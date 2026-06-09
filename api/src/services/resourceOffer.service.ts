import * as offerRepo from '../repositories/resourceOffer.repository';
import type { ResourceOfferRow } from '../repositories/resourceOffer.repository';
import * as disasterRepo from '../repositories/disaster.repository';
import { NotFoundError, ValidationError, isForeignKeyViolation } from '../lib/errors';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';

// Client-safe offer projection (camelCase). `ngoName` is included so the cross-tenant
// board can show which NGO posted each offer.
export interface PublicOffer {
  id: string;
  ngoId: string;
  ngoName: string;
  disasterId: string;
  type: string;
  quantity: number;
  locationId: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  visibility: string;
  description: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function toPublicOffer(row: ResourceOfferRow): PublicOffer {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    ngoName: row.ngo_name,
    disasterId: row.disaster_id,
    type: row.type,
    quantity: row.quantity,
    locationId: row.location_id,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    visibility: row.visibility,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface CreateOfferInput {
  disasterId: string;
  type: string;
  quantity: number;
  locationId?: string;
  availableFrom?: string;
  availableUntil?: string;
  visibility?: string;
  description?: string;
}

// `tenantNgoId` comes from the caller's JWT (req.tenant.ngoId), NEVER the body — an
// ngo_admin can only post offers inside their own NGO. `visibility` is the offer's own
// attribute (shared|private), taken from the body and defaulting to 'shared'. Verify
// the disaster exists first (clean 404); a bad location_id (FK 23503) becomes a 422.
export async function createOffer(
  tenantNgoId: string,
  input: CreateOfferInput,
  actorId: string,
): Promise<PublicOffer> {
  const disaster = await disasterRepo.findById(input.disasterId);
  if (!disaster) throw new NotFoundError('Disaster not found');

  try {
    const row = await offerRepo.insert({
      ngoId: tenantNgoId,
      disasterId: input.disasterId,
      type: input.type,
      quantity: input.quantity,
      locationId: input.locationId ?? null,
      availableFrom: input.availableFrom ?? null,
      availableUntil: input.availableUntil ?? null,
      visibility: input.visibility ?? 'shared',
      description: input.description ?? null,
      createdBy: actorId,
    });
    return toPublicOffer(row);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ValidationError('Referenced region does not exist');
    }
    throw err;
  }
}

// CROSS-TENANT board read — intentionally takes NO tenantNgoId. Returns shared,
// available offers from ALL NGOs within a disaster (status defaults to 'available';
// the repository always pins visibility='shared'). Kept separate from any tenant-scoped
// query for the Slice-9 RLS carve-out.
export async function listSharedOffers(opts: {
  disasterId: string;
  status?: string;
  type?: string;
  locationId?: string;
  limit?: number;
  cursor?: string;
}): Promise<Page<PublicOffer>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await offerRepo.listSharedOffersForDisaster(opts.disasterId, {
    status: opts.status ?? 'available',
    type: opts.type,
    locationId: opts.locationId,
    limit,
    cursor,
  });
  return buildPage(rows, limit, toPublicOffer);
}
