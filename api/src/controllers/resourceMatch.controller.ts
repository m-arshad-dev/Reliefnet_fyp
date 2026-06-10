import { Request, RequestHandler } from 'express';
import * as matchService from '../services/resourceMatch.service';
import { ForbiddenError } from '../lib/errors';
import type { MatchTransitionTarget } from '../lib/coordinationConstants';

// WRITES are tenant-owned: the needing NGO drives, pulled from the verified JWT (never the
// body). A global account (ngoId = null) has no tenant to scope to — reject. (authorize
// already blocks non-propose/confirm roles; this is defense in depth.)
function requireTenant(req: Request): string {
  const ngoId = req.tenant?.ngoId ?? null;
  if (!ngoId) {
    throw new ForbiddenError('This action requires an NGO-scoped account');
  }
  return ngoId;
}

// GET /needs/:id/candidates — CROSS-TENANT suggestions (offers from OTHER NGOs that match
// this need). Pure read, no tenant required: gated by `match:read`; the need scopes it.
export const candidates: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const q = req.query as unknown as { locationId?: string; limit?: number; cursor?: string };
    const data = await matchService.getCandidates(id, {
      locationId: q.locationId,
      limit: q.limit,
      cursor: q.cursor,
    });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// POST /matches — the human CONFIRM: inserts the match and moves the need + offer in one
// transaction (the crux). Tenant-owned: the need must belong to the caller's NGO.
export const create: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const data = await matchService.proposeMatch(ngoId, req.body, req.user!.sub);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// PATCH /matches/:id/status — advance (accepted/fulfilled) or reject. Need + offer move in
// lockstep, in one transaction. Only the needing NGO may transition.
export const setStatus: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: MatchTransitionTarget };
    const data = await matchService.transitionMatch(ngoId, id, status, req.user!.sub);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /matches — tenant-scoped to matches the caller's NGO participates in (either side).
// A tenantless account (system_admin/auditor) simply gets an empty page (they oversee via
// the board), so we never 403 a permitted reader here.
export const list: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = req.tenant?.ngoId ?? null;
    if (!ngoId) {
      res.status(200).json({ success: true, data: { items: [], nextCursor: null }, error: null });
      return;
    }
    const q = req.query as unknown as {
      disasterId?: string;
      needId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    };
    const data = await matchService.listMatches(ngoId, {
      disasterId: q.disasterId,
      needId: q.needId,
      status: q.status,
      limit: q.limit,
      cursor: q.cursor,
    });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
