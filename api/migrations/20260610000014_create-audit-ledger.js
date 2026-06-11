/* eslint-disable camelcase */

// Slice 10: Hash-chained audit ledger (v3 Slice 10, v2 §4.8) — the SECOND hardening pass.
// Adds NO user-facing feature; it makes every state change tamper-EVIDENT.
//
// audit_ledger is APPEND-ONLY and forms ONE GLOBAL hash chain across all NGOs:
//   row_hash = sha256( prev_hash || canonical(action,actor,entity,metadata,ngo,created_at) )
// the FIRST row chains off a fixed genesis hash (64 zeros). Editing or deleting any row
// breaks the chain, which GET /audit/verify recomputes and detects (naming the first bad row).
// auditService.record(client, …) writes one row INSIDE each state-changing service's existing
// withTransaction/withTenant* (law 4), serialized by pg_advisory_xact_lock so two concurrent
// appends can't read the same tip and fork the chain.
//
// APPEND-ONLY ENFORCEMENT — the Slice-9 lesson: the app connects as the table OWNER, and a
// plain `REVOKE UPDATE, DELETE` does NOT bind the owner (ownership confers the privilege).
// So append-only is enforced exactly like Slice 9 enforces isolation: ENABLE + FORCE RLS with
// ONLY an INSERT policy and a SELECT policy — NO update/delete policy. Under FORCE, a command
// with no permissive policy can touch ZERO rows, so even the owner app can neither UPDATE nor
// DELETE a ledger row. Only a DB SUPERUSER (a malicious DBA — the actual threat model) can
// mutate one, and verify catches that. REVOKE … FROM PUBLIC stays as defense-in-depth for
// any non-owner role.
//
//   • SELECT USING (true) is REQUIRED, not lax: record()'s "read the latest tip" runs inside
//     each action's own withTenant(ngoId) txn (app.cross_tenant is NOT on there). A
//     tenant-scoped SELECT policy would let that read see only the caller's own ledger rows
//     and FORK the chain per tenant. The only readers of this table are record()'s tip-read
//     and the /audit/* endpoints (gated by authorize('audit:read'), oversight roles only).
//   • INSERT WITH CHECK (true): rows are written from tenant txns (withTenant*) AND non-tenant
//     txns (withTransaction: onboarding, vetting, disaster), with ngo_id ranging over the
//     acting/target NGO or NULL.
//
// This migration INSERTS NO DATA (CI migration smoke test stays green) and is fully reversible.
// Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE audit_ledger (
      id            BIGSERIAL PRIMARY KEY,            -- monotonic; doubles as the keyset cursor
      ngo_id        UUID,                             -- acting/target NGO; NULL for global actions
      actor_id      UUID,                             -- the user who acted (no FK: ledger outlives users)
      action        TEXT  NOT NULL,                   -- e.g. task.transition, inventory.move, ngo.vetting
      entity_type   TEXT  NOT NULL,                   -- e.g. task, stock_movement, resource_match
      entity_id     UUID,                             -- the affected row's id (NULL where not a UUID)
      metadata      JSONB,                            -- action-specific detail (correction note lives here)
      prev_hash     CHAR(64),                         -- previous row's row_hash; NULL only conceptually
      row_hash      CHAR(64) NOT NULL,                -- sha256(prev_hash || canonical(payload)), hex
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()-- app-SUPPLIED on insert (hashed); default is a safety net
    );

    -- Filtered ledger list (GET /audit/ledger?entityType=&actorId=), keyset on id DESC.
    CREATE INDEX idx_audit_entity ON audit_ledger (entity_type, id DESC);
    CREATE INDEX idx_audit_actor  ON audit_ledger (actor_id, id DESC);

    -- Append-only via FORCE RLS with INSERT + SELECT policies only (see header).
    ALTER TABLE audit_ledger ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_ledger FORCE  ROW LEVEL SECURITY;
    CREATE POLICY append_insert ON audit_ledger FOR INSERT WITH CHECK (true);
    CREATE POLICY read_all      ON audit_ledger FOR SELECT USING (true);
    -- deliberately NO update/delete policy -> under FORCE, even the owner mutates ZERO rows.

    REVOKE UPDATE, DELETE ON audit_ledger FROM PUBLIC;   -- defense-in-depth for non-owner roles
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS read_all      ON audit_ledger;
    DROP POLICY IF EXISTS append_insert ON audit_ledger;
    ALTER TABLE audit_ledger NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE audit_ledger DISABLE ROW LEVEL SECURITY;
    DROP TABLE IF EXISTS audit_ledger;
  `);
};
