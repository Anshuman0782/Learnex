import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PushService } from '../push/push.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import type { BroadcastAudienceDto, CreateBroadcastDto } from './dto/broadcast.dto.js';

/** With nothing scheduled, re-check every 6h (no constant DB polling). */
const IDLE_CHECK_MS = 6 * 60 * 60_000;
const MAX_SCHEDULE_MS = 60 * 24 * 60 * 60_000; // 60 days
const INSERT_CHUNK = 1000;

/**
 * Admin-composed notifications ("broadcasts"). The admin picks an audience
 * (everyone, learners, mentors, a circle, or specific people), sees exactly how
 * many people that is, and sends now or schedules it. Each recipient gets it in
 * their notification list, live in the open app, and as a phone notification.
 */
@Injectable()
export class AdminBroadcastService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminBroadcastService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private nextAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit() {
    this.scheduleAt(Date.now() + 10_000); // catch anything due while we were down
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  /** Wake at `ts` (unless an earlier wake-up is already planned). */
  private scheduleAt(ts: number) {
    const now = Date.now();
    const at = Math.max(now + 1_000, Math.min(ts, now + IDLE_CHECK_MS));
    if (this.timer && this.nextAt && this.nextAt <= at) return;
    if (this.timer) clearTimeout(this.timer);
    this.nextAt = at;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.nextAt = 0;
      void this.sweep();
    }, at - now);
    this.timer.unref?.();
  }

  /** Resolves an audience to concrete, active user ids. */
  private async recipients(a: BroadcastAudienceDto): Promise<string[]> {
    const base: Prisma.UserWhereInput = { deletedAt: null };
    let where: Prisma.UserWhereInput = base;
    if (a.audience === 'LEARNERS') where = { ...base, OR: [{ role: UserRole.LEARNER }, { skills: { some: { role: UserRole.LEARNER } } }] };
    else if (a.audience === 'MENTORS') where = { ...base, OR: [{ role: UserRole.MENTOR }, { skills: { some: { role: UserRole.MENTOR } } }] };
    else if (a.audience === 'CIRCLE') {
      if (!a.communityId) throw new BadRequestException('Choose a circle');
      where = { ...base, memberships: { some: { communityId: a.communityId } } };
    } else if (a.audience === 'USERS') {
      const ids = Array.from(new Set(a.userIds ?? []));
      if (ids.length === 0) throw new BadRequestException('Choose at least one person');
      where = { ...base, id: { in: ids } };
    }
    const rows = await this.prisma.user.findMany({ where, select: { id: true } });
    return rows.map((r) => r.id);
  }

  /** How many people an audience reaches, and how many have phone notifications on. */
  async preview(a: BroadcastAudienceDto) {
    const ids = await this.recipients(a);
    const withPush = ids.length
      ? await this.prisma.user.count({ where: { id: { in: ids }, expoPushToken: { not: null } } })
      : 0;
    return { count: ids.length, withPush };
  }

  private view(b: {
    id: string;
    title: string;
    body: string;
    audience: string;
    communityId: string | null;
    userIds: Prisma.JsonValue | null;
    scheduledAt: Date | null;
    status: string;
    recipients: number;
    pushed: number;
    createdAt: Date;
    sentAt: Date | null;
  }, circleNames: Map<string, string>) {
    return {
      id: b.id,
      title: b.title,
      body: b.body,
      audience: b.audience,
      communityId: b.communityId ?? undefined,
      communityName: b.communityId ? circleNames.get(b.communityId) : undefined,
      userCount: Array.isArray(b.userIds) ? b.userIds.length : undefined,
      scheduledAt: b.scheduledAt?.toISOString(),
      status: b.status,
      recipients: b.recipients,
      pushed: b.pushed,
      createdAt: b.createdAt.toISOString(),
      sentAt: b.sentAt?.toISOString(),
    };
  }

  async list() {
    const rows = await this.prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    const circleIds = Array.from(new Set(rows.map((r) => r.communityId).filter((x): x is string => !!x)));
    const circles = circleIds.length
      ? await this.prisma.community.findMany({ where: { id: { in: circleIds } }, select: { id: true, name: true } })
      : [];
    const names = new Map(circles.map((c) => [c.id, c.name]));
    return rows.map((r) => this.view(r, names));
  }

  async create(adminId: string, dto: CreateBroadcastDto) {
    let scheduledAt: Date | null = null;
    if (dto.scheduledAt) {
      scheduledAt = new Date(dto.scheduledAt);
      const delta = scheduledAt.getTime() - Date.now();
      if (delta < -60_000) throw new BadRequestException('Scheduled time is in the past');
      if (delta > MAX_SCHEDULE_MS) throw new BadRequestException('You can schedule up to 60 days ahead');
      if (delta < 30_000) scheduledAt = null; // "in a moment" = now
    }
    if (dto.audience === 'CIRCLE') {
      const c = await this.prisma.community.findUnique({ where: { id: dto.communityId! }, select: { id: true } });
      if (!c) throw new NotFoundException('Circle not found');
    }
    const count = (await this.recipients(dto)).length;
    if (count === 0) throw new BadRequestException('This audience has no members');

    const b = await this.prisma.broadcast.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: dto.audience,
        communityId: dto.audience === 'CIRCLE' ? dto.communityId : null,
        userIds: dto.audience === 'USERS' ? Array.from(new Set(dto.userIds)) : undefined,
        scheduledAt,
        createdById: adminId,
      },
    });
    if (!scheduledAt) await this.deliver(b.id);
    else this.scheduleAt(scheduledAt.getTime());
    return (await this.list()).find((x) => x.id === b.id);
  }

  async cancel(id: string) {
    const res = await this.prisma.broadcast.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (res.count === 0) throw new BadRequestException('Only scheduled (not yet sent) notifications can be cancelled');
    return { success: true };
  }

  /** Sends scheduled broadcasts whose time has come. */
  private async sweep() {
    try {
      const due = await this.prisma.broadcast.findMany({
        where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
        select: { id: true },
        take: 10,
      });
      for (const d of due) await this.deliver(d.id);
      const next = await this.prisma.broadcast.findFirst({
        where: { status: 'PENDING', scheduledAt: { not: null } },
        orderBy: { scheduledAt: 'asc' },
        select: { scheduledAt: true },
      });
      this.scheduleAt(next?.scheduledAt ? next.scheduledAt.getTime() : Date.now() + IDLE_CHECK_MS);
    } catch (err) {
      this.logger.warn(`Broadcast sweep failed: ${String(err)}`);
      this.scheduleAt(Date.now() + 5 * 60_000);
    }
  }

  private async deliver(id: string) {
    // Claim it atomically so it can never be sent twice.
    const claimed = await this.prisma.broadcast.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'SENDING' },
    });
    if (claimed.count === 0) return;
    const b = await this.prisma.broadcast.findUniqueOrThrow({ where: { id } });
    try {
      const ids = await this.recipients({
        audience: b.audience as BroadcastAudienceDto['audience'],
        communityId: b.communityId ?? undefined,
        userIds: Array.isArray(b.userIds) ? (b.userIds as string[]) : undefined,
      });
      const data = { kind: 'announcement', broadcastId: b.id };
      for (let i = 0; i < ids.length; i += INSERT_CHUNK) {
        await this.prisma.notification.createMany({
          data: ids.slice(i, i + INSERT_CHUNK).map((userId) => ({
            userId,
            type: 'ANNOUNCEMENT' as const,
            title: b.title,
            body: b.body,
            actorName: 'LERNEX',
            data,
          })),
        });
      }
      // Open apps refresh their bell; everyone else gets a phone notification.
      ids.forEach((uid) => {
        if (this.realtime.isOnline(uid)) this.realtime.emitToUser(uid, 'notifications:refresh', { reason: 'announcement' });
      });
      const pushed = await this.push.sendToUsers(
        ids.filter((uid) => !this.realtime.isActive(uid)),
        { title: b.title, body: b.body, data },
      );
      await this.prisma.broadcast.update({
        where: { id },
        data: { status: 'SENT', recipients: ids.length, pushed, sentAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Broadcast ${id} failed: ${String(err)}`);
      await this.prisma.broadcast.update({ where: { id }, data: { status: 'FAILED' } });
    }
  }
}
