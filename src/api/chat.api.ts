import { apiRequest } from './client';

export interface ChatUser {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | 'Guest' | null;
  isOnline: boolean;
  /** Calls are allowed only between mutual followers. */
  canCall?: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
  /** Client-only: optimistic message still being sent / failed to send. */
  pending?: boolean;
  failed?: boolean;
}

export interface Conversation {
  id: string;
  otherUser: ChatUser;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt: string;
}

export const getConversationsRequest = () => apiRequest<Conversation[]>('/chats');

export const getChatUnreadRequest = () => apiRequest<{ count: number }>('/chats/unread-count');

export const openConversationRequest = (userId: string) =>
  apiRequest<Conversation>(`/chats/with/${userId}`, { method: 'POST' });

export const getMessagesRequest = (conversationId: string, before?: string) =>
  apiRequest<{ messages: ChatMessage[]; hasMore: boolean }>(
    `/chats/${conversationId}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`,
  );

export const sendMessageRequest = (conversationId: string, text: string) =>
  apiRequest<ChatMessage>(`/chats/${conversationId}/messages`, { method: 'POST', body: { text } });

export const markConversationReadRequest = (conversationId: string) =>
  apiRequest<{ updated: number }>(`/chats/${conversationId}/read`, { method: 'POST' });
