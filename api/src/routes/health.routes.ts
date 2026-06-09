import { Router } from 'express';
import { ping } from '../db/pool';

const router = Router();

// Liveness + DB reachability. Proves the API can talk to Postgres.
router.get('/health', async (_req, res, next) => {
  try {
    const dbUp = await ping();
    res.status(200).json({
      success: true,
      data: { status: 'ok', db: dbUp ? 'up' : 'down' },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
