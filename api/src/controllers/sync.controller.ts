import { Request, RequestHandler } from 'express';
import * as syncService from '../services/sync.service';
import type { PushOpInput, ResolveInput } from '../services/sync.service';
import { ForbiddenError } from '../lib/errors';

// Sync is tenant-scoped: the NGO comes from the verified JWT, never the body — a device only
// ever pushes/pulls/reconciles its own NGO's queue (RLS enforces it at the DB too). A global
// account (system_admin/auditor, ngoId=null) has no tenant to scope to → reject.
function requireTenant(req: Request): string {
  const ngoId = req.tenant?.ngoId ?? null;
  if (!ngoId) {
    throw new ForbiddenError('This action requires an NGO-scoped account');
  }
  return ngoId;
}

function actor(req: Request): { id: string; role: string } {
  return { id: req.user!.sub, role: req.user!.role };
}

// POST /sync/push — drain the device outbox. Idempotent per client_uuid; returns a per-op status
// (merged | conflict | rejected | duplicate) so the device can clear/badge each op.
export const push: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const { ops } = req.body as { ops: PushOpInput[] };
    const results = await syncService.push(ngoId, actor(req), ops);
    res.status(200).json({ success: true, data: { results }, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /sync/pull?since_seq=&limit= — server changes since the device's stored cursor, ordered by
// the monotonic seq (NEVER a timestamp). maxSeq is the new cursor the device stores.
export const pull: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const q = req.query as unknown as { since_seq?: string; limit?: number };
    const data = await syncService.pull(ngoId, q.since_seq ?? '0', q.limit);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /sync/conflicts — the web reconciliation list (keyset paginated). Coordinator/admin only.
export const conflicts: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const q = req.query as unknown as { limit?: number; cursor?: string };
    const data = await syncService.listConflicts(ngoId, { limit: q.limit, cursor: q.cursor });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// POST /sync/conflicts/:id/resolve — a human settles a conflict (keep_server|keep_client|merge).
export const resolve: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const { id } = req.params as { id: string };
    const data = await syncService.resolve(ngoId, actor(req), id, req.body as ResolveInput);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
