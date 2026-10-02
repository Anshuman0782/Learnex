import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const BATCH = 100;

/** Android notification channels (created by the app; must match its ids). */
export type PushChannel = 'default' | 'messages' | 'incoming_calls';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Android channel: activity (default), chat messages, or ringing calls. */
  channel?: PushChannel;
  /** Notification category (action buttons), e.g. 'incoming_call'. */
  categoryId?: string;
  /** Seconds Expo/FCM keeps trying to deliver (calls are useless after ~30s). */
  ttl?: number;
  /** false = no sound; a string = bundled sound file (e.g. the ringtone). */
  sound?: boolean | string;
  /**
   * Silent data-only push: no banner, no sound. Wakes the app's background
   * task even when it's closed (e.g. "stop ringing, the call ended").
   */
  silent?: boolean;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Sends push notifications through Expo's free push service (which relays to
 * FCM / APNs). Best-effort: failures are logged, never thrown, so a push can't
 * break a request. Tokens Expo reports as dead are removed automatically.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(userId: string, message: PushMessage): Promise<boolean> {
    const sent = await this.sendToUsers([userId], message);
    return sent > 0;
  }

  /** Sends the same message to many users. Returns how many devices it went to. */
  async sendToUsers(userIds: string[], message: PushMessage): Promise<number> {
    if (userIds.length === 0) return 0;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null, expoPushToken: { not: null } },
      select: { id: true, expoPushToken: true },
    });
    const targets = users.filter((u) => this.isExpoToken(u.expoPushToken));
    let sent = 0;
    for (let i = 0; i < targets.length; i += BATCH) {
      const chunk = targets.slice(i, i + BATCH);
      sent += await this.sendBatch(chunk as Array<{ id: string; expoPushToken: string }>, message);
    }
    return sent;
  }

  private isExpoToken(t: string | null): t is string {
    return !!t && /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(t);
  }

  private async sendBatch(
    chunk: Array<{ id: string; expoPushToken: string }>,
    m: PushMessage,
  ): Promise<number> {
    const channelId = m.channel ?? 'default';
    const payload = chunk.map((u) =>
      m.silent
        ? {
            to: u.expoPushToken,
            data: m.data ?? {},
            priority: 'high',
            _contentAvailable: true,
            ...(m.ttl ? { ttl: m.ttl } : {}),
          }
        : {
            to: u.expoPushToken,
            title: m.title,
            body: m.body,
            data: m.data ?? {},
            sound: m.sound === false ? undefined : typeof m.sound === 'string' ? m.sound : 'default',
            priority: 'high',
            channelId,
            ...(m.categoryId ? { categoryId: m.categoryId } : {}),
            ...(m.ttl ? { ttl: m.ttl } : {}),
          },
    );
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const tickets = json?.data ?? [];
      let ok = 0;
      const dead: string[] = [];
      tickets.forEach((t, i) => {
        if (t.status === 'ok') ok++;
        else if (t.details?.error === 'DeviceNotRegistered' && chunk[i]) dead.push(chunk[i].id);
      });
      if (dead.length) {
        // The app was uninstalled / token revoked — stop sending to it.
        await this.prisma.user.updateMany({ where: { id: { in: dead } }, data: { expoPushToken: null } });
      }
      return ok;
    } catch (err) {
      this.logger.warn(`Push batch (${chunk.length}) failed: ${String(err)}`);
      return 0;
    }
  }
}
