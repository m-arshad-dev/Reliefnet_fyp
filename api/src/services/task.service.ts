import * as taskRepo from '../repositories/task.repository';
import type { TaskRow } from '../repositories/task.repository';
import * as transitionRepo from '../repositories/taskTransition.repository';
import type { TransitionRow } from '../repositories/taskTransition.repository';
import * as campaignRepo from '../repositories/campaign.repository';
import * as userRepo from '../repositories/user.repository';
import { withTenant } from '../db/pool';
import { ForbiddenError, NotFoundError, ValidationError, isForeignKeyViolation } from '../lib/errors';
import { hasPermission } from '../lib/permissions';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';
import type { TaskTransitionTarget } from '../lib/taskConstants';

// ── The task FSM (CLAUDE.md law 3) ─────────────────────────────────────────────────
// The service rejects any (from → to) not in this map (422). 'created' is the create-time
// entry state (set on insert). 'escalated' is NOT a requestable target — it is reached ONLY
// via the rejection-cap redirect below; it appears here only as a FROM state for the manual
// reset (escalated → assigned). 'completed' is terminal.
const TASK_TRANSITIONS: Record<string, string[]> = {
  created: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['pending_verification'],
  pending_verification: ['completed', 'rejected'],
  rejected: ['assigned'], // reassign (only reachable while rejection_count < 3)
  escalated: ['assigned'], // manual coordinator/admin reset
  completed: [],
};

// ── Per-edge authorization (the auth business rule lives in the SERVICE, law 2/3) ───────────
// No single permission is held by BOTH volunteers and coordinators, so the PATCH route can't
// gate this with one authorize() — instead each (from→to) edge declares the permission it
// needs and transitionTask enforces it (403), exactly as inventory.service enforces its
// ngo_admin correction guard inline. execute-side = volunteer (task:execute); the manage-side
// assign/verify/reassign = coordinator/admin (task:create); the escalated reset = task:escalate.
const EDGE_PERMISSIONS: Record<string, string> = {
  'created->assigned': 'task:create', // coordinator/admin dispatch
  'assigned->in_progress': 'task:execute', // volunteer
  'in_progress->pending_verification': 'task:execute', // volunteer
  'pending_verification->completed': 'task:create', // coordinator/admin verify-accept
  'pending_verification->rejected': 'task:create', // coordinator/admin verify-reject
  'rejected->assigned': 'task:create', // coordinator/admin reassign
  'escalated->assigned': 'task:escalate', // coordinator/admin reset
};

// The 3rd rejection is silently redirected to 'escalated' instead of 'rejected'.
const REJECTION_CAP = 3;

