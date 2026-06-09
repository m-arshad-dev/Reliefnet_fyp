import { api } from './client';
import type { Envelope, Page } from './types';

// Slice 3 Coordination Board — the single FRONTEND source of truth for the shared
// enums (imported by both the needs and offers forms/filters). The resource-type
// vocabulary mirrors the server's coordinationConstants.ts.
export const RESOURCE_TYPES = ['shelter', 'food', 'water', 'health', 'wash', 'other'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const NEED_PRIORITIES = ['low', 'moderate', 'high', 'critical'] as const;
export type NeedPriority = (typeof NEED_PRIORITIES)[number];

export const OFFER_VISIBILITY = ['shared', 'private'] as const;
export type OfferVisibility = (typeof OFFER_VISIBILITY)[number];

export const NEED_STATUSES = [
  'open',
  'matched',
  'fulfilling',
  'fulfilled',
  'closed',
  'cancelled',
] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

export const OFFER_STATUSES = [
  'available',
  'reserved',
  'committed',
  'delivered',
  'closed',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

// `ngoName` is returned by the cross-tenant board read so a row from another NGO shows
// who raised it (e.g. "Posted by NGO A").
export interface ResourceNeed {
  id: string;
  ngoId: string;
  ngoName: string;
  disasterId: string;
  type: string;
  quantity: number;
  locationId: string | null;
  priority: string;
  description: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceOffer {
  id: string;
  ngoId: string;
  ngoName: string;
  disasterId: string;
  type: string;
  quantity: number;
  locationId: string | null;
  availableFrom: string | null; // YYYY-MM-DD
  availableUntil: string | null; // YYYY-MM-DD
  visibility: string; // shared | private
  description: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNeedInput {
  disasterId: string;
  type: ResourceType;
  quantity: number;
  locationId?: string;
  priority?: NeedPriority;
  description?: string;
}

export interface CreateOfferInput {
  disasterId: string;
  type: ResourceType;
  quantity: number;
  locationId?: string;
  availableFrom?: string;
  availableUntil?: string;
  visibility?: OfferVisibility;
  description?: string;
}

// Board reads are CROSS-NGO: these return needs/offers from every NGO in the disaster.
// `disasterId` is required (the board is disaster-scoped); type/locationId narrow it.
export interface BoardQuery {
  disasterId: string;
  status?: string;
  type?: string;
  locationId?: string;
  limit?: number;
  cursor?: string;
}

export async function listNeeds(params: BoardQuery): Promise<Page<ResourceNeed>> {
  const { data } = await api.get<Envelope<Page<ResourceNeed>>>('/needs', { params });
  return data.data;
}

export async function createNeed(input: CreateNeedInput): Promise<ResourceNeed> {
  const { data } = await api.post<Envelope<ResourceNeed>>('/needs', input);
  return data.data;
}

export async function listOffers(params: BoardQuery): Promise<Page<ResourceOffer>> {
  const { data } = await api.get<Envelope<Page<ResourceOffer>>>('/offers', { params });
  return data.data;
}

export async function createOffer(input: CreateOfferInput): Promise<ResourceOffer> {
  const { data } = await api.post<Envelope<ResourceOffer>>('/offers', input);
  return data.data;
}
