import * as locationRepo from '../repositories/location.repository';
import type { LocationRow } from '../repositories/location.repository';

// Client-safe location projection (camelCase).
export interface PublicLocation {
  id: string;
  parentId: string | null;
  name: string;
  level: string;
  latitude: number | null;
  longitude: number | null;
  censusPopulation: number | null;
}

function toPublicLocation(row: LocationRow): PublicLocation {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    level: row.level,
    latitude: row.latitude,
    longitude: row.longitude,
    censusPopulation: row.census_population,
  };
}

// The full (small) tree — the region picker builds indented paths from it client-side.
export async function listLocations(): Promise<PublicLocation[]> {
  const rows = await locationRepo.listAll();
  return rows.map(toPublicLocation);
}
