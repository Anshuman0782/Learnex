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

/** A photo, video, audio clip or document sent in a message. */
export interface ChatAttachment {
  url: string;
  type: 'image' | 'video' | 'audio' | 'file';
  name?: string;
  mime?: string;
  size?: number;
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  /** Text, or the caption of an attachment (may be empty). */
  text: string;
  attachment?: ChatAttachment | null;
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

export const sendMessageRequest = (conversationId: string, text: string, attachment?: ChatAttachment) =>
  apiRequest<ChatMessage>(`/chats/${conversationId}/messages`, {
    method: 'POST',
    body: attachment ? { text, attachment } : { text },
  });

/** Inbox / notification preview: "📷 Photo", "📄 notes.pdf", or the text. */
export function messagePreview(m: Pick<ChatMessage, 'text' | 'attachment'>): string {
  const a = m.attachment;
  if (!a) return m.text;
  const label =
    a.type === 'image' ? '📷 Photo' : a.type === 'video' ? '🎥 Video' : a.type === 'audio' ? '🎤 Audio' : `📄 ${a.name || 'Document'}`;
  return m.text ? `${label} · ${m.text}` : label;
}

export const markConversationReadRequest = (conversationId: string) =>
  apiRequest<{ updated: number }>(`/chats/${conversationId}/read`, { method: 'POST' });
