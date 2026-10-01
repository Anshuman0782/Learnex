import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from '../push/push.service.js';
import { timeAgo } from '../../common/utils/time-ago.js';

interface CreateNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actorName?: string;
  actorId?: string;
  postId?: string;
  /** Where a tap should take the user (e.g. { kind: 'profile', userId }). */
  data?: Record<string, unknown>;
  /** If set, the user gets at most ONE notification for this key, ever. */
  dedupeKey?: string;
}

type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actorName: string | null;
  actorId: string | null;
  postId: string | null;
  data: Prisma.JsonValue | null;
  read: boolean;
  createdAt: Date;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  serialize(n: NotificationRow) {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      actorName: n.actorName ?? undefined,
      actorId: n.actorId ?? undefined,
      postId: n.postId ?? undefined,
      data: (n.data as Record<string, unknown> | null) ?? undefined,
      read: n.read,
      timeAgo: timeAgo(n.createdAt),
      createdAt: n.createdAt.toISOString(),
    };
  }

  /**
   * Persist a notification, deliver it live to the open app, and — if the app
   * isn't open in the foreground — send a phone (push) notification.
   */
  async create(input: CreateNotification): Promise<void> {
    if (input.actorId && input.actorId === input.userId) return; // never notify yourself

    let notification: NotificationRow;
    try {
      notification = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          actorName: input.actorName,
          actorId: input.actorId,
          postId: input.postId,
          data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (err) {
      // Same dedupe key already notified (e.g. like → unlike → like) — stay quiet.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
    this.realtime.emitToUser(input.userId, 'notification', this.serialize(notification));

    if (!this.realtime.isActive(input.userId)) {
      await this.push.sendToUser(input.userId, {
        title: input.title,
        body: input.body,
        data: {
          ...(input.data ?? {}),
          type: input.type,
          postId: input.postId,
          actorId: input.actorId,
          actorName: input.actorName,
          notificationId: notification.id,
        },
      });
    }
  }

  async list(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((n) => this.serialize(n));
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }

  async markAllRead(userId: string): Promise<{ success: true }> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true };
  }
}
