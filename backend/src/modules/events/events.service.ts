import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CommunityEvent, EventParticipation, PostType, Prisma, XpSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { XpService } from '../gamification/xp.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { utcDay } from '../gamification/leveling.js';
import { resolveContext, SKILL_OWNER_SELECT } from '../../common/utils/skill.js';
import { CreateEventDto, TrackInputDto } from './dto/create-event.dto.js';
import {
  ContentKind,
  DEEP_CRITIQUE_CHARS,
  EventTask,
  PRACTICE_PER_DAY_CAP,
  PRESETS,
  TASKS,
  TaskType,
  Track,
  taskLabel,
} from './challenges.js';

// ---- Event economy & anti-cheat limits (all enforced on the server) ----
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const EVENT_DAYS = 7;
export const EVENT_MIN_XP = 10;
export const EVENT_MAX_XP = 300;
/** A circle needs this many members besides the creator to host an event. */
export const EVENT_MIN_OTHER_MEMBERS = 3;
/** An event goes live only if this many people (not counting the creator) voted. */
export const EVENT_MIN_VOTERS = 3;
export const EVENT_MAX_ACTIVE_PER_CIRCLE = 3;
export const EVENT_MAX_TASKS = 4;
export const VOTING_HOURS = [6, 12, 24, 48];
const PURGE_AFTER_DAYS = 30;
/** With nothing due, still check every 6h (purges old events). Lets a free,
 * scale-to-zero database (Neon) sleep instead of being polled 24/7. */
const IDLE_SWEEP_MS = 6 * 60 * 60_000;

export type Phase = 'voting' | 'live' | 'ended' | 'cancelled';

interface StoredTrack {
  name: string;
  tasks: EventTask[];
}

/** Shown to every member — exactly what the server enforces. */
export const EVENT_RULES: string[] = [
  `Each event lasts ${EVENT_DAYS} days: first a voting window, then the live challenge. It disappears when the week ends.`,
  'Vote to join while voting is open. Only voters can play — the list locks when voting closes.',
  `An event only goes live if at least ${EVENT_MIN_VOTERS} people vote (the creator doesn’t count); otherwise it’s cancelled.`,
  'Learners and Mentors get their own challenge track. Progress is checked by the server from your real activity during the live phase.',
  'XP is proportional: complete 10% of your tasks and earn 10% of the XP, complete 100% for the full reward. Collect anytime — the rest is paid automatically when the event ends.',
  'Your own posts never count for comments, critiques or likes. Private, deleted or hidden content doesn’t count.',
  'The admin who created an event can play, but never earns its XP.',
];


