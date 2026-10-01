import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PushService } from '../push/push.service.js';
import { timeAgo } from '../../common/utils/time-ago.js';
import type { JwtPayload } from '../auth/types/authenticated-user.type.js';

interface SocketData {
  userId: string;
  name: string;
  avatarUrl: string;
}

type CallType = 'voice' | 'video';

/** A 1:1 call the server is brokering (media itself is peer-to-peer WebRTC). */
interface CallSession {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  calleeId: string;
  callType: CallType;
  state: 'ringing' | 'active';
  startedAt: number;
  timer?: ReturnType<typeof setTimeout>;
}

/** How long a call rings before it's a missed call. */
const RING_MS = 40_000;
/** Safety net: forget calls that somehow never got an "end". */
const MAX_CALL_MS = 3 * 60 * 60_000;
/** Minimum gap between call invites from one user (anti-spam). */
const INVITE_GAP_MS = 3_000;
/** Max size of one relayed WebRTC signal (SDP / ICE). */
const MAX_SIGNAL_CHARS = 20_000;
const CALL_ID_RE = /^call-[A-Za-z0-9_-]{6,64}$/;

/**
 * Self-hosted, free real-time layer (Socket.IO): live updates, presence,
 * foreground/background state (decides when to send push), and a SECURE 1:1
 * call broker — only mutual followers can call, only the two participants of a
 * call can exchange signals, calls ring for 40s and then become missed calls.
 *
 * Message handlers are attached directly on the socket in handleConnection
 * (reliable across the NestJS/ESM build) rather than via @SubscribeMessage.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  // userId -> number of open sockets (presence).
  private readonly online = new Map<string, number>();
  // userId -> ids of sockets whose app is in the FOREGROUND.
  private readonly foreground = new Map<string, Set<string>>();

  private readonly calls = new Map<string, CallSession>();
  private readonly userCall = new Map<string, string>();
  private readonly lastInvite = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      client.disconnect(true);
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, name: true, avatarUrl: true },
    });
    if (!user) {
      client.disconnect(true);
      return;
    }

    const data: SocketData = { userId: user.id, name: user.name, avatarUrl: user.avatarUrl ?? '' };
    client.data = data;
    client.join(`user:${user.id}`);
    this.online.set(user.id, (this.online.get(user.id) ?? 0) + 1);
    // A freshly connected app is open; it reports when it goes to background.
    this.setForeground(user.id, client.id, true);

    this.registerHandlers(client, data);

    // Opened from an incoming-call push? Re-deliver the ring to this device.
    for (const c of this.calls.values()) {
      if (c.calleeId === user.id && c.state === 'ringing') {
        client.emit('call:incoming', this.incomingPayload(c));
      }
    }
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as SocketData | undefined;
    if (!data?.userId) return;
    this.setForeground(data.userId, client.id, false);
    const count = (this.online.get(data.userId) ?? 1) - 1;
    if (count <= 0) this.online.delete(data.userId);
    else this.online.set(data.userId, count);

    // A caller who vanished while still ringing → the call is cancelled.
    if (count <= 0) {
      const callId = this.userCall.get(data.userId);
      const c = callId ? this.calls.get(callId) : undefined;
      if (c && c.state === 'ringing' && c.callerId === data.userId) {
        this.emitToUser(c.calleeId, 'call:cancelled', { callId: c.callId });
        void this.missedCall(c);
        this.finishCall(c);
      }
    }
  }

  private setForeground(userId: string, socketId: string, active: boolean) {
    let set = this.foreground.get(userId);
    if (active) {
      if (!set) this.foreground.set(userId, (set = new Set()));
      set.add(socketId);
    } else if (set) {
      set.delete(socketId);
      if (set.size === 0) this.foreground.delete(userId);
    }
  }

  /** Attach all inbound message listeners for a connected, authenticated socket. */
  private registerHandlers(client: Socket, self: SocketData): void {
    client.on('post:subscribe', (body: { postId?: string }) => {
      if (typeof body?.postId === 'string') client.join(`post:${body.postId}`);
    });
    client.on('post:unsubscribe', (body: { postId?: string }) => {
      if (typeof body?.postId === 'string') client.leave(`post:${body.postId}`);
    });

    // The app tells us when it goes to the background / comes back, so we know
    // to send a phone notification instead of relying on the open app.
    client.on('app:state', (body: { active?: boolean }) => {
      this.setForeground(self.userId, client.id, body?.active !== false);
    });

    // ---- Calls ----
    client.on(
      'call:invite',
      (body: { toUserId?: string; callId?: string; callType?: string }, ack?: (r: unknown) => void) => {
        void this.onInvite(self, body, ack);
      },
    );

    client.on('call:accept', (body: { callId?: string }) => {
      const c = this.participantCall(self.userId, body?.callId);
      if (!c || c.calleeId !== self.userId || c.state !== 'ringing') return;
      if (c.timer) clearTimeout(c.timer);
      c.state = 'active';
      c.startedAt = Date.now();
      c.timer = setTimeout(() => this.finishCall(c), MAX_CALL_MS);
      this.emitToUser(c.callerId, 'call:accepted', { callId: c.callId });
      // Stop it ringing on the callee's other devices.
      client.to(`user:${self.userId}`).emit('call:handled', { callId: c.callId });
    });

    client.on('call:reject', (body: { callId?: string }) => {
      const c = this.participantCall(self.userId, body?.callId);
      if (!c || c.calleeId !== self.userId || c.state !== 'ringing') return;
      this.emitToUser(c.callerId, 'call:rejected', { callId: c.callId });
      client.to(`user:${self.userId}`).emit('call:handled', { callId: c.callId });
      this.finishCall(c);
    });

    client.on('call:end', (body: { callId?: string }) => {
      const c = this.participantCall(self.userId, body?.callId);
      if (!c) return;
      const otherId = c.callerId === self.userId ? c.calleeId : c.callerId;
      if (c.state === 'ringing' && c.callerId === self.userId) {
        // Caller hung up before an answer → missed call for the callee.
        this.emitToUser(otherId, 'call:cancelled', { callId: c.callId });
        void this.missedCall(c);
      } else {
        this.emitToUser(otherId, 'call:ended', { callId: c.callId });
      }
      this.finishCall(c);
    });

    client.on('call:signal', (body: { callId?: string; data?: unknown }) => {
      const c = this.participantCall(self.userId, body?.callId);
      if (!c || c.state !== 'active' || body.data == null) return;
      let size = 0;
      try {
        size = JSON.stringify(body.data).length;
      } catch {
        return;
      }
      if (size > MAX_SIGNAL_CHARS) return;
      const otherId = c.callerId === self.userId ? c.calleeId : c.callerId;
      this.emitToUser(otherId, 'call:signal', { callId: c.callId, data: body.data });
    });
  }

  private async onInvite(
    self: SocketData,
    body: { toUserId?: string; callId?: string; callType?: string },
    ack?: (r: unknown) => void,
  ) {
    const reply = (r: { ok: boolean; reason?: string; calleeOnline?: boolean }) => {
      try {
        ack?.(r);
      } catch {
        /* ignore */
      }
    };
    const toUserId = body?.toUserId;
    const callId = body?.callId;
    const callType = body?.callType;
    if (
      typeof toUserId !== 'string' ||
      typeof callId !== 'string' ||
      !CALL_ID_RE.test(callId) ||
      (callType !== 'voice' && callType !== 'video') ||
      toUserId === self.userId ||
      this.calls.has(callId)
    ) {
      return reply({ ok: false, reason: 'invalid' });
    }
    const now = Date.now();
    if (now - (this.lastInvite.get(self.userId) ?? 0) < INVITE_GAP_MS) {
      return reply({ ok: false, reason: 'slow_down' });
    }
    this.lastInvite.set(self.userId, now);
    if (this.userCall.has(self.userId)) return reply({ ok: false, reason: 'busy_self' });

    const callee = await this.prisma.user.findFirst({
      where: { id: toUserId, deletedAt: null },
      select: { id: true },
    });
    if (!callee) return reply({ ok: false, reason: 'unavailable' });
    if (!(await this.areMutualFollowers(self.userId, toUserId))) {
      return reply({ ok: false, reason: 'not_mutual' });
    }
    if (this.userCall.has(toUserId)) return reply({ ok: false, reason: 'busy' });

    const c: CallSession = {
      callId,
      callerId: self.userId,
      callerName: self.name,
      callerAvatar: self.avatarUrl,
      calleeId: toUserId,
      callType,
      state: 'ringing',
      startedAt: now,
    };
    this.calls.set(callId, c);
    this.userCall.set(c.callerId, callId);
    this.userCall.set(c.calleeId, callId);
    c.timer = setTimeout(() => {
      if (this.calls.get(callId)?.state !== 'ringing') return;
      this.emitToUser(c.callerId, 'call:unanswered', { callId });
      this.emitToUser(c.calleeId, 'call:cancelled', { callId });
      void this.missedCall(c);
      this.finishCall(c);
    }, RING_MS);

    this.emitToUser(toUserId, 'call:incoming', this.incomingPayload(c));
    // App closed or in the background → ring the phone with a call notification.
    if (!this.isActive(toUserId)) {
      void this.push.sendToUser(toUserId, {
        title: `Incoming ${callType} call`,
        body: `${self.name} is calling you…`,
        channel: 'calls',
        categoryId: 'incoming_call',
        ttl: 30,
        data: { kind: 'call', callId, callType, fromUserId: self.userId, fromName: self.name },
      });
    }
    reply({ ok: true, calleeOnline: this.isOnline(toUserId) });
  }

  private incomingPayload(c: CallSession) {
    return {
      callId: c.callId,
      callType: c.callType,
      fromUserId: c.callerId,
      fromName: c.callerName,
      fromAvatar: c.callerAvatar,
    };
  }

  /** The call `callId` if (and only if) `userId` is one of its two participants. */
  private participantCall(userId: string, callId?: string): CallSession | undefined {
    if (typeof callId !== 'string') return undefined;
    const c = this.calls.get(callId);
    if (!c || (c.callerId !== userId && c.calleeId !== userId)) return undefined;
    return c;
  }

  private finishCall(c: CallSession) {
    if (c.timer) clearTimeout(c.timer);
    this.calls.delete(c.callId);
    if (this.userCall.get(c.callerId) === c.callId) this.userCall.delete(c.callerId);
    if (this.userCall.get(c.calleeId) === c.callId) this.userCall.delete(c.calleeId);
  }

  /** Calls are only allowed between people who follow each other. */
  async areMutualFollowers(a: string, b: string): Promise<boolean> {
    const n = await this.prisma.follow.count({
      where: {
        OR: [
          { followerId: a, followingId: b },
          { followerId: b, followingId: a },
        ],
      },
    });
    return n >= 2;
  }

  /** Stores a "missed call" notification for the callee and alerts them. */
  private async missedCall(c: CallSession) {
    try {
      const n = await this.prisma.notification.create({
        data: {
          userId: c.calleeId,
          type: 'CALL',
          title: `Missed ${c.callType} call 📞`,
          body: `${c.callerName} tried to call you`,
          actorName: c.callerName,
          actorId: c.callerId,
          data: { kind: 'missed_call', userId: c.callerId },
        },
      });
      this.emitToUser(c.calleeId, 'notification', {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        actorName: n.actorName ?? undefined,
        actorId: n.actorId ?? undefined,
        data: n.data ?? undefined,
        read: n.read,
        timeAgo: timeAgo(n.createdAt),
        createdAt: n.createdAt.toISOString(),
      });
      if (!this.isActive(c.calleeId)) {
        await this.push.sendToUser(c.calleeId, {
          title: n.title,
          body: n.body,
          data: { kind: 'missed_call', userId: c.callerId, notificationId: n.id },
        });
      }
    } catch (err) {
      this.logger.warn(`Missed-call notification failed: ${String(err)}`);
    }
  }

  // --- presence + emit helpers (used by feature services) ---

  /** Has at least one connected socket. */
  isOnline(userId: string): boolean {
    return this.online.has(userId);
  }

  /** Has the app OPEN in the foreground right now (no phone notification needed). */
  isActive(userId: string): boolean {
    return (this.foreground.get(userId)?.size ?? 0) > 0;
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToPost(postId: string, event: string, payload: unknown): void {
    this.server?.to(`post:${postId}`).emit(event, payload);
  }

  /** Broadcast to every connected client (e.g. admin changed XP rules/rewards). */
  emitToAll(event: string, payload: unknown): void {
    this.server?.emit(event, payload);
  }
}
