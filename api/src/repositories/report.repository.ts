import { query } from '../db/pool';

// ─────────────────────────────────────────────────────────────────────────────
// Slice 8 — Coordination Dashboard / 3W. Every function here is a CROSS-TENANT,
// AGGREGATE-ONLY read: it rolls up rows from ALL NGOs within one disaster and
// returns counts/ratios, NEVER another NGO's row-level operational detail. None
// of these take an `ngo_id` filter. They are kept separate from the tenant-scoped
// repositories (same RLS-ready seam discipline as the coordination board's
// listOpenNeedsForDisaster) so Slice 9 can carve out shared-read policies here
// without weakening default-deny elsewhere.
//
// Casts: COUNT()/SUM() come back from pg as `bigint` → JS string, so every count
// is cast `::int` and the coverage ratio `::float8` to land as a JS number.
// ─────────────────────────────────────────────────────────────────────────────

// One row of the coverage picture for a single location in the disaster's region
// subtree. coverage_ratio is people_reached / census_population (NULL when census
// is unknown/zero — rendered as "no data" rather than a divide-by-zero).
export interface CoverageRow {
  id: string;
  name: string;
  level: string;
  census_population: number | null;
  households_aided: number;
  people_reached: number;
  open_needs: number;
  open_need_qty: number;
  coverage_ratio: number | null;
}

// CROSS-TENANT READ — aggregate only, no per-NGO rows. Coverage vs census for every
// location in the disaster region's subtree, with an open-needs demand overlay.
// `regionId` is the disaster's region_id (the subtree root); a NULL region yields an
// empty result (no anchor to walk). Aid is summed ONCE per distinct beneficiary, not
// per aid_record — a beneficiary with food + shelter records must not double-count
// people and inflate coverage. Aid attaches at the exact location_id it was recorded
// at (no descendant roll-up — a deliberate first-pass simplification).
export async function coverageByLocation(
  disasterId: string,
  regionId: string | null,
): Promise<CoverageRow[]> {
  if (!regionId) return [];
  const { rows } = await query<CoverageRow>(
    `WITH RECURSIVE subtree AS (
       SELECT id, parent_id, name, level, census_population
       FROM locations WHERE id = $2
       UNION ALL
       SELECT l.id, l.parent_id, l.name, l.level, l.census_population
       FROM locations l JOIN subtree s ON l.parent_id = s.id
     ),
     aid AS (
       SELECT location_id,
              COUNT(*)::int AS households_aided,
              COALESCE(SUM(household_size), 0)::int AS people_reached
       FROM (
         SELECT DISTINCT b.id, b.location_id, b.household_size
         FROM aid_records ar
         JOIN beneficiaries b ON b.id = ar.beneficiary_id
         JOIN campaigns c     ON c.id = ar.campaign_id
         WHERE c.disaster_id = $1
       ) d
       GROUP BY location_id
     ),
     needs AS (
       SELECT location_id,
              COUNT(*)::int AS open_needs,
              COALESCE(SUM(quantity), 0)::int AS open_need_qty
       FROM resource_needs
       WHERE disaster_id = $1 AND status = 'open'
       GROUP BY location_id
     )
     SELECT s.id, s.name, s.level, s.census_population,
            COALESCE(a.households_aided, 0) AS households_aided,
            COALESCE(a.people_reached, 0)   AS people_reached,
            COALESCE(n.open_needs, 0)       AS open_needs,
            COALESCE(n.open_need_qty, 0)    AS open_need_qty,
            CASE WHEN s.census_population > 0
                 THEN COALESCE(a.people_reached, 0)::float8 / s.census_population
                 ELSE NULL END AS coverage_ratio
     FROM subtree s
     LEFT JOIN aid   a ON a.location_id = s.id
     LEFT JOIN needs n ON n.location_id = s.id
     ORDER BY coverage_ratio ASC NULLS LAST, s.census_population DESC NULLS LAST`,
    [disasterId, regionId],
  );
  return rows;
}

// Aggregate count of still-open needs with no live match, grouped by type × priority.
export interface UnmatchedNeedRow {
  type: string;
  priority: string;
  need_count: number;
  total_quantity: number;
}

