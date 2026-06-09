import { api } from './client';
import type { PublicUser } from './auth';
import type { Envelope, Page } from './types';

export interface Ngo {
  id: string;
  name: string;
  registrationNo: string | null;
  status: string; // pending | active | suspended
  vettedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterNgoInput {
  ngo: { name: string; registrationNo?: string };
  admin: { fullName: string; email: string; password: string };
}

export async function registerNgo(
  input: RegisterNgoInput,
): Promise<{ ngo: Ngo; admin: PublicUser }> {
  const { data } = await api.post<Envelope<{ ngo: Ngo; admin: PublicUser }>>(
    '/auth/register-ngo',
    input,
  );
  return data.data;
}

export async function listNgos(params?: { limit?: number; cursor?: string }): Promise<Page<Ngo>> {
  const { data } = await api.get<Envelope<Page<Ngo>>>('/ngos', { params });
  return data.data;
}

export async function setNgoStatus(id: string, status: 'active' | 'suspended'): Promise<Ngo> {
  const { data } = await api.patch<Envelope<Ngo>>(`/ngos/${id}/status`, { status });
  return data.data;
}
