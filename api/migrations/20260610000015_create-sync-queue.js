/* eslint-disable camelcase */

// Slice 12: Offline sync queue + monotonic pull cursor (v3 Slice 12, v2 §4.7, §5.7, §6.4).
// The field client captures writes offline and replays them on reconnect; this table is the
// server-side landing zone + change feed that makes that replay correct.
//
// THREE LOCKED DESIGN DECISIONS this schema encodes (do NOT redesign):
//
//  1. THE PULL CURSOR IS A SERVER-ASSIGNED MONOTONIC seq, NEVER A TIMESTAMP. `seq` defaults to
//     nextval('global_sync_sequence') — assigned at INSERT time on the server. GET
//     /sync/pull?since_seq=<bigint> returns rows where seq > since_seq ordered by seq ASC. A
//     Postgres sequence is gap-safe for cursor purposes: even if a txn rolls back and skips a
//     value, the client never receives a seq lower than one it has seen, so there is no
//     same-millisecond window where a committed row is invisible to a later seq-ordered scan.
//     `client_created_at` is the DEVICE clock — advisory metadata only, never the cursor, never
//     an overwrite decision.
//
//  2. PUSH IS IDEMPOTENT VIA client_uuid. The mobile outbox stamps each op with a client_uuid;
//     uq_sync_idem (UNIQUE) makes a replayed op a no-op — the push handler INSERTs ... ON
//     CONFLICT (client_uuid) DO NOTHING and, on no row, returns the prior result without
//     re-writing. Retry-on-reconnect is therefore safe.
//
//  3. CONFLICTS ARE RESOLVED BY HUMANS ON WEB. The server DETECTS a conflict (an op whose
//     expected base — e.g. a task's fromStatus — no longer matches the current server record)
//     and parks the row at status='conflict' with server_snapshot captured for a side-by-side
//     diff. A coordinator resolves it on the web reconciliation screen (keep_server | keep_client
//     | merge); resolving re-stamps seq so the outcome re-enters the pull feed and the device
//     reconciles its outbox by client_uuid. Mobile shows only an "N conflicts" badge.
//
// RLS — the Slice-9 / Slice-10 lesson reapplied: the app connects as the table OWNER, so a plain
// grant is theater. ENABLE + FORCE row-level security with a single tenant_rw policy so each
// device only ever sees/writes its own NGO's queue (push, pull, conflicts list, and resolve all
// run inside withTenant(ngoId), which sets app.current_ngo_id). The empty-string→NULL guard
// (NULLIF(...,'')) fails closed to 0 rows when the GUC is unset on a recycled pooled connection,
// rather than throwing on ''::uuid.
//
// Columns beyond the v2 §4.7 sketch (entity_id, result, server_snapshot) carry the canonical
// server entity for pull hydration and the diff for reconciliation — they do not alter the three
// locked decisions. This migration INSERTS NO DATA and is fully reversible. Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    -- One global monotonic counter shared across all syncable writes (v2 §4.7). seq is the
    -- pull cursor; it is assigned on the SERVER at insert time, never derived from a clock.
    CREATE SEQUENCE global_sync_sequence START 1 INCREMENT 1;

    CREATE TABLE sync_queue (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ngo_id            UUID NOT NULL REFERENCES ngos(id),
      client_uuid       UUID NOT NULL,                                  -- idempotency key from the mobile outbox
      entity_type       TEXT NOT NULL,                                  -- beneficiary | task_transition | beneficiary_verify
      payload           JSONB NOT NULL,                                 -- the client op as captured (forensics + replay)
      seq               BIGINT NOT NULL DEFAULT nextval('global_sync_sequence'), -- THE pull cursor
      client_created_at TIMESTAMPTZ NOT NULL,                           -- device clock (advisory only)
      status            TEXT NOT NULL DEFAULT 'pending',                -- pending|merged|conflict|resolved|rejected
      entity_id         UUID,                                           -- the server entity the op resolved to
      result            JSONB,                                          -- canonical server entity post-write (what pull returns)
      server_snapshot   JSONB,                                          -- server's current entity at conflict-detection (diff's server side)
      conflict_with     UUID,                                           -- the existing server record this op conflicts with
      reject_reason     TEXT,                                           -- why a malformed/illegal op was rejected
      resolved_by       UUID REFERENCES users(id),
      received_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Idempotency: a replayed client_uuid can never double-write.
    CREATE UNIQUE INDEX uq_sync_idem   ON sync_queue (client_uuid);
    -- Fast seq-ordered cursor scans, scoped per tenant for the pull feed.
    CREATE INDEX        idx_sync_seq   ON sync_queue (ngo_id, seq);
    -- Keyset list of open conflicts for the web reconciliation screen.
    CREATE INDEX        idx_sync_conflicts ON sync_queue (status, received_at DESC, id DESC);

    -- DB-enforced tenant isolation (FORCE binds even the owner app). Own-NGO rows only.
    ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sync_queue FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON sync_queue
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS tenant_rw ON sync_queue;
    ALTER TABLE sync_queue NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE sync_queue DISABLE ROW LEVEL SECURITY;
    DROP TABLE IF EXISTS sync_queue;
    DROP SEQUENCE IF EXISTS global_sync_sequence;
  `);
};
