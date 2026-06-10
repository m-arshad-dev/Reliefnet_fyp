import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of an `inventory_items` row (snake_case, straight from SQL). There is NO
// quantity_on_hand column — on-hand is derived from stock_movements (see ItemWithStockRow).
export interface ItemRow {
  id: string;
  ngo_id: string;
  name: string;
  unit: string;
  created_at: Date;
  updated_at: Date;
}

// An item joined to its DERIVED per-state balances (each a pure SUM over the item's
// movements). All numeric columns are cast ::float8 in SQL so pg returns JS numbers, not
// NUMERIC-as-string. balance(item,S) = Σ qty[state=S] − Σ qty[prev_state=S]; corrections
// (signed) fold only into in_stock — the "available to allocate" pool.
export interface ItemWithStockRow extends ItemRow {
  in_stock: number;
  allocated: number;
  dispatched: number;
  delivered: number;
  consumed: number;
}

const COLUMNS = `id, ngo_id, name, unit, created_at, updated_at`;

interface InsertItemParams {
  ngoId: string;
  name: string;
  unit: string;
}

export async function insert(params: InsertItemParams, client?: PoolClient): Promise<ItemRow> {
  const text = `INSERT INTO inventory_items (ngo_id, name, unit)
                VALUES ($1, $2, $3)
                RETURNING ${COLUMNS}`;
  const values = [params.ngoId, params.name, params.unit];
  const { rows } = client
    ? await client.query<ItemRow>(text, values)
    : await query<ItemRow>(text, values);
  return rows[0];
}

export async function findById(id: string, client?: PoolClient): Promise<ItemRow | null> {
  const text = `SELECT ${COLUMNS} FROM inventory_items WHERE id = $1`;
  const { rows } = client
    ? await client.query<ItemRow>(text, [id])
    : await query<ItemRow>(text, [id]);
  return rows[0] ?? null;
}

// Locked FOR UPDATE — taken at the top of the recordMovement transaction so concurrent
// movements on the SAME item serialize (the availability check can't be raced). Also lets
// the service confirm tenant ownership before any write.
export async function findByIdForUpdate(
  id: string,
  client: PoolClient,
): Promise<ItemRow | null> {
  const { rows } = await client.query<ItemRow>(
    `SELECT ${COLUMNS} FROM inventory_items WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

// One CASE-balance expression for a forward state S: Σ qty[state=S] − Σ qty[prev_state=S].
function balanceCol(state: string, alias: string): string {
  return `(COALESCE(SUM(CASE WHEN m.state = '${state}' THEN m.quantity END), 0)
           - COALESCE(SUM(CASE WHEN m.prev_state = '${state}' THEN m.quantity END), 0))::float8 AS ${alias}`;
}

// Tenant-scoped keyset page of items, each with its DERIVED per-state balances computed in
// ONE query (LEFT JOIN so items with no movements still appear, all balances 0). Keyset on
// (created_at, id). in_stock additionally folds in signed corrections. Raw, parameterized
// SQL — the state literals are from a fixed server-side allow-list (not user input).
export async function listByNgoWithStock(
  ngoId: string,
  opts: { limit: number; cursor?: Keyset | null },
): Promise<ItemWithStockRow[]> {
  const { limit, cursor } = opts;
  const conditions: string[] = ['i.ngo_id = $1'];
  const values: unknown[] = [ngoId];

  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(
      `(i.created_at, i.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
    );
  }
  values.push(limit);
  const limitPos = values.length;

  const inStock = `(COALESCE(SUM(CASE WHEN m.state = 'stock_in' THEN m.quantity END), 0)
                    - COALESCE(SUM(CASE WHEN m.prev_state = 'stock_in' THEN m.quantity END), 0)
                    + COALESCE(SUM(CASE WHEN m.state = 'correction' THEN m.quantity END), 0))::float8 AS in_stock`;

  const { rows } = await query<ItemWithStockRow>(
    `SELECT i.id, i.ngo_id, i.name, i.unit, i.created_at, i.updated_at,
            ${inStock},
            ${balanceCol('allocated', 'allocated')},
            ${balanceCol('dispatched', 'dispatched')},
            ${balanceCol('delivered', 'delivered')},
            ${balanceCol('consumed', 'consumed')}
     FROM inventory_items i
     LEFT JOIN stock_movements m ON m.item_id = i.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY i.id
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT $${limitPos}`,
    values,
  );
  return rows;
}
