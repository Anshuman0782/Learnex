import { apiRequest } from './client';

export interface AppNotification {
  id: string;
  type: 'COMMENT' | 'CRITIQUE' | 'LIKE' | 'EVENT' | 'SYSTEM' | 'FOLLOW' | 'REPOST' | 'CALL' | 'ANNOUNCEMENT';
  title: string;
  body: string;
  actorName?: string;
  actorId?: string;
  postId?: string;
  /** Where a tap should go (same shape as push data). */
  data?: Record<string, unknown>;
  read: boolean;
  timeAgo: string;
  createdAt: string;
}

export function getNotificationsRequest(): Promise<AppNotification[]> {
  return apiRequest<AppNotification[]>('/notifications');
}

export function getUnreadCountRequest(): Promise<{ count: number }> {
  return apiRequest<{ count: number }>('/notifications/unread-count');
}

export function markNotificationsReadRequest(): Promise<{ success: true }> {
  return apiRequest<{ success: true }>('/notifications/read', { method: 'POST' });
}

export function deleteNotificationRequest(id: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/notifications/${id}`, { method: 'DELETE' });
}

export function clearNotificationsRequest(): Promise<{ success: true; deleted: number }> {
  return apiRequest<{ success: true; deleted: number }>('/notifications', { method: 'DELETE' });
}
