/* eslint-disable camelcase */

// Slice 7: Task FSM (v3 Slice 7, v2 §4.6) — field execution of confirmed work, the last
// core domain slice. Two tables:
//
//   tasks — TENANT-OWNED work items (every row carries ngo_id, forced from the caller's
//   JWT; tasks are PRIVATE per NGO this slice — no cross-tenant read seam). `status` is the
//   FSM state (created -> assigned -> in_progress -> pending_verification ->
//   completed|rejected, with rejected -> assigned reassign and escalated -> assigned reset).
//   The TRANSITIONS map + the per-edge permission map live in task.service.ts (law 3) — NOT
//   in the DB; status is plain TEXT + a comment, matching the needs/offers/matches/inventory
//   convention (no CHECK constraint). `rejection_count` increments on every rejection; the
//   service redirects the 3rd rejection to 'escalated' instead of 'rejected' (and the count
//   PERSISTS across that escalation — it is never reset).
//
//   task_transitions — the append-only, immutable history. One row per state change
//   (from_status -> to_status, who, an optional note), written in the SAME withTransaction
//   as the task UPDATE (law 4) so a status move and its audit row can never drift. A genesis
//   row (from_status=NULL -> 'created') is written at creation so the lineage is complete.
//   The history row records the APPLIED status (so a capped rejection shows -> 'escalated').
//
// Assignment: assigned_to references a user; it is set/retargeted on the assign edges
// (created/rejected/escalated -> assigned) and may be pre-filled at creation.
//
// DEFERRED (additive later slices): RLS / SET LOCAL app.current_ngo_id (Slice 9); the
// hash-chained audit ledger entry inside the transition transaction (Slice 10); mobile task
// execution + offline sync (Slices 11–12). FKs resolve against ngos + users (Slices 0–1),
// campaigns (Slice 2) and locations (Slice 2). Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE tasks (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ngo_id          UUID NOT NULL REFERENCES ngos(id),
      campaign_id     UUID NOT NULL REFERENCES campaigns(id),
      title           TEXT NOT NULL,
      description     TEXT,
      location_id     UUID REFERENCES locations(id),
      status          TEXT NOT NULL DEFAULT 'created',
      -- Allowed statuses: created|assigned|in_progress|pending_verification
      --                   |completed|rejected|escalated   (legality enforced in the service)
      rejection_count INTEGER NOT NULL DEFAULT 0,    -- increments on each rejection; persists across escalation
      assigned_to     UUID REFERENCES users(id),
      created_by      UUID NOT NULL REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Tenant keyset list (matches the campaigns/inventory convention), newest first.
    CREATE INDEX idx_tasks_tenant_keyset ON tasks (ngo_id, created_at DESC, id DESC);
    -- Backs ?status= (incl. the escalated queue) and ?assignedTo= filters within a tenant.
    CREATE INDEX idx_tasks_status   ON tasks (ngo_id, status);
    CREATE INDEX idx_tasks_assigned ON tasks (ngo_id, assigned_to);

    -- The append-only transition ledger. from_status is NULL only on the genesis row.
    CREATE TABLE task_transitions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id     UUID NOT NULL REFERENCES tasks(id),
      from_status TEXT,
      to_status   TEXT NOT NULL,
      actor_id    UUID NOT NULL REFERENCES users(id),
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Per-task history (keyset, newest first).
    CREATE INDEX idx_task_transitions_task_keyset
      ON task_transitions (task_id, created_at DESC, id DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS task_transitions;
    DROP TABLE IF EXISTS tasks;
  `);
};
