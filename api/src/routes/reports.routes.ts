import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import { authorize } from '../middleware/authorize';
import * as reportController from '../controllers/report.controller';

const router = Router();

// Slice 8 Coordination Dashboard. `disasterId` is REQUIRED — every report is scoped to
// one disaster. The reads are CROSS-TENANT aggregates, gated by the dedicated read
// permission `reports:read` (never a write permission); the controllers skip
// requireTenant so a tenantless system_admin can read the command picture too.
const disasterQuery = z.object({
  disasterId: z.string().uuid(),
});

// coverage-gaps additionally accepts an optional coverage threshold (0..1).
const coverageGapsQuery = disasterQuery.extend({
  threshold: z.coerce.number().min(0).max(1).optional(),
});

// Middleware chain per v2 §7: authenticate -> tenantScope -> authorize(perm).
router.use(authenticate, tenantScope);

router.get(
  '/heatmap',
  authorize('reports:read'),
  validate(disasterQuery, 'query'),
  reportController.heatmap,
);
router.get(
  '/coverage-gaps',
  authorize('reports:read'),
  validate(coverageGapsQuery, 'query'),
  reportController.coverageGaps,
);
router.get(
  '/unmatched-needs',
  authorize('reports:read'),
  validate(disasterQuery, 'query'),
  reportController.unmatchedNeeds,
);
router.get(
  '/resource-availability',
  authorize('reports:read'),
  validate(disasterQuery, 'query'),
  reportController.resourceAvailability,
);
router.get(
  '/3w',
  authorize('reports:read'),
  validate(disasterQuery, 'query'),
  reportController.threeW,
);

export default router;
