import { Injectable } from '@nestjs/common';
import { PostType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { seasonWindow, utcDay } from '../gamification/leveling.js';

const DAY_MS = 86_400_000;

/** The last `n` UTC days as 'YYYY-MM-DD', oldest first (today last). */
function lastDays(n: number): string[] {
  const today = Date.parse(`${utcDay()}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => utcDay(new Date(today - (n - 1 - i) * DAY_MS)));
}

/** Application-wide statistics for the Admin dashboard. All values are live. */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  private async contentStats(where: Prisma.PostWhereInput, since7: Date) {
    const base: Prisma.PostWhereInput = { deletedAt: null, ...where };
    const [total, last7Days, views, likes, comments, privateCount] = await Promise.all([
      this.prisma.post.count({ where: base }),
      this.prisma.post.count({ where: { ...base, createdAt: { gte: since7 } } }),
      this.prisma.post.aggregate({ where: base, _sum: { viewsCount: true } }),
      this.prisma.postLike.count({ where: { post: base } }),
      this.prisma.comment.count({ where: { deletedAt: null, post: base } }),
      this.prisma.post.count({ where: { ...base, isPrivate: true } }),
    ]);
    return {
      total,
      last7Days,
      views: views._sum.viewsCount ?? 0,
      likes,
      comments,
      private: privateCount,
    };
  }

  async dashboard() {
    const days30 = lastDays(30);
    const start30 = new Date(`${days30[0]}T00:00:00Z`);
    const days7 = days30.slice(-7);
    const since7 = new Date(`${days7[0]}T00:00:00Z`);
    const today = days30[days30.length - 1];
    const liveUser: Prisma.UserWhereInput = { deletedAt: null };

    // ---- Users ----
    const [totalUsers, learners, mentors, guests, admins, usersBefore30, recentUsers] = await Promise.all([
      this.prisma.user.count({ where: liveUser }),
      this.prisma.user.count({ where: { ...liveUser, role: UserRole.LEARNER } }),
      this.prisma.user.count({ where: { ...liveUser, role: UserRole.MENTOR } }),
      this.prisma.user.count({ where: { ...liveUser, role: UserRole.GUEST } }),
      this.prisma.user.count({ where: { ...liveUser, isAdmin: true } }),
      this.prisma.user.count({ where: { ...liveUser, createdAt: { lt: start30 } } }),
      this.prisma.user.findMany({
        where: { ...liveUser, createdAt: { gte: start30 } },
        select: { createdAt: true },
      }),
    ]);
    const signupsByDay = new Map(days30.map((d) => [d, 0]));
    for (const u of recentUsers) {
      const d = utcDay(u.createdAt);
      signupsByDay.set(d, (signupsByDay.get(d) ?? 0) + 1);
    }
    let running = usersBefore30;
    const growth = days30.map((day) => {
      const signups = signupsByDay.get(day) ?? 0;
      running += signups;
      return { day, signups, total: running };
    });

    // ---- Time spent (foreground heartbeats) ----
    const usage = await this.prisma.usageDay.findMany({
      where: { day: { gte: days30[0] } },
      select: { userId: true, day: true, seconds: true },
    });
    const usageByDay = new Map(days30.map((d) => [d, { seconds: 0, users: 0 }]));
    const wau = new Set<string>();
    const mau = new Set<string>();
    let totalSeconds30 = 0;
    for (const u of usage) {
      const bucket = usageByDay.get(u.day);
      if (!bucket) continue;
      bucket.seconds += u.seconds;
      bucket.users += 1;
      totalSeconds30 += u.seconds;
      mau.add(u.userId);
      if (u.day >= days7[0]) wau.add(u.userId);
    }
    const activeUserDays = usage.length;
    const timeSpent = days30.map((day) => {
      const b = usageByDay.get(day)!;
      return {
        day,
        minutes: Math.round(b.seconds / 60),
        activeUsers: b.users,
        avgMinutesPerUser: b.users ? Math.round(b.seconds / 60 / b.users) : 0,
      };
    });
    const todayUsage = usageByDay.get(today)!;

    // ---- Content ----
    const [videos, reels, audio, photos, discussions, postsRecent, scheduledPending] = await Promise.all([
      this.contentStats({ isShort: false, postType: PostType.VIDEO }, since7),
      this.contentStats({ isShort: true }, since7),
      this.contentStats({ isShort: false, postType: PostType.AUDIO }, since7),
      this.contentStats({ isShort: false, postType: PostType.IMAGE }, since7),
      this.contentStats(
        { isShort: false, postType: { in: [PostType.TEXT, PostType.CRITIQUE_REQUEST] } },
        since7,
      ),
      this.prisma.post.findMany({
        where: { deletedAt: null, createdAt: { gte: start30 } },
        select: { createdAt: true, isShort: true, postType: true },
      }),
      this.prisma.post.count({ where: { deletedAt: null, scheduledAt: { gt: new Date() } } }),
    ]);
    const postsByDay = new Map(days30.map((d) => [d, { videos: 0, reels: 0, audio: 0, photos: 0, discussions: 0 }]));
    for (const p of postsRecent) {
      const b = postsByDay.get(utcDay(p.createdAt));
      if (!b) continue;
      if (p.isShort) b.reels += 1;
      else if (p.postType === PostType.VIDEO) b.videos += 1;
      else if (p.postType === PostType.AUDIO) b.audio += 1;
      else if (p.postType === PostType.IMAGE) b.photos += 1;
      else b.discussions += 1;
    }

    // ---- Circles ----
    const [circles, userCreatedCircles, memberships, postsInCircles, topMembership, events, eventCompletions] =
      await Promise.all([
        this.prisma.community.count(),
        this.prisma.community.count({ where: { createdById: { not: null } } }),
        this.prisma.communityMembership.count(),
        this.prisma.postCommunity.count({ where: { post: { deletedAt: null } } }),
        this.prisma.communityMembership.groupBy({
          by: ['communityId'],
          _count: { _all: true },
          orderBy: { _count: { communityId: 'desc' } },
          take: 5,
        }),
        this.prisma.communityEvent.count(),
        this.prisma.eventParticipation.count({ where: { completedAt: { not: null } } }),
      ]);
    const topIds = topMembership.map((t) => t.communityId);
    const topCircles = topIds.length
      ? await this.prisma.community.findMany({
          where: { id: { in: topIds } },
          select: { id: true, name: true, category: true },
        })
      : [];
    const circleInfo = new Map(topCircles.map((c) => [c.id, c]));

    // ---- Engagement ----
    const [comments, critiques, likes, reposts, saves, follows, allViews] = await Promise.all([
      this.prisma.comment.count({ where: { deletedAt: null, isMentorCritique: false } }),
      this.prisma.comment.count({ where: { deletedAt: null, isMentorCritique: true } }),
      this.prisma.postLike.count(),
      this.prisma.repost.count(),
      this.prisma.postSave.count(),
      this.prisma.follow.count(),
      this.prisma.post.aggregate({ where: { deletedAt: null }, _sum: { viewsCount: true } }),
    ]);

    // ---- XP economy ----
    const season = seasonWindow();
    const [seasonXp, seasonParticipants, lifetimeXp, activeRules, customRules, activeRewards, claims] =
      await Promise.all([
        this.prisma.xpEvent.aggregate({
          where: { createdAt: { gte: season.startsAt, lt: season.endsAt } },
          _sum: { amount: true },
        }),
        this.prisma.xpEvent.findMany({
          where: { createdAt: { gte: season.startsAt, lt: season.endsAt } },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.xpEvent.aggregate({ _sum: { amount: true } }),
        this.prisma.xpRule.count({ where: { isActive: true } }),
        this.prisma.xpRule.count({ where: { createdById: { not: null } } }),
        this.prisma.seasonReward.count({ where: { isActive: true } }),
        this.prisma.rewardClaim.count(),
      ]);

    // ---- Moderation ----
    const [reportsByStatus, hiddenPosts] = await Promise.all([
      this.prisma.report.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.post.count({ where: { isHidden: true, deletedAt: null } }),
    ]);
    const reports = Object.fromEntries(reportsByStatus.map((r) => [r.status, r._count._all]));

    return {
      generatedAt: new Date().toISOString(),
      users: {
        total: totalUsers,
        learners,
        mentors,
        guests,
        onboarding: totalUsers - learners - mentors - guests,
        admins,
        newLast7Days: growth.slice(-7).reduce((s, g) => s + g.signups, 0),
        newLast30Days: growth.reduce((s, g) => s + g.signups, 0),
        growth,
      },
      activity: {
        dailyActiveUsers: todayUsage.users,
        weeklyActiveUsers: wau.size,
        monthlyActiveUsers: mau.size,
        minutesToday: Math.round(todayUsage.seconds / 60),
        avgMinutesPerActiveUser: activeUserDays ? Math.round(totalSeconds30 / 60 / activeUserDays) : 0,
        totalHoursLast30Days: Math.round((totalSeconds30 / 3600) * 10) / 10,
        timeSpent,
      },
      content: {
        videos,
        reels,
        audio,
        photos,
        discussions,
        scheduledPending,
        postsPerDay: days30.map((day) => ({ day, ...postsByDay.get(day)! })),
      },
      circles: {
        total: circles,
        userCreated: userCreatedCircles,
        memberships,
        postsInCircles,
        events,
        eventCompletions,
        top: topMembership.map((t) => ({
          id: t.communityId,
          name: circleInfo.get(t.communityId)?.name ?? 'Unknown circle',
          category: circleInfo.get(t.communityId)?.category ?? '',
          members: t._count._all,
        })),
      },
      engagement: {
        comments,
        critiques,
        likes,
        reposts,
        saves,
        follows,
        views: allViews._sum.viewsCount ?? 0,
      },
      xp: {
        seasonNumber: season.number,
        seasonXpAwarded: seasonXp._sum.amount ?? 0,
        seasonParticipants: seasonParticipants.length,
        lifetimeXpAwarded: lifetimeXp._sum.amount ?? 0,
        activeRules,
        customRules,
        activeRewards,
        rewardClaims: claims,
      },
      moderation: {
        openReports: reports.OPEN ?? 0,
        reviewedReports: (reports.REVIEWED ?? 0) + (reports.ACTIONED ?? 0) + (reports.DISMISSED ?? 0),
        hiddenPosts,
      },
    };
  }
}
