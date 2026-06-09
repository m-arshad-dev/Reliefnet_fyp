import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenStore } from '../auth/tokenStore';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export const api = axios.create({ baseURL });

// Attach the access token to every outgoing request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: if several requests 401 at once, they all await one
// refresh round-trip rather than stampeding /auth/refresh.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');
  // Bare axios (not `api`) so this call skips the interceptors below.
  const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  const newAccess: string | undefined = data?.data?.accessToken;
  if (!newAccess) throw new Error('No access token in refresh response');
  tokenStore.setAccess(newAccess);
  return newAccess;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isRefreshCall && tokenStore.getRefresh()) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newAccess = await refreshPromise;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshErr) {
        // Refresh failed → session is dead. Clear and bounce to login.
        tokenStore.clear();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  },
);
