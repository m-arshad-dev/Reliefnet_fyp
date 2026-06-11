import * as beneficiaryRepo from '../repositories/beneficiary.repository';
import type { BeneficiaryRow } from '../repositories/beneficiary.repository';
import * as aidRecordRepo from '../repositories/aidRecord.repository';
import type { PriorAidRow } from '../repositories/aidRecord.repository';
import * as campaignRepo from '../repositories/campaign.repository';
import { withTenant, withCrossTenant, withTenantShared } from '../db/pool';
import * as auditService from './audit.service';
import { ConflictError, NotFoundError } from '../lib/errors';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';
import { hashCnic, maskCnic } from '../lib/cnic';
import type { AidType } from '../lib/beneficiaryConstants';

// Client-safe beneficiary projection (camelCase). Deliberately EXCLUDES cnic_hash — the
// hash never leaves the server.
export interface PublicBeneficiary {
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

function toPublicBeneficiary(row: BeneficiaryRow): PublicBeneficiary {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    fullName: row.full_name,
    householdSize: row.household_size,
    locationId: row.location_id,
    contactMasked: row.contact_masked,
    verified: row.verified,
    verifiedBy: row.verified_by,
    registeredBy: row.registered_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// The duplicate flag (v2 §5.4). It FLAGS, never blocks: `flagged` is true when prior aid
// exists for this CNIC (under ANY NGO). maskedIdentity is derived from the just-submitted
// CNIC (never persisted); priorAid lists who gave what, when.
export interface DuplicateFlag {
  flagged: boolean;
  maskedIdentity: string | null;
  priorAid: { ngo: string; aidType: string; deliveredAt: string }[];
}

function toDuplicateFlag(rawCnic: string, prior: PriorAidRow[]): DuplicateFlag {
  const flagged = prior.length > 0;
  return {
    flagged,
    maskedIdentity: flagged ? maskCnic(rawCnic) : null,
    priorAid: prior.map((p) => ({
      ngo: p.ngo_name,
      aidType: p.aid_type,
      deliveredAt: p.delivered_at.toISOString(),
    })),
  };
}

interface RegisterBeneficiaryInput {
  cnic: string;
  fullName: string;
  householdSize?: number;
  locationId?: string;
  contactMasked?: string;
  campaignId: string;
  aidType: AidType;
}

export interface RegisterBeneficiaryResult {
  beneficiary: PublicBeneficiary;
  duplicateFlag: DuplicateFlag;
}

// THE CORE OF THE SLICE (laws 4 & 6). `tenantNgoId` is the caller's NGO from the JWT — the
// write is tenant-owned (ngo_id forced here, never the body; registered_by/recorded_by are
// the actor). The duplicate check is a CROSS-NGO read read BEFORE the new aid_record is
// written, so it reflects PRIOR aid only — and it FLAGS, never BLOCKS: a hash hit never
// throws, registration always succeeds (201). create + flag-read + aid_record are ONE
// withTransaction so a half-applied registration is impossible.
export async function registerBeneficiary(
  tenantNgoId: string,
  input: RegisterBeneficiaryInput,
  actorId: string,
): Promise<RegisterBeneficiaryResult> {
  const cnicHash = hashCnic(input.cnic);

  // withTenantShared sets BOTH GUCs: app.current_ngo_id (so our own campaign read + the two
  // inserts pass tenant_rw) AND app.cross_tenant='on' (so the prior-aid hash read crosses the
  // aid_records cross_tenant_read carve-out). One txn, so the flag-read + writes stay atomic.
  return withTenantShared(tenantNgoId, async (client) => {
    // The aid_record nests under a campaign; it must belong to the caller's NGO (404
    // otherwise — never write aid against another tenant's campaign). The FK is the
    // integrity backstop if the campaign vanishes between this check and the insert.
    const campaign = await campaignRepo.findById(input.campaignId, client);
    if (!campaign || campaign.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Campaign not found');
    }

    // Read prior aid FIRST, before our own aid_record exists, so we never flag ourselves.
    const prior = await aidRecordRepo.findPriorAidByHash(cnicHash, client);

    const beneficiary = await beneficiaryRepo.insert(
      {
        ngoId: tenantNgoId,
        cnicHash,
        fullName: input.fullName,
        householdSize: input.householdSize ?? null,
        locationId: input.locationId ?? null,
        contactMasked: input.contactMasked ?? null,
        registeredBy: actorId,
      },
      client,
    );

    await aidRecordRepo.insert(
      {
        beneficiaryId: beneficiary.id,
        cnicHash,
        ngoId: tenantNgoId,
        campaignId: input.campaignId,
        aidType: input.aidType,
        recordedBy: actorId,
      },
      client,
    );

    // Slice 10 — tamper-evident ledger entry in the SAME txn (law 4). NO CNIC/PII in metadata
    // (the hash never leaves the server); just whether a cross-NGO duplicate was flagged.
    await auditService.record(client, {
      action: 'beneficiary.register',
      entityType: 'beneficiary',
      entityId: beneficiary.id,
      metadata: { campaignId: input.campaignId, aidType: input.aidType, duplicateFlagged: prior.length > 0 },
      actorId,
      ngoId: tenantNgoId,
    });

    return {
      beneficiary: toPublicBeneficiary(beneficiary),
      duplicateFlag: toDuplicateFlag(input.cnic, prior),
    };
  });
}

// Pre-check (POST /beneficiaries/check). Pure CROSS-NGO read — no tenant, no write — so a
// registrar can preview the flag before saving. Same hash + prior-aid path as the real
// create, just without the insert.
export async function checkDuplicate(cnic: string): Promise<DuplicateFlag> {
  const prior = await withCrossTenant((client) =>
    aidRecordRepo.findPriorAidByHash(hashCnic(cnic), client),
  );
  return toDuplicateFlag(cnic, prior);
}

export async function getBeneficiary(
  tenantNgoId: string,
  id: string,
): Promise<PublicBeneficiary> {
  const row = await withTenant(tenantNgoId, (client) => beneficiaryRepo.findById(id, client));
  // 404 if missing OR not in the caller's tenant — never reveal another NGO's beneficiary.
  if (!row || row.ngo_id !== tenantNgoId) {
    throw new NotFoundError('Beneficiary not found');
  }
  return toPublicBeneficiary(row);
}

export async function listBeneficiaries(
  tenantNgoId: string,
  opts: { limit?: number; cursor?: string; verified?: boolean },
): Promise<Page<PublicBeneficiary>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await withTenant(tenantNgoId, (client) =>
    beneficiaryRepo.listByNgo(tenantNgoId, { limit, cursor, verified: opts.verified }, client),
  );
  return buildPage(rows, limit, toPublicBeneficiary);
}

// Verify a beneficiary (PATCH /beneficiaries/:id/verify). Not an FSM — a guarded boolean
// flip — but wrapped in a transaction with a FOR UPDATE lock so concurrent verifies can't
// race past the "already verified" guard. Tenant-owned: only the owning NGO may verify.
export async function verifyBeneficiary(
  tenantNgoId: string,
  id: string,
  actorId: string,
): Promise<PublicBeneficiary> {
  return withTenant(tenantNgoId, async (client) => {
    const row = await beneficiaryRepo.findByIdForUpdate(id, client);
    if (!row || row.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Beneficiary not found');
    }
    if (row.verified) {
      throw new ConflictError('Beneficiary is already verified');
    }
    const updated = await beneficiaryRepo.setVerified(id, actorId, client);

    // Slice 10 — tamper-evident ledger entry in the SAME txn (law 4).
    await auditService.record(client, {
      action: 'beneficiary.verify',
      entityType: 'beneficiary',
      entityId: id,
      metadata: {},
      actorId,
      ngoId: tenantNgoId,
    });

    return toPublicBeneficiary(updated);
  });
}
