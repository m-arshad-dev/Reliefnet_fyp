/* eslint-disable camelcase */

// Slice 0: a single `users` table. This is a strict subset of v2 §4.1 — the
// `ngo_id` / `region_id` foreign keys are deferred to Slice 1 (the `ngos` and
// `locations` tables don't exist yet). All DDL is raw SQL via pgm.sql() to honor
// the "no query builder" law. gen_random_uuid() is built into Postgres 13+.

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name     TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL,
      is_active     BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS users;`);
};