const LOOK = {
  Learner: { gradient: ['#7C3AED', '#DB2777'] as [string, string], icon: 'rocket' },
  Mentor: { gradient: ['#0F766E', '#0284C7'] as [string, string], icon: 'school' },
  Both: { gradient: ['#4F46E5', '#DB2777'] as [string, string], icon: 'trophy' },
};

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private timer?: NodeJS.Timeout;
  private nextAt = 0;
  private sweeping = false;
  private lastSweep = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.scheduleAt(Date.now() + 10_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  /** Plan the next sweep at `ts` (unless an earlier one is already planned). */
  private scheduleAt(ts: number): void {
    const now = Date.now();
    const at = Math.max(now + 5_000, Math.min(ts, now + IDLE_SWEEP_MS));
    if (this.timer && this.nextAt && this.nextAt <= at) return;
    if (this.timer) clearTimeout(this.timer);
    this.nextAt = at;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.nextAt = 0;
      void this.sweep();
    }, at - now);
    this.timer.unref();
  }

  /** Next moment an event changes phase (voting closes / event ends). */
  private async scheduleNextDeadline(): Promise<void> {
    const now = new Date();
    const open = { cancelledAt: null, settledAt: null };
    const [v, e] = await Promise.all([
      this.prisma.communityEvent.findFirst({
        where: { ...open, votingEndsAt: { gt: now } },
        orderBy: { votingEndsAt: 'asc' },
        select: { votingEndsAt: true },
      }),
      this.prisma.communityEvent.findFirst({
        where: { ...open, endsAt: { gt: now } },
        orderBy: { endsAt: 'asc' },
        select: { endsAt: true },
      }),
    ]);
    const times = [v?.votingEndsAt?.getTime(), e?.endsAt?.getTime()].filter((t): t is number => !!t);
    this.scheduleAt(times.length ? Math.min(...times) + 2_000 : Date.now() + IDLE_SWEEP_MS);
  }

  // ------------------------------------------------------------------ catalog

  catalog() {
    return {
      rules: EVENT_RULES,
      limits: {
        days: EVENT_DAYS,
        minXp: EVENT_MIN_XP,
        maxXp: EVENT_MAX_XP,
        minOtherMembers: EVENT_MIN_OTHER_MEMBERS,
        minVoters: EVENT_MIN_VOTERS,
        maxActivePerCircle: EVENT_MAX_ACTIVE_PER_CIRCLE,
        maxTasks: EVENT_MAX_TASKS,
        votingHours: VOTING_HOURS,
      },
      tasks: (Object.keys(TASKS) as TaskType[]).map((type) => ({ type, ...TASKS[type] })),
      presets: PRESETS,
    };
  }

  // ------------------------------------------------------------------ helpers

  private tracksOf(e: CommunityEvent): Partial<Record<Track, StoredTrack & { xp: number }>> {
    const out: Partial<Record<Track, StoredTrack & { xp: number }>> = {};
    const l = e.learnerTasks as unknown as StoredTrack | null;
    const m = e.mentorTasks as unknown as StoredTrack | null;
    if (l?.tasks?.length) out.Learner = { ...l, xp: e.learnerXp ?? 0 };
    if (m?.tasks?.length) out.Mentor = { ...m, xp: e.mentorXp ?? 0 };
    return out;
  }

  private phaseOf(e: CommunityEvent, nonCreatorVoters: number, now = new Date()): Phase {
    if (e.cancelledAt) return 'cancelled';
    if (e.votingEndsAt && now < e.votingEndsAt) return 'voting';
    if (nonCreatorVoters < EVENT_MIN_VOTERS) return 'cancelled';
    if (e.endsAt && now >= e.endsAt) return 'ended';
    return 'live';
  }

  private taskView(t: EventTask) {
    return {
      id: t.id,
      type: t.type,
      target: t.target,
      kind: t.kind,
      label: taskLabel(t),
      icon: TASKS[t.type].icon,
      howMeasured: TASKS[t.type].howMeasured,
    };
  }

  /** Measure one task for a user inside [from, to] — from real activity only. */
  private async measure(userId: string, t: EventTask, circleId: string, from: Date, to: Date): Promise<number> {
    const inCircle = { some: { communityId: circleId } };
    const window = { gte: from, lte: to };
    const othersPostInCircle: Prisma.PostWhereInput = {
      authorId: { not: userId },
      deletedAt: null,
      isHidden: false,
      communities: inCircle,
    };

    switch (t.type) {
      case 'PUBLISH': {
        const where: Prisma.PostWhereInput = {
          authorId: userId,
          deletedAt: null,
          isHidden: false,
          isPrivate: false,
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: to } }],
          communities: inCircle,
          createdAt: window,
        };
        const kind = (t.kind ?? 'any') as ContentKind;
        if (kind === 'video') Object.assign(where, { isShort: false, postType: PostType.VIDEO });
        if (kind === 'reel') Object.assign(where, { isShort: true });
        if (kind === 'audio') Object.assign(where, { isShort: false, postType: PostType.AUDIO });
        if (kind === 'photo') Object.assign(where, { isShort: false, postType: PostType.IMAGE });
        if (kind === 'discussion')
          Object.assign(where, { isShort: false, postType: { in: [PostType.TEXT, PostType.CRITIQUE_REQUEST] } });
        return this.prisma.post.count({ where });
      }
      case 'COMMENT':
      case 'GIVE_CRITIQUES': {
        const rows = await this.prisma.comment.findMany({
          where: {
            authorId: userId,
            isMentorCritique: t.type === 'GIVE_CRITIQUES',
            deletedAt: null,
            isHidden: false,
            createdAt: window,
            post: othersPostInCircle,
          },
          distinct: ['postId'],
          select: { postId: true },
        });
        return rows.length;
      }
      case 'DEEP_CRITIQUES': {
        const rows = await this.prisma.comment.findMany({
          where: {
            authorId: userId,
            isMentorCritique: true,
            deletedAt: null,
            isHidden: false,
            createdAt: window,
            post: othersPostInCircle,
          },
          select: { postId: true, text: true },
          take: 500,
        });
        return new Set(rows.filter((r) => r.text.trim().length >= DEEP_CRITIQUE_CHARS).map((r) => r.postId)).size;
      }
      case 'EARN_LIKES':
        return this.prisma.postLike.count({
          where: {
            userId: { not: userId },
            createdAt: window,
            post: { authorId: userId, deletedAt: null, isHidden: false, isPrivate: false, communities: inCircle },
          },
        });
      case 'GET_CRITIQUED':
        return this.prisma.comment.count({
          where: {
            authorId: { not: userId },
            isMentorCritique: true,
            deletedAt: null,
            isHidden: false,
            createdAt: window,
            post: { authorId: userId, deletedAt: null, communities: inCircle },
          },
        });
      case 'HELPFUL_CRITIQUES':
        return this.prisma.commentLike.count({
          where: {
            userId: { not: userId },
            createdAt: window,
            comment: {
              authorId: userId,
              isMentorCritique: true,
              deletedAt: null,
              post: { deletedAt: null, communities: inCircle },
            },
          },
        });
      case 'PRACTICE': {
        const rows = await this.prisma.practiceSession.findMany({
          where: { userId, createdAt: window },
          select: { createdAt: true },
          take: 500,
        });
        const perDay = new Map<string, number>();
        for (const r of rows) perDay.set(utcDay(r.createdAt), (perDay.get(utcDay(r.createdAt)) ?? 0) + 1);
        return [...perDay.values()].reduce((s, n) => s + Math.min(n, PRACTICE_PER_DAY_CAP), 0);
      }
      case 'ACTIVE_DAYS': {
        const [posts, comments] = await Promise.all([
          this.prisma.post.findMany({
            where: { authorId: userId, deletedAt: null, isPrivate: false, communities: inCircle, createdAt: window },
            select: { createdAt: true },
            take: 500,
          }),
          this.prisma.comment.findMany({
            where: { authorId: userId, deletedAt: null, createdAt: window, post: othersPostInCircle },
            select: { createdAt: true },
            take: 500,
          }),
        ]);
        return new Set([...posts, ...comments].map((r) => utcDay(r.createdAt))).size;
      }
    }
  }

  /** A participant's per-task progress and overall % for their track. */
  private async progressOf(userId: string, track: Track, e: CommunityEvent, phase: Phase) {
    const t = this.tracksOf(e)[track];
    if (!t) return { tasks: [], pct: 0 };
    const counting = phase === 'live' || phase === 'ended';
    const from = e.votingEndsAt ?? e.startsAt;
    const now = new Date();
    const to = e.endsAt && e.endsAt < now ? e.endsAt : now;
    const tasks = await Promise.all(
      t.tasks.map(async (task) => {
        const current = counting ? await this.measure(userId, task, e.communityId, from, to) : 0;
        return { ...this.taskView(task), current: Math.min(current, task.target), done: current >= task.target };
      }),
    );
    const pct = tasks.length
      ? Math.floor((tasks.reduce((s, x) => s + Math.min(1, x.current / x.target), 0) / tasks.length) * 100)
      : 0;
    return { tasks, pct };
  }

  private xpFor(e: CommunityEvent, track: Track, pct: number): number {
    const t = this.tracksOf(e)[track];
    return t ? Math.floor((t.xp * pct) / 100) : 0;
  }

  /**
   * Pay a participant whatever they've earned but not received yet. Safe under
   * concurrency: only the request that moves xpAwarded from its old value pays.
   */
  private async payDelta(
    e: CommunityEvent & { community?: { category?: string } },
    p: EventParticipation,
    pct: number,
  ): Promise<number> {
    // Event XP counts toward the circle's skill.
    const skill = e.community?.category;
    const isCreator = e.createdById === p.userId;
    const target = isCreator ? 0 : this.xpFor(e, p.role as Track, pct);
    const completedNow = pct >= 100 && !p.completedAt;
    const data: Prisma.EventParticipationUpdateManyMutationInput = { progressPct: pct };
    if (completedNow) data.completedAt = new Date();
    const delta = target - p.xpAwarded;
    if (delta > 0) data.xpAwarded = target;

    const res = await this.prisma.eventParticipation.updateMany({
      where: { id: p.id, xpAwarded: p.xpAwarded },
      data,
    });
    if (res.count !== 1) return 0;
    if (delta > 0) {
      await this.xp.award(p.userId, XpSource.EVENT, delta, `event:${e.id}:${p.userId}:${target}`, undefined, skill);
    }
    if (completedNow && !isCreator) {
      await this.xp.onEventCompleted(p.userId, e.id, skill);
      await this.xp.recordActivity(p.userId);
    }
    return Math.max(0, delta);
  }

  // -------------------------------------------------------------- lifecycle

  /** Cancel events without enough voters, settle ended events, purge old ones. */
  async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    this.lastSweep = Date.now();
    try {
      const now = new Date();
      const due = await this.prisma.communityEvent.findMany({
        where: {
          cancelledAt: null,
          settledAt: null,
          OR: [{ votingEndsAt: { lte: now } }, { endsAt: { lte: now } }],
        },
        include: { participations: true, community: { select: { name: true, category: true } } },
      });
      for (const e of due) {
        const voters = e.participations.filter((p) => p.userId !== e.createdById);
        const phase = this.phaseOf(e, voters.length, now);
        if (phase === 'cancelled') {
          await this.prisma.communityEvent.update({ where: { id: e.id }, data: { cancelledAt: now } });
          for (const p of e.participations) {
            await this.notifications.create({
              userId: p.userId,
              type: 'EVENT',
              title: `“${e.title}” was cancelled`,
              body: `Not enough members voted to join (needs ${EVENT_MIN_VOTERS}).`,
              data: { kind: 'circle', communityId: e.communityId },
            });
          }
          this.realtime.emitToAll('events:updated', { communityId: e.communityId });
        } else if (phase === 'ended') {
          for (const p of e.participations) {
            const { pct } = await this.progressOf(p.userId, p.role as Track, e, 'ended');
            const paid = await this.payDelta(e, p, pct);
            const total = p.xpAwarded + paid;
            if (total > 0) {
              await this.notifications.create({
                userId: p.userId,
                type: 'EVENT',
                title: `“${e.title}” has ended`,
                body: `You completed ${pct}% and earned ${total} XP in ${e.community.name}.`,
                data: { kind: 'circle', communityId: e.communityId },
              });
            }
          }
          await this.prisma.communityEvent.update({ where: { id: e.id }, data: { settledAt: now } });
          this.realtime.emitToAll('events:updated', { communityId: e.communityId });
        }
      }
      await this.prisma.communityEvent.deleteMany({
        where: { endsAt: { lt: new Date(now.getTime() - PURGE_AFTER_DAYS * DAY_MS) } },
      });
    } catch (err) {
      this.logger.warn(`Event sweep failed: ${(err as Error).message}`);
    } finally {
      this.sweeping = false;
    }
    try {
      await this.scheduleNextDeadline();
    } catch {
      this.scheduleAt(Date.now() + 10 * 60_000); // DB hiccup → try again later
    }
  }

  private async maybeSweep(): Promise<void> {
    if (Date.now() - this.lastSweep > 30_000) await this.sweep();
  }

  // ------------------------------------------------------------------ reads

  private async summarize(
    e: CommunityEvent & { participations: EventParticipation[]; community: { name: string } },
    userId: string,
    myRole: Track | null,
    creatorName: string,
  ) {
    const voters = e.participations.filter((p) => p.userId !== e.createdById);
    const phase = this.phaseOf(e, voters.length);
    const tracks = this.tracksOf(e);
    const mine = e.participations.find((p) => p.userId === userId);
    const isCreator = e.createdById === userId;
    const now = Date.now();

    let my = null as null | {
      role: Track;
      pct: number;
      tasks: Awaited<ReturnType<EventsService['progressOf']>>['tasks'];
      xpEarned: number;
      xpAwarded: number;
      collectable: number;
      maxXp: number;
      tasksDone: number;
    };
    if (mine) {
      const role = mine.role as Track;
      const prog = await this.progressOf(userId, role, e, phase);
      const earned = isCreator ? 0 : this.xpFor(e, role, prog.pct);
      if (prog.pct !== mine.progressPct) {
        await this.prisma.eventParticipation.update({ where: { id: mine.id }, data: { progressPct: prog.pct } });
      }
      my = {
        role,
        pct: prog.pct,
        tasks: prog.tasks,
        xpEarned: earned,
        xpAwarded: mine.xpAwarded,
        collectable: phase === 'live' ? Math.max(0, earned - mine.xpAwarded) : 0,
        maxXp: isCreator ? 0 : tracks[role]?.xp ?? 0,
        tasksDone: prog.tasks.filter((t) => t.done).length,
      };
    }

    const trackView = (t?: StoredTrack & { xp: number }) =>
      t ? { name: t.name, xp: t.xp, tasks: t.tasks.map((x) => this.taskView(x)) } : null;

    return {
      id: e.id,
      communityId: e.communityId,
      communityName: e.community.name,
      title: e.title,
      description: e.description,
      phase,
      createdAt: e.createdAt.toISOString(),
      votingEndsAt: e.votingEndsAt?.toISOString(),
      endsAt: e.endsAt?.toISOString(),
      daysLeft: Math.max(0, Math.ceil(((e.endsAt?.getTime() ?? now) - now) / DAY_MS)),
      votingHoursLeft: Math.max(0, Math.ceil(((e.votingEndsAt?.getTime() ?? now) - now) / HOUR_MS)),
      tracks: { Learner: trackView(tracks.Learner), Mentor: trackView(tracks.Mentor) },
      xpReward: Math.max(tracks.Learner?.xp ?? 0, tracks.Mentor?.xp ?? 0),
      votes: {
        Learner: e.participations.filter((p) => p.role === 'Learner').length,
        Mentor: e.participations.filter((p) => p.role === 'Mentor').length,
        total: e.participations.length,
        countedForStart: voters.length,
      },
      minVoters: EVENT_MIN_VOTERS,
      hasVoted: !!mine,
      myRole,
      myTrackAvailable: !!myRole && !!tracks[myRole],
      isCreator,
      my,
      bannerGradient: e.bannerGradient as [string, string],
      icon: e.icon,
      createdByName: creatorName,
    };
  }

  private async load(where: Prisma.CommunityEventWhereInput) {
    return this.prisma.communityEvent.findMany({
      where,
      include: { participations: true, community: { select: { name: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async creatorNames(ids: (string | null)[]) {
    const list = [...new Set(ids.filter((x): x is string => !!x))];
    const rows = list.length
      ? await this.prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, name: true } })
      : [];
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async list(userId: string, communityId?: string) {
    await this.maybeSweep();
    const viewer = await this.prisma.user.findUnique({ where: { id: userId }, select: SKILL_OWNER_SELECT });
    // The viewer's track in each event = their role in that circle's skill.
    const trackIn = (category: string): Track | null =>
      viewer ? resolveContext(viewer, category)?.role ?? null : null;
    const events = await this.load({
      ...(communityId ? { communityId } : {}),
      cancelledAt: null,
      endsAt: { gt: new Date() },
      OR: [{ learnerTasks: { not: Prisma.AnyNull } }, { mentorTasks: { not: Prisma.AnyNull } }],
    });
    const names = await this.creatorNames(events.map((e) => e.createdById));
    const out = await Promise.all(
      events.map((e) => this.summarize(e, userId, trackIn(e.community.category), names.get(e.createdById ?? '') ?? 'LERNEX Admin')),
    );
    return out.filter((e) => e.phase === 'voting' || e.phase === 'live');
  }

  /** Full event view including the participants' status board. */
  async detail(userId: string, eventId: string) {
    await this.maybeSweep();
    const [e] = await this.load({ id: eventId });
    if (!e) throw new NotFoundException('Event not found');
    const viewer = await this.prisma.user.findUnique({ where: { id: userId }, select: SKILL_OWNER_SELECT });
    const names = await this.creatorNames([e.createdById]);
    const myTrack = viewer ? resolveContext(viewer, e.community.category)?.role ?? null : null;
    const summary = await this.summarize(e, userId, myTrack, names.get(e.createdById ?? '') ?? 'LERNEX Admin');

    const users = await this.prisma.user.findMany({
      where: { id: { in: e.participations.map((p) => p.userId) } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const board = await Promise.all(
      e.participations.slice(0, 60).map(async (p) => {
        const prog =
          p.userId === userId && summary.my
            ? { pct: summary.my.pct, tasks: summary.my.tasks }
            : await this.progressOf(p.userId, p.role as Track, e, summary.phase);
        const u = userMap.get(p.userId);
        return {
          userId: p.userId,
          name: u?.name ?? 'Member',
          avatarUrl: u?.avatarUrl ?? '',
          role: p.role as Track,
          pct: prog.pct,
          tasksDone: prog.tasks.filter((t) => t.done).length,
          tasksTotal: prog.tasks.length,
          xpAwarded: p.xpAwarded,
          isCreator: p.userId === e.createdById,
          isMe: p.userId === userId,
        };
      }),
    );
    board.sort((a, b) => b.pct - a.pct || b.tasksDone - a.tasksDone || a.name.localeCompare(b.name));
    return { ...summary, board };
  }

  // ----------------------------------------------------------------- writes

  private validateTrack(track: Track, input: TrackInputDto, liveDays: number): StoredTrack {
    if (input.xp < EVENT_MIN_XP || input.xp > EVENT_MAX_XP) {
      throw new BadRequestException(`${track} XP must be between ${EVENT_MIN_XP} and ${EVENT_MAX_XP}.`);
    }
    if (input.tasks.length < 1 || input.tasks.length > EVENT_MAX_TASKS) {
      throw new BadRequestException(`Each track needs 1–${EVENT_MAX_TASKS} tasks.`);
    }
    const tasks: EventTask[] = input.tasks.map((t) => {
      const type = t.type as TaskType;
      const def = TASKS[type];
      if (!def.tracks.includes(track)) {
        throw new BadRequestException(`“${def.title}” isn’t available for ${track}s.`);
      }
      const max = type === 'ACTIVE_DAYS' ? Math.min(def.max, liveDays) : def.max;
      if (t.target < def.min || t.target > max) {
        throw new BadRequestException(`“${def.title}” target must be between ${def.min} and ${max}.`);
      }
      return {
        id: randomBytes(4).toString('hex'),
        type,
        target: t.target,
        ...(type === 'PUBLISH' ? { kind: (t.kind ?? 'any') as ContentKind } : {}),
      };
    });
    return { name: input.name?.trim() || `${track} challenge`, tasks };
  }

  /**
   * Who may create / end events in a circle: app admins (Admin Panel) and that
   * circle's own admins. Checked against the database on every call.
   */
  async canManage(userId: string, communityId: string): Promise<boolean> {
    const [u, m] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, deletedAt: true } }),
      this.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId, communityId } },
        select: { role: true },
      }),
    ]);
    if (!u || u.deletedAt) return false;
    return u.isAdmin || m?.role === 'ADMIN';
  }

  private async assertCanManage(userId: string, communityId: string) {
    if (!(await this.canManage(userId, communityId))) {
      throw new ForbiddenException('Only this circle’s admins can manage its events');
    }
  }

  /** App admins or this circle's admins. */
  async create(adminId: string, dto: CreateEventDto) {
    await this.assertCanManage(adminId, dto.communityId);
    if (!dto.learner && !dto.mentor) {
      throw new BadRequestException('Add a Learner track, a Mentor track, or both.');
    }
    const now = new Date();
    const votingEndsAt = new Date(now.getTime() + dto.votingHours * HOUR_MS);
    const endsAt = new Date(now.getTime() + EVENT_DAYS * DAY_MS);
    const liveDays = Math.floor((endsAt.getTime() - votingEndsAt.getTime()) / DAY_MS);
    const learner = dto.learner ? this.validateTrack('Learner', dto.learner, liveDays) : null;
    const mentor = dto.mentor ? this.validateTrack('Mentor', dto.mentor, liveDays) : null;

    const circle = await this.prisma.community.findUnique({ where: { id: dto.communityId }, select: { id: true, name: true } });
    if (!circle) throw new NotFoundException('Circle not found');

    const members = await this.prisma.communityMembership.findMany({
      where: { communityId: dto.communityId, userId: { not: adminId }, user: { deletedAt: null } },
      select: { userId: true },
    });
    if (members.length < EVENT_MIN_OTHER_MEMBERS) {
      throw new BadRequestException(
        `This circle needs at least ${EVENT_MIN_OTHER_MEMBERS} members besides you to host an event (it has ${members.length}).`,
      );
    }
    const active = await this.prisma.communityEvent.count({
      where: { communityId: dto.communityId, cancelledAt: null, endsAt: { gt: now } },
    });
    if (active >= EVENT_MAX_ACTIVE_PER_CIRCLE) {
      throw new ConflictException(
        `This circle already has ${EVENT_MAX_ACTIVE_PER_CIRCLE} active events. End one or wait for it to finish.`,
      );
    }

    const audience: 'Learner' | 'Mentor' | 'Both' = learner && mentor ? 'Both' : learner ? 'Learner' : 'Mentor';
    const look = LOOK[audience];
    const subtitle = [learner && `Learners: ${learner.name}`, mentor && `Mentors: ${mentor.name}`].filter(Boolean).join(' · ');

    const event = await this.prisma.communityEvent.create({
      data: {
        communityId: dto.communityId,
        title: dto.title.trim(),
        subtitle,
        description: dto.description.trim(),
        targetRole: audience,
        category: 'challenge',
        xpReward: Math.max(dto.learner?.xp ?? 0, dto.mentor?.xp ?? 0),
        status: 'active',
        goalType: 'TRACKS',
        goalCount: 0,
        startsAt: now,
        votingEndsAt,
        endsAt,
        createdById: adminId,
        learnerTasks: (learner ?? undefined) as unknown as Prisma.InputJsonValue,
        mentorTasks: (mentor ?? undefined) as unknown as Prisma.InputJsonValue,
        learnerXp: dto.learner?.xp ?? null,
        mentorXp: dto.mentor?.xp ?? null,
        bannerGradient: look.gradient,
        icon: look.icon,
        requirements: [],
      },
    });

    // Invite the circle to vote.
    const who = audience === 'Both' ? 'Learners & Mentors' : `${audience}s`;
    for (const m of members.slice(0, 500)) {
      await this.notifications.create({
        userId: m.userId,
        type: 'EVENT',
        title: `New challenge in ${circle.name} 🏆`,
        body: `“${event.title}” — ${who}, vote to join within ${dto.votingHours}h.`,
        data: { kind: 'event', eventId: event.id, communityId: dto.communityId },
      });
    }
    this.realtime.emitToAll('events:updated', { communityId: dto.communityId });
    this.scheduleAt(votingEndsAt.getTime() + 2_000); // wake when voting closes
    return this.detail(adminId, event.id);
  }

  async vote(userId: string, eventId: string) {
    const [e] = await this.load({ id: eventId });
    if (!e) throw new NotFoundException('Event not found');
    const phase = this.phaseOf(e, e.participations.filter((p) => p.userId !== e.createdById).length);
    if (phase !== 'voting') throw new BadRequestException('Voting has closed — only members who voted can play.');

    const [user, member] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: SKILL_OWNER_SELECT }),
      this.prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId, communityId: e.communityId } },
        select: { id: true },
      }),
    ]);
    if (!member) throw new ForbiddenException('Join this circle first to vote.');
    if (user?.role === 'GUEST') {
      throw new ForbiddenException('Challenges award XP, so they’re for Learners and Mentors. Switch from Guest in your profile to join.');
    }
    // Learner or Mentor track = the member's role in this circle's skill.
    const role = user ? resolveContext(user, e.community.category)?.role ?? null : null;
    if (!role || !this.tracksOf(e)[role]) {
      throw new ForbiddenException(`This event has no challenge for ${role ?? 'your role'}s.`);
    }
    await this.prisma.eventParticipation.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, role },
      update: {},
    });
    this.realtime.emitToAll('events:updated', { communityId: e.communityId });
    return this.detail(userId, eventId);
  }

  async unvote(userId: string, eventId: string) {
    const [e] = await this.load({ id: eventId });
    if (!e) throw new NotFoundException('Event not found');
    const phase = this.phaseOf(e, e.participations.filter((p) => p.userId !== e.createdById).length);
    if (phase !== 'voting') throw new BadRequestException('Voting has closed — you can’t withdraw now.');
    await this.prisma.eventParticipation.deleteMany({ where: { userId, eventId } });
    this.realtime.emitToAll('events:updated', { communityId: e.communityId });
    return this.detail(userId, eventId);
  }

  /** Collect the XP earned so far (proportional to completion). */
  async collect(userId: string, eventId: string) {
    const [e] = await this.load({ id: eventId });
    if (!e) throw new NotFoundException('Event not found');
    const phase = this.phaseOf(e, e.participations.filter((p) => p.userId !== e.createdById).length);
    if (phase !== 'live') throw new BadRequestException('XP can be collected while the challenge is live.');
    const p = e.participations.find((x) => x.userId === userId);
    if (!p) throw new ForbiddenException('Only members who voted can play this event.');

    const { pct } = await this.progressOf(userId, p.role as Track, e, phase);
    const earnedXP = await this.payDelta(e, p, pct);
    return {
      earnedXP,
      pct,
      totalXp: p.xpAwarded + earnedXP,
      creatorNoXp: e.createdById === userId,
      eventTitle: e.title,
    };
  }

  /** App/circle admins: end early — everyone is paid for progress so far, then it's removed. */
  async remove(userId: string, eventId: string) {
    const [e] = await this.load({ id: eventId });
    if (!e) throw new NotFoundException('Event not found');
    await this.assertCanManage(userId, e.communityId);
    const phase = this.phaseOf(e, e.participations.filter((p) => p.userId !== e.createdById).length);
    if (phase === 'live') {
      for (const p of e.participations) {
        const { pct } = await this.progressOf(p.userId, p.role as Track, e, phase);
        await this.payDelta(e, p, pct);
      }
    }
    await this.prisma.communityEvent.delete({ where: { id: eventId } });
    this.realtime.emitToAll('events:updated', { communityId: e.communityId });
    return { success: true };
  }
}
