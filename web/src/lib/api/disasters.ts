import { api } from './client';
import type { Envelope, Page } from './types';

export const DISASTER_TYPES = ['flood', 'earthquake', 'drought', 'other'] as const;
export type DisasterType = (typeof DISASTER_TYPES)[number];

export const DISASTER_SEVERITIES = ['low', 'moderate', 'high', 'critical'] as const;
export type DisasterSeverity = (typeof DISASTER_SEVERITIES)[number];

export interface Disaster {
  id: string;
  name: string;
  type: string;
  severity: string;
  regionId: string | null;
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null;
  status: string; // active | closed
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisasterInput {
  name: string;
  type: DisasterType;
  severity: DisasterSeverity;
  regionId?: string;
  startsOn: string;
  endsOn?: string;
}

export async function listDisasters(
  params?: { limit?: number; cursor?: string },
): Promise<Page<Disaster>> {
  const { data } = await api.get<Envelope<Page<Disaster>>>('/disasters', { params });
  return data.data;
}

export async function createDisaster(input: CreateDisasterInput): Promise<Disaster> {
  const { data } = await api.post<Envelope<Disaster>>('/disasters', input);
  return data.data;
}

export async function getDisaster(id: string): Promise<Disaster> {
  const { data } = await api.get<Envelope<Disaster>>(`/disasters/${id}`);
  return data.data;
}
