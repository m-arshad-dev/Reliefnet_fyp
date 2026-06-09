import * as userRepo from '../repositories/user.repository';
import type { UserRow } from '../repositories/user.repository';
import { compare } from '../lib/password';
import { signAccess, signRefresh, verifyRefresh } from '../lib/jwt';
import { UnauthorizedError } from '../lib/errors';

// Public, client-safe projection of a user (camelCase, no password hash).
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  ngoId: string | null;
}

// Exported so the ngo/user services share one projection (no duplicated shaping).
export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    ngoId: row.ngo_id,
  };
}

export async function login(email: string, password: string) {
  const user = await userRepo.findByEmail(email);
  // Same error for "no such user" and "wrong password" — don't leak which.
  if (!user || !user.is_active) {
    throw new UnauthorizedError('Invalid email or password');
  }
  const ok = await compare(password, user.password_hash);
  if (!ok) {
    throw new UnauthorizedError('Invalid email or password');
  }
  return {
    accessToken: signAccess({ sub: user.id, role: user.role, ngoId: user.ngo_id }),
    refreshToken: signRefresh({ sub: user.id }),
    user: toPublicUser(user),
  };
}

export async function refresh(refreshToken: string) {
  const claims = verifyRefresh(refreshToken);
  const user = await userRepo.findById(claims.sub);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('User is no longer active');
  }
  // Stateless: issue a fresh access token; the refresh token keeps its own TTL.
  return { accessToken: signAccess({ sub: user.id, role: user.role, ngoId: user.ngo_id }) };
}

export async function me(userId: string) {
  const user = await userRepo.findById(userId);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('User is no longer active');
  }
  return { user: toPublicUser(user) };
}
