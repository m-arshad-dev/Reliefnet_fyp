import { api } from './client';
import type { Envelope, Page } from './types';

// Mirrors the server's AID_TYPES (lib/beneficiaryConstants.ts) — the aid vocabulary for
// the registration form's aid-type select.
export const AID_TYPES = ['food', 'shelter', 'medical', 'hygiene', 'other'] as const;
export type AidType = (typeof AID_TYPES)[number];

// Client-safe beneficiary (camelCase). The CNIC / its hash NEVER leave the server.
export interface Beneficiary {
  id: string;
  ngoId: string;
  fullName: string;
  householdSize: number | null;
  locationId: string | null;
  contactMasked: string | null;
  verified: boolean;
  verifiedBy: string | null;
  registeredBy: string;
  createdAt: string;
  updatedAt: string;
}

// The cross-NGO duplicate flag (v2 §5.4). It FLAGS, never blocks — registration still
// succeeds. `priorAid` lists who gave what aid, when, under any NGO.
export interface DuplicateFlag {
  flagged: boolean;
  maskedIdentity: string | null;
  priorAid: { ngo: string; aidType: string; deliveredAt: string }[];
}

export interface RegisterBeneficiaryResult {
  beneficiary: Beneficiary;
  duplicateFlag: DuplicateFlag;
}

export interface CreateBeneficiaryInput {
  cnic: string; // raw; sent over HTTPS, hashed + discarded server-side, never stored
  fullName: string;
  householdSize?: number;
  contactMasked?: string;
  locationId?: string;
  campaignId: string;
  aidType: AidType;
}

// POST /beneficiaries — always 201; the response nests the duplicateFlag inside data.
export async function registerBeneficiary(
  input: CreateBeneficiaryInput,
): Promise<RegisterBeneficiaryResult> {
  const { data } = await api.post<Envelope<RegisterBeneficiaryResult>>('/beneficiaries', input);
  return data.data;
}

// POST /beneficiaries/check — pre-check. CNIC travels in the body (kept out of URLs/logs).
export async function checkDuplicate(cnic: string): Promise<DuplicateFlag> {
  const { data } = await api.post<Envelope<DuplicateFlag>>('/beneficiaries/check', { cnic });
  return data.data;
}

export async function listBeneficiaries(
  params?: { verified?: boolean; limit?: number; cursor?: string },
): Promise<Page<Beneficiary>> {
  const { data } = await api.get<Envelope<Page<Beneficiary>>>('/beneficiaries', { params });
  return data.data;
}

export async function verifyBeneficiary(id: string): Promise<Beneficiary> {
  const { data } = await api.patch<Envelope<Beneficiary>>(`/beneficiaries/${id}/verify`, {});
  return data.data;
}
