/* eslint-disable no-console */
//
// Slice 8 demo seed — NOT a migration. Populates a rich, cross-domain coordination
// picture so the Reports dashboard (heatmap / coverage-gaps / unmatched-needs /
// resource-availability / 3W) renders something meaningful on the live URL. Safe to run
// repeatedly: every row is inserted with a fixed UUID + ON CONFLICT (id) DO NOTHING.
//
// Self-contained on purpose: it opens its own pg Pool and hashes inline, so it needs only
// DATABASE_URL (+ optional CNIC_PEPPER) — it does NOT import the app's env schema. The
// constant UUIDs below are trusted module constants, inlined into the SQL (same style as
// the location seed migration); only the genuinely dynamic values (the bcrypt password
// hash, the CNIC hashes, the looked-up system_admin id) are passed as bound parameters.
//
//   Run:  DATABASE_URL='postgresql:///reliefnet_dev?host=/var/run/postgresql' \
//         CNIC_PEPPER='dev-pepper' npx tsx scripts/seed-demo.ts
//
// Demo logins (all password 'Demo123!'):
//   admin.hope@demo.reliefnet.org      (ngo_admin,         Hope Relief Foundation)
//   coord.hope@demo.reliefnet.org      (field_coordinator, Hope Relief Foundation)
//   admin.crescent@demo.reliefnet.org  (ngo_admin,         Crescent Aid Network)
//   coord.crescent@demo.reliefnet.org  (field_coordinator, Crescent Aid Network)

import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const CNIC_PEPPER = process.env.CNIC_PEPPER ?? 'dev-pepper';
const cnicHash = (raw: string): string =>
  createHash('sha256').update(CNIC_PEPPER + raw.replace(/\D/g, '')).digest('hex');

// ── Seeded location UUIDs (from migration 20260609000007_seed-punjab-locations) ──
const PUNJAB = '2a000000-0000-4000-8000-000000000001';
const LAHORE_CITY = '2a000000-0000-4000-8000-000000000011';
const RAWALPINDI_CITY = '2a000000-0000-4000-8000-000000000021';
const MULTAN_CITY = '2a000000-0000-4000-8000-000000000031';

// ── Demo entity UUIDs (the '2b…' prefix marks demo-seed rows) ──
const NGO_A = '2b000000-0000-4000-8000-000000000001';
const NGO_B = '2b000000-0000-4000-8000-000000000002';
const NA_ADMIN = '2b000000-0000-4000-8000-000000000011';
const NA_COORD = '2b000000-0000-4000-8000-000000000012';
const NB_ADMIN = '2b000000-0000-4000-8000-000000000013';
const NB_COORD = '2b000000-0000-4000-8000-000000000014';

// Small demo relief-camp villages under the real tehsils. Census is intentionally tiny
// (30–200) so a handful of seeded beneficiaries produces a VISIBLE coverage ratio — real
// district census is in the millions and would flatten the heatmap to ~0% everywhere.
const DV1 = '2b000000-0000-4000-8000-0000000000a1'; // Shadara Camp      (census 80)
const DV2 = '2b000000-0000-4000-8000-0000000000a2'; // Ravi Bund Camp    (census 50)
const DV3 = '2b000000-0000-4000-8000-0000000000a3'; // Multan Relief Camp(census 200)
const DV4 = '2b000000-0000-4000-8000-0000000000a4'; // Gulshan Camp      (census 30)

const D1 = '2b000000-0000-4000-8000-000000000020'; // disaster
const C_A = '2b000000-0000-4000-8000-000000000030'; // Hope campaign
const C_B = '2b000000-0000-4000-8000-000000000031'; // Crescent campaign

const N1 = '2b000000-0000-4000-8000-000000000040';
const N2 = '2b000000-0000-4000-8000-000000000041';
const N3 = '2b000000-0000-4000-8000-000000000042';
const N4 = '2b000000-0000-4000-8000-000000000043';
const N5 = '2b000000-0000-4000-8000-000000000044';

const O1 = '2b000000-0000-4000-8000-000000000050';
const O2 = '2b000000-0000-4000-8000-000000000051';
const O3 = '2b000000-0000-4000-8000-000000000052';
const O4 = '2b000000-0000-4000-8000-000000000053';
const O5 = '2b000000-0000-4000-8000-000000000054';

const M1 = '2b000000-0000-4000-8000-000000000060';

const B1 = '2b000000-0000-4000-8000-000000000070';
const B2 = '2b000000-0000-4000-8000-000000000071';
const B3 = '2b000000-0000-4000-8000-000000000072';
const B4 = '2b000000-0000-4000-8000-000000000073';

// CNIC hashes (denormalized identically onto beneficiaries + their aid_records).
const CNIC1 = cnicHash('35201-1111111-1');
const CNIC2 = cnicHash('35201-2222222-2');
const CNIC3 = cnicHash('36302-3333333-3');
const CNIC4 = cnicHash('37405-4444444-4');

