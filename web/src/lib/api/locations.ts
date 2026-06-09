import { api } from './client';
import type { Envelope } from './types';

// Mirrors the server's PublicLocation. The tree is small bounded reference data, so
// the endpoint returns the whole list (no pagination).
export interface Location {
  id: string;
  parentId: string | null;
  name: string;
  level: string; // province | district | tehsil | uc | village
  latitude: number | null;
  longitude: number | null;
  censusPopulation: number | null;
}

export async function listLocations(): Promise<Location[]> {
  const { data } = await api.get<Envelope<Location[]>>('/locations');
  return data.data;
}

// Flatten the tree into "Punjab › Lahore › Lahore City (tehsil)" labels for a single
// indented <select> region picker. Walks parent_id up to the province root.
export function buildLocationOptions(locations: Location[]): { id: string; label: string }[] {
  const byId = new Map(locations.map((l) => [l.id, l] as const));
  const pathOf = (loc: Location): string => {
    const parts = [loc.name];
    let parent = loc.parentId ? byId.get(loc.parentId) : undefined;
    while (parent) {
      parts.unshift(parent.name);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return parts.join(' › ');
  };
  return locations.map((l) => ({ id: l.id, label: `${pathOf(l)} (${l.level})` }));
}
