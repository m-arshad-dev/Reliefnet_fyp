import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as inventoryController from '../controllers/inventory.controller';
import { ITEM_UNITS, MOVEMENT_STATES, FORWARD_STATES } from '../lib/inventoryConstants';

const router = Router();

// No `ngoId` field — the NGO is forced from the JWT.
const createItemSchema = z.object({
  name: z.string().min(1),
  unit: z.enum(ITEM_UNITS),
});

// Zod owns SHAPE only (types/enums/uuid/nonzero). The FSM legality, the ngo_admin correction
// guard (403), the mandatory note (422) and the availability check (422) all live in the
// SERVICE (law 3) — so those statuses come from there exactly as the DoD specifies.
const createMovementSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().refine((n) => n !== 0, 'Quantity must be nonzero'),
  toState: z.enum(MOVEMENT_STATES),
  prevState: z.enum(FORWARD_STATES).optional(),
  correctionNote: z.string().optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// itemId is required — movement history is always scoped to one item.
const movementsQuerySchema = z.object({
  itemId: z.string().uuid(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

// Inventory is ngo_admin-only this slice (private per NGO). `inventory:manage` gates every
// endpoint; corrections are additionally gated by the service's ngo_admin role check.
router.post('/items', authorize('inventory:manage'), validate(createItemSchema), inventoryController.createItem);
router.get('/items', authorize('inventory:manage'), validate(listQuerySchema, 'query'), inventoryController.listItems);
router.post(
  '/movements',
  authorize('inventory:manage'),
  validate(createMovementSchema),
  inventoryController.createMovement,
);
router.get(
  '/movements',
  authorize('inventory:manage'),
  validate(movementsQuerySchema, 'query'),
  inventoryController.listMovements,
);

export default router;
