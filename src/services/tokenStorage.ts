import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Storage for auth tokens. The raw tokens never touch React state or logs —
 * only this module reads them.
 *
 * - iOS / Android: encrypted device keychain/keystore via expo-secure-store.
 * - Web: expo-secure-store has no browser implementation (there is no keychain),
 *   so we fall back to localStorage. That is the standard web option but is NOT
 *   encrypted — the phone apps remain the secure path.
 */
const ACCESS_KEY = 'lernex.accessToken';
const REFRESH_KEY = 'lernex.refreshToken';
const USER_KEY = 'lernex.cachedUser';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const isWeb = Platform.OS === 'web';

/** localStorage can be missing or throw (private mode, blocked site data). */
function webStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      webStorage()?.setItem(key, value);
    } catch {
      /* storage full or blocked — the session just won't persist */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return webStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      webStorage()?.removeItem(key);
    } catch {
      /* nothing to clear */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    setItem(ACCESS_KEY, tokens.accessToken),
    setItem(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_KEY);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY), deleteItem(USER_KEY)]);
}

/** Last known profile, so the app opens even while the server is waking up. */
export async function saveCachedUser(user: unknown): Promise<void> {
  try {
    await setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* best-effort */
  }
}

export async function getCachedUser<T>(): Promise<T | null> {
  try {
    const raw = await getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
