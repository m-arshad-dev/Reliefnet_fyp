import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as userController from '../controllers/user.controller';

const router = Router();

// Roles an ngo_admin may assign to new staff (mirrors ASSIGNABLE_ROLES in the
// service). system_admin / auditor are intentionally excluded.
const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ngo_admin', 'field_coordinator', 'volunteer', 'data_entry']),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

router.use(authenticate, tenantScope);

router.post('/', authorize('user:manage'), validate(createUserSchema), userController.create);
router.get('/', authorize('user:manage'), validate(listQuerySchema, 'query'), userController.list);

export default router;
