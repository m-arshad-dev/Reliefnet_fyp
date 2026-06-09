import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';

// Single shared connection pool. Every repository goes through `query()` below —
// the one and only entry point for raw, parameterized SQL (no ORM, no query builder).
export const pool = new Pool({ connectionString: env.DATABASE_URL });

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

// One explicit BEGIN/COMMIT per multi-step write (CLAUDE.md law 4). The callback
// receives the checked-out client; all of its queries share one transaction, so a
// throw anywhere rolls the whole thing back — no partial writes. NOTE: this is a
// plain transaction. The `SET LOCAL app.current_ngo_id` (RLS) wiring from v2 §3.1
// is deliberately NOT here yet — that's the Slice 9 hardening upgrade.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Lightweight liveness probe used by the health check.
export async function ping(): Promise<boolean> {
  const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}
