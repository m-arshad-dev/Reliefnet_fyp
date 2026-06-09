// Where the access + refresh tokens live in the browser. Centralized so the
// axios client, AuthContext, and logout all touch storage through one module.
const ACCESS_KEY = 'reliefnet.accessToken';
const REFRESH_KEY = 'reliefnet.refreshToken';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (accessToken: string, refreshToken?: string) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  setAccess: (accessToken: string) => localStorage.setItem(ACCESS_KEY, accessToken),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
