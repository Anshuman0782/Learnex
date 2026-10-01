import { apiRequest } from './client';
import type { ApiUser } from './auth.api';

export interface UpdateProfileBody {
  avatarUrl?: string;
  name?: string;
  bio?: string;
  handle?: string;
}

export function updateProfileRequest(body: UpdateProfileBody): Promise<ApiUser> {
  return apiRequest<ApiUser>('/users/me', { method: 'PATCH', body });
}
