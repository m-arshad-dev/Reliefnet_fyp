import * as reportRepo from '../repositories/report.repository';
import * as disasterRepo from '../repositories/disaster.repository';
import { NotFoundError } from '../lib/errors';

// Slice 8 — read-only reporting. Each function validates the disaster exists first
// (clean 404), then delegates to a CROSS-TENANT aggregate read in report.repository
// and projects snake_case rows → camelCase client shapes. Nothing writes, so there is
// no transaction here; the tenancy discipline lives in the repository (aggregate only,
// no per-NGO rows). These return BOUNDED rollups (a region's location subtree;
// type×priority; NGO×location), not unbounded entity lists, so no keyset pagination
// applies — the one unbounded list (open-needs detail) is the board's GET /needs.

// Below this coverage ratio (people reached / census) a location counts as a gap.
const COVERAGE_GAP_THRESHOLD = 0.25;

export interface CoverageLocation {
  locationId: string;
  name: string;
  level: string;
  censusPopulation: number | null;
  householdsAided: number;
  peopleReached: number;
  openNeeds: number;
  openNeedQty: number;
  coverageRatio: number | null;
}

function toCoverageLocation(row: reportRepo.CoverageRow): CoverageLocation {
  return {
    locationId: row.id,
    name: row.name,
    level: row.level,
    censusPopulation: row.census_population,
    householdsAided: row.households_aided,
    peopleReached: row.people_reached,
    openNeeds: row.open_needs,
    openNeedQty: row.open_need_qty,
    coverageRatio: row.coverage_ratio,
  };
}

async function loadCoverage(disasterId: string): Promise<CoverageLocation[]> {
  const disaster = await disasterRepo.findById(disasterId);
  if (!disaster) throw new NotFoundError('Disaster not found');
  const rows = await reportRepo.coverageByLocation(disasterId, disaster.region_id);
  return rows.map(toCoverageLocation);
}

// GET /reports/heatmap — every location in the disaster region's subtree, with coverage
// ratio + open-needs demand overlay (worst-covered first, from the repo ORDER BY).
export async function getHeatmap(disasterId: string): Promise<{ locations: CoverageLocation[] }> {
  const locations = await loadCoverage(disasterId);
  return { locations };
}

// GET /reports/coverage-gaps — the underserved subset of the heatmap: a location is a gap
// when its coverage ratio is unknown (no census/no aid) or below the threshold. Threshold
// is overridable per request (Zod-validated 0..1) for "show me anything under 50%" views.
export async function getCoverageGaps(
  disasterId: string,
  threshold: number = COVERAGE_GAP_THRESHOLD,
): Promise<{ threshold: number; locations: CoverageLocation[] }> {
  const all = await loadCoverage(disasterId);
  const locations = all.filter(
    (l) => l.coverageRatio === null || l.coverageRatio < threshold,
  );
  return { threshold, locations };
}

export interface UnmatchedNeedGroup {
  type: string;
  priority: string;
  needCount: number;
  totalQuantity: number;
}

// GET /reports/unmatched-needs — counts + total quantity of open, unmatched needs grouped
// by type × priority, plus grand totals for a headline ("12 needs / 3,400 units unmet").
export async function getUnmatchedNeeds(disasterId: string): Promise<{
  byTypePriority: UnmatchedNeedGroup[];
  totals: { needCount: number; totalQuantity: number };
}> {
  const disaster = await disasterRepo.findById(disasterId);
  if (!disaster) throw new NotFoundError('Disaster not found');
  const rows = await reportRepo.unmatchedNeedsSummary(disasterId);
  const byTypePriority = rows.map((r) => ({
    type: r.type,
    priority: r.priority,
    needCount: r.need_count,
    totalQuantity: r.total_quantity,
  }));
  const totals = byTypePriority.reduce(
    (acc, g) => ({
      needCount: acc.needCount + g.needCount,
      totalQuantity: acc.totalQuantity + g.totalQuantity,
    }),
    { needCount: 0, totalQuantity: 0 },
  );
  return { byTypePriority, totals };
}

export interface AvailabilityGroup {
  type: string;
  locationId: string | null;
  locationName: string | null;
  ngoCount: number;
}

// GET /reports/resource-availability — privacy-preserving surplus summary. Returns ONLY
// NGO counts per (type, location); the repo never selects quantity or ngo_id, so there is
// nothing per-NGO to leak here.
export async function getResourceAvailability(
  disasterId: string,
): Promise<{ summary: AvailabilityGroup[] }> {
  const disaster = await disasterRepo.findById(disasterId);
  if (!disaster) throw new NotFoundError('Disaster not found');
  const rows = await reportRepo.resourceAvailabilitySummary(disasterId);
  const summary = rows.map((r) => ({
    type: r.type,
    locationId: r.location_id,
    locationName: r.location_name,
    ngoCount: r.ngo_count,
  }));
  return { summary };
}

export interface ThreeWCell {
  ngoId: string;
  ngoName: string;
  locationId: string | null;
  locationName: string | null;
  campaigns: number;
  openNeeds: number;
  sharedOffers: number;
  matches: number;
}

// GET /reports/3w — the 3W matrix (Who × Where with activity counts as What).
export async function get3WMatrix(disasterId: string): Promise<{ cells: ThreeWCell[] }> {
  const disaster = await disasterRepo.findById(disasterId);
  if (!disaster) throw new NotFoundError('Disaster not found');
  const rows = await reportRepo.threeWMatrix(disasterId);
  const cells = rows.map((r) => ({
    ngoId: r.ngo_id,
    ngoName: r.ngo_name,
    locationId: r.location_id,
    locationName: r.location_name,
    campaigns: r.campaigns,
    openNeeds: r.open_needs,
    sharedOffers: r.shared_offers,
    matches: r.matches,
  }));
  return { cells };
}
