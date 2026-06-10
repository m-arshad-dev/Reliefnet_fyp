/* eslint-disable camelcase */

// Slice 6: Inventory FSM — MOVEMENT-AUTHORITATIVE (v3 Slice 6, v2 §4.5). The defining
// decision: there is NO mutable quantity_on_hand counter (v2 §4.5 lists one — we
// deliberately omit it). Every stock change is an IMMUTABLE, append-only stock_movements
// row; current quantity on hand is DERIVED by summing movements per item. That gives a
// full audit trail of every unit — the whole point in a relief context — and sets up the
// Slice-10 audit ledger cleanly.
//
//   inventory_items — TENANT-OWNED catalogue (every row carries ngo_id, forced from the
//   caller's JWT). Inventory is PRIVATE per NGO this slice (no cross-tenant read seam).
//
//   stock_movements — the append-only ledger. Each row records `quantity` units moving
//   from `prev_state` -> `state`. The forward FSM (stock_in -> allocated -> dispatched ->
//   delivered -> consumed) is enforced in inventory.service.ts (law 3 — TRANSITIONS map),
//   NOT in the DB. `correction` is a special append-only branch (state='correction',
//   ngo_admin-only + mandatory note, both enforced in the service); it is written as a NEW
//   row and NEVER mutates a prior row.
//
// Per-state balance is derived purely by summing:
//   balance(item, S) = Σ quantity WHERE state=S − Σ quantity WHERE prev_state=S
// `stock_in` has prev_state=NULL (the only entry point). Headline quantity-on-hand =
// balance(item,'stock_in') + Σ(correction.quantity) — "available to allocate".
//
// No CHECK constraints (legality lives in the service, matching needs/offers/matches). No
// campaign_id (v2 §4.5 has it nullable — omitted; not needed this slice). NUMERIC supports
// fractional units (kg/litre); reads cast ::float8 so JS gets numbers, not strings.
//
// DEFERRED (additive later slices): RLS / SET LOCAL app.current_ngo_id (Slice 9); the
// hash-chained audit ledger entry inside the movement transaction (Slice 10); linking an
// offer to an inventory item so fulfilling a match moves stock (later concern). FKs resolve
// against ngos + users (Slices 0–1). Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE inventory_items (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ngo_id      UUID NOT NULL REFERENCES ngos(id),
      name        TEXT NOT NULL,                      -- "Food ration pack"
      unit        TEXT NOT NULL,                      -- pack|kg|litre|unit
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- DELIBERATELY no quantity_on_hand column: movement-authoritative, derived by summing.

    -- Tenant keyset list (matches the campaigns/beneficiaries convention), newest first.
    CREATE INDEX idx_inventory_items_tenant_keyset
      ON inventory_items (ngo_id, created_at DESC, id DESC);

    -- The append-only movement ledger. One row = quantity units moving prev_state -> state.
    CREATE TABLE stock_movements (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ngo_id          UUID NOT NULL REFERENCES ngos(id),
      item_id         UUID NOT NULL REFERENCES inventory_items(id),
      quantity        NUMERIC NOT NULL,               -- fractional units ok; signed for correction
      state           TEXT NOT NULL,                  -- stock_in|allocated|dispatched|delivered|consumed|correction
      prev_state      TEXT,                           -- the from-state; NULL only for stock_in entry
      correction_note TEXT,                           -- REQUIRED when state='correction' (service-enforced), else NULL
      moved_by        UUID NOT NULL REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Per-item movement history (keyset, newest first).
    CREATE INDEX idx_stock_movements_item_keyset ON stock_movements (item_id, created_at DESC, id DESC);
    -- Backs the derived balance sums: Σ by (item, state) and Σ by (item, prev_state).
    CREATE INDEX idx_stock_movements_item_state  ON stock_movements (item_id, state);
    CREATE INDEX idx_stock_movements_item_prev   ON stock_movements (item_id, prev_state);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS stock_movements;
    DROP TABLE IF EXISTS inventory_items;
  `);
};
