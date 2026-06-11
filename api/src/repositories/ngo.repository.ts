import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of a row in the `ngos` table (snake_case, straight from SQL).
export interface NgoRow {
  id: string;
  name: string;
  registration_no: string | null;
  status: string;
  vetted_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, name, registration_no, status, vetted_by, created_at, updated_at`;

interface InsertNgoParams {
  name: string;
  registrationNo: string | null;
}

// Accepts an optional transaction client so register-ngo can insert the ngo and
// its first admin inside one BEGIN/COMMIT (law 4). Without a client it runs on the
// shared pool. Status defaults to 'pending' and vetted_by to NULL (set on vetting).
export async function insert(params: InsertNgoParams, client?: PoolClient): Promise<NgoRow> {
  const text = `INSERT INTO ngos (name, registration_no)
                VALUES ($1, $2)
                RETURNING ${COLUMNS}`;
  const values = [params.name, params.registrationNo];
  const { rows } = client
    ? await client.query<NgoRow>(text, values)
    : await query<NgoRow>(text, values);
  return rows[0];
}

export async function findById(id: string): Promise<NgoRow | null> {
  const { rows } = await query<NgoRow>(
    `SELECT ${COLUMNS} FROM ngos WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Keyset page over all NGOs (system-admin scope is cross-tenant by design).
export async function list(opts: { limit: number; cursor?: Keyset | null }): Promise<NgoRow[]> {
  const { limit, cursor } = opts;
  if (cursor) {
    const { rows } = await query<NgoRow>(
      `SELECT ${COLUMNS} FROM ngos
       WHERE (created_at, id) < ($1::timestamptz, $2::uuid)
       ORDER BY created_at DESC, id DESC
       LIMIT $3`,
      [cursor.createdAt, cursor.id, limit],
    );
    return rows;
  }
  const { rows } = await query<NgoRow>(
    `SELECT ${COLUMNS} FROM ngos
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

// Accepts an optional transaction client so vetting can update the status AND append its
// audit-ledger entry inside one BEGIN/COMMIT (Slice 10, law 4). Without a client it runs on
// the shared pool.
export async function updateStatus(
  id: string,
  status: string,
  vettedBy: string,
  client?: PoolClient,
): Promise<NgoRow | null> {
  const text = `UPDATE ngos
     SET status = $2, vetted_by = $3, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`;
  const values = [id, status, vettedBy];
  const { rows } = client
    ? await client.query<NgoRow>(text, values)
    : await query<NgoRow>(text, values);
  return rows[0] ?? null;
}
