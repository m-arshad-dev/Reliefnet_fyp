import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as ngoController from '../controllers/ngo.controller';

const router = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

const statusParamsSchema = z.object({ id: z.string().uuid() });
const statusBodySchema = z.object({ status: z.enum(['active', 'suspended']) });

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

router.get('/', authorize('ngo:manage'), validate(listQuerySchema, 'query'), ngoController.list);
router.patch(
  '/:id/status',
  authorize('ngo:manage'),
  validate(statusParamsSchema, 'params'),
  validate(statusBodySchema, 'body'),
  ngoController.setStatus,
);

export default router;
