import { PoolClient } from 'pg';
import type { Keyset } from '../lib/pagination';

// Slice 12 — the sync_queue data access (v2 §4.7). Raw, parameterized SQL only (law 1). Every
// function takes the caller's withTenant/withTenantShared `client` so the row is written/read
// under the tenant GUC that drives the table's RLS policy. seq is a BIGINT and pg hands int8
// back as a STRING — we keep it a string end-to-end (like the audit ledger's BIGSERIAL id) so a
// large cursor never loses precision in JS.

export interface SyncQueueRow {
  id: string;
  ngo_id: string;
  client_uuid: string;
  entity_type: string;
  payload: unknown;
  seq: string;
  client_created_at: Date;
  status: string;
  entity_id: string | null;
  result: unknown;
  server_snapshot: unknown;
  conflict_with: string | null;
  reject_reason: string | null;
  resolved_by: string | null;
  received_at: Date;
}

const COLUMNS = `id, ngo_id, client_uuid, entity_type, payload, seq, client_created_at, status,
                 entity_id, result, server_snapshot, conflict_with, reject_reason, resolved_by,
                 received_at`;

interface InsertOpParams {
  ngoId: string;
  clientUuid: string;
  entityType: string;
  payload: unknown;
  clientCreatedAt: string; // ISO from the device (advisory only)
}

// Land an offline op. ON CONFLICT (client_uuid) DO NOTHING is the idempotency gate (law: a
// replayed client_uuid must not double-write): on a first arrival it RETURNs the new row's id +
// server-assigned seq; on a replay it RETURNs nothing and the caller fetches the prior outcome.
// seq takes its column default nextval('global_sync_sequence') — assigned here, on the server.
export async function insertOp(
  params: InsertOpParams,
  client: PoolClient,
): Promise<{ id: string; seq: string } | null> {
  const { rows } = await client.query<{ id: string; seq: string }>(
    `INSERT INTO sync_queue (ngo_id, client_uuid, entity_type, payload, client_created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (client_uuid) DO NOTHING
     RETURNING id, seq`,
    [params.ngoId, params.clientUuid, params.entityType, JSON.stringify(params.payload), params.clientCreatedAt],
  );
  return rows[0] ?? null;
}

export async function findByClientUuid(
  clientUuid: string,
  client: PoolClient,
): Promise<SyncQueueRow | null> {
  const { rows } = await client.query<SyncQueueRow>(
    `SELECT ${COLUMNS} FROM sync_queue WHERE client_uuid = $1`,
    [clientUuid],
  );
  return rows[0] ?? null;
}

// Mark an op applied. `result` is the canonical server entity post-write — what GET /sync/pull
// hands back so other devices hydrate from server truth, not the raw client payload.
export async function markMerged(
  id: string,
  params: { entityId: string | null; result: unknown },
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE sync_queue SET status = 'merged', entity_id = $2, result = $3::jsonb WHERE id = $1`,
    [id, params.entityId, JSON.stringify(params.result ?? null)],
  );
}

// Park a conflict for human resolution on web. server_snapshot is the current server entity
// (the diff's "server" side; the "client" side is the stored payload).
export async function markConflict(
  id: string,
  params: { entityId: string | null; conflictWith: string | null; serverSnapshot: unknown },
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE sync_queue
       SET status = 'conflict', entity_id = $2, conflict_with = $3, server_snapshot = $4::jsonb
     WHERE id = $1`,
    [id, params.entityId, params.conflictWith, JSON.stringify(params.serverSnapshot ?? null)],
  );
}

// A well-formed-but-illegal op (e.g. base matched yet the requested edge is FSM-illegal, or an
// unknown campaign). Recorded durably so a replay returns 'rejected' rather than reprocessing.
export async function markRejected(
  id: string,
  reason: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE sync_queue SET status = 'rejected', reject_reason = $2 WHERE id = $1`,
    [id, reason],
  );
}

export interface PullRow {
  id: string;
  seq: string;
  client_uuid: string;
  entity_type: string;
  entity_id: string | null;
  status: string;
  result: unknown;
}

// THE PULL CURSOR (v2 §4.7): rows for this tenant with seq strictly greater than the client's
// stored cursor, ORDERED BY seq ASC — never by a timestamp. Only merged/resolved rows are
// pulled (pending/conflict/rejected never masquerade as server truth). Bounded by limit.
export async function pullSince(
  ngoId: string,
  sinceSeq: string,
  limit: number,
  client: PoolClient,
): Promise<PullRow[]> {
  const { rows } = await client.query<PullRow>(
    `SELECT id, seq, client_uuid, entity_type, entity_id, status, result
     FROM sync_queue
     WHERE ngo_id = $1 AND seq > $2::bigint AND status IN ('merged', 'resolved')
     ORDER BY seq ASC
     LIMIT $3`,
    [ngoId, sinceSeq, limit],
  );
  return rows;
}

// Keyset list of OPEN conflicts for the web reconciliation screen. received_at is aliased to
// created_at so the shared buildPage/decodeCursor keyset helpers apply unchanged.
export interface ConflictListRow {
  id: string;
  ngo_id: string;
  client_uuid: string;
  entity_type: string;
  payload: unknown;
  server_snapshot: unknown;
  entity_id: string | null;
  conflict_with: string | null;
  client_created_at: Date;
  created_at: Date; // received_at, aliased for the keyset helper
}

export async function listConflicts(
  ngoId: string,
  opts: { limit: number; cursor?: Keyset | null },
  client: PoolClient,
): Promise<ConflictListRow[]> {
  const conditions: string[] = ['ngo_id = $1', "status = 'conflict'"];
  const values: unknown[] = [ngoId];

  if (opts.cursor) {
    values.push(opts.cursor.createdAt, opts.cursor.id);
    conditions.push(
      `(received_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
    );
  }
  values.push(opts.limit);
  const limitPos = values.length;

  const { rows } = await client.query<ConflictListRow>(
    `SELECT id, ngo_id, client_uuid, entity_type, payload, server_snapshot, entity_id,
            conflict_with, client_created_at, received_at AS created_at
     FROM sync_queue
     WHERE ${conditions.join(' AND ')}
     ORDER BY received_at DESC, id DESC
     LIMIT $${limitPos}`,
    values,
  );
  return rows;
}

// Load a single open conflict (for resolve). RLS already scopes to the caller's tenant.
export async function findOpenConflict(
  id: string,
  client: PoolClient,
): Promise<SyncQueueRow | null> {
  const { rows } = await client.query<SyncQueueRow>(
    `SELECT ${COLUMNS} FROM sync_queue WHERE id = $1 AND status = 'conflict'`,
    [id],
  );
  return rows[0] ?? null;
}

// Resolve a parked conflict. RE-STAMPS seq from the global sequence so the resolution re-enters
// the pull feed (seq jumps ahead of the cursor any device has seen) — that is how a device
// learns its conflicting op was settled and reconciles its outbox by client_uuid.
export async function resolveOp(
  id: string,
  params: { resolvedBy: string; result: unknown },
  client: PoolClient,
): Promise<{ seq: string }> {
  const { rows } = await client.query<{ seq: string }>(
    `UPDATE sync_queue
       SET status = 'resolved', resolved_by = $2, result = $3::jsonb,
           seq = nextval('global_sync_sequence')
     WHERE id = $1
     RETURNING seq`,
    [id, params.resolvedBy, JSON.stringify(params.result ?? null)],
  );
  return rows[0];
}
