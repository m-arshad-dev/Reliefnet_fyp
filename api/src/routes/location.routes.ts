import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantScope } from '../middleware/tenantScope';
import * as locationController from '../controllers/location.controller';

const router = Router();

// Locations are shared reference data: any authenticated user may read them (both the
// system-admin disaster form and the ngo-admin campaign form feed their region picker
// from here). No authorize() gate — there is no write endpoint this slice.
router.use(authenticate, tenantScope);

router.get('/', locationController.list);

export default router;
