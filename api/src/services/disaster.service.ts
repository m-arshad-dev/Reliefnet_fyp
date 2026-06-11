import * as disasterRepo from '../repositories/disaster.repository';
import type { DisasterRow } from '../repositories/disaster.repository';
import { withTransaction } from '../db/pool';
import * as auditService from './audit.service';
import { NotFoundError, ValidationError, isForeignKeyViolation } from '../lib/errors';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';

// Client-safe disaster projection (camelCase). starts_on/ends_on already arrive as
// 'YYYY-MM-DD' strings from the repo; created_at/updated_at are ISO timestamps.
export interface PublicDisaster {
  id: string;
  name: string;
  type: string;
  severity: string;
  regionId: string | null;
  startsOn: string;
  endsOn: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function toPublicDisaster(row: DisasterRow): PublicDisaster {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    severity: row.severity,
    regionId: row.region_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface CreateDisasterInput {
  name: string;
  type: string;
  severity: string;
  regionId?: string;
  startsOn: string;
  endsOn?: string;
}

// Disasters are GLOBAL: created by a system_admin (authorize('disaster:create')),
// `created_by` is the acting admin, status defaults to 'active' in the DB. A bad
// region_id (FK 23503) surfaces as a clean 422 rather than a 500.
export async function createDisaster(
  input: CreateDisasterInput,
  actorId: string,
): Promise<PublicDisaster> {
  try {
    // The disaster insert AND its audit-ledger entry commit together (Slice 10, law 4).
    // disaster_events is RLS-excluded (global), so the plain withTransaction is the right helper.
    const row = await withTransaction(async (client) => {
      const created = await disasterRepo.insert(
        {
          name: input.name,
          type: input.type,
          severity: input.severity,
          regionId: input.regionId ?? null,
          startsOn: input.startsOn,
          endsOn: input.endsOn ?? null,
          createdBy: actorId,
        },
        client,
      );
      await auditService.record(client, {
        action: 'disaster.create',
        entityType: 'disaster_event',
        entityId: created.id,
        metadata: { name: created.name, type: created.type, severity: created.severity },
        actorId,
        ngoId: null,
      });
      return created;
    });
    return toPublicDisaster(row);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ValidationError('Referenced region does not exist');
    }
    throw err;
  }
}

export async function listDisasters(opts: {
  limit?: number;
  cursor?: string;
}): Promise<Page<PublicDisaster>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await disasterRepo.list({ limit, cursor });
  return buildPage(rows, limit, toPublicDisaster);
}

export async function getDisaster(id: string): Promise<PublicDisaster> {
  const row = await disasterRepo.findById(id);
  if (!row) throw new NotFoundError('Disaster not found');
  return toPublicDisaster(row);
}
