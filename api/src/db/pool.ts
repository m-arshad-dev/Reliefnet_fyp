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
// throw anywhere rolls the whole thing back — no partial writes. This is the PLAIN
// transaction with no RLS GUC set — kept for the excluded-table flows (register-ngo:
// users + ngos) that have no tenant to scope to. RLS-table work uses the `withTenant*`
// helpers below instead, which set the same BEGIN/COMMIT plus the tenancy GUCs.
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

// ── Slice 9 — Row-Level Security transaction helpers (v2 §3.1) ───────────────────────
// Two transaction-scoped GUCs drive every RLS policy in migration 013:
//   • app.current_ngo_id — the caller's tenant uuid; `tenant_rw` policies match on it.
//   • app.cross_tenant   — 'on' opens the deliberate cross-tenant read carve-outs
//                          (coordination board, dup-check, reports) and the matching
//                          offer-status write seam.
// With NEITHER set, FORCE RLS denies everything (current_setting(..., true) → NULL →
// no policy matches) — fail-closed by default.
//
// `set_config(name, value, is_local=true)` is the parameterized form of `SET LOCAL`
// (plain `SET LOCAL x = $1` can't bind a parameter), so the tenant uuid is passed as a
// bound value, never string-concatenated. Being LOCAL, the GUC resets at COMMIT/ROLLBACK,
// so the connection returns to the pool clean — the next checkout starts with no tenant.

// Tenant mode — own rows only. Every per-NGO read/write (campaigns, inventory, tasks,
// beneficiaries, own needs/offers) runs here; RLS hides every other tenant's rows even
// if a query forgets its `WHERE ngo_id`.
export async function withTenant<T>(
  ngoId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_ngo_id', $1, true)", [ngoId]);
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

// Deliberate cross-tenant READ — no tenant set, just the carve-out flag. Powers the
// coordination board (open needs / shared offers), match candidates, the CNIC dup-check,
// the reporting aggregates, and tenantless system_admin/auditor oversight.
export async function withCrossTenant<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.cross_tenant', 'on', true)", []);
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

// Tenant mode + the cross-tenant seam in ONE transaction. For flows that write their own
// rows AND legitimately touch a counterparty's: the matching write (needing NGO moves its
// own need + the shared offer's status, JOINs both NGOs' rows) and beneficiary register
// (own write + the cross-NGO prior-aid hash read).
export async function withTenantShared<T>(
  ngoId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_ngo_id', $1, true)", [ngoId]);
    await client.query("SELECT set_config('app.cross_tenant', 'on', true)", []);
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
