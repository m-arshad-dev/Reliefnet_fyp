import { RequestHandler } from 'express';
import { verifyAccess } from '../lib/jwt';
import { UnauthorizedError } from '../lib/errors';

// Augment Express's Request with the authenticated principal.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { sub: string; role: string; ngoId: string | null };
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = verifyAccess(token);
    req.user = { sub: claims.sub, role: claims.role, ngoId: claims.ngoId ?? null };
    next();
  } catch (err) {
    next(err);
  }
};
