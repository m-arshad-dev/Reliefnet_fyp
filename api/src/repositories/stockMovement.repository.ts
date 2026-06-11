import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of a `stock_movements` row (snake_case). `quantity` is cast ::float8 on every
// read so pg returns a JS number, not a NUMERIC-as-string. An immutable, append-only row:
// it records `quantity` units moving prev_state -> state (prev_state NULL for stock_in).
export interface MovementRow {
  id: string;
  ngo_id: string;
  item_id: string;
  quantity: number;
  state: string;
  prev_state: string | null;
  correction_note: string | null;
  moved_by: string;
  created_at: Date;
}

const COLUMNS = `id, ngo_id, item_id, quantity::float8 AS quantity, state, prev_state,
                 correction_note, moved_by, created_at`;

interface InsertMovementParams {
  ngoId: string;
  itemId: string;
  quantity: number;
  state: string;
  prevState: string | null;
  correctionNote: string | null;
  movedBy: string;
}

// Always called with the shared `client` — the insert is the final step of the
// recordMovement transaction (after the FOR-UPDATE item lock + FSM/availability checks).
export async function insert(
  params: InsertMovementParams,
  client: PoolClient,
): Promise<MovementRow> {
  const text = `INSERT INTO stock_movements
                  (ngo_id, item_id, quantity, state, prev_state, correction_note, moved_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING ${COLUMNS}`;
  const { rows } = await client.query<MovementRow>(text, [
    params.ngoId,
    params.itemId,
    params.quantity,
    params.state,
    params.prevState,
    params.correctionNote,
    params.movedBy,
  ]);
  return rows[0];
}

// The DERIVED balance currently sitting in state S for an item — how much can still move
// OUT of S: Σ qty[state=S] − Σ qty[prev_state=S]. For 'stock_in' the signed corrections
// fold in (they adjust the available pool). Called inside the transaction (after the item
// FOR UPDATE lock) so the availability check is race-free. ::float8 → JS number.
export async function availableInState(
  itemId: string,
  state: string,
  client: PoolClient,
): Promise<number> {
  const correctionTerm =
    state === 'stock_in'
      ? `+ COALESCE(SUM(CASE WHEN state = 'correction' THEN quantity END), 0)`
      : '';
  const { rows } = await client.query<{ balance: number }>(
    `SELECT (COALESCE(SUM(CASE WHEN state = $2 THEN quantity END), 0)
             - COALESCE(SUM(CASE WHEN prev_state = $2 THEN quantity END), 0)
             ${correctionTerm})::float8 AS balance
     FROM stock_movements
     WHERE item_id = $1`,
    [itemId, state],
  );
  return rows[0]?.balance ?? 0;
}

// Keyset page of an item's movement history (newest first), for GET /inventory/movements
// ?itemId=. The caller (service) has already confirmed the item belongs to the tenant.
export async function listByItem(
  itemId: string,
  opts: { limit: number; cursor?: Keyset | null },
  client?: PoolClient,
): Promise<MovementRow[]> {
  const { limit, cursor } = opts;
  const conditions: string[] = ['item_id = $1'];
  const values: unknown[] = [itemId];

  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(
      `(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
    );
  }
  values.push(limit);
  const limitPos = values.length;

  const text = `SELECT ${COLUMNS} FROM stock_movements
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitPos}`;
  const { rows } = client
    ? await client.query<MovementRow>(text, values)
    : await query<MovementRow>(text, values);
  return rows;
}
