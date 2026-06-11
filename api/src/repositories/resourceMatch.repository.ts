import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// A resource_matches row joined to BOTH sides — the need (+ its NGO's name) and the offer
// (+ its NGO's name) — because a match is inherently cross-tenant: the card must read
// "NGO A's need ↔ NGO B's offer". The denormalized need_*/offer_* columns let the client
// render the whole card without extra round trips. created_at/updated_at stay Date (keyset).
export interface MatchRow {
  id: string;
  need_id: string;
  offer_id: string;
  quantity: number;
  status: string;
  created_by: string;
  confirmed_by: string | null;
  created_at: Date;
  updated_at: Date;
  // Need side
  need_type: string;
  need_quantity: number;
  need_status: string;
  need_ngo_id: string;
  need_ngo_name: string;
  need_location_id: string | null;
  need_disaster_id: string;
  // Offer side
  offer_type: string;
  offer_quantity: number;
  offer_status: string;
  offer_ngo_id: string;
  offer_ngo_name: string;
  offer_location_id: string | null;
}

// Columns for a match aliased `m`, joined to the need `rn` (+ its NGO `nn`) and the offer
// `ro` (+ its NGO `no`). Written once and reused by every read.
function cols(m: string, rn: string, ro: string, nn: string, no: string): string {
  return `${m}.id, ${m}.need_id, ${m}.offer_id, ${m}.quantity, ${m}.status,
          ${m}.created_by, ${m}.confirmed_by, ${m}.created_at, ${m}.updated_at,
          ${rn}.type AS need_type, ${rn}.quantity AS need_quantity, ${rn}.status AS need_status,
          ${rn}.ngo_id AS need_ngo_id, ${nn}.name AS need_ngo_name,
          ${rn}.location_id AS need_location_id, ${rn}.disaster_id AS need_disaster_id,
          ${ro}.type AS offer_type, ${ro}.quantity AS offer_quantity, ${ro}.status AS offer_status,
          ${ro}.ngo_id AS offer_ngo_id, ${no}.name AS offer_ngo_name,
          ${ro}.location_id AS offer_location_id`;
}

const JOINS = `JOIN resource_needs rn ON rn.id = m.need_id
               JOIN resource_offers ro ON ro.id = m.offer_id
               JOIN ngos nn ON nn.id = rn.ngo_id
               JOIN ngos no ON no.id = ro.ngo_id`;

const SELECTED = cols('m', 'rn', 'ro', 'nn', 'no');

interface InsertMatchParams {
  needId: string;
  offerId: string;
  quantity: number;
  createdBy: string;
}

// Always called with the shared `client` — the insert is step 1 of the multi-table
// transaction (insert match + move need + move offer). A data-modifying CTE re-selects the
// joined row so the response carries both NGOs' names like every read does. A 23505 here
// is the partial-unique index firing (a live match already exists for this need or offer);
// the service translates it into a 409.
export async function insert(params: InsertMatchParams, client: PoolClient): Promise<MatchRow> {
  const text = `
    WITH m AS (
      INSERT INTO resource_matches (need_id, offer_id, quantity, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    )
    SELECT ${SELECTED} FROM m ${JOINS}`;
  const { rows } = await client.query<MatchRow>(text, [
    params.needId,
    params.offerId,
    params.quantity,
    params.createdBy,
  ]);
  return rows[0];
}

// Bare row (no joins) locked FOR UPDATE — used by the FSM check inside the transaction so a
// concurrent transition can't double-advance the same match. Carries need_id/offer_id so
// the service can then lock those rows in turn.
export interface MatchBareRow {
  id: string;
  need_id: string;
  offer_id: string;
  status: string;
  quantity: number;
}

export async function findByIdForUpdate(
  id: string,
  client: PoolClient,
): Promise<MatchBareRow | null> {
  const { rows } = await client.query<MatchBareRow>(
    `SELECT id, need_id, offer_id, status, quantity FROM resource_matches WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

// Full joined projection by id. Used to hydrate the response after an insert/update inside
// the transaction (pass the `client`); usable outside one too.
export async function findByIdHydrated(
  id: string,
  client?: PoolClient,
): Promise<MatchRow | null> {
  const text = `SELECT ${SELECTED} FROM resource_matches m ${JOINS} WHERE m.id = $1`;
  const { rows } = client
    ? await client.query<MatchRow>(text, [id])
    : await query<MatchRow>(text, [id]);
  return rows[0] ?? null;
}

// Status transition (+ stamp confirmed_by when supplied — only on the move to 'accepted').
// COALESCE keeps any existing confirmed_by when null is passed. Re-selects the joined row.
export async function updateStatus(
  id: string,
  status: string,
  confirmedBy: string | null,
  client: PoolClient,
): Promise<MatchRow> {
  const text = `
    WITH m AS (
      UPDATE resource_matches
      SET status = $2, confirmed_by = COALESCE($3, confirmed_by), updated_at = now()
      WHERE id = $1
      RETURNING *
    )
    SELECT ${SELECTED} FROM m ${JOINS}`;
  const { rows } = await client.query<MatchRow>(text, [id, status, confirmedBy]);
  return rows[0];
}

// TENANT-SCOPED read: matches where the caller's NGO is on EITHER side (it raised the need
// OR it posted the offer), so both the needing and offering NGO see a match they're part
// of. Optional disaster/need/status filters. Keyset on (m.created_at, m.id).
export async function listInvolvingNgo(
  ngoId: string,
  opts: {
    disasterId?: string;
    needId?: string;
    status?: string;
    limit: number;
    cursor?: Keyset | null;
  },
  client?: PoolClient,
): Promise<MatchRow[]> {
  const { disasterId, needId, status, limit, cursor } = opts;
  const conditions: string[] = ['(rn.ngo_id = $1 OR ro.ngo_id = $1)'];
  const values: unknown[] = [ngoId];

  if (disasterId) {
    values.push(disasterId);
    conditions.push(`rn.disaster_id = $${values.length}`);
  }
  if (needId) {
    values.push(needId);
    conditions.push(`m.need_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`m.status = $${values.length}`);
  }
  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(`(m.created_at, m.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  values.push(limit);
  const limitPos = values.length;

  const text = `SELECT ${SELECTED} FROM resource_matches m ${JOINS}
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT $${limitPos}`;
  const { rows } = client
    ? await client.query<MatchRow>(text, values)
    : await query<MatchRow>(text, values);
  return rows;
}
