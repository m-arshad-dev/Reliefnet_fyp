import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import ngoRoutes from './ngo.routes';
import userRoutes from './user.routes';
import locationRoutes from './location.routes';
import disasterRoutes from './disaster.routes';
import campaignRoutes from './campaign.routes';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/ngos', ngoRoutes);
router.use('/users', userRoutes);
router.use('/locations', locationRoutes);
router.use('/disasters', disasterRoutes);
router.use('/campaigns', campaignRoutes);

export default router;
