import { api } from './client';
import type { Envelope, Page } from './types';

// Slice 7 Task FSM — the FRONTEND source of truth for the task vocabulary, mirroring the
// server's taskConstants.ts + task.service.ts maps. The server is authoritative and
// re-validates everything; these mirrors only drive which actions the UI offers.
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

export const TASK_TRANSITION_TARGETS = [
  'assigned',
  'in_progress',
  'pending_verification',
  'completed',
  'rejected',
] as const;
export type TaskTransitionTarget = (typeof TASK_TRANSITION_TARGETS)[number];

// Mirror of the server FSM — so the row only renders legal next states. 'escalated' is never
// a requestable target (it's reached only via the rejection-cap redirect).
export const TASK_TRANSITIONS: Record<string, TaskTransitionTarget[]> = {
  created: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['pending_verification'],
  pending_verification: ['completed', 'rejected'],
  rejected: ['assigned'],
  escalated: ['assigned'],
  completed: [],
};

// Mirror of the server's EDGE_PERMISSIONS, expressed as the roles allowed to drive each edge,
// so the UI enables/disables an action per the current role. (task:create/escalate →
// ngo_admin+field_coordinator; task:execute → volunteer.)
const EDGE_ROLES: Record<string, string[]> = {
  'created->assigned': ['ngo_admin', 'field_coordinator'],
  'assigned->in_progress': ['volunteer'],
  'in_progress->pending_verification': ['volunteer'],
  'pending_verification->completed': ['ngo_admin', 'field_coordinator'],
  'pending_verification->rejected': ['ngo_admin', 'field_coordinator'],
  'rejected->assigned': ['ngo_admin', 'field_coordinator'],
  'escalated->assigned': ['ngo_admin', 'field_coordinator'],
};

export function canTransition(role: string, from: string, to: string): boolean {
  return EDGE_ROLES[`${from}->${to}`]?.includes(role) ?? false;
}

// The assign edges (created/rejected/escalated -> assigned) carry an assignee.
export function isAssignEdge(to: string): boolean {
  return to === 'assigned';
}

// Human label for an edge — 'assigned' is context-dependent (assign / reassign / reset).
export function actionLabel(from: string, to: string): string {
  if (to === 'assigned') {
    if (from === 'created') return 'Assign';
    if (from === 'escalated') return 'Reset & reassign';
    return 'Reassign';
  }
  const labels: Record<string, string> = {
    in_progress: 'Start',
    pending_verification: 'Submit for verification',
    completed: 'Mark complete',
    rejected: 'Reject',
  };
  return labels[to] ?? to;
}

export interface Task {
  id: string;
  ngoId: string;
  campaignId: string;
  title: string;
  description: string | null;
  locationId: string | null;
  status: string;
  rejectionCount: number;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTransition {
  id: string;
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string;
  note: string | null;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  campaignId: string;
  locationId?: string;
  assignedTo?: string;
}

export interface TransitionTaskInput {
  toStatus: TaskTransitionTarget;
  note?: string;
  assignedTo?: string;
}

export async function listTasks(params?: {
  status?: string;
  assignedTo?: string;
  limit?: number;
  cursor?: string;
}): Promise<Page<Task>> {
  const { data } = await api.get<Envelope<Page<Task>>>('/tasks', { params });
  return data.data;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { data } = await api.post<Envelope<Task>>('/tasks', input);
  return data.data;
}

export async function transitionTask(id: string, input: TransitionTaskInput): Promise<Task> {
  const { data } = await api.patch<Envelope<Task>>(`/tasks/${id}/transition`, input);
  return data.data;
}

export async function listHistory(
  taskId: string,
  params?: { limit?: number; cursor?: string },
): Promise<Page<TaskTransition>> {
  const { data } = await api.get<Envelope<Page<TaskTransition>>>(`/tasks/${taskId}/history`, {
    params,
  });
  return data.data;
}
