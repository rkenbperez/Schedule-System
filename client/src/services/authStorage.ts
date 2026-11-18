// client/src/services/authStorage.ts
// Persistent storage for JWT access + refresh tokens.
// Uses localStorage so the session survives tab refreshes and restarts.

const ACCESS_KEY = 'ss_access_token';
const REFRESH_KEY = 'ss_refresh_token';

export const authStorage = {
  getAccessToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  },

  setTokens(access: string, refresh: string) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },

  clearTokens() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
