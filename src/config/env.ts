import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolves the backend base URL.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL env var (set this for staging/production builds).
 *  2. Auto-detected dev-machine IP from the Expo/Metro host — works on a
 *     physical phone (Expo Go) and most emulators without any config.
 *  3. Platform fallback (Android emulator uses 10.0.2.2 to reach the host).
 *
 * The backend listens on port 3000 with a global /api/v1 prefix.
 */
const API_PORT = 3000;
const API_PREFIX = '/api/v1';

function resolveHost(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  // e.g. "192.168.1.5:8081" (Expo dev server host).
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${API_PORT}`;
  }

  // Fallbacks when no LAN host is available.
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = `${resolveHost()}${API_PREFIX}`;
