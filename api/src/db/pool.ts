import { Pool, QueryResult, QueryResultRow } from 'pg';
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

// Lightweight liveness probe used by the health check.
export async function ping(): Promise<boolean> {
  const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}
