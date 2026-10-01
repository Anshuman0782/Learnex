import { apiRequest } from './client';
import type { CommunityPost } from '../types';

/** The backend returns posts already in the app's CommunityPost shape. */
export type ApiPost = CommunityPost;

export interface CreatePostBody {
  content: string;
  postType: 'text' | 'video' | 'audio' | 'image' | 'critique_request';
  communityIds?: string[];
  title?: string;
  tags?: string[];
  tag?: string;
  isPrivate?: boolean;
  focusArea?: string;
  bgStyle?: string;
  videoUrl?: string;
  videoThumbnail?: string;
  videoDuration?: string;
  audioUrl?: string;
  imageUrls?: string[];
  isShort?: boolean;
  scheduledAt?: string;
}

export interface AddCommentBody {
  text: string;
  isMentorCritique?: boolean;
  commentType?: 'general' | 'mentor';
  mentorRating?: number;
  critiqueFocus?: string;
  videoCritiqueThumbnail?: string;
  videoCritiqueDuration?: string;
  videoCritiqueTitle?: string;
}

export function getFeedRequest(params?: {
  communityId?: string;
  saved?: boolean;
  authorId?: string;
  shorts?: boolean;
  reposted?: boolean;
}): Promise<ApiPost[]> {
  const qs = new URLSearchParams();
  if (params?.communityId) qs.set('communityId', params.communityId);
  if (params?.saved) qs.set('saved', 'true');
  if (params?.authorId) qs.set('authorId', params.authorId);
  if (params?.shorts) qs.set('shorts', 'true');
  if (params?.reposted) qs.set('reposted', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<ApiPost[]>(`/posts${suffix}`);
}

/** The Reels feed: vertical clips (video or audio) under 60 seconds. */
/** One post by id (respects visibility on the server). */
export function getPostRequest(id: string): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/posts/${id}`);
}

export function getReelsRequest(): Promise<ApiPost[]> {
  return getFeedRequest({ shorts: true });
}

export function createPostRequest(body: CreatePostBody): Promise<ApiPost> {
  return apiRequest<ApiPost>('/posts', { method: 'POST', body });
}

/** Record a unique view for this post (called after a few seconds of playback). */
export function recordPostViewRequest(id: string): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/posts/${id}/view`, { method: 'POST' });
}

export function deletePostRequest(id: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/posts/${id}`, { method: 'DELETE' });
}

export function updatePostRequest(
  id: string,
  body: { isPrivate?: boolean; title?: string; content?: string },
): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/posts/${id}`, { method: 'PATCH', body });
}

export function setPostLikeRequest(id: string, liked: boolean): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/posts/${id}/like`, { method: liked ? 'POST' : 'DELETE' });
}

export function setPostSaveRequest(id: string, saved: boolean): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/posts/${id}/save`, { method: saved ? 'POST' : 'DELETE' });
}

export function setPostRepostRequest(
  id: string,
  reposted: boolean,
  body?: { caption?: string; communityId?: string },
): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/posts/${id}/repost`, {
    method: reposted ? 'POST' : 'DELETE',
    body: reposted ? body ?? {} : undefined,
  });
}

export function addCommentRequest(id: string, body: AddCommentBody): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/posts/${id}/comments`, { method: 'POST', body });
}

export function setCommentLikeRequest(commentId: string, liked: boolean): Promise<ApiPost> {
  return apiRequest<ApiPost>(`/comments/${commentId}/like`, {
    method: liked ? 'POST' : 'DELETE',
  });
}
