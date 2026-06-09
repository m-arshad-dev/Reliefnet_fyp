import * as userRepo from '../repositories/user.repository';
import { hash } from '../lib/password';
import { ConflictError, ForbiddenError, isUniqueViolation } from '../lib/errors';
import { toPublicUser, type PublicUser } from './auth.service';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';

// An ngo_admin may only mint staff within these roles. system_admin / auditor are
// global identities, never created through tenant staff management.
const ASSIGNABLE_ROLES = new Set(['ngo_admin', 'field_coordinator', 'volunteer', 'data_entry']);

interface CreateStaffInput {
  fullName: string;
  email: string;
  password: string;
  role: string;
}

// `tenantNgoId` comes from the caller's JWT (req.tenant.ngoId), NEVER the request
// body — that is the core app-layer isolation guarantee: an ngo_admin can only ever
// create users inside their own NGO.
export async function createStaff(tenantNgoId: string, input: CreateStaffInput): Promise<PublicUser> {
  if (!ASSIGNABLE_ROLES.has(input.role)) {
    throw new ForbiddenError(`Cannot create a user with role '${input.role}'`);
  }
  const passwordHash = await hash(input.password);
  try {
    const row = await userRepo.insert({
      ngoId: tenantNgoId,
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    return toPublicUser(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('A user with this email already exists');
    }
    throw err;
  }
}

export async function listStaff(
  tenantNgoId: string,
  opts: { limit?: number; cursor?: string },
): Promise<Page<PublicUser>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await userRepo.listByNgo(tenantNgoId, { limit, cursor });
  return buildPage(rows, limit, toPublicUser);
}
