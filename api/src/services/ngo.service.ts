import { withTransaction } from '../db/pool';
import * as ngoRepo from '../repositories/ngo.repository';
import type { NgoRow } from '../repositories/ngo.repository';
import * as userRepo from '../repositories/user.repository';
import { hash } from '../lib/password';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  isUniqueViolation,
} from '../lib/errors';
import { toPublicUser, type PublicUser } from './auth.service';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';

// Client-safe NGO projection (camelCase).
export interface PublicNgo {
  id: string;
  name: string;
  registrationNo: string | null;
  status: string;
  vettedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPublicNgo(row: NgoRow): PublicNgo {
  return {
    id: row.id,
    name: row.name,
    registrationNo: row.registration_no,
    status: row.status,
    vettedBy: row.vetted_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface RegisterNgoInput {
  ngo: { name: string; registrationNo?: string };
  admin: { fullName: string; email: string; password: string };
}

// System-admin onboards an NGO and its first ngo_admin in ONE transaction (law 4):
// the ngo insert and the admin insert commit together or not at all. If the admin
// email is already taken, the user insert throws 23505 -> we ROLLBACK (no orphan
// ngo row) and surface a 409.
export async function registerNgo(
  input: RegisterNgoInput,
): Promise<{ ngo: PublicNgo; admin: PublicUser }> {
  const passwordHash = await hash(input.admin.password);
  try {
    const result = await withTransaction(async (client) => {
      const ngo = await ngoRepo.insert(
        { name: input.ngo.name, registrationNo: input.ngo.registrationNo ?? null },
        client,
      );
      const admin = await userRepo.insert(
        {
          ngoId: ngo.id,
          fullName: input.admin.fullName,
          email: input.admin.email,
          passwordHash,
          role: 'ngo_admin',
        },
        client,
      );
      return { ngo, admin };
    });
    return { ngo: toPublicNgo(result.ngo), admin: toPublicUser(result.admin) };
  } catch (err) {
    if (isUniqueViolation(err)) {
      if (err.constraint?.includes('email')) {
        throw new ConflictError('A user with this email already exists');
      }
      if (err.constraint?.includes('registration_no')) {
        throw new ConflictError('An NGO with this registration number already exists');
      }
      throw new ConflictError('Duplicate value violates a unique constraint');
    }
    throw err;
  }
}

export async function listNgos(opts: { limit?: number; cursor?: string }): Promise<Page<PublicNgo>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await ngoRepo.list({ limit, cursor });
  return buildPage(rows, limit, toPublicNgo);
}

// NGO status is not one of the three formal FSMs (inventory/task/match), but a tiny
// allowed-transitions guard keeps vetting clean. Vetting records who acted (vetted_by).
const NGO_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export async function setNgoStatus(
  id: string,
  status: 'active' | 'suspended',
  actorId: string,
): Promise<PublicNgo> {
  const existing = await ngoRepo.findById(id);
  if (!existing) throw new NotFoundError('NGO not found');

  if (existing.status !== status) {
    const allowed = NGO_STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      throw new ValidationError(`Cannot change NGO status from '${existing.status}' to '${status}'`);
    }
  }

  const updated = await ngoRepo.updateStatus(id, status, actorId);
  if (!updated) throw new NotFoundError('NGO not found');
  return toPublicNgo(updated);
}
