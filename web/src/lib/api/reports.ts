import { api } from './client';
import type { Envelope } from './types';

// Slice 8 Coordination Dashboard / 3W — the frontend client for the read-only
// `/reports/*` aggregates. Every endpoint is disaster-scoped and CROSS-TENANT: it rolls
// up all NGOs in the disaster and returns BOUNDED arrays (a location subtree, type×priority
// groups, NGO×location cells), so these return plain objects, not keyset Page<T>. The
// availability summary deliberately carries only `ngoCount` — never a quantity or ngo id.

// One location in the disaster region's subtree, with coverage vs census + demand overlay.
export interface CoverageLocation {
  locationId: string;
  name: string;
  level: string;
  censusPopulation: number | null;
  householdsAided: number;
  peopleReached: number;
  openNeeds: number;
  openNeedQty: number;
  coverageRatio: number | null; // people_reached / census_population (null when no census)
}

export interface HeatmapResult {
  locations: CoverageLocation[];
}

export interface CoverageGapsResult {
  threshold: number;
  locations: CoverageLocation[];
}

export interface UnmatchedNeedGroup {
  type: string;
  priority: string;
  needCount: number;
  totalQuantity: number;
}

export interface UnmatchedNeedsResult {
  byTypePriority: UnmatchedNeedGroup[];
  totals: { needCount: number; totalQuantity: number };
}

// PRIVACY SEAM: counts of NGOs with shared+available surplus per (type, location). No
// quantity and no ngo id — "Tents: 2 NGOs have surplus in Lahore", never "NGO-B has 340".
export interface AvailabilityGroup {
  type: string;
  locationId: string | null;
  locationName: string | null;
  ngoCount: number;
}

export interface AvailabilityResult {
  summary: AvailabilityGroup[];
}

// One 3W cell: Who (NGO) × Where (location) with What (activity counts).
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

export interface ThreeWResult {
  cells: ThreeWCell[];
}

export async function getHeatmap(disasterId: string): Promise<HeatmapResult> {
  const { data } = await api.get<Envelope<HeatmapResult>>('/reports/heatmap', {
    params: { disasterId },
  });
  return data.data;
}

export async function getCoverageGaps(
  disasterId: string,
  threshold?: number,
): Promise<CoverageGapsResult> {
  const { data } = await api.get<Envelope<CoverageGapsResult>>('/reports/coverage-gaps', {
    params: { disasterId, threshold },
  });
  return data.data;
}

export async function getUnmatchedNeeds(disasterId: string): Promise<UnmatchedNeedsResult> {
  const { data } = await api.get<Envelope<UnmatchedNeedsResult>>('/reports/unmatched-needs', {
    params: { disasterId },
  });
  return data.data;
}

export async function getResourceAvailability(disasterId: string): Promise<AvailabilityResult> {
  const { data } = await api.get<Envelope<AvailabilityResult>>('/reports/resource-availability', {
    params: { disasterId },
  });
  return data.data;
}

export async function get3WMatrix(disasterId: string): Promise<ThreeWResult> {
  const { data } = await api.get<Envelope<ThreeWResult>>('/reports/3w', {
    params: { disasterId },
  });
  return data.data;
}
