import { api } from './client';
import type { Envelope, Page } from './types';

export const CAMPAIGN_STATUSES = ['planning', 'active', 'paused', 'completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

// Statuses you can transition TO via PATCH (never back to 'planning').
export type CampaignStatusTarget = 'active' | 'paused' | 'completed';

// Mirror of the server's CAMPAIGN_STATUS_TRANSITIONS, used to enable/disable the
// status action buttons. The server is the source of truth and re-validates.
export const CAMPAIGN_TRANSITIONS: Record<string, CampaignStatusTarget[]> = {
  planning: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};

export interface Campaign {
  id: string;
  ngoId: string;
  disasterId: string;
  name: string;
  targetRegionId: string | null;
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null;
  status: string; // planning | active | paused | completed
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  name: string;
  disasterId: string;
  targetRegionId?: string;
  startsOn: string;
  endsOn?: string;
}

export async function listCampaigns(
  params?: { limit?: number; cursor?: string; disasterId?: string },
): Promise<Page<Campaign>> {
  const { data } = await api.get<Envelope<Page<Campaign>>>('/campaigns', { params });
  return data.data;
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const { data } = await api.post<Envelope<Campaign>>('/campaigns', input);
  return data.data;
}

export async function setCampaignStatus(
  id: string,
  status: CampaignStatusTarget,
): Promise<Campaign> {
  const { data } = await api.patch<Envelope<Campaign>>(`/campaigns/${id}/status`, { status });
  return data.data;
}
