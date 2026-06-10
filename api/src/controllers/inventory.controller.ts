import { Request, RequestHandler } from 'express';
import * as inventoryService from '../services/inventory.service';
import { ForbiddenError } from '../lib/errors';

// Inventory is tenant-owned AND private per NGO: pull the NGO from the verified JWT, never
// the body. A global account (system_admin/auditor, ngoId = null) has no tenant to scope to
// — reject. (authorize already blocks them; this is defense in depth.)
function requireTenant(req: Request): string {
  const ngoId = req.tenant?.ngoId ?? null;
  if (!ngoId) {
    throw new ForbiddenError('This action requires an NGO-scoped account');
  }
  return ngoId;
}

// POST /inventory/items — create a catalogue item (no stock yet; on-hand starts at 0).
export const createItem: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const data = await inventoryService.createItem(ngoId, req.body, req.user!.sub);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /inventory/items — tenant-scoped list with DERIVED quantity-on-hand per item.
export const listItems: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const q = req.query as unknown as { limit?: number; cursor?: string };
    const data = await inventoryService.listItems(ngoId, { limit: q.limit, cursor: q.cursor });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// POST /inventory/movements — append one immutable movement (FSM + correction guard live in
// the service). The actor's role is passed through so the service can enforce the ngo_admin
// correction guard itself (not just the route middleware).
export const createMovement: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const data = await inventoryService.recordMovement(ngoId, req.body, {
      id: req.user!.sub,
      role: req.user!.role,
    });
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /inventory/movements?itemId= — an item's append-only history (tenant-scoped; 404 if
// the item isn't the caller's).
export const listMovements: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const q = req.query as unknown as { itemId: string; limit?: number; cursor?: string };
    const data = await inventoryService.listMovements(ngoId, q.itemId, {
      limit: q.limit,
      cursor: q.cursor,
    });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
