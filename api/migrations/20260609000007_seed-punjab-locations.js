/* eslint-disable camelcase */

// Slice 2 seed: a small but REAL Punjab location tree so the campaign region picker
// (and the later coverage heatmap) has data to render. Fixed UUID literals let each
// child's parent_id reference its parent deterministically; ON CONFLICT (id) DO
// NOTHING makes re-running migrations idempotent (same discipline as the seed-admin
// migration). Inserted level-by-level (parents before children) so every parent_id
// FK resolves. Coordinates/populations are approximate real values.

const PUNJAB = '2a000000-0000-4000-8000-000000000001';
const LAHORE = '2a000000-0000-4000-8000-000000000010';
const LAHORE_CITY = '2a000000-0000-4000-8000-000000000011';
const GULBERG = '2a000000-0000-4000-8000-000000000012';
const ICHHRA = '2a000000-0000-4000-8000-000000000013';
const RAWALPINDI = '2a000000-0000-4000-8000-000000000020';
const RAWALPINDI_CITY = '2a000000-0000-4000-8000-000000000021';
const MULTAN = '2a000000-0000-4000-8000-000000000030';
const MULTAN_CITY = '2a000000-0000-4000-8000-000000000031';

exports.up = (pgm) => {
  pgm.sql(`
    -- province
    INSERT INTO locations (id, parent_id, name, level, latitude, longitude, census_population) VALUES
      ('${PUNJAB}', NULL, 'Punjab', 'province', 31.1704, 72.7097, 110012442)
    ON CONFLICT (id) DO NOTHING;

    -- districts
    INSERT INTO locations (id, parent_id, name, level, latitude, longitude, census_population) VALUES
      ('${LAHORE}',     '${PUNJAB}', 'Lahore',     'district', 31.5204, 74.3587, 11126285),
      ('${RAWALPINDI}', '${PUNJAB}', 'Rawalpindi', 'district', 33.5651, 73.0169, 5405633),
      ('${MULTAN}',     '${PUNJAB}', 'Multan',     'district', 30.1575, 71.5249, 4745109)
    ON CONFLICT (id) DO NOTHING;

    -- tehsils
    INSERT INTO locations (id, parent_id, name, level, latitude, longitude, census_population) VALUES
      ('${LAHORE_CITY}',     '${LAHORE}',     'Lahore City',     'tehsil', 31.5497, 74.3436, 5500000),
      ('${RAWALPINDI_CITY}', '${RAWALPINDI}', 'Rawalpindi City', 'tehsil', 33.5973, 73.0479, 2098231),
      ('${MULTAN_CITY}',     '${MULTAN}',     'Multan City',     'tehsil', 30.1956, 71.4753, 1871843)
    ON CONFLICT (id) DO NOTHING;

    -- union council + village (under Lahore City)
    INSERT INTO locations (id, parent_id, name, level, latitude, longitude, census_population) VALUES
      ('${GULBERG}', '${LAHORE_CITY}', 'Gulberg', 'uc',      31.5169, 74.3484, 220000)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO locations (id, parent_id, name, level, latitude, longitude, census_population) VALUES
      ('${ICHHRA}', '${GULBERG}', 'Ichhra', 'village', 31.5310, 74.3120, 45000)
    ON CONFLICT (id) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  // Children first to satisfy the self-referencing FK.
  pgm.sql(`
    DELETE FROM locations WHERE id IN (
      '${ICHHRA}', '${GULBERG}',
      '${LAHORE_CITY}', '${RAWALPINDI_CITY}', '${MULTAN_CITY}',
      '${LAHORE}', '${RAWALPINDI}', '${MULTAN}',
      '${PUNJAB}'
    );
  `);
};
