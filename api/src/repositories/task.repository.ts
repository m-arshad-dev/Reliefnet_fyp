import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of a `tasks` row (snake_case, straight from SQL). `status` and `rejection_count`
// are the FSM state; the legality of moving between statuses lives in task.service.ts, not here.
export interface TaskRow {
  id: string;
  ngo_id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  location_id: string | null;
  status: string;
  rejection_count: number;
  assigned_to: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, ngo_id, campaign_id, title, description, location_id, status,
                 rejection_count, assigned_to, created_by, created_at, updated_at`;

interface InsertTaskParams {
  ngoId: string;
  campaignId: string;
  title: string;
  description: string | null;
  locationId: string | null;
  assignedTo: string | null;
  createdBy: string;
}

// Always called with the shared `client` — createTask wraps the insert + the genesis
// transition row in one transaction (law 4). status/rejection_count take their column
// defaults ('created' / 0).
export async function insert(params: InsertTaskParams, client: PoolClient): Promise<TaskRow> {
  const text = `INSERT INTO tasks
                  (ngo_id, campaign_id, title, description, location_id, assigned_to, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING ${COLUMNS}`;
  const { rows } = await client.query<TaskRow>(text, [
    params.ngoId,
    params.campaignId,
    params.title,
    params.description,
    params.locationId,
    params.assignedTo,
    params.createdBy,
  ]);
  return rows[0];
}

export async function findById(id: string, client?: PoolClient): Promise<TaskRow | null> {
  const text = `SELECT ${COLUMNS} FROM tasks WHERE id = $1`;
  const { rows } = client
    ? await client.query<TaskRow>(text, [id])
    : await query<TaskRow>(text, [id]);
  return rows[0] ?? null;
}

// Locked FOR UPDATE — taken at the top of the transitionTask transaction so concurrent
// transitions on the SAME task serialize (the FSM + rejection-cap check can't be raced) and
// the service can confirm tenant ownership before any write.
export async function findByIdForUpdate(
  id: string,
  client: PoolClient,
): Promise<TaskRow | null> {
  const { rows } = await client.query<TaskRow>(
    `SELECT ${COLUMNS} FROM tasks WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

interface UpdateTaskParams {
  status: string;
  rejectionCount: number;
  assignedTo: string | null;
}

// The single mutation the FSM performs: set the applied status, the (possibly bumped)
// rejection_count, and the resolved assignee. Always inside the transitionTask transaction.
export async function update(
  id: string,
  params: UpdateTaskParams,
  client: PoolClient,
): Promise<TaskRow> {
  const { rows } = await client.query<TaskRow>(
    `UPDATE tasks
     SET status = $2, rejection_count = $3, assigned_to = $4, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, params.status, params.rejectionCount, params.assignedTo],
  );
  return rows[0];
}

// Tenant-scoped keyset page: only tasks belonging to `ngoId` (the app-layer isolation
// guarantee for now; DB-enforced RLS lands in Slice 9). Optional status (powers the
// escalated queue) and assignedTo filters. Keyset on (created_at, id).
export async function listByNgo(
  ngoId: string,
  opts: { limit: number; cursor?: Keyset | null; status?: string; assignedTo?: string },
): Promise<TaskRow[]> {
  const { limit, cursor, status, assignedTo } = opts;
  const conditions: string[] = ['ngo_id = $1'];
  const values: unknown[] = [ngoId];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (assignedTo) {
    values.push(assignedTo);
    conditions.push(`assigned_to = $${values.length}`);
  }
  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(
      `(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
    );
  }
  values.push(limit);
  const limitPos = values.length;

  const { rows } = await query<TaskRow>(
    `SELECT ${COLUMNS} FROM tasks
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitPos}`,
    values,
  );
  return rows;
}
