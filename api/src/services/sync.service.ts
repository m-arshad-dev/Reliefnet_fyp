import { PoolClient } from 'pg';
import { withTenant, withTenantShared } from '../db/pool';
import * as syncRepo from '../repositories/sync.repository';
import type { SyncQueueRow, ConflictListRow } from '../repositories/sync.repository';
import * as taskService from './task.service';
import * as beneficiaryService from './beneficiary.service';
import type { RegisterBeneficiaryInput } from './beneficiary.service';
import type { Actor } from './task.service';
import * as taskRepo from '../repositories/task.repository';
import * as beneficiaryRepo from '../repositories/beneficiary.repository';
import * as auditService from './audit.service';
import { AppError, NotFoundError, ValidationError } from '../lib/errors';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';
import type { TaskTransitionTarget } from '../lib/taskConstants';

// Slice 12 — the offline-sync engine (v2 §4.7, §5.7, §6.4). The mobile field client captures
// writes offline in a local outbox, then replays them here on reconnect. This service is the
// ONLY place that knows how an offline op maps onto a domain write — and it does that by calling
// the SAME service cores the online endpoints use (beneficiaryService.applyRegister/applyVerify,
// taskService.applyTransition), so a replayed op runs the identical FSM, dup-flag, RLS and audit
// as a live request (law 2: the rules live in one place). Three invariants are enforced here:
//   • IDEMPOTENCY — a replayed client_uuid is a no-op that returns the prior outcome.
//   • SEQ CURSOR  — pull is ordered by the server-assigned monotonic seq, never a clock.
//   • HUMAN CONFLICTS — a base-mismatch op is PARKED (status='conflict'); a coordinator settles
//                       it on the web, never the device.

// The op types the mobile outbox produces (Slice 11 exposes only these field writes; inventory
// was dropped for field roles, so stock_movement is a documented-but-unwired future op type).
export type SyncEntityType = 'beneficiary' | 'task_transition' | 'beneficiary_verify';

export interface PushOpInput {
  clientUuid: string;
  entityType: SyncEntityType;
  clientCreatedAt: string; // device clock — advisory metadata ONLY (never the cursor)
  payload: Record<string, unknown>;
  entityId?: string; // target server entity (task / beneficiary) for transition & verify
  baseStatus?: string; // task status the device saw — the optimistic-concurrency base
  baseVerified?: boolean; // beneficiary.verified the device saw — the base for verify
}

export type OpOutcome = 'merged' | 'conflict' | 'rejected' | 'duplicate';

export interface PushOpResult {
  clientUuid: string;
  status: OpOutcome;
  seq: string | null;
  entityId: string | null;
  conflictId?: string;
  duplicate?: boolean;
  reason?: string;
}

// ── PUSH ────────────────────────────────────────────────────────────────────────────────────
// Each op is processed in its OWN transaction (mixed op types need different RLS helpers; per-op
// atomicity means one bad op can't roll back its neighbours). Ops are applied in array order.
export async function push(
  tenantNgoId: string,
  actor: Actor,
  ops: PushOpInput[],
): Promise<PushOpResult[]> {
  const results: PushOpResult[] = [];
  for (const op of ops) {
    results.push(await processOp(tenantNgoId, actor, op));
  }
  return results;
}

async function processOp(
  tenantNgoId: string,
  actor: Actor,
  op: PushOpInput,
): Promise<PushOpResult> {
  // beneficiary.register reads the cross-NGO prior-aid hash → withTenantShared; everything else
  // touches only own-tenant rows → withTenant.
  const run = op.entityType === 'beneficiary' ? withTenantShared : withTenant;
  return run(tenantNgoId, async (client) => {
    // The payload we persist for forensics + the web diff: the domain fields plus the captured
    // base, so a conflict's "client side" shows what the device intended.
    const storedPayload = {
      ...op.payload,
      ...(op.baseStatus !== undefined ? { baseStatus: op.baseStatus } : {}),
      ...(op.baseVerified !== undefined ? { baseVerified: op.baseVerified } : {}),
    };

    // Idempotency gate: ON CONFLICT (client_uuid) DO NOTHING. No row back ⇒ this client_uuid was
    // already processed ⇒ return the PRIOR outcome, write nothing (retry-on-reconnect is safe).
    const inserted = await syncRepo.insertOp(
      {
        ngoId: tenantNgoId,
        clientUuid: op.clientUuid,
        entityType: op.entityType,
        payload: storedPayload,
        clientCreatedAt: op.clientCreatedAt,
      },
      client,
    );
    if (!inserted) {
      const prior = await syncRepo.findByClientUuid(op.clientUuid, client);
      return {
        clientUuid: op.clientUuid,
        status: 'duplicate',
        seq: prior?.seq ?? null,
        entityId: prior?.entity_id ?? null,
        conflictId: prior?.status === 'conflict' ? prior.id : undefined,
        duplicate: true,
      };
    }

    // Apply the domain write under a SAVEPOINT so a domain-rule failure (illegal edge, unknown
    // campaign) rolls back ONLY the attempted write — the sync_queue row + its 'rejected' status
    // still commit, making the outcome durable and idempotent. A conflict is a clean, non-throw
    // path (no domain write attempted).
    await client.query('SAVEPOINT sync_op');
    try {
      const outcome = await dispatch(client, tenantNgoId, actor, op);
      if (outcome.kind === 'conflict') {
        await syncRepo.markConflict(
          inserted.id,
          { entityId: outcome.entityId, conflictWith: outcome.entityId, serverSnapshot: outcome.serverSnapshot },
          client,
        );
        return {
          clientUuid: op.clientUuid,
          status: 'conflict',
          seq: inserted.seq,
          entityId: outcome.entityId,
          conflictId: inserted.id,
        };
      }
      await syncRepo.markMerged(inserted.id, { entityId: outcome.entityId, result: outcome.result }, client);
      return { clientUuid: op.clientUuid, status: 'merged', seq: inserted.seq, entityId: outcome.entityId };
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sync_op');
      // A domain-rule rejection is recorded durably; anything else (infra/bug) bubbles so the
      // whole op txn rolls back and the device retries the batch.
      if (err instanceof AppError) {
        await syncRepo.markRejected(inserted.id, err.message, client);
        return { clientUuid: op.clientUuid, status: 'rejected', seq: inserted.seq, entityId: null, reason: err.message };
      }
      throw err;
    }
  });
}

