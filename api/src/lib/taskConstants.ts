// Slice 7 Task FSM — the single backend source of truth for the task enums. tasks.routes.ts
// builds its Zod `z.enum(...)` from these tuples; the service draws on them too. The forward
// TRANSITIONS map and the per-edge permission map live in task.service.ts (law 3) — this file
// only holds the vocabulary both sides share.

// Every status a task row can land in. The lifecycle (created -> assigned -> in_progress ->
// pending_verification -> completed|rejected, with rejected/escalated -> assigned) is the FSM;
// 'escalated' is only ever reached via the rejection-cap redirect (never requested directly).
export const TASK_STATUSES = [
  'created',
  'assigned',
  'in_progress',
  'pending_verification',
  'completed',
  'rejected',
  'escalated',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// Valid PATCH targets only. 'created' is the create-time entry state (set on insert) and
// 'escalated' is reachable ONLY via the rejection cap (the service redirects a 'rejected'
// request to it) — so neither is a directly-requestable transition target.
export const TASK_TRANSITION_TARGETS = [
  'assigned',
  'in_progress',
  'pending_verification',
  'completed',
  'rejected',
] as const;
export type TaskTransitionTarget = (typeof TASK_TRANSITION_TARGETS)[number];
