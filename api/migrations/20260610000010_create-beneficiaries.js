/* eslint-disable camelcase */

// Slice 5: Privacy-preserving beneficiaries + cross-NGO duplicate flag (v3 Slice 5, v2
// §4.4) — the project's core differentiator. A raw CNIC is NEVER stored: the service
// reduces it to a peppered SHA-256 hash (lib/cnic.ts) and writes only the hex into
// cnic_hash. Two tables:
//
//   beneficiaries — TENANT-OWNED registry (every row carries ngo_id, forced from the
//   caller's JWT). `verified` is a simple guarded boolean flip (no FSM/TRANSITIONS map
//   this slice — law 3 N/A). contact stored masked, never raw if avoidable.
//
//   aid_records — the normalized cross-NGO ledger the duplicate flag READS. cnic_hash is
//   denormalized here for a fast (cnic_hash, delivered_at DESC) scan. Registering a
//   beneficiary writes the first aid_record in the SAME transaction as the insert (law 4).
//
// The duplicate flag FLAGS, never BLOCKS: POST /beneficiaries always succeeds; the
// cross-NGO read (idx_aid_hash, NO ngo_id filter) just surfaces prior aid + masked
// identity so a human decides. idx_beneficiary_hash is the global dup-detection index;
// idx_beneficiaries_tenant_keyset backs the tenant list (WHERE ngo_id ORDER BY created_at
// DESC, id DESC) like campaigns.
//
// DEFERRED (additive later slices): RLS / SET LOCAL app.current_ngo_id (Slice 9); the
// hash-chained audit ledger entry inside this transaction (Slice 10); offline sync +
// mobile capture (Slices 11–12). FKs resolve against ngos + locations + users (Slices
// 0–1) and campaigns (Slice 2). Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE beneficiaries (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ngo_id         UUID NOT NULL REFERENCES ngos(id),
      cnic_hash      CHAR(64) NOT NULL,                -- SHA-256 hex of (pepper + normalized CNIC)
      full_name      TEXT NOT NULL,
      household_size INTEGER,
      location_id    UUID REFERENCES locations(id),
      contact_masked TEXT,                             -- masked contact, never raw if avoidable
      verified       BOOLEAN NOT NULL DEFAULT false,
      verified_by    UUID REFERENCES users(id),        -- set when a field_coordinator verifies
      registered_by  UUID NOT NULL REFERENCES users(id),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Global cross-NGO duplicate detection (fast hash equality scan).
    CREATE INDEX idx_beneficiary_hash ON beneficiaries (cnic_hash);

    -- Tenant keyset list (matches the campaigns convention), newest first.
    CREATE INDEX idx_beneficiaries_tenant_keyset
      ON beneficiaries (ngo_id, created_at DESC, id DESC);

    -- Normalized aid-record ledger — what the duplicate flag reads from, cross-NGO.
    CREATE TABLE aid_records (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
      cnic_hash      CHAR(64) NOT NULL,                -- denormalized for fast cross-NGO scan
      ngo_id         UUID NOT NULL REFERENCES ngos(id),
      campaign_id    UUID NOT NULL REFERENCES campaigns(id),
      aid_type       TEXT NOT NULL,                    -- food|shelter|medical|hygiene|other
      delivered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      recorded_by    UUID NOT NULL REFERENCES users(id)
    );

    -- The cross-NGO duplicate scan: prior aid for a hash, newest first.
    CREATE INDEX idx_aid_hash ON aid_records (cnic_hash, delivered_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS aid_records;
    DROP TABLE IF EXISTS beneficiaries;
  `);
};