interface DispatchOutcome {
  kind: 'merged' | 'conflict';
  entityId: string | null;
  result?: unknown;
  serverSnapshot?: unknown;
}

// Map one op onto a domain write. The conflict rule is a single idea — OPTIMISTIC-CONCURRENCY
// BASE MISMATCH: the op was captured against a base (a task's status / a beneficiary's verified
// flag) that the server has since moved past. Append-only creates (register) have no base, so
// they never conflict.
async function dispatch(
  client: PoolClient,
  tenantNgoId: string,
  actor: Actor,
  op: PushOpInput,
): Promise<DispatchOutcome> {
  switch (op.entityType) {
    case 'beneficiary': {
      // Append-only create → always merges (a duplicate CNIC is a FLAG, never a conflict; the
      // dup engine inside applyRegister handles it). Throws → savepoint catch → 'rejected'.
      const result = await beneficiaryService.applyRegister(
        client,
        tenantNgoId,
        op.payload as unknown as RegisterBeneficiaryInput,
        actor.id,
      );
      return { kind: 'merged', entityId: result.beneficiary.id, result };
    }

    case 'task_transition': {
      const taskId = op.entityId;
      if (!taskId) throw new ValidationError('task_transition op requires entityId');
      const task = await taskRepo.findByIdForUpdate(taskId, client);
      if (!task || task.ngo_id !== tenantNgoId) {
        throw new NotFoundError('Task not found');
      }
      // CONFLICT: the device's base status no longer matches the server's current status →
      // park for human resolution; do NOT apply. Snapshot the server task for the diff.
      if (task.status !== op.baseStatus) {
        return { kind: 'conflict', entityId: taskId, serverSnapshot: taskService.toPublicTask(task) };
      }
      // Base matched → run the identical online FSM path (legality, per-edge auth, rejection cap,
      // history, audit). An illegal edge / missing perm throws → savepoint catch → 'rejected'.
      const payload = op.payload as { toStatus: TaskTransitionTarget; note?: string; assignedTo?: string };
      const result = await taskService.applyTransition(
        client,
        tenantNgoId,
        taskId,
        { toStatus: payload.toStatus, note: payload.note, assignedTo: payload.assignedTo },
        actor,
      );
      return { kind: 'merged', entityId: taskId, result };
    }

    case 'beneficiary_verify': {
      const benId = op.entityId;
      if (!benId) throw new ValidationError('beneficiary_verify op requires entityId');
      const ben = await beneficiaryRepo.findByIdForUpdate(benId, client);
      if (!ben || ben.ngo_id !== tenantNgoId) {
        throw new NotFoundError('Beneficiary not found');
      }
      if (ben.verified !== op.baseVerified) {
        return {
          kind: 'conflict',
          entityId: benId,
          serverSnapshot: beneficiaryService.toPublicBeneficiary(ben),
        };
      }
      const result = await beneficiaryService.applyVerify(client, tenantNgoId, benId, actor.id);
      return { kind: 'merged', entityId: benId, result };
    }

    default:
      throw new ValidationError(`Unknown sync entity type '${op.entityType as string}'`);
  }
}

// ── PULL (the cursor contract) ────────────────────────────────────────────────────────────────
export interface PulledOp {
  seq: string;
  clientUuid: string;
  entityType: string;
  entityId: string | null;
  status: string;
  result: unknown;
}