async function seed(client: PoolClient): Promise<void> {
  const passwordHash = await bcrypt.hash('Demo123!', 10);

  // created_by for the disaster: the seeded system_admin (falls back to NGO-A admin).
  const { rows: adminRows } = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'system_admin' ORDER BY created_at ASC LIMIT 1`,
  );
  const systemAdminId = adminRows[0]?.id ?? NA_ADMIN;

  // 1. NGOs
  await client.query(
    `INSERT INTO ngos (id, name, registration_no, status) VALUES
       ('${NGO_A}', 'Hope Relief Foundation', 'DEMO-NGO-A', 'active'),
       ('${NGO_B}', 'Crescent Aid Network',   'DEMO-NGO-B', 'active')
     ON CONFLICT (id) DO NOTHING`,
  );

  // 2. Users (one ngo_admin + one field_coordinator per NGO). $1 = bcrypt('Demo123!').
  // NOTE: the users table has no region_id column (the v2 doc lists one, but no migration
  // ever added it) — coordinators are scoped by ngo_id alone.
  await client.query(
    `INSERT INTO users (id, ngo_id, full_name, email, password_hash, role) VALUES
       ('${NA_ADMIN}', '${NGO_A}', 'Ayesha Khan (Hope Admin)',      'admin.hope@demo.reliefnet.org',     $1, 'ngo_admin'),
       ('${NA_COORD}', '${NGO_A}', 'Bilal Ahmed (Hope Coord)',      'coord.hope@demo.reliefnet.org',     $1, 'field_coordinator'),
       ('${NB_ADMIN}', '${NGO_B}', 'Fatima Noor (Crescent Admin)',  'admin.crescent@demo.reliefnet.org', $1, 'ngo_admin'),
       ('${NB_COORD}', '${NGO_B}', 'Daniyal Raza (Crescent Coord)', 'coord.crescent@demo.reliefnet.org', $1, 'field_coordinator')
     ON CONFLICT (id) DO NOTHING`,
    [passwordHash],
  );

  // 3. Demo relief-camp villages (small census so coverage is visible)
  await client.query(
    `INSERT INTO locations (id, parent_id, name, level, latitude, longitude, census_population) VALUES
       ('${DV1}', '${LAHORE_CITY}',     'Shadara Camp',       'village', 31.6000, 74.2800, 80),
       ('${DV2}', '${LAHORE_CITY}',     'Ravi Bund Camp',     'village', 31.5800, 74.3000, 50),
       ('${DV3}', '${MULTAN_CITY}',     'Multan Relief Camp', 'village', 30.2000, 71.4800, 200),
       ('${DV4}', '${RAWALPINDI_CITY}', 'Gulshan Camp',       'village', 33.6000, 73.0500, 30)
     ON CONFLICT (id) DO NOTHING`,
  );

  // 4. Disaster (active, anchored on the Punjab region so the subtree covers everything).
  await client.query(
    `INSERT INTO disaster_events (id, name, type, severity, region_id, starts_on, status, created_by)
     VALUES ('${D1}', 'Punjab Monsoon Floods 2026', 'flood', 'high', '${PUNJAB}', CURRENT_DATE, 'active', $1)
     ON CONFLICT (id) DO NOTHING`,
    [systemAdminId],
  );

  // 5. Campaigns (one per NGO, nested under the disaster)
  await client.query(
    `INSERT INTO campaigns (id, ngo_id, disaster_id, name, target_region_id, starts_on, status, created_by) VALUES
       ('${C_A}', '${NGO_A}', '${D1}', 'Hope Lahore Flood Response',     '${LAHORE_CITY}', CURRENT_DATE, 'active', '${NA_ADMIN}'),
       ('${C_B}', '${NGO_B}', '${D1}', 'Crescent Multan Flood Response', '${MULTAN_CITY}', CURRENT_DATE, 'active', '${NB_ADMIN}')
     ON CONFLICT (id) DO NOTHING`,
  );

  // 6. Resource needs (mix of locations/types/priorities; N5 is pre-matched).
  await client.query(
    `INSERT INTO resource_needs
       (id, ngo_id, disaster_id, type, quantity, location_id, priority, description, status, created_by) VALUES
       ('${N1}', '${NGO_A}', '${D1}', 'shelter', 100, '${DV3}',         'critical', 'Family tents — camp flooded', 'open',    '${NA_COORD}'),
       ('${N2}', '${NGO_B}', '${D1}', 'food',    500, '${MULTAN_CITY}', 'high',     'Dry ration packs',            'open',    '${NB_COORD}'),
       ('${N3}', '${NGO_A}', '${D1}', 'water',   200, '${DV2}',         'moderate', 'Clean drinking water',        'open',    '${NA_COORD}'),
       ('${N4}', '${NGO_B}', '${D1}', 'health',  50,  '${DV1}',         'high',     'Medical kits',                'open',    '${NB_COORD}'),
       ('${N5}', '${NGO_A}', '${D1}', 'shelter', 80,  '${DV4}',         'moderate', 'Tarpaulin sheets (matched)',  'matched', '${NA_COORD}')
     ON CONFLICT (id) DO NOTHING`,
  );

  // 7. Resource offers (shared/available, except O5 reserved by the match). Two NGOs both
  //    offer shelter at Shadara Camp → availability shows "2 NGOs have surplus".
  await client.query(
    `INSERT INTO resource_offers
       (id, ngo_id, disaster_id, type, quantity, location_id, visibility, description, status, created_by) VALUES
       ('${O1}', '${NGO_B}', '${D1}', 'shelter', 120, '${DV1}',         'shared', 'Spare family tents',    'available', '${NB_ADMIN}'),
       ('${O2}', '${NGO_A}', '${D1}', 'shelter', 60,  '${DV1}',         'shared', 'Winterized tents',      'available', '${NA_ADMIN}'),
       ('${O3}', '${NGO_B}', '${D1}', 'food',    300, '${MULTAN_CITY}', 'shared', 'Ration packs surplus',  'available', '${NB_ADMIN}'),
       ('${O4}', '${NGO_A}', '${D1}', 'water',   50,  '${MULTAN_CITY}', 'shared', 'Bottled water pallets', 'available', '${NA_ADMIN}'),
       ('${O5}', '${NGO_B}', '${D1}', 'shelter', 90,  '${DV4}',         'shared', 'Tarpaulins (reserved)', 'reserved',  '${NB_ADMIN}')
     ON CONFLICT (id) DO NOTHING`,
  );

  // 8. One confirmed cross-NGO match (NGO-A need N5 ↔ NGO-B offer O5) so 3W "matches"
  //    and the matched/unmatched split are non-trivial.
  await client.query(
    `INSERT INTO resource_matches (id, need_id, offer_id, quantity, status, created_by, confirmed_by)
     VALUES ('${M1}', '${N5}', '${O5}', 80, 'accepted', '${NA_COORD}', '${NB_ADMIN}')
     ON CONFLICT (id) DO NOTHING`,
  );

  // 9. Beneficiaries (distinct people with household_size, at the small demo camps).
  //    $1..$4 = CNIC hashes.
  await client.query(
    `INSERT INTO beneficiaries
       (id, ngo_id, cnic_hash, full_name, household_size, location_id, verified, registered_by) VALUES
       ('${B1}', '${NGO_A}', $1, 'Rukhsana Bibi',  6,  '${DV1}', true,  '${NA_COORD}'),
       ('${B2}', '${NGO_A}', $2, 'Imran Shah',     5,  '${DV1}', false, '${NA_COORD}'),
       ('${B3}', '${NGO_B}', $3, 'Nasreen Akhtar', 8,  '${DV2}', false, '${NB_COORD}'),
       ('${B4}', '${NGO_A}', $4, 'Ghulam Mustafa', 12, '${DV4}', true,  '${NA_COORD}')
     ON CONFLICT (id) DO NOTHING`,
    [CNIC1, CNIC2, CNIC3, CNIC4],
  );

  // 10. Aid records. B1 has TWO records (food + shelter) — the coverage query MUST count
  //     B1's household ONCE, not twice. Distinct-beneficiary people_reached at Shadara
  //     (DV1) = 6 + 5 = 11 over census 80 = ~13.75%. $1..$4 = CNIC hashes.
  await client.query(
    `INSERT INTO aid_records (id, beneficiary_id, cnic_hash, ngo_id, campaign_id, aid_type, recorded_by) VALUES
       ('2b000000-0000-4000-8000-000000000081', '${B1}', $1, '${NGO_A}', '${C_A}', 'food',    '${NA_COORD}'),
       ('2b000000-0000-4000-8000-000000000082', '${B1}', $1, '${NGO_A}', '${C_A}', 'shelter', '${NA_COORD}'),
       ('2b000000-0000-4000-8000-000000000083', '${B2}', $2, '${NGO_A}', '${C_A}', 'food',    '${NA_COORD}'),
       ('2b000000-0000-4000-8000-000000000084', '${B3}', $3, '${NGO_B}', '${C_B}', 'food',    '${NB_COORD}'),
       ('2b000000-0000-4000-8000-000000000085', '${B4}', $4, '${NGO_A}', '${C_A}', 'shelter', '${NA_COORD}')
     ON CONFLICT (id) DO NOTHING`,
    [CNIC1, CNIC2, CNIC3, CNIC4],
  );
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seed(client);
    await client.query('COMMIT');
    console.log('✅ Demo data seeded for disaster:', D1, '(Punjab Monsoon Floods 2026)');
    console.log('   Logins (password Demo123!): admin.hope@, coord.hope@, admin.crescent@, coord.crescent@ demo.reliefnet.org');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
