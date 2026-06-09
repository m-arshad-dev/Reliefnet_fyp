import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// A resource_offers row joined to its owning NGO's name (see resourceNeed.repository
// for why `ngo_name` is denormalized into every read). DATE columns are cast to text
// so we get plain 'YYYY-MM-DD' strings (no JS Date timezone drift); created_at/
// updated_at stay as Date (the keyset cursor needs the Date).
export interface ResourceOfferRow {
  id: string;
  ngo_id: string;
  ngo_name: string;
  disaster_id: string;
  type: string;
  quantity: number;
  location_id: string | null;
  available_from: string | null;
  available_until: string | null;
  visibility: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Columns for a resource_offers row aliased `ro` joined to ngos aliased `n`.
function cols(ro: string, n: string): string {
  return `${ro}.id, ${ro}.ngo_id, ${n}.name AS ngo_name, ${ro}.disaster_id,
          ${ro}.type, ${ro}.quantity, ${ro}.location_id,
          ${ro}.available_from::text AS available_from,
          ${ro}.available_until::text AS available_until,
          ${ro}.visibility, ${ro}.description, ${ro}.status, ${ro}.created_by,
          ${ro}.created_at, ${ro}.updated_at`;
}

interface InsertOfferParams {
  ngoId: string;
  disasterId: string;
  type: string;
  quantity: number;
  locationId: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  visibility: string;
  description: string | null;
  createdBy: string;
}

// TENANT WRITE — `ngo_id` and `created_by` are forced by the service from the JWT,
// never the body. `visibility` IS the offer's own attribute (shared|private) and comes
// from the body. Data-modifying CTE re-selects with ngos so the response carries
// `ngo_name` like every read does.
export async function insert(
  params: InsertOfferParams,
  client?: PoolClient,
): Promise<ResourceOfferRow> {
  const text = `
    WITH ro AS (
      INSERT INTO resource_offers
        (ngo_id, disaster_id, type, quantity, location_id, available_from, available_until, visibility, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    )
    SELECT ${cols('ro', 'n')} FROM ro JOIN ngos n ON n.id = ro.ngo_id`;
  const values = [
    params.ngoId,
    params.disasterId,
    params.type,
    params.quantity,
    params.locationId,
    params.availableFrom,
    params.availableUntil,
    params.visibility,
    params.description,
    params.createdBy,
  ];
  const { rows } = client
    ? await client.query<ResourceOfferRow>(text, values)
    : await query<ResourceOfferRow>(text, values);
  return rows[0];
}

// ────────────────────────────────────────────────────────────────────────────────
// CROSS-TENANT READ — deliberately has NO `ngo_id` filter, but ALWAYS pins
// visibility = 'shared'. This is the controlled cross-tenant window of the
// Coordination Board: within one disaster, return shared, available offers from ALL
// NGOs (private offers stay with their owner). Kept as its OWN function so Slice 9's
// RLS can carve out exactly the visibility='shared' rows. Keyset on (created_at, id).
// ────────────────────────────────────────────────────────────────────────────────
export async function listSharedOffersForDisaster(
  disasterId: string,
  opts: { status: string; type?: string; locationId?: string; limit: number; cursor?: Keyset | null },
): Promise<ResourceOfferRow[]> {
  const { status, type, locationId, limit, cursor } = opts;
  const conditions: string[] = [
    'ro.disaster_id = $1',
    "ro.visibility = 'shared'",
    'ro.status = $2',
  ];
  const values: unknown[] = [disasterId, status];

  if (type) {
    values.push(type);
    conditions.push(`ro.type = $${values.length}`);
  }
  if (locationId) {
    values.push(locationId);
    conditions.push(`ro.location_id = $${values.length}`);
  }
  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(`(ro.created_at, ro.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  values.push(limit);
  const limitPos = values.length;

  const { rows } = await query<ResourceOfferRow>(
    `SELECT ${cols('ro', 'n')}
     FROM resource_offers ro
     JOIN ngos n ON n.id = ro.ngo_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ro.created_at DESC, ro.id DESC
     LIMIT $${limitPos}`,
    values,
  );
  return rows;
}