// Client-safe task projection (camelCase).
export interface PublicTask {
  id: string;
  ngoId: string;
  campaignId: string;
  title: string;
  description: string | null;
  locationId: string | null;
  status: string;
  rejectionCount: number;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function toPublicTask(row: TaskRow): PublicTask {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    locationId: row.location_id,
    status: row.status,
    rejectionCount: row.rejection_count,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface PublicTransition {
  id: string;
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string;
  note: string | null;
  createdAt: string;
}

function toPublicTransition(row: TransitionRow): PublicTransition {
  return {
    id: row.id,
    taskId: row.task_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  };
}

interface Actor {
  id: string;
  role: string;
}

// Validate an assignee is a real, active user in the caller's NGO (422 otherwise). Used at
// create-time and on the assign edges. A 422 (not 404) so we never reveal whether a given
// user id exists in another tenant.
async function resolveAssignee(tenantNgoId: string, assignedTo: string): Promise<string> {
  const user = await userRepo.findById(assignedTo);
  if (!user || user.ngo_id !== tenantNgoId || !user.is_active) {
    throw new ValidationError('Assignee must be an active user in your NGO');
  }
  return user.id;
}

interface CreateTaskInput {
  campaignId: string;
  title: string;
  description?: string;
  locationId?: string;
  assignedTo?: string;
}

// POST /tasks — tenant-owned (ngo_id + created_by forced from the JWT, never the body). The
// task nests under a campaign that must belong to the caller's NGO (404 otherwise — never
// write a task against another tenant's campaign). A new task starts at 'created'; assignedTo
// may be pre-filled here (validated). create + genesis history row are ONE withTransaction
// (law 4) so the lineage is complete from birth.
export async function createTask(
  tenantNgoId: string,
  input: CreateTaskInput,
  actorId: string,
): Promise<PublicTask> {
  try {
    return await withTenant(tenantNgoId, async (client) => {
      // The campaign read happens inside the tenant txn so RLS (tenant_rw) scopes it; the
      // app-layer ngo_id guard stays as the second wall. resolveAssignee reads `users` (an
      // RLS-excluded table) so it runs on the pool — unaffected by the tenant GUC.
      const campaign = await campaignRepo.findById(input.campaignId, client);
      if (!campaign || campaign.ngo_id !== tenantNgoId) {
        throw new NotFoundError('Campaign not found');
      }

      const assignedTo = input.assignedTo
        ? await resolveAssignee(tenantNgoId, input.assignedTo)
        : null;

      const task = await taskRepo.insert(
        {
          ngoId: tenantNgoId,
          campaignId: input.campaignId,
          title: input.title,
          description: input.description ?? null,
          locationId: input.locationId ?? null,
          assignedTo,
          createdBy: actorId,
        },
        client,
      );
      // Genesis row: the lineage starts at NULL -> 'created'.
      await transitionRepo.insert(
        { taskId: task.id, fromStatus: null, toStatus: 'created', actorId, note: null },
        client,
      );
      return toPublicTask(task);
    });
  } catch (err) {
    // A bad location_id (FK 23503) surfaces as a 422 rather than a raw 500.
    if (isForeignKeyViolation(err)) {
      throw new ValidationError('Referenced location does not exist');
    }
    throw err;
  }
}

interface TransitionInput {
  toStatus: TaskTransitionTarget;
  note?: string;
  assignedTo?: string;
}

// THE CRUX OF THE SLICE (laws 3 & 4). One withTransaction: lock the task, validate the FSM,
// enforce the per-edge permission, resolve the assignee on assign edges, apply the rejection
// cap, then UPDATE the task AND append ONE immutable history row — all commit together or
// roll back together. `tenantNgoId` is the caller's NGO from the JWT — the task must belong
// to it (404 otherwise, never reveal another tenant's task). The FOR-UPDATE lock serializes
// concurrent transitions so the FSM + rejection-cap check can't be raced.
export async function transitionTask(
  tenantNgoId: string,
  taskId: string,
  input: TransitionInput,
  actor: Actor,
): Promise<PublicTask> {
  return withTenant(tenantNgoId, async (client) => {
    const task = await taskRepo.findByIdForUpdate(taskId, client);
    if (!task || task.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Task not found');
    }

    const { toStatus } = input;

    // 1) FSM legality — validate the REQUESTED transition (the cap redirect happens after).
    const allowed = TASK_TRANSITIONS[task.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ValidationError(`Illegal task transition from '${task.status}' to '${toStatus}'`);
    }

    // 2) Per-edge authorization (business rule in the service, not the route).
    const requiredPerm = EDGE_PERMISSIONS[`${task.status}->${toStatus}`];
    if (!requiredPerm || !hasPermission(actor.role, requiredPerm)) {
      throw new ForbiddenError('You do not have permission to perform this transition');
    }

    // 3) Resolve the assignee on assign edges only; other edges leave it untouched.
    let assignedTo = task.assigned_to;
    if (toStatus === 'assigned') {
      if (input.assignedTo) {
        assignedTo = await resolveAssignee(tenantNgoId, input.assignedTo);
      }
      if (!assignedTo) {
        throw new ValidationError('An assignee is required to assign this task');
      }
    }

    // 4) Rejection cap — the slice's signature twist. The count increments on EVERY rejection
    // and is never reset; when it reaches the cap the APPLIED status becomes 'escalated'
    // instead of 'rejected' (so once at the cap, any further rejection re-escalates).
    let appliedStatus: string = toStatus;
    let rejectionCount = task.rejection_count;
    if (toStatus === 'rejected') {
      rejectionCount = task.rejection_count + 1;
      appliedStatus = rejectionCount >= REJECTION_CAP ? 'escalated' : 'rejected';
    }

    const updated = await taskRepo.update(
      taskId,
      { status: appliedStatus, rejectionCount, assignedTo },
      client,
    );

    // 5) Append the immutable history row — recording the APPLIED status (so a capped
    // rejection shows ... -> 'escalated'), keeping the audit trail faithful.
    await transitionRepo.insert(
      {
        taskId,
        fromStatus: task.status,
        toStatus: appliedStatus,
        actorId: actor.id,
        note: input.note ?? null,
      },
      client,
    );

    return toPublicTask(updated);
  });
}

// GET /tasks?status=&assignedTo= — tenant-scoped keyset page. The escalated queue is just
// this with status='escalated'.
export async function listTasks(
  tenantNgoId: string,
  opts: { status?: string; assignedTo?: string; limit?: number; cursor?: string },
): Promise<Page<PublicTask>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await withTenant(tenantNgoId, (client) =>
    taskRepo.listByNgo(
      tenantNgoId,
      { limit, cursor, status: opts.status, assignedTo: opts.assignedTo },
      client,
    ),
  );
  return buildPage(rows, limit, toPublicTask);
}

// GET /tasks/:id/history — a task's append-only transition history. The task must belong to
// the caller's NGO (404 otherwise) before we expose any history.
export async function getHistory(
  tenantNgoId: string,
  taskId: string,
  opts: { limit?: number; cursor?: string },
): Promise<Page<PublicTransition>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  return withTenant(tenantNgoId, async (client) => {
    const task = await taskRepo.findById(taskId, client);
    if (!task || task.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Task not found');
    }
    const rows = await transitionRepo.listByTask(taskId, { limit, cursor }, client);
    return buildPage(rows, limit, toPublicTransition);
  });
}
