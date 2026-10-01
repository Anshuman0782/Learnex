import { apiRequest } from './client';

/** User shape the backend returns (never includes secrets). */
export interface ApiUser {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  role: 'LEARNER' | 'MENTOR' | null;
  dob: string | null;
  hobby: string | null;
  avatarUrl: string | null;
  /** Has Admin Panel access (verified again by the server on every admin call). */
  isAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: ApiUser;
  tokens: AuthTokensResponse;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  dob?: string;
  hobby?: string;
}

export function registerRequest(payload: RegisterPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function loginRequest(identifier: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password },
    auth: false,
  });
}

export function logoutRequest(): Promise<{ success: true }> {
  return apiRequest<{ success: true }>('/auth/logout', { method: 'POST' });
}

export function meRequest(): Promise<ApiUser> {
  return apiRequest<ApiUser>('/auth/me');
}
