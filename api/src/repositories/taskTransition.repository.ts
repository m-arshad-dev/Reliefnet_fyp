import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of a `task_transitions` row (snake_case). An immutable, append-only audit row:
// it records one status change (from_status -> to_status) on a task, by whom, with an
// optional note. from_status is NULL only on the genesis row written at task creation.
export interface TransitionRow {
  id: string;
  task_id: string;
  from_status: string | null;
  to_status: string;
  actor_id: string;
  note: string | null;
  created_at: Date;
}

const COLUMNS = `id, task_id, from_status, to_status, actor_id, note, created_at`;

interface InsertTransitionParams {
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string;
  note: string | null;
}

// Always called with the shared `client` — the history row is written in the SAME
// transaction as the task insert/update (law 4), so a status move and its audit row commit
// together or not at all.
export async function insert(
  params: InsertTransitionParams,
  client: PoolClient,
): Promise<TransitionRow> {
  const text = `INSERT INTO task_transitions (task_id, from_status, to_status, actor_id, note)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING ${COLUMNS}`;
  const { rows } = await client.query<TransitionRow>(text, [
    params.taskId,
    params.fromStatus,
    params.toStatus,
    params.actorId,
    params.note,
  ]);
  return rows[0];
}

// Keyset page of a task's transition history (newest first), for GET /tasks/:id/history.
// The caller (service) has already confirmed the task belongs to the tenant.
export async function listByTask(
  taskId: string,
  opts: { limit: number; cursor?: Keyset | null },
  client?: PoolClient,
): Promise<TransitionRow[]> {
  const { limit, cursor } = opts;
  const conditions: string[] = ['task_id = $1'];
  const values: unknown[] = [taskId];

  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(
      `(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
    );
  }
  values.push(limit);
  const limitPos = values.length;

  const text = `SELECT ${COLUMNS} FROM task_transitions
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitPos}`;
  const { rows } = client
    ? await client.query<TransitionRow>(text, values)
    : await query<TransitionRow>(text, values);
  return rows;
}
