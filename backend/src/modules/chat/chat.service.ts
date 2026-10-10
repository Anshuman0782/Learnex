import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from '../push/push.service.js';

const PAGE_SIZE = 30;

const roleLabel = (r: UserRole | null) =>
  r === UserRole.MENTOR ? 'Mentor' : r === UserRole.LEARNER ? 'Learner' : r === UserRole.GUEST ? 'Guest' : null;

export interface ChatUser {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | 'Guest' | null;
  isOnline: boolean;
  /** Voice/video calls are allowed only between mutual followers. */
  canCall: boolean;
}

export interface ChatMessageView {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  readAt: string | null;
}

export interface ConversationView {
  id: string;
  otherUser: ChatUser;
  lastMessage: ChatMessageView | null;
  unreadCount: number;
  lastMessageAt: string;
}

const toMessage = (m: {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: Date;
  readAt: Date | null;
}): ChatMessageView => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  text: m.text,
  createdAt: m.createdAt.toISOString(),
  readAt: m.readAt?.toISOString() ?? null,
});

/**
 * Private 1:1 messaging. Only the two participants can read or write a
 * conversation. New messages and read receipts are pushed live to both users'
 * sockets (`user:<id>` rooms) so every open device updates instantly.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  /** Of `others`, the ids that follow `userId` AND are followed back. */
  private async mutualSet(userId: string, others: string[]): Promise<Set<string>> {
    if (others.length === 0) return new Set();
    const rows = await this.prisma.follow.findMany({
      where: {
        OR: [
          { followerId: userId, followingId: { in: others } },
          { followingId: userId, followerId: { in: others } },
        ],
      },
      select: { followerId: true, followingId: true },
    });
    const iFollow = new Set(rows.filter((r) => r.followerId === userId).map((r) => r.followingId));
    const followsMe = new Set(rows.filter((r) => r.followingId === userId).map((r) => r.followerId));
    return new Set(others.filter((id) => iFollow.has(id) && followsMe.has(id)));
  }

  private sortedPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private async toUser(viewerId: string, id: string): Promise<ChatUser> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, avatarUrl: true, role: true },
    });
    return {
      id,
      name: u?.name ?? 'Deleted user',
      avatarUrl: u?.avatarUrl ?? '',
      role: roleLabel(u?.role ?? null),
      isOnline: this.realtime.isOnline(id),
      canCall: (await this.mutualSet(viewerId, [id])).has(id),
    };
  }

  /** Loads a conversation and verifies the viewer is one of its two members. */
  private async membership(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userAId !== userId && conv.userBId !== userId) {
      throw new ForbiddenException('You are not part of this conversation');
    }
    const otherId = conv.userAId === userId ? conv.userBId : conv.userAId;
    return { conv, otherId };
  }

  /** The viewer's conversations, most recent first, with unread counts. */
  async list(userId: string): Promise<ConversationView[]> {
    const convs = await this.prisma.conversation.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        messages: { some: {} }, // hide empty threads that were opened but never used
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        userA: { select: { id: true, name: true, avatarUrl: true, role: true, deletedAt: true } },
        userB: { select: { id: true, name: true, avatarUrl: true, role: true, deletedAt: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (convs.length === 0) return [];

    const unread = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: convs.map((c) => c.id) },
        senderId: { not: userId },
        readAt: null,
      },
      _count: { _all: true },
    });
    const unreadMap = new Map(unread.map((u) => [u.conversationId, u._count._all]));
    const mutual = await this.mutualSet(
      userId,
      convs.map((c) => (c.userAId === userId ? c.userBId : c.userAId)),
    );

    return convs.map((c) => {
      const other = c.userAId === userId ? c.userB : c.userA;
      return {
        id: c.id,
        otherUser: {
          id: other.id,
          name: other.deletedAt ? 'Deleted user' : other.name,
          avatarUrl: other.avatarUrl ?? '',
          role: roleLabel(other.role),
          isOnline: this.realtime.isOnline(other.id),
          canCall: !other.deletedAt && mutual.has(other.id),
        },
        lastMessage: c.messages[0] ? toMessage(c.messages[0]) : null,
        unreadCount: unreadMap.get(c.id) ?? 0,
        lastMessageAt: c.lastMessageAt.toISOString(),
      };
    });
  }

  /** Total unread messages across all conversations (for the app badge). */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.message.count({
      where: {
        senderId: { not: userId },
        readAt: null,
        conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
      },
    });
    return { count };
  }

  /** Get (or create) the single conversation between the viewer and another user. */
  async openWith(userId: string, otherId: string): Promise<ConversationView> {
    if (userId === otherId) throw new BadRequestException('You can’t message yourself');
    const other = await this.prisma.user.findFirst({
      where: { id: otherId, deletedAt: null },
      select: { id: true },
    });
    if (!other) throw new NotFoundException('User not found');

    const [userAId, userBId] = this.sortedPair(userId, otherId);
    const conv = await this.prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    const unreadCount = await this.prisma.message.count({
      where: { conversationId: conv.id, senderId: { not: userId }, readAt: null },
    });

    return {
      id: conv.id,
      otherUser: await this.toUser(userId, otherId),
      lastMessage: conv.messages[0] ? toMessage(conv.messages[0]) : null,
      unreadCount,
      lastMessageAt: conv.lastMessageAt.toISOString(),
    };
  }

  /** A page of messages, newest first. Pass `before` (ISO time) for older pages. */
  async messages(
    userId: string,
    conversationId: string,
    before?: string,
  ): Promise<{ messages: ChatMessageView[]; hasMore: boolean }> {
    await this.membership(userId, conversationId);
    const beforeDate = before ? new Date(before) : undefined;
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(beforeDate && !Number.isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE + 1,
    });
    return {
      messages: rows.slice(0, PAGE_SIZE).map(toMessage),
      hasMore: rows.length > PAGE_SIZE,
    };
  }

  async send(userId: string, conversationId: string, rawText: string): Promise<ChatMessageView> {
    const text = rawText.trim();
    if (!text) throw new BadRequestException('Message is empty');
    const { otherId } = await this.membership(userId, conversationId);

    const otherAlive = await this.prisma.user.findFirst({
      where: { id: otherId, deletedAt: null },
      select: { id: true },
    });
    if (!otherAlive) throw new BadRequestException('This account is no longer available');

    const msg = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderId: userId, text },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      return created;
    });

    const view = toMessage(msg);
    // Deliver to the recipient and to the sender's other devices.
    this.realtime.emitToUser(otherId, 'chat:message', view);
    this.realtime.emitToUser(userId, 'chat:message', view);

    // Phone notification when the recipient doesn't have the app open.
    if (!this.realtime.isActive(otherId)) {
      const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } });
      void this.push.sendToUser(otherId, {
        title: me?.name ?? 'New message',
        body: text.length > 140 ? `${text.slice(0, 137)}…` : text,
        channel: 'messages',
        categoryId: 'chat_message', // inline "Reply" button
        data: { kind: 'chat', conversationId, userId, fromName: me?.name, fromAvatar: me?.avatarUrl ?? undefined },
      });
    }
    return view;
  }

  /** Mark everything the other person sent in this conversation as read. */
  async markRead(userId: string, conversationId: string): Promise<{ updated: number }> {
    const { otherId } = await this.membership(userId, conversationId);
    const readAt = new Date();
    const res = await this.prisma.message.updateMany({
      where: { conversationId, senderId: otherId, readAt: null },
      data: { readAt },
    });
    if (res.count > 0) {
      const payload = { conversationId, readerId: userId, readAt: readAt.toISOString() };
      this.realtime.emitToUser(otherId, 'chat:read', payload); // sender sees "Seen"
      this.realtime.emitToUser(userId, 'chat:read', payload); // my other devices clear badges
    }
    return { updated: res.count };
  }
}
