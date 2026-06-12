import { api } from './client';
import type { Envelope, Page } from './types';

// Slice 12 Offline Sync — the web reconciliation client. The mobile field client captures writes
// offline and replays them on reconnect; an op whose optimistic base diverged from the server is
// PARKED as a conflict (it is never auto-resolved on the device). A coordinator/admin settles it
// here with a side-by-side diff. clientPayload = what the device intended; serverSnapshot = the
// current server entity. Resolving re-stamps the op's seq so the device reconciles by client_uuid.
export interface SyncConflict {
  conflictId: string;
  entityType: string;
  entityId: string | null;
  conflictWith: string | null;
  clientPayload: unknown;
  serverSnapshot: unknown;
  clientCreatedAt: string;
  receivedAt: string;
}

export type Resolution = 'keep_server' | 'keep_client' | 'merge';

export interface ResolveInput {
  resolution: Resolution;
  mergedPayload?: unknown;
}

export interface ResolveResult {
  conflictId: string;
  resolution: string;
  status: 'resolved';
  seq: string;
  result: unknown;
}

export async function listConflicts(params?: {
  limit?: number;
  cursor?: string;
}): Promise<Page<SyncConflict>> {
  const { data } = await api.get<Envelope<Page<SyncConflict>>>('/sync/conflicts', { params });
  return data.data;
}

export async function resolveConflict(id: string, input: ResolveInput): Promise<ResolveResult> {
  const { data } = await api.post<Envelope<ResolveResult>>(`/sync/conflicts/${id}/resolve`, input);
  return data.data;
}
