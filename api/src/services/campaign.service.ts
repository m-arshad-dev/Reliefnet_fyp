import * as campaignRepo from '../repositories/campaign.repository';
import type { CampaignRow } from '../repositories/campaign.repository';
import * as disasterRepo from '../repositories/disaster.repository';
import { withTenant } from '../db/pool';
import { NotFoundError, ValidationError, isForeignKeyViolation } from '../lib/errors';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';

// Client-safe campaign projection (camelCase).
export interface PublicCampaign {
  id: string;
  ngoId: string;
  disasterId: string;
  name: string;
  targetRegionId: string | null;
  startsOn: string;
  endsOn: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function toPublicCampaign(row: CampaignRow): PublicCampaign {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    disasterId: row.disaster_id,
    name: row.name,
    targetRegionId: row.target_region_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Campaign status is a small state machine (CLAUDE.md law 3): the service rejects any
// (from -> to) not in this map. 'planning' is the create-time entry state and is never
// a target; 'completed' is terminal.
const CAMPAIGN_STATUS_TRANSITIONS: Record<string, string[]> = {
  planning: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};

interface CreateCampaignInput {
  name: string;
  disasterId: string;
  targetRegionId?: string;
  startsOn: string;
  endsOn?: string;
}

// `tenantNgoId` comes from the caller's JWT (req.tenant.ngoId), NEVER the body — the
// core app-layer isolation guarantee: an ngo_admin can only create campaigns inside
// their own NGO. We verify the referenced disaster exists first (clean 404), then a
// bad target_region_id (FK 23503) surfaces as a 422.
export async function createCampaign(
  tenantNgoId: string,
  input: CreateCampaignInput,
  actorId: string,
): Promise<PublicCampaign> {
  const disaster = await disasterRepo.findById(input.disasterId);
  if (!disaster) throw new NotFoundError('Disaster not found');

  try {
    const row = await withTenant(tenantNgoId, (client) =>
      campaignRepo.insert(
        {
          ngoId: tenantNgoId,
          disasterId: input.disasterId,
          name: input.name,
          targetRegionId: input.targetRegionId ?? null,
          startsOn: input.startsOn,
          endsOn: input.endsOn ?? null,
          createdBy: actorId,
        },
        client,
      ),
    );
    return toPublicCampaign(row);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ValidationError('Referenced region does not exist');
    }
    throw err;
  }
}

export async function listCampaigns(
  tenantNgoId: string,
  opts: { limit?: number; cursor?: string; disasterId?: string },
): Promise<Page<PublicCampaign>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await withTenant(tenantNgoId, (client) =>
    campaignRepo.listByNgo(tenantNgoId, { limit, cursor, disasterId: opts.disasterId }, client),
  );
  return buildPage(rows, limit, toPublicCampaign);
}

export async function setCampaignStatus(
  id: string,
  status: 'active' | 'paused' | 'completed',
  tenantNgoId: string,
): Promise<PublicCampaign> {
  return withTenant(tenantNgoId, async (client) => {
    const existing = await campaignRepo.findById(id, client);
    // 404 if missing OR not in the caller's tenant — never reveal another NGO's campaign.
    if (!existing || existing.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Campaign not found');
    }

    if (existing.status !== status) {
      const allowed = CAMPAIGN_STATUS_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(status)) {
        throw new ValidationError(
          `Cannot change campaign status from '${existing.status}' to '${status}'`,
        );
      }
    }

    const updated = await campaignRepo.updateStatus(id, status, client);
    if (!updated) throw new NotFoundError('Campaign not found');
    return toPublicCampaign(updated);
  });
}
