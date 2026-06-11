import * as needRepo from '../repositories/resourceNeed.repository';
import type { ResourceNeedRow } from '../repositories/resourceNeed.repository';
import * as disasterRepo from '../repositories/disaster.repository';
import { withTenant, withCrossTenant } from '../db/pool';
import { NotFoundError, ValidationError, isForeignKeyViolation } from '../lib/errors';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';

// Client-safe need projection (camelCase). `ngoName` is included so the cross-tenant
// board can show which NGO raised each need.
export interface PublicNeed {
  id: string;
  ngoId: string;
  ngoName: string;
  disasterId: string;
  type: string;
  quantity: number;
  locationId: string | null;
  priority: string;
  description: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function toPublicNeed(row: ResourceNeedRow): PublicNeed {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    ngoName: row.ngo_name,
    disasterId: row.disaster_id,
    type: row.type,
    quantity: row.quantity,
    locationId: row.location_id,
    priority: row.priority,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface CreateNeedInput {
  disasterId: string;
  type: string;
  quantity: number;
  locationId?: string;
  priority?: string;
  description?: string;
}

// `tenantNgoId` comes from the caller's JWT (req.tenant.ngoId), NEVER the body — the
// core app-layer isolation guarantee. A field_coordinator can only raise needs inside
// their own NGO. We verify the disaster exists first (clean 404), then a bad
// location_id (FK 23503) surfaces as a 422.
export async function createNeed(
  tenantNgoId: string,
  input: CreateNeedInput,
  actorId: string,
): Promise<PublicNeed> {
  const disaster = await disasterRepo.findById(input.disasterId);
  if (!disaster) throw new NotFoundError('Disaster not found');

  try {
    const row = await withTenant(tenantNgoId, (client) =>
      needRepo.insert(
        {
          ngoId: tenantNgoId,
          disasterId: input.disasterId,
          type: input.type,
          quantity: input.quantity,
          locationId: input.locationId ?? null,
          priority: input.priority ?? 'moderate',
          description: input.description ?? null,
          createdBy: actorId,
        },
        client,
      ),
    );
    return toPublicNeed(row);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ValidationError('Referenced region does not exist');
    }
    throw err;
  }
}

// CROSS-TENANT board read — intentionally takes NO tenantNgoId. Returns open needs from
// ALL NGOs within a disaster (status defaults to 'open'). See the repository for why
// this read is kept separate from any tenant-scoped query.
export async function listOpenNeeds(opts: {
  disasterId: string;
  status?: string;
  type?: string;
  locationId?: string;
  limit?: number;
  cursor?: string;
}): Promise<Page<PublicNeed>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await withCrossTenant((client) =>
    needRepo.listOpenNeedsForDisaster(
      opts.disasterId,
      { status: opts.status ?? 'open', type: opts.type, locationId: opts.locationId, limit, cursor },
      client,
    ),
  );
  return buildPage(rows, limit, toPublicNeed);
}
