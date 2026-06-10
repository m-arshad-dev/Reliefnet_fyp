import { Request, RequestHandler } from 'express';
import * as taskService from '../services/task.service';
import { ForbiddenError } from '../lib/errors';
import type { TaskTransitionTarget } from '../lib/taskConstants';

// Tasks are tenant-owned AND private per NGO: pull the NGO from the verified JWT, never the
// body. A global account (system_admin/auditor, ngoId = null) has no tenant to scope to —
// reject. (authorize already blocks them on the gated routes; this is defense in depth.)
function requireTenant(req: Request): string {
  const ngoId = req.tenant?.ngoId ?? null;
  if (!ngoId) {
    throw new ForbiddenError('This action requires an NGO-scoped account');
  }
  return ngoId;
}

// POST /tasks — create a task (starts at 'created'; assignedTo may be pre-filled).
export const create: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const data = await taskService.createTask(ngoId, req.body, req.user!.sub);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// PATCH /tasks/:id/transition — move the task through the FSM. The actor's role is passed so
// the service can enforce the per-edge permission map itself (this endpoint is NOT gated by a
// single authorize() — see tasks.routes.ts). FSM legality (422), per-edge auth (403), the
// rejection cap → escalation, and the genesis/history append all live in the service.
export const transition: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const { id } = req.params as { id: string };
    const body = req.body as { toStatus: TaskTransitionTarget; note?: string; assignedTo?: string };
    const data = await taskService.transitionTask(ngoId, id, body, {
      id: req.user!.sub,
      role: req.user!.role,
    });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /tasks?status=&assignedTo= — tenant-scoped list (status='escalated' is the stuck-task queue).
export const list: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const q = req.query as unknown as {
      status?: string;
      assignedTo?: string;
      limit?: number;
      cursor?: string;
    };
    const data = await taskService.listTasks(ngoId, {
      status: q.status,
      assignedTo: q.assignedTo,
      limit: q.limit,
      cursor: q.cursor,
    });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /tasks/:id/history — a task's immutable transition history (tenant-scoped; 404 if the
// task isn't the caller's).
export const history: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const { id } = req.params as { id: string };
    const q = req.query as unknown as { limit?: number; cursor?: string };
    const data = await taskService.getHistory(ngoId, id, { limit: q.limit, cursor: q.cursor });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
