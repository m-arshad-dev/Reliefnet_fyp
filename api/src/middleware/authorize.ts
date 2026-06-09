import { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { hasPermission } from '../lib/permissions';

// authorize(...permissions): passes if the authenticated caller's role holds ANY
// of the required permission strings, looked up in the ROLE_PERMISSIONS map
// (v2 §3.2). Compose per route after `authenticate` (and `tenantScope`).
export function authorize(...permissions: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    const allowed = permissions.some((p) => hasPermission(req.user!.role, p));
    if (!allowed) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
}
