import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as offerController from '../controllers/resourceOffer.controller';
import { RESOURCE_TYPES, OFFER_VISIBILITY, OFFER_STATUSES } from '../lib/coordinationConstants';

const router = Router();

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// No `ngoId` field — the owning NGO is forced from the JWT in the service, never the
// body. `visibility` IS the offer's own attribute (shared|private), default 'shared'.
const createOfferSchema = z.object({
  disasterId: z.string().uuid(),
  type: z.enum(RESOURCE_TYPES),
  quantity: z.number().int().positive(),
  locationId: z.string().uuid().optional(),
  availableFrom: dateSchema.optional(),
  availableUntil: dateSchema.optional(),
  visibility: z.enum(OFFER_VISIBILITY).optional(),
  description: z.string().min(1).optional(),
});

// `disasterId` is REQUIRED: the board is always scoped to one disaster. The cross-NGO
// read returns shared, available offers from every NGO in that disaster.
const listOffersQuerySchema = z.object({
  disasterId: z.string().uuid(),
  status: z.enum(OFFER_STATUSES).optional(),
  type: z.enum(RESOURCE_TYPES).optional(),
  locationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

// POST is tenant-owned (ngo_admin posts an offer for THEIR NGO).
router.post('/', authorize('offer:create'), validate(createOfferSchema), offerController.create);
// GET is CROSS-TENANT (the shared board). Gated by `board:read`, never a create perm.
router.get('/', authorize('board:read'), validate(listOffersQuerySchema, 'query'), offerController.list);

export default router;
