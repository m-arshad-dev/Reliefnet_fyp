import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

export function createApp() {
  const app = express();

  // Bearer-token auth (no cookies) → simple CORS allowing the SPA origin.
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json());

  app.use('/api/v1', routes);

  // Unmatched routes → consistent envelope.
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // Error handler is registered last.
  app.use(errorHandler);

  return app;
}
