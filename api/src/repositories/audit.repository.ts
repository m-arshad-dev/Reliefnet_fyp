import { PoolClient } from 'pg';

// The shape of an `audit_ledger` row (snake_case). `id` is BIGSERIAL — pg returns bigint as a
// STRING (it doesn't fit a JS number safely), so the type is string. `metadata` comes back as
// a parsed JS object/array (node-pg parses JSONB). created_at is a JS Date.
export interface AuditRow {
  id: string;
  ngo_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  prev_hash: string | null;
  row_hash: string;
  created_at: Date;
}

const COLUMNS = `id, ngo_id, actor_id, action, entity_type, entity_id, metadata,
                 prev_hash, row_hash, created_at`;

// The latest tip of the GLOBAL chain (highest id). The caller (auditService.record) holds the
// advisory lock before calling this, so no other appender can be between this read and its
// insert. Returns null when the ledger is empty (the genesis case). Runs on the SAME client as
// the action's transaction.
export async function latestRowHash(client: PoolClient): Promise<string | null> {
  const { rows } = await client.query<{ row_hash: string }>(
    'SELECT row_hash FROM audit_ledger ORDER BY id DESC LIMIT 1',
  );
  return rows[0]?.row_hash ?? null;
}

export interface InsertAuditParams {
  ngoId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  prevHash: string;
  rowHash: string;
  createdAt: Date; // app-supplied so it can be folded into row_hash deterministically
}

// Append one immutable row. Always called with the shared `client` — the insert is the final
// step of the recording transaction, after the advisory lock + tip read + hash computation.
// created_at is passed explicitly (NOT left to DEFAULT now()) because its exact value is part
// of row_hash; verify re-reads and re-hashes it.
export async function insertEntry(
  params: InsertAuditParams,
  client: PoolClient,
): Promise<AuditRow> {
  const text = `INSERT INTO audit_ledger
                  (ngo_id, actor_id, action, entity_type, entity_id, metadata,
                   prev_hash, row_hash, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING ${COLUMNS}`;
  const { rows } = await client.query<AuditRow>(text, [
    params.ngoId,
    params.actorId,
    params.action,
    params.entityType,
    params.entityId,
    // pg serializes a JS object/array to JSONB; stringify keeps NULL distinct from 'null'.
    params.metadata === undefined ? null : JSON.stringify(params.metadata),
    params.prevHash,
    params.rowHash,
    params.createdAt,
  ]);
  return rows[0];
}

// The WHOLE chain in insertion order (id ASC) for GET /audit/verify. Reads inside a
// withCrossTenant txn (the SELECT policy is USING(true), so the oversight read sees every row).
// For this project's scale a single ordered scan is fine.
export async function listForVerify(client: PoolClient): Promise<AuditRow[]> {
  const { rows } = await client.query<AuditRow>(
    `SELECT ${COLUMNS} FROM audit_ledger ORDER BY id ASC`,
  );
  return rows;
}

// Keyset page of the ledger (newest first), filterable by entity_type / actor_id, for
// GET /audit/ledger. Keyset is on the BIGSERIAL id (monotonic) — WHERE id < $cursor.
export async function listLedger(
  opts: { entityType?: string; actorId?: string; limit: number; cursorId?: string | null },
  client: PoolClient,
): Promise<AuditRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (opts.entityType) {
    values.push(opts.entityType);
    conditions.push(`entity_type = $${values.length}`);
  }
  if (opts.actorId) {
    values.push(opts.actorId);
    conditions.push(`actor_id = $${values.length}`);
  }
  if (opts.cursorId) {
    values.push(opts.cursorId);
    conditions.push(`id < $${values.length}::bigint`);
  }
  values.push(opts.limit);
  const limitPos = values.length;

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const text = `SELECT ${COLUMNS} FROM audit_ledger
                ${where}
                ORDER BY id DESC
                LIMIT $${limitPos}`;
  const { rows } = await client.query<AuditRow>(text, values);
  return rows;
}
