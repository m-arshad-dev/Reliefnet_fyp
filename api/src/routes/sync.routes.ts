import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as syncController from '../controllers/sync.controller';
import { AID_TYPES } from '../lib/beneficiaryConstants';
import { TASK_STATUSES, TASK_TRANSITION_TARGETS } from '../lib/taskConstants';

const router = Router();

// Per-op payloads are validated by entity type (discriminated union) so a malformed offline op is
// rejected at the boundary, not deep in a service. Zod owns SHAPE; the FSM legality / dup-flag /
// conflict detection all live in the service (laws 2 & 3). clientCreatedAt is the device clock —
// accepted as an opaque string because it is advisory metadata only (never the cursor).
const registerPayload = z.object({
  cnic: z.string().min(1),
  fullName: z.string().min(1),
  householdSize: z.number().int().positive().optional(),
  locationId: z.string().uuid().optional(),
  contactMasked: z.string().optional(),
  campaignId: z.string().uuid(),
  aidType: z.enum(AID_TYPES),
});

const transitionPayload = z.object({
  toStatus: z.enum(TASK_TRANSITION_TARGETS),
  note: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
});

const pushOpSchema = z.discriminatedUnion('entityType', [
  z.object({
    clientUuid: z.string().uuid(),
    entityType: z.literal('beneficiary'),
    clientCreatedAt: z.string().min(1),
    payload: registerPayload,
  }),
  z.object({
    clientUuid: z.string().uuid(),
    entityType: z.literal('task_transition'),
    clientCreatedAt: z.string().min(1),
    entityId: z.string().uuid(),
    baseStatus: z.enum(TASK_STATUSES),
    payload: transitionPayload,
  }),
  z.object({
    clientUuid: z.string().uuid(),
    entityType: z.literal('beneficiary_verify'),
    clientCreatedAt: z.string().min(1),
    entityId: z.string().uuid(),
    baseVerified: z.boolean(),
    payload: z.object({}).optional().default({}),
  }),
]);

const pushSchema = z.object({ ops: z.array(pushOpSchema).min(1).max(200) });

const pullQuerySchema = z.object({
  since_seq: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const conflictsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

const resolveSchema = z.object({
  resolution: z.enum(['keep_server', 'keep_client', 'merge']),
  mergedPayload: z.record(z.unknown()).optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

// Field roles (volunteer/field_coordinator) capture offline and sync.
router.post('/push', authorize('sync:push'), validate(pushSchema), syncController.push);
router.get('/pull', authorize('sync:pull'), validate(pullQuerySchema, 'query'), syncController.pull);

// Reconciliation is a coordinator/admin web action (sync:resolve).
router.get('/conflicts', authorize('sync:resolve'), validate(conflictsQuerySchema, 'query'), syncController.conflicts);
router.post(
  '/conflicts/:id/resolve',
  authorize('sync:resolve'),
  validate(idParamSchema, 'params'),
  validate(resolveSchema, 'body'),
  syncController.resolve,
);

export default router;
