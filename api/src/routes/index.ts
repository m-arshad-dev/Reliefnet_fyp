import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import ngoRoutes from './ngo.routes';
import userRoutes from './user.routes';
import locationRoutes from './location.routes';
import disasterRoutes from './disaster.routes';
import campaignRoutes from './campaign.routes';
import needsRoutes from './needs.routes';
import offersRoutes from './offers.routes';
import matchesRoutes from './matches.routes';
import beneficiaryRoutes from './beneficiary.routes';
import inventoryRoutes from './inventory.routes';
import tasksRoutes from './tasks.routes';
import reportsRoutes from './reports.routes';
import auditRoutes from './audit.routes';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/ngos', ngoRoutes);
router.use('/users', userRoutes);
router.use('/locations', locationRoutes);
router.use('/disasters', disasterRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/needs', needsRoutes);
router.use('/offers', offersRoutes);
router.use('/matches', matchesRoutes);
router.use('/beneficiaries', beneficiaryRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/tasks', tasksRoutes);
router.use('/reports', reportsRoutes);
router.use('/audit', auditRoutes);

export default router;
