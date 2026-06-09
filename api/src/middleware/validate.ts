import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../lib/errors';

type Source = 'body' | 'query' | 'params';

// Parse a request part against a Zod schema at the controller boundary.
// On success the parsed (typed/coerced) value replaces the raw input.
export function validate(schema: ZodSchema, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new ValidationError('Validation failed', result.error.flatten()));
    }
    (req as Record<Source, unknown>)[source] = result.data;
    next();
  };
}
