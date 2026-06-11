import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as auditController from '../controllers/audit.controller';

// Slice 10 Audit Ledger. Reads are CROSS-TENANT oversight, gated by the dedicated read
// permission `audit:read` (auditor + system_admin only — v2 §3.2). The controllers skip
// requireTenant so a tenantless auditor/system_admin reads the whole chain.
const router = Router();

// GET /audit/ledger — keyset-paginated, optionally filtered by entityType / actorId.
const listQuery = z.object({
  entityType: z.string().min(1).optional(),
  actorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

router.get('/ledger', authorize('audit:read'), validate(listQuery, 'query'), auditController.listLedger);
router.get('/verify', authorize('audit:read'), auditController.verify);

export default router;
