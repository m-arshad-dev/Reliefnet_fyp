import { Request, RequestHandler } from 'express';
import * as userService from '../services/user.service';
import { ForbiddenError } from '../lib/errors';

// Staff endpoints are tenant-scoped: pull the NGO from the verified JWT, never the
// body. A global account (system_admin/auditor, ngoId = null) has no tenant to scope
// to — reject rather than guess. (authorize('user:manage') already blocks them, so
// this is defense in depth.)
function requireTenant(req: Request): string {
  const ngoId = req.tenant?.ngoId ?? null;
  if (!ngoId) {
    throw new ForbiddenError('This action requires an NGO-scoped account');
  }
  return ngoId;
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const data = await userService.createStaff(ngoId, req.body);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const q = req.query as { limit?: number; cursor?: string };
    const data = await userService.listStaff(ngoId, { limit: q.limit, cursor: q.cursor });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
