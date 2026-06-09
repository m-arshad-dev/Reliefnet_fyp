import { query } from '../db/pool';

// The shape of a row in the `users` table (snake_case, straight from SQL).
export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, full_name, email, password_hash, role, is_active, created_at, updated_at`;

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
