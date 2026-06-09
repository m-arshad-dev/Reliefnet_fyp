import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as authController from '../controllers/auth.controller';
import * as ngoController from '../controllers/ngo.controller';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// System admin onboards an NGO + its first ngo_admin (v2 §5.1). Lives under /auth
// by the spec; the controller/service belong to the ngo domain.
const registerNgoSchema = z.object({
  ngo: z.object({
    name: z.string().min(1),
    registrationNo: z.string().min(1).optional(),
  }),
  admin: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.get('/me', authenticate, authController.me);
router.post(
  '/register-ngo',
  authenticate,
  tenantScope,
  authorize('ngo:manage'),
  validate(registerNgoSchema),
  ngoController.register,
);

export default router;
