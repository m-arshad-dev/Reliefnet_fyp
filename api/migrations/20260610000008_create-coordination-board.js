/* eslint-disable camelcase */

// Slice 3: Coordination Board (v3 Slice 3). The project's FIRST cross-tenant feature.
// Two tables — resource_needs (raised by field_coordinators) and resource_offers
// (raised by ngo_admins) — each carry `ngo_id` (the tenant owner, forced from the JWT
// on write) AND `disaster_id` (the shared frame the board hangs off). The board READS
// across all NGOs for a disaster; writes stay tenant-owned (see the repositories).
//
// `visibility` on offers is the deliberate cross-tenant carve-out seam: only
// visibility='shared' offers are ever exposed cross-tenant, so Slice 9's RLS can write
// an explicit shared-read policy without touching the default-deny on everything else.
//
// Status/enum columns are plain TEXT with comments (matching campaigns/disasters — no
// CHECK constraints; legality is validated in Zod + the service). The composite board
// indexes back the cross-tenant keyset reads (WHERE disaster_id = $1 AND status = $2
// [AND visibility = 'shared'] ORDER BY created_at DESC, id DESC). Raw SQL via pgm.sql().
//
// FKs resolve against ngos (Slice 1), disaster_events + locations (migrations 04–05),
// users (Slice 0). No matching engine yet (resource_matches lands in Slice 4); the
// non-initial statuses exist on the columns now but transitions arrive with matching.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE resource_needs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ngo_id       UUID NOT NULL REFERENCES ngos(id),
      disaster_id  UUID NOT NULL REFERENCES disaster_events(id),
      type         TEXT NOT NULL,                       -- shelter|food|water|health|wash|other
      quantity     INTEGER NOT NULL,
      location_id  UUID REFERENCES locations(id),
      priority     TEXT NOT NULL DEFAULT 'moderate',    -- low|moderate|high|critical
      description  TEXT,                                 -- optional specifics ("Family tents")
      status       TEXT NOT NULL DEFAULT 'open',         -- open|matched|fulfilling|fulfilled|closed|cancelled
      created_by   UUID NOT NULL REFERENCES users(id),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Cross-tenant board read: filter by disaster + status, keyset on (created_at, id).
    CREATE INDEX idx_needs_board ON resource_needs (disaster_id, status, created_at DESC, id DESC);

    CREATE TABLE resource_offers (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ngo_id          UUID NOT NULL REFERENCES ngos(id),
      disaster_id     UUID NOT NULL REFERENCES disaster_events(id),
      type            TEXT NOT NULL,                     -- shelter|food|water|health|wash|other
      quantity        INTEGER NOT NULL,
      location_id     UUID REFERENCES locations(id),
      available_from  DATE,
      available_until DATE,
      visibility      TEXT NOT NULL DEFAULT 'shared',    -- shared|private (the Slice-9 RLS carve-out seam)
      description     TEXT,
      status          TEXT NOT NULL DEFAULT 'available',  -- available|reserved|committed|delivered|closed
      created_by      UUID NOT NULL REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Cross-tenant board read: only visibility='shared' rows are ever exposed cross-tenant.
    CREATE INDEX idx_offers_board ON resource_offers (disaster_id, visibility, status, created_at DESC, id DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS resource_offers;
    DROP TABLE IF EXISTS resource_needs;
  `);
};
