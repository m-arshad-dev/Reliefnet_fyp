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
// Slice 4 — match-loop helpers (run INSIDE the match service's withTransaction).
// `findByIdForUpdate` locks the offer row so a concurrent propose can't reserve the same
// offer twice; `updateStatus` is the CONSEQUENCE move (available → reserved → committed →
// delivered, or back to available on reject). Bare row carries the fields the propose
// guards check (visibility/status/disaster/type/ngo/quantity).
// ────────────────────────────────────────────────────────────────────────────────
export interface OfferBareRow {
  id: string;
  ngo_id: string;
  disaster_id: string;
  type: string;
  quantity: number;
  location_id: string | null;
  visibility: string;
  status: string;
}

const BARE_COLUMNS = `id, ngo_id, disaster_id, type, quantity, location_id, visibility, status`;

export async function findByIdForUpdate(
  id: string,
  client: PoolClient,
): Promise<OfferBareRow | null> {
  const { rows } = await client.query<OfferBareRow>(
    `SELECT ${BARE_COLUMNS} FROM resource_offers WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateStatus(
  id: string,
  status: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE resource_offers SET status = $2, updated_at = now() WHERE id = $1`,
    [id, status],
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// CROSS-TENANT SUGGESTION — the match candidate query. Like listSharedOffersForDisaster
// it has NO caller-tenant filter and pins visibility='shared'; additionally it SUGGESTS
// offers from OTHER NGOs only (ro.ngo_id <> the need's ngo_id) that match the need on
// disaster + resource type and are still available. This is SUGGEST-only — it never
// writes. Region (location_id) is an optional soft filter; date-window and quantity
// overlap are surfaced as badges in the service, not used to drop rows (a human decides).
// Kept as its OWN function next to the board read so Slice 9's RLS carves it out cleanly.
// Keyset on (created_at, id).
// ────────────────────────────────────────────────────────────────────────────────
export async function findCandidateOffersForNeed(
  need: { disasterId: string; type: string; ngoId: string },
  opts: { locationId?: string; limit: number; cursor?: Keyset | null },
): Promise<ResourceOfferRow[]> {
  const { locationId, limit, cursor } = opts;
  const conditions: string[] = [
    'ro.disaster_id = $1',
    'ro.type = $2',
    "ro.visibility = 'shared'",
    "ro.status = 'available'",
    'ro.ngo_id <> $3',
  ];
  const values: unknown[] = [need.disasterId, need.type, need.ngoId];

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