// CROSS-TENANT READ — aggregate only. Open needs (from every NGO in the disaster) that
// have no live match (no proposed/accepted resource_matches row). Needs are already
// public on the coordination board, so aggregating their quantities is fine — the
// privacy boundary is on offer surplus (see resourceAvailabilitySummary), not demand.
export async function unmatchedNeedsSummary(disasterId: string): Promise<UnmatchedNeedRow[]> {
  const { rows } = await query<UnmatchedNeedRow>(
    `SELECT rn.type, rn.priority,
            COUNT(*)::int AS need_count,
            COALESCE(SUM(rn.quantity), 0)::int AS total_quantity
     FROM resource_needs rn
     WHERE rn.disaster_id = $1 AND rn.status = 'open'
       AND NOT EXISTS (
         SELECT 1 FROM resource_matches m
         WHERE m.need_id = rn.id AND m.status IN ('proposed', 'accepted')
       )
     GROUP BY rn.type, rn.priority
     ORDER BY total_quantity DESC`,
    [disasterId],
  );
  return rows;
}

// The privacy-preserving surplus summary: how MANY NGOs have a shared offer of each
// type in each location — never the quantity, never which NGO.
export interface AvailabilityRow {
  type: string;
  location_id: string | null;
  location_name: string | null;
  ngo_count: number;
}

// CROSS-TENANT READ — aggregate only, PRIVACY SEAM. Counts DISTINCT NGOs with a
// shared+available offer per (type, location). Deliberately NO SUM(quantity) and NO
// ngo_id in the projection: "Tents: 2 NGOs have surplus in Lahore" is allowed,
// "NGO-B has 340 tents" is NOT. visibility='shared' is pinned (private offers stay
// with their owner) — mirrors the board's listSharedOffersForDisaster seam.
export async function resourceAvailabilitySummary(disasterId: string): Promise<AvailabilityRow[]> {
  const { rows } = await query<AvailabilityRow>(
    `SELECT ro.type, ro.location_id, l.name AS location_name,
            COUNT(DISTINCT ro.ngo_id)::int AS ngo_count
     FROM resource_offers ro
     LEFT JOIN locations l ON l.id = ro.location_id
     WHERE ro.disaster_id = $1 AND ro.visibility = 'shared' AND ro.status = 'available'
     GROUP BY ro.type, ro.location_id, l.name
     ORDER BY ngo_count DESC`,
    [disasterId],
  );
  return rows;
}

// One cell of the 3W matrix: an NGO (Who) × location (Where) with its activity counts
// (What). Names the NGO at aggregate count level only — no row-level operational detail.
export interface ThreeWRow {
  ngo_id: string;
  ngo_name: string;
  location_id: string | null;
  location_name: string | null;
  campaigns: number;
  open_needs: number;
  shared_offers: number;
  matches: number;
}

// CROSS-TENANT READ — aggregate only. The 3W command picture: Who (NGO) is doing What
// (campaigns / needs / shared offers / matches) Where (location), within one disaster.
// Activity sources are UNION-ed then grouped per (ngo, location). Matches are attributed
// to the NEEDING NGO's cell (the side receiving fulfilment). Counts only — no quantities,
// no per-row detail — so this stays within the aggregate tenancy boundary.
export async function threeWMatrix(disasterId: string): Promise<ThreeWRow[]> {
  const { rows } = await query<ThreeWRow>(
    `WITH activity AS (
       SELECT ngo_id, target_region_id AS location_id, 'campaign' AS kind
       FROM campaigns WHERE disaster_id = $1
       UNION ALL
       SELECT ngo_id, location_id, 'need'
       FROM resource_needs WHERE disaster_id = $1 AND status = 'open'
       UNION ALL
       SELECT ngo_id, location_id, 'offer'
       FROM resource_offers WHERE disaster_id = $1 AND visibility = 'shared' AND status = 'available'
       UNION ALL
       SELECT rn.ngo_id, rn.location_id, 'match'
       FROM resource_matches m JOIN resource_needs rn ON rn.id = m.need_id
       WHERE rn.disaster_id = $1 AND m.status IN ('accepted', 'fulfilled')
     )
     SELECT a.ngo_id, n.name AS ngo_name, a.location_id, l.name AS location_name,
            COUNT(*) FILTER (WHERE kind = 'campaign')::int AS campaigns,
            COUNT(*) FILTER (WHERE kind = 'need')::int     AS open_needs,
            COUNT(*) FILTER (WHERE kind = 'offer')::int    AS shared_offers,
            COUNT(*) FILTER (WHERE kind = 'match')::int    AS matches
     FROM activity a
     JOIN ngos n ON n.id = a.ngo_id
     LEFT JOIN locations l ON l.id = a.location_id
     GROUP BY a.ngo_id, n.name, a.location_id, l.name
     ORDER BY n.name, l.name`,
    [disasterId],
  );
  return rows;
}
