import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as matchController from '../controllers/resourceMatch.controller';
import { MATCH_STATUSES, MATCH_TRANSITION_TARGETS } from '../lib/coordinationConstants';

const router = Router();

// No NGO/status fields — the owning NGO is forced from the JWT and a new match always
// starts at 'proposed'. `quantity` is optional (defaults to the need's quantity in the
// service, bounded by the offer's quantity).
const proposeSchema = z.object({
  needId: z.string().uuid(),
  offerId: z.string().uuid(),
  quantity: z.number().int().positive().optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });
// PATCH targets only — 'proposed' is the create-time entry state, never a transition.
const statusBodySchema = z.object({ status: z.enum(MATCH_TRANSITION_TARGETS) });

// Tenant-scoped list filters. All optional; the controller scopes to the caller's NGO.
const listQuerySchema = z.object({
  disasterId: z.string().uuid().optional(),
  needId: z.string().uuid().optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

// Writes are driven by the NEEDING NGO. Reads use `match:read`, never a write permission.
router.post('/', authorize('match:propose'), validate(proposeSchema), matchController.create);
router.patch(
  '/:id/status',
  authorize('match:confirm'),
  validate(idParamSchema, 'params'),
  validate(statusBodySchema, 'body'),
  matchController.setStatus,
);
router.get('/', authorize('match:read'), validate(listQuerySchema, 'query'), matchController.list);

export default router;
