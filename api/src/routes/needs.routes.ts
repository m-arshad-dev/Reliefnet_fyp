import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as needController from '../controllers/resourceNeed.controller';
import * as matchController from '../controllers/resourceMatch.controller';
import { RESOURCE_TYPES, NEED_PRIORITIES, NEED_STATUSES } from '../lib/coordinationConstants';

const router = Router();

// No `ngoId` field — the owning NGO is forced from the JWT in the service, never the body.
const createNeedSchema = z.object({
  disasterId: z.string().uuid(),
  type: z.enum(RESOURCE_TYPES),
  quantity: z.number().int().positive(),
  locationId: z.string().uuid().optional(),
  priority: z.enum(NEED_PRIORITIES).optional(),
  description: z.string().min(1).optional(),
});

// `disasterId` is REQUIRED: the board is always scoped to one disaster. The cross-NGO
// read returns open needs from every NGO in that disaster; type/region narrow it.
const listNeedsQuerySchema = z.object({
  disasterId: z.string().uuid(),
  status: z.enum(NEED_STATUSES).optional(),
  type: z.enum(RESOURCE_TYPES).optional(),
  locationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// Slice 4 — match candidates for a need. `:id/candidates` is a CROSS-TENANT suggestion
// read (offers from OTHER NGOs matching this need), so it's gated by `match:read`, never a
// write permission. Region is an optional soft filter.
const idParamSchema = z.object({ id: z.string().uuid() });
const candidatesQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

// POST is tenant-owned (field_coordinator raises a need for THEIR NGO).
router.post('/', authorize('need:create'), validate(createNeedSchema), needController.create);
// GET is CROSS-TENANT (the shared board). Gated by `board:read`, never a create perm.
router.get('/', authorize('board:read'), validate(listNeedsQuerySchema, 'query'), needController.list);
router.get(
  '/:id/candidates',
  authorize('match:read'),
  validate(idParamSchema, 'params'),
  validate(candidatesQuerySchema, 'query'),
  matchController.candidates,
);

export default router;