export async function pull(
  tenantNgoId: string,
  sinceSeq: string,
  limit?: number,
): Promise<{ ops: PulledOp[]; maxSeq: string }> {
  const cappedLimit = clampLimit(limit);
  const rows = await withTenant(tenantNgoId, (client) =>
    syncRepo.pullSince(tenantNgoId, sinceSeq, cappedLimit, client),
  );
  const ops: PulledOp[] = rows.map((r) => ({
    seq: r.seq,
    clientUuid: r.client_uuid,
    entityType: r.entity_type,
    entityId: r.entity_id,
    status: r.status,
    result: r.result,
  }));
  // rows are seq-ASC; the last is the highest seq the device should store as its new cursor.
  const maxSeq = rows.length ? rows[rows.length - 1].seq : sinceSeq;
  return { ops, maxSeq };
}

// ── CONFLICTS (web reconciliation read) ────────────────────────────────────────────────────────
export interface PublicConflict {
  conflictId: string;
  entityType: string;
  entityId: string | null;
  conflictWith: string | null;
  clientPayload: unknown; // what the device intended (the diff's "client" side)
  serverSnapshot: unknown; // the current server entity (the diff's "server" side)
  clientCreatedAt: string;
  receivedAt: string;
}

function toPublicConflict(row: ConflictListRow): PublicConflict {
  return {
    conflictId: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    conflictWith: row.conflict_with,
    clientPayload: row.payload,
    serverSnapshot: row.server_snapshot,
    clientCreatedAt: row.client_created_at.toISOString(),
    receivedAt: row.created_at.toISOString(),
  };
}

export async function listConflicts(
  tenantNgoId: string,
  opts: { limit?: number; cursor?: string },
): Promise<Page<PublicConflict>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await withTenant(tenantNgoId, (client) =>
    syncRepo.listConflicts(tenantNgoId, { limit, cursor }, client),
  );
  return buildPage(rows, limit, toPublicConflict);
}

// ── RESOLVE (web only — human decision) ─────────────────────────────────────────────────────────
export interface ResolveInput {
  resolution: 'keep_server' | 'keep_client' | 'merge';
  mergedPayload?: Record<string, unknown>;
}

export interface ResolveResult {
  conflictId: string;
  resolution: string;
  status: 'resolved';
  seq: string;
  result: unknown;
}

export async function resolve(
  tenantNgoId: string,
  actor: Actor,
  conflictId: string,
  input: ResolveInput,
): Promise<ResolveResult> {
  return withTenant(tenantNgoId, async (client) => {
    const row = await syncRepo.findOpenConflict(conflictId, client);
    if (!row) {
      throw new NotFoundError('Conflict not found');
    }

    const result = await applyResolution(client, tenantNgoId, actor, row, input);

    // Re-stamp seq so the settled op re-enters the pull feed; the device reconciles by client_uuid.
    const { seq } = await syncRepo.resolveOp(conflictId, { resolvedBy: actor.id, result }, client);

    // The reconciliation DECISION is itself a governance event — recorded on the tamper-evident
    // ledger (force-applied transitions skip the FSM, so this is their only audit trail).
    await auditService.record(client, {
      action: 'sync.conflict.resolve',
      entityType: 'sync_conflict',
      entityId: conflictId,
      metadata: {
        resolution: input.resolution,
        targetEntityType: row.entity_type,
        targetEntityId: row.entity_id,
      },
      actorId: actor.id,
      ngoId: tenantNgoId,
    });

    return { conflictId, resolution: input.resolution, status: 'resolved', seq, result };
  });
}

async function applyResolution(
  client: PoolClient,
  tenantNgoId: string,
  actor: Actor,
  row: SyncQueueRow,
  input: ResolveInput,
): Promise<unknown> {
  // keep_server: the server record stands; no domain write, just settle the queue row.
  if (input.resolution === 'keep_server') {
    return row.server_snapshot;
  }

  if (row.entity_type === 'task_transition') {
    const payload = row.payload as { toStatus?: string; note?: string };
    const target =
      input.resolution === 'merge'
        ? String(input.mergedPayload?.status ?? input.mergedPayload?.toStatus ?? '')
        : String(payload.toStatus ?? '');
    if (!target) {
      throw new ValidationError('A target status is required to resolve this conflict');
    }
    const note =
      input.resolution === 'merge'
        ? ((input.mergedPayload?.note as string | undefined) ?? '[reconciled: merge]')
        : `[reconciled: keep_client] ${payload.note ?? ''}`.trim();
    // Human override → force-apply, bypassing the FSM legality / per-edge auth checks.
    return taskService.applyResolvedTransition(client, tenantNgoId, row.entity_id!, target, actor.id, note);
  }

  if (row.entity_type === 'beneficiary_verify') {
    // keep_client / merge → ensure verified; if the server already verified it, accept that.
    try {
      return await beneficiaryService.applyVerify(client, tenantNgoId, row.entity_id!, actor.id);
    } catch (err) {
      if (err instanceof AppError) return row.server_snapshot;
      throw err;
    }
  }

  throw new ValidationError(`Cannot resolve a conflict for entity type '${row.entity_type}'`);
}
