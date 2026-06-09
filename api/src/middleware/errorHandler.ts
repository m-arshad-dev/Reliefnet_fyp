import { ErrorRequestHandler } from 'express';
import { AppError, ValidationError } from '../lib/errors';

// The single place that shapes every error into { success, data, error }.
// Must be registered last, after all routes.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const error: Record<string, unknown> = { code: err.code, message: err.message };
    if (err instanceof ValidationError && err.details) {
      error.details = err.details;
    }
    return res.status(err.statusCode).json({ success: false, data: null, error });
  }

  // Unknown / unexpected error — log server-side, never leak internals to the client.
  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
};
