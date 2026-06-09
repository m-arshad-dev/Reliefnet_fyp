import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of a row in the `users` table (snake_case, straight from SQL).
export interface UserRow {
  id: string;
  ngo_id: string | null;
  full_name: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, ngo_id, full_name, email, password_hash, role, is_active, created_at, updated_at`;

export async function findByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${COLUMNS} FROM users WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${COLUMNS} FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

interface InsertUserParams {
  ngoId: string | null;
  fullName: string;
  email: string;
  passwordHash: string;
  role: string;
}

// Optional transaction client: register-ngo passes the BEGIN/COMMIT client so the
// first admin and its ngo commit atomically; staff creation runs on the pool.
export async function insert(params: InsertUserParams, client?: PoolClient): Promise<UserRow> {
  const text = `INSERT INTO users (ngo_id, full_name, email, password_hash, role)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING ${COLUMNS}`;
  const values = [params.ngoId, params.fullName, params.email, params.passwordHash, params.role];
  const { rows } = client
    ? await client.query<UserRow>(text, values)
    : await query<UserRow>(text, values);
  return rows[0];
}

// Tenant-scoped keyset page: only users belonging to `ngoId`. This WHERE clause is
// the app-layer isolation guarantee for Slice 1 (DB-enforced RLS arrives in Slice 9).
export async function listByNgo(
  ngoId: string,
  opts: { limit: number; cursor?: Keyset | null },
): Promise<UserRow[]> {
  const { limit, cursor } = opts;
  if (cursor) {
    const { rows } = await query<UserRow>(
      `SELECT ${COLUMNS} FROM users
       WHERE ngo_id = $1 AND (created_at, id) < ($2::timestamptz, $3::uuid)
       ORDER BY created_at DESC, id DESC
       LIMIT $4`,
      [ngoId, cursor.createdAt, cursor.id, limit],
    );
    return rows;
  }
  const { rows } = await query<UserRow>(
    `SELECT ${COLUMNS} FROM users
     WHERE ngo_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [ngoId, limit],
  );
  return rows;
}
