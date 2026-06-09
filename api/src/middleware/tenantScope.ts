import { RequestHandler } from 'express';
import { UnauthorizedError } from '../lib/errors';

// Augment Express's Request with the resolved tenant.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: { ngoId: string | null };
    }
  }
}

// App-layer tenant scoping (Slice 1): lift `ngo_id` straight off the verified JWT
// and expose it as `req.tenant.ngoId` for services/repositories to scope their
// queries (e.g. WHERE ngo_id = $tenant). system_admin / auditor carry ngoId = null
// (global, not bound to one tenant). Must run AFTER `authenticate`.
//
// Slice 9 upgrades this to DB-enforced isolation by also issuing
// `SET LOCAL app.current_ngo_id` inside the request transaction (v2 §3.1). Not yet.
export const tenantScope: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required before tenant scoping'));
  }
  req.tenant = { ngoId: req.user.ngoId };
  next();
};
