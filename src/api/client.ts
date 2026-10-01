import { API_BASE_URL } from '../config/env';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../services/tokenStorage';

/**
 * Thrown for any non-2xx response. `status` lets callers branch on 401/409/etc,
 * and `message` is the backend's human-readable reason.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Called when the session can't be recovered (refresh failed) — AppContext
// registers this to force a logout / return to the Login screen.
let onAuthFailure: (() => void) | null = null;
export function setOnAuthFailure(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // attach the access token (default true)
  token?: string; // override the token (used for the refresh call)
}

async function parseError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.message) {
      message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  } catch {
    // non-JSON body — keep the default message
  }
  throw new ApiError(res.status, message);
}

// --- refresh coordination (single-flight so parallel 401s share one refresh) ---
let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
        await saveTokens(data.tokens);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * Refreshes the session (single-flight). Used by non-fetch uploads
 * (expo-file-system) that can't go through apiRequest's 401 retry.
 */
export function refreshSession(): Promise<boolean> {
  return tryRefresh();
}

async function doFetch(path: string, options: RequestOptions, token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;

  // For multipart, let fetch set the Content-Type (with boundary) itself.
  if (options.body !== undefined && !isForm) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const body =
    options.body === undefined
      ? undefined
      : isForm
      ? (options.body as FormData)
      : JSON.stringify(options.body);

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });
}

/**
 * The single entry point for all backend calls.
 * Attaches the access token, and on a 401 transparently refreshes once and retries.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  let token = options.token ?? (useAuth ? await getAccessToken() : undefined) ?? undefined;

  let res = await doFetch(path, options, token);

  // Access token likely expired — try a one-time refresh + retry.
  if (res.status === 401 && useAuth && !options.token) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      token = (await getAccessToken()) ?? undefined;
      res = await doFetch(path, options, token);
    } else {
      await clearTokens();
      onAuthFailure?.();
    }
  }

  if (!res.ok) {
    await parseError(res);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
