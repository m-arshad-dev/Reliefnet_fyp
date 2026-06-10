import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as beneficiaryController from '../controllers/beneficiary.controller';
import { AID_TYPES } from '../lib/beneficiaryConstants';
import { normalizeCnic } from '../lib/cnic';

const router = Router();

// A CNIC is 13 digits, typed with optional dashes (`12345-1234567-1`). We validate the
// normalized length so dashes/spaces don't matter; the raw value is hashed server-side and
// never stored.
const cnicSchema = z
  .string()
  .refine((s) => normalizeCnic(s).length === 13, 'CNIC must be 13 digits');

// No `ngoId` / `verified` fields — the NGO is forced from the JWT and a beneficiary always
// starts unverified. campaignId + aidType seed the first aid_record in the same write.
const createSchema = z.object({
  cnic: cnicSchema,
  fullName: z.string().min(1),
  householdSize: z.number().int().positive().optional(),
  locationId: z.string().uuid().optional(),
  contactMasked: z.string().optional(),
  campaignId: z.string().uuid(),
  aidType: z.enum(AID_TYPES),
});

const checkSchema = z.object({ cnic: cnicSchema });

const idParamSchema = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  // Query strings are always strings — parse 'true'/'false' explicitly (z.coerce.boolean
  // would treat the string 'false' as truthy).
  verified: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

// Reads use 'beneficiary:read' (registrars + ngo_admin), never a write permission.
// Register stays on 'beneficiary:register'; verify on 'beneficiary:verify'.
router.post('/check', authorize('beneficiary:read'), validate(checkSchema), beneficiaryController.check);
router.post('/', authorize('beneficiary:register'), validate(createSchema), beneficiaryController.create);
router.get('/', authorize('beneficiary:read'), validate(listQuerySchema, 'query'), beneficiaryController.list);
router.get('/:id', authorize('beneficiary:read'), validate(idParamSchema, 'params'), beneficiaryController.get);
router.patch(
  '/:id/verify',
  authorize('beneficiary:verify'),
  validate(idParamSchema, 'params'),
  beneficiaryController.verify,
);

export default router;
