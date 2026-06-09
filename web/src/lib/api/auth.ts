import { api } from './client';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  ngoId: string | null;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

interface LoginData {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export async function login(email: string, password: string): Promise<LoginData> {
  const { data } = await api.post<Envelope<LoginData>>('/auth/login', { email, password });
  return data.data;
}

export async function fetchMe(): Promise<PublicUser> {
  const { data } = await api.get<Envelope<{ user: PublicUser }>>('/auth/me');
  return data.data.user;
}
