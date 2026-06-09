/* eslint-disable camelcase */

// Slice 1: introduce tenancy. We add the `ngos` table and give `users` an
// `ngo_id`. The two tables reference each other (ngos.vetted_by -> users,
// users.ngo_id -> ngos), so ORDER matters to avoid a chicken-and-egg FK:
//   1. `users` already exists from Slice 0, so we can create `ngos` first —
//      its `vetted_by` FK resolves immediately.
//   2. Then ALTER `users` to add the `ngo_id` FK, now that `ngos` exists.
// `ngo_id` is nullable on purpose: system_admin / auditor are global (no NGO),
// and the already-seeded system_admin row stays ngo_id = NULL untouched.
// `region_id` (v2 §4.1) is still deferred — `locations` arrives in Slice 2.
// Raw SQL via pgm.sql() to honor the "no query builder" law.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE ngos (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT NOT NULL,
      registration_no TEXT UNIQUE,
      status          TEXT NOT NULL DEFAULT 'pending', -- pending|active|suspended
      vetted_by       UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE users
      ADD COLUMN ngo_id UUID REFERENCES ngos(id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS ngo_id;
    DROP TABLE IF EXISTS ngos;
  `);
};
