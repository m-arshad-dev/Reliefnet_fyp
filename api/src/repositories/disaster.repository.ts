import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of a row in the `disaster_events` table (snake_case, straight from SQL).
// DATE columns are cast to text in COLUMNS so we get a plain 'YYYY-MM-DD' string and
// sidestep JS Date timezone drift; created_at/updated_at stay as timestamptz Dates
// (the keyset cursor needs a Date).
export interface DisasterRow {
  id: string;
  name: string;
  type: string;
  severity: string;
  region_id: string | null;
  starts_on: string;
  ends_on: string | null;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, name, type, severity, region_id,
                 starts_on::text AS starts_on, ends_on::text AS ends_on,
                 status, created_by, created_at, updated_at`;

interface InsertDisasterParams {
  name: string;
  type: string;
  severity: string;
  regionId: string | null;
  startsOn: string;
  endsOn: string | null;
  createdBy: string;
}

// Accepts an optional transaction client for consistency with the other repos;
// disaster create is a single insert today (status defaults to 'active' in the DB).
export async function insert(
  params: InsertDisasterParams,
  client?: PoolClient,
): Promise<DisasterRow> {
  const text = `INSERT INTO disaster_events (name, type, severity, region_id, starts_on, ends_on, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING ${COLUMNS}`;
  const values = [
    params.name,
    params.type,
    params.severity,
    params.regionId,
    params.startsOn,
    params.endsOn,
    params.createdBy,
  ];
  const { rows } = client
    ? await client.query<DisasterRow>(text, values)
    : await query<DisasterRow>(text, values);
  return rows[0];
}

export async function findById(id: string): Promise<DisasterRow | null> {
  const { rows } = await query<DisasterRow>(
    `SELECT ${COLUMNS} FROM disaster_events WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Keyset page over ALL disasters — they are global, so no tenant filter (any
// authenticated NGO reads them). Same (created_at, id) cursor pattern as ngos.list.
export async function list(opts: { limit: number; cursor?: Keyset | null }): Promise<DisasterRow[]> {
  const { limit, cursor } = opts;
  if (cursor) {
    const { rows } = await query<DisasterRow>(
      `SELECT ${COLUMNS} FROM disaster_events
       WHERE (created_at, id) < ($1::timestamptz, $2::uuid)
       ORDER BY created_at DESC, id DESC
       LIMIT $3`,
      [cursor.createdAt, cursor.id, limit],
    );
    return rows;
  }
  const { rows } = await query<DisasterRow>(
    `SELECT ${COLUMNS} FROM disaster_events
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}
