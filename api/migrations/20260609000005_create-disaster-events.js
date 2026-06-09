/* eslint-disable camelcase */

// Slice 2: disaster events (v2 §4.3). These are GLOBAL — no `ngo_id`. A system_admin
// creates them; every authenticated NGO can read them (a campaign references one).
// `region_id` and `created_by` resolve against tables that already exist (locations
// from migration 04, users from Slice 0). `starts_on` is required; `ends_on` is open
// while the event is ongoing. created_at/updated_at back keyset pagination + the
// CLAUDE.md "every table" rule. Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE disaster_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,                      -- "Punjab Monsoon Floods 2026"
      type        TEXT NOT NULL,                      -- flood|earthquake|drought|other
      severity    TEXT NOT NULL,                      -- low|moderate|high|critical
      region_id   UUID REFERENCES locations(id),
      starts_on   DATE NOT NULL,
      ends_on     DATE,
      status      TEXT NOT NULL DEFAULT 'active',     -- active|closed
      created_by  UUID NOT NULL REFERENCES users(id), -- system admin
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS disaster_events;`);
};
