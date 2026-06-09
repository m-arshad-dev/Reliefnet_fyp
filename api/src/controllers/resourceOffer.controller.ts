import { Request, RequestHandler } from 'express';
import * as offerService from '../services/resourceOffer.service';
import { ForbiddenError } from '../lib/errors';

// WRITES are tenant-owned: pull the NGO from the verified JWT, never the body. A global
// account (ngoId = null) has no tenant to scope to — reject. (authorize already blocks
// non-ngo_admins; this is defense in depth.)
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
    const data = await offerService.createOffer(ngoId, req.body, req.user!.sub);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// READ is CROSS-TENANT by design — it does NOT call requireTenant. The board shows
// shared, available offers from ALL NGOs in a disaster, and a system_admin (tenantless)
// must be able to read it. `board:read` gates access; the disaster scopes it.
export const list: RequestHandler = async (req, res, next) => {
  try {
    // Validated by listOffersQuerySchema (disasterId required, limit coerced to number).
    const q = req.query as unknown as {
      disasterId: string;
      status?: string;
      type?: string;
      locationId?: string;
      limit?: number;
      cursor?: string;
    };
    const data = await offerService.listSharedOffers({
      disasterId: q.disasterId,
      status: q.status,
      type: q.type,
      locationId: q.locationId,
      limit: q.limit,
      cursor: q.cursor,
    });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
