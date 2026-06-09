import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as campaignController from '../controllers/campaign.controller';

const router = Router();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// No `ngoId` field — the NGO is forced from the JWT in the controller/service.
const createCampaignSchema = z.object({
  name: z.string().min(1),
  disasterId: z.string().uuid(),
  targetRegionId: z.string().uuid().optional(),
  startsOn: dateSchema,
  endsOn: dateSchema.optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
  disasterId: z.string().uuid().optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });
// 'planning' is create-time only — you never transition back to it.
const statusBodySchema = z.object({ status: z.enum(['active', 'paused', 'completed']) });

router.use(authenticate, tenantScope);

// Read/write split: reads use 'campaign:read' (ngo_admin + field_coordinator, ready
// for Slice 3); create/transition stay on 'campaign:create' (ngo_admin only).
router.post('/', authorize('campaign:create'), validate(createCampaignSchema), campaignController.create);
router.get('/', authorize('campaign:read'), validate(listQuerySchema, 'query'), campaignController.list);
router.patch(
  '/:id/status',
  authorize('campaign:create'),
  validate(idParamSchema, 'params'),
  validate(statusBodySchema, 'body'),
  campaignController.setStatus,
);

export default router;
