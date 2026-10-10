import { apiRequest } from './client';
import type { ApiPost } from './posts.api';

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | 'Guest' | null;
  hobby: string | null;
  bio: string | null;
  handle: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isSelf: boolean;
}

export function getUserProfileRequest(id: string): Promise<PublicProfile> {
  return apiRequest<PublicProfile>(`/users/${id}`);
}

export function followUserRequest(id: string): Promise<{ isFollowing: boolean; followersCount: number }> {
  return apiRequest(`/users/${id}/follow`, { method: 'POST' });
}

export function unfollowUserRequest(id: string): Promise<{ isFollowing: boolean; followersCount: number }> {
  return apiRequest(`/users/${id}/follow`, { method: 'DELETE' });
}

export interface FollowUserRow {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | 'Guest' | null;
  isFollowing?: boolean;
  isSelf?: boolean;
}

/** Search users by name (people search / member pickers). */
export function searchUsersRequest(q: string): Promise<FollowUserRow[]> {
  return apiRequest<FollowUserRow[]>(`/users/search?q=${encodeURIComponent(q)}`);
}

/** Followers of a user (decorated with the viewer's follow status). */
export function getFollowersOfRequest(id: string): Promise<FollowUserRow[]> {
  return apiRequest<FollowUserRow[]>(`/users/${id}/followers`);
}

/** Who a user is following. */
export function getFollowingOfRequest(id: string): Promise<FollowUserRow[]> {
  return apiRequest<FollowUserRow[]>(`/users/${id}/following`);
}

export interface ReportBody {
  targetType: 'POST' | 'COMMENT' | 'USER';
  postId?: string;
  commentId?: string;
  reportedUserId?: string;
  reason: string;
}

export function reportRequest(body: ReportBody): Promise<{ success: true }> {
  return apiRequest('/reports', { method: 'POST', body });
}

export function deleteCommentRequest(commentId: string): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/comments/${commentId}`, { method: 'DELETE' });
}

export function editCommentRequest(commentId: string, text: string): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/comments/${commentId}`, { method: 'PATCH', body: { text } });
}

// --- password reset ---
export function forgotPasswordRequest(identifier: string): Promise<{ sent: boolean; devCode?: string }> {
  return apiRequest('/auth/forgot-password', { method: 'POST', body: { identifier }, auth: false });
}

export function resetPasswordRequest(
  identifier: string,
  code: string,
  password: string,
): Promise<{ success: true }> {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: { identifier, code, password },
    auth: false,
  });
}
