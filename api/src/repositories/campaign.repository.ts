import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of a row in the `campaigns` table (snake_case, straight from SQL).
// DATE columns cast to text (see disaster.repository for the rationale).
export interface CampaignRow {
  id: string;
  ngo_id: string;
  disaster_id: string;
  name: string;
  target_region_id: string | null;
  starts_on: string;
  ends_on: string | null;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, ngo_id, disaster_id, name, target_region_id,
                 starts_on::text AS starts_on, ends_on::text AS ends_on,
                 status, created_by, created_at, updated_at`;

interface InsertCampaignParams {
  ngoId: string;
  disasterId: string;
  name: string;
  targetRegionId: string | null;
  startsOn: string;
  endsOn: string | null;
  createdBy: string;
}

export async function insert(
  params: InsertCampaignParams,
  client?: PoolClient,
): Promise<CampaignRow> {
  const text = `INSERT INTO campaigns (ngo_id, disaster_id, name, target_region_id, starts_on, ends_on, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING ${COLUMNS}`;
  const values = [
    params.ngoId,
    params.disasterId,
    params.name,
    params.targetRegionId,
    params.startsOn,
    params.endsOn,
    params.createdBy,
  ];
  const { rows } = client
    ? await client.query<CampaignRow>(text, values)
    : await query<CampaignRow>(text, values);
  return rows[0];
}

export async function findById(id: string, client?: PoolClient): Promise<CampaignRow | null> {
  const text = `SELECT ${COLUMNS} FROM campaigns WHERE id = $1`;
  const { rows } = client
    ? await client.query<CampaignRow>(text, [id])
    : await query<CampaignRow>(text, [id]);
  return rows[0] ?? null;
}

// Tenant-scoped keyset page: only campaigns belonging to `ngoId` (the app-layer
// isolation guarantee for Slice 2; DB-enforced RLS lands in Slice 9). Optional
// `disasterId` narrows to one disaster. Conditions/params are assembled positionally
// — still raw, parameterized SQL, no query builder.
export async function listByNgo(
  ngoId: string,
  opts: { limit: number; cursor?: Keyset | null; disasterId?: string },
  client?: PoolClient,
): Promise<CampaignRow[]> {
  const { limit, cursor, disasterId } = opts;
  const conditions: string[] = ['ngo_id = $1'];
  const values: unknown[] = [ngoId];

  if (disasterId) {
    values.push(disasterId);
    conditions.push(`disaster_id = $${values.length}`);
  }
  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(`(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  values.push(limit);
  const limitPos = values.length;

  const text = `SELECT ${COLUMNS} FROM campaigns
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitPos}`;
  const { rows } = client
    ? await client.query<CampaignRow>(text, values)
    : await query<CampaignRow>(text, values);
  return rows;
}

export async function updateStatus(
  id: string,
  status: string,
  client?: PoolClient,
): Promise<CampaignRow | null> {
  const text = `UPDATE campaigns
     SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`;
  const { rows } = client
    ? await client.query<CampaignRow>(text, [id, status])
    : await query<CampaignRow>(text, [id, status]);
  return rows[0] ?? null;
}
