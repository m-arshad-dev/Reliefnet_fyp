import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import { withCrossTenant } from '../db/pool';
import * as auditRepo from '../repositories/audit.repository';
import type { AuditRow } from '../repositories/audit.repository';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';

// Slice 10 — the hash-chained, append-only audit ledger (v2 §4.8). record() appends one row
// INSIDE each state-changing service's existing transaction (law 4); the chain is GLOBAL
// (one BIGSERIAL id, one prev_hash linkage across all NGOs). Reads (list/verify) are
// oversight-only, gated by authorize('audit:read') at the route.

// The first row chains off this fixed genesis hash (64 hex zeros).
export const GENESIS_HASH = '0'.repeat(64);

// A stable, process-independent advisory-lock key for the single global chain. Taken as an
// xact lock inside the action's transaction so it auto-releases at COMMIT/ROLLBACK.
const ADVISORY_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext('reliefnet:audit_ledger'))";

// ── Canonical serialization (must be byte-identical at write time and verify time) ──────────
// Recursive, key-sorted JSON with no incidental whitespace. JSON.stringify alone is NOT enough:
// JSONB does not preserve object key order, so we sort keys here and never hash raw JSON text.
function canonicalize(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

interface PayloadFields {
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  ngoId: string | null;
  metadata: unknown;
  createdAt: Date | string;
}

// Build the exact object the hash covers. metadata is normalized through a JSON round-trip so
// it matches what is physically stored in JSONB (this drops any undefined-valued keys exactly
// as the INSERT's JSON.stringify does, keeping write and verify identical). createdAt is pinned
// to its ISO-8601 form — both sides go through a JS Date so the timestamptz round-trip is stable.
function buildCanonicalPayload(fields: PayloadFields): Record<string, unknown> {
  return {
    action: fields.action,
    actorId: fields.actorId ?? null,
    createdAt: new Date(fields.createdAt).toISOString(),
    entityId: fields.entityId ?? null,
    entityType: fields.entityType,
    metadata: JSON.parse(JSON.stringify(fields.metadata ?? null)),
    ngoId: fields.ngoId ?? null,
  };
}

function computeRowHash(prevHash: string, fields: PayloadFields): string {
  const canonical = canonicalize(buildCanonicalPayload(fields));
  return createHash('sha256')
    .update(prevHash + canonical)
    .digest('hex');
}

export interface RecordInput {
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  actorId: string | null;
  ngoId: string | null;
}

// Append one ledger row on the SAME client/transaction as the action that triggered it.
// Sequence: take the advisory lock (serializes appends so two can't read the same tip and fork
// the chain) -> read the true latest tip -> compute row_hash -> insert. The lock releases when
// the surrounding action transaction commits/rolls back; if it rolls back, this row does too.
export async function record(client: PoolClient, input: RecordInput): Promise<AuditRow> {
  await client.query(ADVISORY_LOCK_SQL);
  const prevHash = (await auditRepo.latestRowHash(client)) ?? GENESIS_HASH;
  const createdAt = new Date();
  const rowHash = computeRowHash(prevHash, {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId,
    ngoId: input.ngoId,
    metadata: input.metadata,
    createdAt,
  });
  return auditRepo.insertEntry(
    {
      ngoId: input.ngoId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? null,
      prevHash,
      rowHash,
      createdAt,
    },
    client,
  );
}

// ── Read side (oversight only) ──────────────────────────────────────────────────────────────
export interface PublicAuditEntry {
  id: string;
  ngoId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  prevHash: string | null;
  rowHash: string;
  createdAt: string;
}

function toPublicEntry(row: AuditRow): PublicAuditEntry {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    prevHash: row.prev_hash,
    rowHash: row.row_hash,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listLedger(opts: {
  entityType?: string;
  actorId?: string;
  limit?: number;
  cursor?: string;
}): Promise<Page<PublicAuditEntry>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await withCrossTenant((client) =>
    auditRepo.listLedger(
      { entityType: opts.entityType, actorId: opts.actorId, limit, cursorId: cursor?.id ?? null },
      client,
    ),
  );
  return buildPage(rows, limit, toPublicEntry);
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  head: string | null;
  brokenRow?: { id: string; reason: 'prev_hash_mismatch' | 'row_hash_mismatch' };
}

// Recompute the WHOLE chain in id order. Two checks per row: (1) linkage — prev_hash equals the
// previous row's stored row_hash (a deletion/insertion/reorder fails here); (2) integrity —
// recomputing row_hash from the row's own content matches the stored row_hash (an edit fails
// here). Returns the first broken row, if any.
export async function verifyChain(): Promise<VerifyResult> {
  const rows = await withCrossTenant((client) => auditRepo.listForVerify(client));

  let expectedPrev = GENESIS_HASH;
  for (const row of rows) {
    if (row.prev_hash !== expectedPrev) {
      return { ok: false, checked: rows.length, head: null, brokenRow: { id: row.id, reason: 'prev_hash_mismatch' } };
    }
    const recomputed = computeRowHash(expectedPrev, {
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actorId: row.actor_id,
      ngoId: row.ngo_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    });
    if (recomputed !== row.row_hash) {
      return { ok: false, checked: rows.length, head: null, brokenRow: { id: row.id, reason: 'row_hash_mismatch' } };
    }
    expectedPrev = row.row_hash;
  }

  return { ok: true, checked: rows.length, head: rows.length ? expectedPrev : null };
}
