// client/src/services/http.ts
// Authenticated fetch wrapper.
// - Attaches Authorization: Bearer <access_token> to every request.
// - On 401: attempts a single token refresh via POST /api/auth/jwt/refresh/.
//   If refresh succeeds, retries the original request with the new token.
//   If refresh fails (or no refresh token): clears tokens and redirects to /.
// - Always sends credentials: 'include' (keeps the same cookie behavior
//   the app already used).

import { authStorage } from './authStorage';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BASE_URL}/api/auth/jwt/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const newAccess = data.access as string | undefined;
    const newRefresh = data.refresh as string | undefined;

    if (!newAccess) return null;

    // SimpleJWT rotates refresh tokens when ROTATE_REFRESH_TOKENS is true.
    if (newRefresh) {
      authStorage.setTokens(newAccess, newRefresh);
    } else {
      authStorage.setTokens(newAccess, refreshToken);
    }
    return newAccess;
  } catch {
    return null;
  }
}

function buildHeaders(init: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, init.headers);
    }
  }
  const accessToken = authStorage.getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const mergedInit: RequestInit = {
    ...init,
    headers: buildHeaders(init),
    credentials: 'include',
  };

  let response = await fetch(input, mergedInit);

  // 401 with a refresh token available → try once to refresh, then retry.
  if (response.status === 401 && authStorage.getRefreshToken()) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }

    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newToken) {
      const retryHeaders = buildHeaders(init);
      retryHeaders['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(input, {
        ...init,
        headers: retryHeaders,
        credentials: 'include',
      });
    } else {
      // Refresh failed (expired/invalid refresh token) — clear session.
      authStorage.clearTokens();
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
  }

  return response;
}

// Convenience: parse JSON body, throwing a descriptive error on non-ok.
export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail || body.error || JSON.stringify(body);
    } catch {
      // ignore parse errors; use status text
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

// Convenience: fetch a blob (for file exports).
export async function apiBlob(input: RequestInfo | URL, init?: RequestInit): Promise<Blob> {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.blob();
}

// Follow DRF PageNumberPagination ({ count, next, previous, results }) until
// `next` is null, concatenating every `results` page into one flat array.
// Non-paginated responses (plain arrays) are returned as-is.
export async function apiAllPages<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T[]> {
  type PaginatedPage = { results: T[]; next: string | null };
  const first = await apiJson<T[] | PaginatedPage>(input, init);

  if (Array.isArray(first)) {
    return first;
  }
  if (!first || !Array.isArray(first.results) || typeof first.next !== 'string') {
    return [];
  }

  const all: T[] = [...first.results];
  let nextUrl: string | null = first.next;

  while (nextUrl) {
    const page: PaginatedPage = await apiJson<PaginatedPage>(nextUrl, init);
    if (!Array.isArray(page.results)) break;
    all.push(...page.results);
    nextUrl = typeof page.next === 'string' ? page.next : null;
  }

  return all;
}

export { BASE_URL };
