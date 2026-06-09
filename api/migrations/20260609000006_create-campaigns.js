/* eslint-disable camelcase */

// Slice 2: campaigns (v2 §4.3). TENANT-SCOPED — every row carries `ngo_id`, forced
// from the caller's JWT (never the request body). Each campaign nests under exactly
// one global disaster_event and may target a region from the locations tree. FKs
// resolve against ngos (Slice 1), disaster_events + locations (migrations 04–05),
// users (Slice 0). The composite index backs the tenant keyset list
// (WHERE ngo_id = $1 ORDER BY created_at DESC, id DESC); idx_campaigns_disaster
// speeds the "campaigns under this disaster" filter. Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE campaigns (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ngo_id           UUID NOT NULL REFERENCES ngos(id),
      disaster_id      UUID NOT NULL REFERENCES disaster_events(id),
      name             TEXT NOT NULL,
      target_region_id UUID REFERENCES locations(id),
      starts_on        DATE NOT NULL,
      ends_on          DATE,
      status           TEXT NOT NULL DEFAULT 'planning', -- planning|active|completed|paused
      created_by       UUID NOT NULL REFERENCES users(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_campaigns_tenant_keyset ON campaigns (ngo_id, created_at DESC, id DESC);
    CREATE INDEX idx_campaigns_disaster ON campaigns (disaster_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS campaigns;`);
};
