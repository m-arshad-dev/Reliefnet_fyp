/* eslint-disable camelcase */

// Slice 2: the location hierarchy (v2 §4.2). A single self-referencing tree —
// province → district → tehsil → uc → village — via `parent_id` pointing back at
// `locations(id)`. Reference data shared across all tenants (disaster_events and
// campaigns both point their region columns here), so it carries no `ngo_id`.
// lat/lng + census_population are nullable now; the heatmap slice (8) reads them.
// created_at/updated_at per the CLAUDE.md "every table" rule. Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE locations (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id         UUID REFERENCES locations(id),  -- NULL at the province root
      name              TEXT NOT NULL,
      level             TEXT NOT NULL,                   -- province|district|tehsil|uc|village
      latitude          DOUBLE PRECISION,
      longitude         DOUBLE PRECISION,
      census_population INTEGER,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_locations_parent ON locations (parent_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS locations;`);
};
