import { apiRequest } from './client';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function getIceServersRequest(): Promise<{ iceServers: IceServer[] }> {
  return apiRequest<{ iceServers: IceServer[] }>('/calls/ice-servers');
}

export function registerPushTokenRequest(token: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>('/users/me/push-token', {
    method: 'POST',
    body: { token },
  });
}

/** Logout: stop sending this account's notifications to this device. */
export function unregisterPushTokenRequest(): Promise<{ success: true }> {
  return apiRequest<{ success: true }>('/users/me/push-token', { method: 'DELETE' });
}
