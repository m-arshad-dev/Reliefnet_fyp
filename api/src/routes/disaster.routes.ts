import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as disasterController from '../controllers/disaster.controller';

const router = Router();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const createDisasterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['flood', 'earthquake', 'drought', 'other']),
  severity: z.enum(['low', 'moderate', 'high', 'critical']),
  regionId: z.string().uuid().optional(),
  startsOn: dateSchema,
  endsOn: dateSchema.optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

// Disasters are GLOBAL. Only creation is gated (system_admin via 'disaster:create');
// reads are open to any authenticated NGO because a campaign references a disaster.
router.post('/', authorize('disaster:create'), validate(createDisasterSchema), disasterController.create);
router.get('/', validate(listQuerySchema, 'query'), disasterController.list);
router.get('/:id', validate(idParamSchema, 'params'), disasterController.get);

export default router;
