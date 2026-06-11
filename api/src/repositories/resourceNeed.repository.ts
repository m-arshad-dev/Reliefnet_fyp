import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// A resource_needs row joined to its owning NGO's name. `ngo_name` is denormalized
// into every read because the board is CROSS-TENANT — a field_coordinator in NGO B
// must see that NGO A raised a need, and there is no broadly-readable NGO list
// endpoint to resolve the name client-side. created_at/updated_at stay as Date (the
// keyset cursor needs the Date).
export interface ResourceNeedRow {
  id: string;
  ngo_id: string;
  ngo_name: string;
  disaster_id: string;
  type: string;
  quantity: number;
  location_id: string | null;
  priority: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Columns for a resource_needs row aliased `rn` joined to ngos aliased `n`.
function cols(rn: string, n: string): string {
  return `${rn}.id, ${rn}.ngo_id, ${n}.name AS ngo_name, ${rn}.disaster_id,
          ${rn}.type, ${rn}.quantity, ${rn}.location_id, ${rn}.priority,
          ${rn}.description, ${rn}.status, ${rn}.created_by,
          ${rn}.created_at, ${rn}.updated_at`;
}

interface InsertNeedParams {
  ngoId: string;
  disasterId: string;
  type: string;
  quantity: number;
  locationId: string | null;
  priority: string;
  description: string | null;
  createdBy: string;
}

// TENANT WRITE — `ngo_id` and `created_by` are forced by the service from the JWT,
// never the body. A data-modifying CTE inserts then re-selects the row joined to ngos
// so the response carries `ngo_name` like every read does (one round trip).
export async function insert(
  params: InsertNeedParams,
  client?: PoolClient,
): Promise<ResourceNeedRow> {
  const text = `
    WITH rn AS (
      INSERT INTO resource_needs (ngo_id, disaster_id, type, quantity, location_id, priority, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    )
    SELECT ${cols('rn', 'n')} FROM rn JOIN ngos n ON n.id = rn.ngo_id`;
  const values = [
    params.ngoId,
    params.disasterId,
    params.type,
    params.quantity,
    params.locationId,
    params.priority,
    params.description,
    params.createdBy,
  ];
  const { rows } = client
    ? await client.query<ResourceNeedRow>(text, values)
    : await query<ResourceNeedRow>(text, values);
  return rows[0];
}

// ────────────────────────────────────────────────────────────────────────────────
// Slice 4 — match-loop helpers. Both run INSIDE the match service's withTransaction so
// they take the shared `client`. `findByIdForUpdate` SELECT ... FOR UPDATE locks the
// need row for the duration of the transaction so a concurrent propose can't race two
// matches onto the same need; `updateStatus` is the consequence move (open → matched →
// fulfilling → fulfilled, or back to open on reject). Bare row — no ngos join needed.
// ────────────────────────────────────────────────────────────────────────────────
export interface NeedBareRow {
  id: string;
  ngo_id: string;
  disaster_id: string;
  type: string;
  quantity: number;
  location_id: string | null;
  priority: string;
  status: string;
}

const BARE_COLUMNS = `id, ngo_id, disaster_id, type, quantity, location_id, priority, status`;

export async function findByIdForUpdate(
  id: string,
  client: PoolClient,
): Promise<NeedBareRow | null> {
  const { rows } = await client.query<NeedBareRow>(
    `SELECT ${BARE_COLUMNS} FROM resource_needs WHERE id = $1 FOR UPDATE`,
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
    `UPDATE resource_needs SET status = $2, updated_at = now() WHERE id = $1`,
    [id, status],
  );
}

// Plain (non-locking) read by id — used by the candidates endpoint to resolve a need's
// disaster/type/region before suggesting offers. Cross-tenant readable like the board, so
// it runs inside withCrossTenant and takes that txn `client` (board_read needs the GUC set).
export async function findById(id: string, client?: PoolClient): Promise<NeedBareRow | null> {
  const text = `SELECT ${BARE_COLUMNS} FROM resource_needs WHERE id = $1`;
  const { rows } = client
    ? await client.query<NeedBareRow>(text, [id])
    : await query<NeedBareRow>(text, [id]);
  return rows[0] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────────
// CROSS-TENANT READ — deliberately has NO `ngo_id` filter. This is the controlled
// cross-tenant window of the Coordination Board: within one disaster, return open
// needs raised by ALL NGOs. Kept as its OWN function (separate from any tenant-scoped
// query) so Slice 9's RLS can carve out a shared-read policy here without weakening
// default-deny elsewhere. Type/region are optional filters; keyset on (created_at, id).
// ────────────────────────────────────────────────────────────────────────────────
export async function listOpenNeedsForDisaster(
  disasterId: string,
  opts: { status: string; type?: string; locationId?: string; limit: number; cursor?: Keyset | null },
  client?: PoolClient,
): Promise<ResourceNeedRow[]> {
  const { status, type, locationId, limit, cursor } = opts;
  const conditions: string[] = ['rn.disaster_id = $1', 'rn.status = $2'];
  const values: unknown[] = [disasterId, status];

  if (type) {
    values.push(type);
    conditions.push(`rn.type = $${values.length}`);
  }
  if (locationId) {
    values.push(locationId);
    conditions.push(`rn.location_id = $${values.length}`);
  }
  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(`(rn.created_at, rn.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  values.push(limit);
  const limitPos = values.length;

  const text = `SELECT ${cols('rn', 'n')}
     FROM resource_needs rn
     JOIN ngos n ON n.id = rn.ngo_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY rn.created_at DESC, rn.id DESC
     LIMIT $${limitPos}`;
  const { rows } = client
    ? await client.query<ResourceNeedRow>(text, values)
    : await query<ResourceNeedRow>(text, values);
  return rows;
}
