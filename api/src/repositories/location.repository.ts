import { query } from '../db/pool';

// The shape of a row in the `locations` table (snake_case, straight from SQL).
export interface LocationRow {
  id: string;
  parent_id: string | null;
  name: string;
  level: string;
  latitude: number | null;
  longitude: number | null;
  census_population: number | null;
}

const COLUMNS = `id, parent_id, name, level, latitude, longitude, census_population`;

// The whole tree at once: it's small bounded reference data (a region picker reads
// it), so no keyset pagination here. Ordered parents-before-children by level rank,
// then name, so the client can build the tree / indented paths in one pass.
export async function listAll(): Promise<LocationRow[]> {
  const { rows } = await query<LocationRow>(
    `SELECT ${COLUMNS} FROM locations
     ORDER BY
       CASE level
         WHEN 'province' THEN 1
         WHEN 'district' THEN 2
         WHEN 'tehsil'   THEN 3
         WHEN 'uc'       THEN 4
         WHEN 'village'  THEN 5
         ELSE 6
       END,
       name ASC`,
  );
  return rows;
}

export async function findById(id: string): Promise<LocationRow | null> {
  const { rows } = await query<LocationRow>(
    `SELECT ${COLUMNS} FROM locations WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
