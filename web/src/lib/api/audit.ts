import { api } from './client';
import type { Envelope, Page } from './types';

// Slice 10 Audit Ledger — the auditor/system_admin read client. The ledger is APPEND-ONLY and
// hash-chained on the server; here we only read it (list + verify). entityType values mirror the
// server's record() calls, so the filter can offer the known set without a magic-string lookup.
export const AUDIT_ENTITY_TYPES = [
  'resource_match',
  'stock_movement',
  'task',
  'beneficiary',
  'campaign',
  'ngo',
  'disaster_event',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export interface AuditEntry {
  id: string;
  ngoId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  prevHash: string | null;
  rowHash: string;
  createdAt: string;
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  head: string | null;
  brokenRow?: { id: string; reason: 'prev_hash_mismatch' | 'row_hash_mismatch' };
}

export async function listLedger(params?: {
  entityType?: string;
  actorId?: string;
  limit?: number;
  cursor?: string;
}): Promise<Page<AuditEntry>> {
  const { data } = await api.get<Envelope<Page<AuditEntry>>>('/audit/ledger', { params });
  return data.data;
}

export async function verifyChain(): Promise<VerifyResult> {
  const { data } = await api.get<Envelope<VerifyResult>>('/audit/verify');
  return data.data;
}
