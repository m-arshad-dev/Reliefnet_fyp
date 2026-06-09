import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

// Access and refresh tokens are both stateless JWTs, signed with DISTINCT secrets,
// and carry an explicit `type` claim so an access token can never be replayed at
// /auth/refresh (and vice versa). The DB-backed refresh_tokens table is a later slice.
export interface AccessClaims {
  sub: string; // user id
  role: string;
  ngoId: string | null; // tenant; null for global roles (system_admin / auditor)
  type: 'access';
}

export interface RefreshClaims {
  sub: string; // user id
  type: 'refresh';
}

export function signAccess(payload: { sub: string; role: string; ngoId: string | null }): string {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'] };
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, options);
}

export function signRefresh(payload: { sub: string }): string {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'] };
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccess(token: string): AccessClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
    if (decoded.type !== 'access') throw new UnauthorizedError('Invalid token type');
    return decoded;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function verifyRefresh(token: string): RefreshClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims;
    if (decoded.type !== 'refresh') throw new UnauthorizedError('Invalid token type');
    return decoded;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}
