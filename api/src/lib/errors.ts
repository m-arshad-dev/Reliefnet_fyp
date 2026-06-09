// Typed application errors. The central error handler maps these to the
// { success, data, error } envelope with the right HTTP status.
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  readonly details?: unknown;

  constructor(message = 'Validation failed', details?: unknown) {
    super(422, 'VALIDATION_ERROR', message);
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, 'CONFLICT', message);
  }
}

// Postgres raises SQLSTATE 23505 on a unique-constraint violation. Repositories
// surface the raw pg error; services use this to translate it into a 409, reading
// `constraint` to craft a precise message (which unique index was hit).
export function isUniqueViolation(
  err: unknown,
): err is { code: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

// Postgres raises SQLSTATE 23503 on a foreign-key violation (e.g. a campaign pointing
// at a region_id that doesn't exist). Services translate it into a 422 rather than
// leaking a raw 500.
export function isForeignKeyViolation(
  err: unknown,
): err is { code: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23503'
  );
}
