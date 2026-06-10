import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as taskController from '../controllers/task.controller';
import { TASK_STATUSES, TASK_TRANSITION_TARGETS } from '../lib/taskConstants';

const router = Router();

// No `ngoId`/`status` fields — the NGO is forced from the JWT and a new task always starts at
// 'created'. assignedTo is optional (may be pre-filled, or set later on the assign edge).
const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  campaignId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

// Zod owns SHAPE only (enum/uuid). The FSM legality (422), the per-edge permission (403) and
// the rejection cap → escalation all live in the SERVICE (law 3). assignedTo is honored only
// on the assign edges; the service ignores it elsewhere.
const transitionSchema = z.object({
  toStatus: z.enum(TASK_TRANSITION_TARGETS),
  note: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
});

const listQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  assignedTo: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

// Creating a task is a coordinator/admin action (task:create). Reads use task:read, never a
// write permission.
router.post('/', authorize('task:create'), validate(createSchema), taskController.create);

// PATCH transition intentionally has NO authorize() middleware: no single permission is held
// by BOTH volunteers (execute edges) and coordinators (manage edges), so per-edge
// authorization is enforced in the service against the (from→to) edge (mirrors inventory's
// in-service correction guard). authenticate + tenantScope still require a logged-in NGO user.
router.patch(
  '/:id/transition',
  validate(idParamSchema, 'params'),
  validate(transitionSchema, 'body'),
  taskController.transition,
);

router.get('/', authorize('task:read'), validate(listQuerySchema, 'query'), taskController.list);
router.get(
  '/:id/history',
  authorize('task:read'),
  validate(idParamSchema, 'params'),
  validate(historyQuerySchema, 'query'),
  taskController.history,
);

export default router;
