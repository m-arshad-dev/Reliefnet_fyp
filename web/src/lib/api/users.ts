import { api } from './client';
import type { PublicUser } from './auth';
import type { Envelope, Page } from './types';

export type StaffRole = 'ngo_admin' | 'field_coordinator' | 'volunteer' | 'data_entry';

export const STAFF_ROLES: StaffRole[] = [
  'ngo_admin',
  'field_coordinator',
  'volunteer',
  'data_entry',
];

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  role: StaffRole;
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const { data } = await api.post<Envelope<PublicUser>>('/users', input);
  return data.data;
}

export async function listUsers(params?: { limit?: number; cursor?: string }): Promise<Page<PublicUser>> {
  const { data } = await api.get<Envelope<Page<PublicUser>>>('/users', { params });
  return data.data;
}
