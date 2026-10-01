import { apiRequest } from './client';
import type { Community, Skill, UserRow } from '../types';

/** Backend community = the app's Community plus a per-user isJoined flag. */
export type ApiCommunity = Community & { isJoined: boolean };

export interface CreateCommunityBody {
  name: string;
  description: string;
  category: string;
  avatarUrl?: string;
  tags?: string[];
  memberIds?: string[];
  adminIds?: string[];
}

export interface UpdateCommunityBody {
  name?: string;
  description?: string;
  category?: string;
  avatarUrl?: string;
  postPolicy?: 'ALL' | 'ADMINS';
}

export function getCommunitiesRequest(category?: string): Promise<ApiCommunity[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiRequest<ApiCommunity[]>(`/communities${qs}`);
}

export function getRecommendedCommunitiesRequest(): Promise<ApiCommunity[]> {
  return apiRequest<ApiCommunity[]>('/communities/recommended');
}

export function getJoinedCommunitiesRequest(): Promise<ApiCommunity[]> {
  return apiRequest<ApiCommunity[]>('/communities/joined');
}

export function joinCommunityRequest(id: string): Promise<{ isJoined: boolean }> {
  return apiRequest<{ isJoined: boolean }>(`/communities/${id}/join`, { method: 'POST' });
}

export function leaveCommunityRequest(id: string): Promise<{ isJoined: boolean }> {
  return apiRequest<{ isJoined: boolean }>(`/communities/${id}/join`, { method: 'DELETE' });
}

export function createCommunityRequest(body: CreateCommunityBody): Promise<ApiCommunity> {
  return apiRequest<ApiCommunity>('/communities', { method: 'POST', body });
}

export function addCommunityMembersRequest(
  id: string,
  members: { userId: string; isAdmin?: boolean }[],
): Promise<ApiCommunity> {
  return apiRequest<ApiCommunity>(`/communities/${id}/members`, {
    method: 'POST',
    body: { members },
  });
}

export function setCommunityAdminRequest(
  id: string,
  userId: string,
  isAdmin: boolean,
): Promise<ApiCommunity> {
  return apiRequest<ApiCommunity>(`/communities/${id}/admins`, {
    method: 'POST',
    body: { userId, isAdmin },
  });
}

export function updateCommunityRequest(id: string, body: UpdateCommunityBody): Promise<ApiCommunity> {
  return apiRequest<ApiCommunity>(`/communities/${id}`, { method: 'PATCH', body });
}

export function deleteCommunityRequest(id: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/communities/${id}`, { method: 'DELETE' });
}

export function removeCommunityMemberRequest(id: string, userId: string): Promise<ApiCommunity> {
  return apiRequest<ApiCommunity>(`/communities/${id}/members/${userId}`, { method: 'DELETE' });
}

/** Search users by name (for member pickers). */
export function searchUsersRequest(q: string): Promise<UserRow[]> {
  return apiRequest<UserRow[]>(`/users/search?q=${encodeURIComponent(q)}`);
}

/** People who follow the current user. */
export function getMyFollowersRequest(): Promise<UserRow[]> {
  return apiRequest<UserRow[]>('/users/me/followers');
}

export function getSkillsRequest(category?: string): Promise<Skill[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiRequest<Skill[]>(`/skills${qs}`);
}
