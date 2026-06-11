/* eslint-disable camelcase */

// Slice 9: Row-Level Security (v3 Slice 9, v2 §3.1) — DB-enforced tenant isolation, the
// SECOND wall behind app-layer scoping (belt and suspenders; app-layer WHERE ngo_id stays).
// Even a query that forgets its tenant filter cannot leak another NGO's rows once RLS is on.
//
// Two transaction-scoped GUCs (set by the withTenant* helpers in src/db/pool.ts) drive
// every policy here:
//   app.current_ngo_id — the caller's tenant uuid; `tenant_rw` matches a row's ngo_id to it.
//   app.cross_tenant   — 'on' opens the deliberate read carve-outs (board, dup-check,
//                        reports) and the matching offer-status write seam.
// current_setting(name, true) uses missing_ok=true. NULLIF(..., '') is the crucial twist:
// a pooled connection that previously served a withTenant txn reverts the LOCAL GUC to the
// EMPTY STRING (not NULL) after COMMIT, and ''::uuid would THROW. NULLIF maps '' → NULL, so a
// query with no tenant set is DENIED cleanly (NULL never equals a real ngo_id) instead of
// erroring. With neither GUC set, RLS denies everything (fail-closed).
//
// FORCE is mandatory, not optional: the app connects as the table OWNER (the role that ran
// these migrations), and owners BYPASS plain ENABLE'd RLS. FORCE makes the owner obey its
// own policies. Permissive policies are OR-combined, so a row is visible if ANY policy's
// USING is true; a write is allowed if ANY policy's WITH CHECK is true.
//
// Three excluded tables keep app-layer scoping only (deliberate, see the plan):
//   users  — read pre-JWT by login/refresh/me (no tenant exists yet); strict RLS breaks login.
//   ngos   — the tenant ROOT (rows ARE tenants); JOINed cross-tenant for NGO names everywhere.
//   disaster_events / locations — global reference, no ngo_id.
//
// This migration INSERTS NO DATA (CI migration smoke test stays green) and is fully
// reversible (down drops every policy and DISABLEs RLS). Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    -- ── Tier A: strictly private (no cross-tenant read at all) ──────────────────────────
    -- inventory_items / stock_movements / tasks are PRIVATE per NGO. In plain tenant mode
    -- they have NO cross-tenant carve-out, so a forged query (its WHERE ngo_id stripped)
    -- returns ZERO foreign rows — the DoD demonstration target.

    ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_items FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON inventory_items
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);

    ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE stock_movements FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON stock_movements
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);

    ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tasks FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON tasks
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);

    -- task_transitions has no ngo_id of its own — it inherits the tenant of its parent task.
    -- The EXISTS subquery on tasks is itself filtered by tasks' tenant_rw policy (same GUC),
    -- so a transition is visible/writable only when its parent task is the caller's.
    ALTER TABLE task_transitions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE task_transitions FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON task_transitions
      USING      (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id
                          AND t.ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid))
      WITH CHECK (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id
                          AND t.ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid));

    -- ── Tier A + report carve-out (private, but reports read them cross-tenant) ──────────
    -- tenant_rw isolates as above; cross_tenant_read adds a SELECT-ONLY window that opens
    -- ONLY when a helper has set app.cross_tenant='on' (the reporting aggregates + the
    -- CNIC dup-check). Plain withTenant reads never set that flag, so they stay strictly
    -- isolated — which is exactly what the forged-query DoD test exercises.

    ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
    ALTER TABLE campaigns FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON campaigns
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);
    CREATE POLICY cross_tenant_read ON campaigns FOR SELECT
      USING (current_setting('app.cross_tenant', true) = 'on');

    ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE beneficiaries FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON beneficiaries
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);
    CREATE POLICY cross_tenant_read ON beneficiaries FOR SELECT
      USING (current_setting('app.cross_tenant', true) = 'on');

    -- aid_records: the cross_tenant read is the CNIC duplicate-flag seam (prior aid by ANY
    -- NGO) plus the coverage report. Still SELECT-only — no cross-tenant aid WRITE.
    ALTER TABLE aid_records ENABLE ROW LEVEL SECURITY;
    ALTER TABLE aid_records FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON aid_records
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);
    CREATE POLICY cross_tenant_read ON aid_records FOR SELECT
      USING (current_setting('app.cross_tenant', true) = 'on');

    -- ── Tier B: coordination / shared ───────────────────────────────────────────────────
    -- resource_needs: own rows via tenant_rw; the board reads ALL NGOs' needs when
    -- cross_tenant='on' (needs are public on the coordination board — no visibility gate).
    ALTER TABLE resource_needs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE resource_needs FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON resource_needs
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);
    CREATE POLICY board_read ON resource_needs FOR SELECT
      USING (current_setting('app.cross_tenant', true) = 'on');

    -- resource_offers: own rows via tenant_rw; shared_read exposes only visibility='shared'
    -- offers cross-tenant (private offers stay with their owner). shared_match_write is the
    -- matching seam — it lets a needing NGO (in a withTenantShared txn) move a counterparty's
    -- SHARED offer status during a match. Postgres applies the UPDATE USING policy to
    -- SELECT ... FOR UPDATE locks too, so this also unblocks the offer's FOR UPDATE lock in
    -- proposeMatch. KNOWN LIMITATION: RLS can't restrict this to the status column — the FSM
    -- + app-layer scoping still gate it; donor-consent cross-tenant write is a deferred slice.
    ALTER TABLE resource_offers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE resource_offers FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON resource_offers
      USING      (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
      WITH CHECK (ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid);
    CREATE POLICY shared_read ON resource_offers FOR SELECT
      USING (current_setting('app.cross_tenant', true) = 'on' AND visibility = 'shared');
    CREATE POLICY shared_match_write ON resource_offers FOR UPDATE
      USING      (current_setting('app.cross_tenant', true) = 'on' AND visibility = 'shared')
      WITH CHECK (current_setting('app.cross_tenant', true) = 'on' AND visibility = 'shared');

    -- resource_matches has no ngo_id — a match belongs to BOTH the needing and offering NGO.
    -- tenant_rw is satisfied via EITHER parent (so both sides can read/transition their own
    -- matches); the WITH CHECK pins the NEEDING side (only the needing NGO inserts/advances).
    -- report_read opens all matches for the cross-tenant reporting aggregates.
    ALTER TABLE resource_matches ENABLE ROW LEVEL SECURITY;
    ALTER TABLE resource_matches FORCE  ROW LEVEL SECURITY;
    CREATE POLICY tenant_rw ON resource_matches
      USING      (EXISTS (SELECT 1 FROM resource_needs  rn WHERE rn.id = need_id
                          AND rn.ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid)
               OR EXISTS (SELECT 1 FROM resource_offers ro WHERE ro.id = offer_id
                          AND ro.ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid))
      WITH CHECK (EXISTS (SELECT 1 FROM resource_needs  rn WHERE rn.id = need_id
                          AND rn.ngo_id = NULLIF(current_setting('app.current_ngo_id', true), '')::uuid));
    CREATE POLICY report_read ON resource_matches FOR SELECT
      USING (current_setting('app.cross_tenant', true) = 'on');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS report_read         ON resource_matches;
    DROP POLICY IF EXISTS tenant_rw           ON resource_matches;
    ALTER TABLE resource_matches NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE resource_matches DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS shared_match_write  ON resource_offers;
    DROP POLICY IF EXISTS shared_read         ON resource_offers;
    DROP POLICY IF EXISTS tenant_rw           ON resource_offers;
    ALTER TABLE resource_offers NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE resource_offers DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS board_read          ON resource_needs;
    DROP POLICY IF EXISTS tenant_rw           ON resource_needs;
    ALTER TABLE resource_needs NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE resource_needs DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS cross_tenant_read   ON aid_records;
    DROP POLICY IF EXISTS tenant_rw           ON aid_records;
    ALTER TABLE aid_records NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE aid_records DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS cross_tenant_read   ON beneficiaries;
    DROP POLICY IF EXISTS tenant_rw           ON beneficiaries;
    ALTER TABLE beneficiaries NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE beneficiaries DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS cross_tenant_read   ON campaigns;
    DROP POLICY IF EXISTS tenant_rw           ON campaigns;
    ALTER TABLE campaigns NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_rw           ON task_transitions;
    ALTER TABLE task_transitions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE task_transitions DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_rw           ON tasks;
    ALTER TABLE tasks NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_rw           ON stock_movements;
    ALTER TABLE stock_movements NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_rw           ON inventory_items;
    ALTER TABLE inventory_items NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;
  `);
};
