import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Goal, UserRole, XpSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SeasonService } from '../seasons/season.service.js';
import { XpService } from './xp.service.js';
import {
  levelInfo,
  levelTiers,
  seasonWindow,
  startOfUtcDay,
  startOfIsoWeek,
  utcDay,
  isoWeek,
  daysAgoUtc,
} from './leveling.js';
import { QUEST_DEFS, BADGE_DEFS, type QuestMeasure } from './quests.js';
import { SEASON_RULES, FAIR_PLAY_RULES } from './xp-rules.js';
import { SaveGoalDto } from './dto/save-goal.dto.js';

/** Human label for each ledger source (XP activity history). */
const SOURCE_LABEL: Record<XpSource, string> = {
  SESSION: 'Logged a practice session',
  POST: 'Published a post',
  CRITIQUE_RECEIVED: 'Received a mentor critique',
  CRITIQUE_GIVEN: 'Gave a critique',
  DAILY_CHECKIN: 'Daily check-in',
  GOAL_COMPLETE: 'Completed a goal',
  QUEST: 'Quest reward',
  STREAK_MILESTONE: 'Streak milestone',
  EVENT: 'Circle event completed',
  COMMENT: 'Commented on a post',
  LIKE_RECEIVED: 'Your post got a like',
  ADMIN_ADJUSTMENT: 'Adjustment by the LERNEX team',
  CUSTOM_RULE: 'Bonus XP',
};

const SOURCE_ICON: Record<XpSource, string> = {
  CUSTOM_RULE: 'gift-outline',
  SESSION: 'timer-outline',
  POST: 'cloud-upload-outline',
  CRITIQUE_RECEIVED: 'ribbon-outline',
  CRITIQUE_GIVEN: 'ribbon',
  DAILY_CHECKIN: 'calendar-outline',
  GOAL_COMPLETE: 'flag',
  QUEST: 'flash',
  STREAK_MILESTONE: 'flame',
  EVENT: 'people',
  COMMENT: 'chatbubble-outline',
  LIKE_RECEIVED: 'heart',
  ADMIN_ADJUSTMENT: 'shield-checkmark-outline',
};

const roleLabelOf = (role: UserRole | null): 'Learner' | 'Mentor' =>
  role === UserRole.MENTOR ? 'Mentor' : 'Learner';

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly seasons: SeasonService,
  ) {}

  // ---------- STATS ----------

  async getStats(userId: string, role: UserRole | null) {
    const [xp, streak, goal, ratingAgg, badgeRows] = await Promise.all([
      this.xp.totalXp(userId),
      this.prisma.streak.findUnique({ where: { userId } }),
      this.activeGoalRow(userId),
      this.prisma.comment.aggregate({
        where: {
          post: { authorId: userId },
          isMentorCritique: true,
          mentorRating: { not: null },
          deletedAt: null,
        },
        _avg: { mentorRating: true },
        _count: { mentorRating: true },
      }),
      this.prisma.badge.findMany({ where: { userId }, orderBy: { awardedAt: 'desc' } }),
    ]);

    const info = levelInfo(xp);
    const avgRating = ratingAgg._avg.mentorRating ?? 0;
    const ratingCount = ratingAgg._count.mentorRating;
    const accuracyRate = avgRating ? Math.round(avgRating * 20) : 0;

    // Lazily award milestone badges that depend on aggregate state.
    if (info.level >= 5) await this.xp.awardBadge(userId, 'level_5');
    if (avgRating >= 4.5 && ratingCount >= 5) await this.xp.awardBadge(userId, 'top_rated');

    const activeDays = await this.activeDaysThisWeek(userId);
    const consistencyRate =
      goal && goal.targetSessions > 0
        ? Math.min(100, Math.round((goal.completedSessions / goal.targetSessions) * 100))
        : Math.round((activeDays / 7) * 100);

    const critiquesCompleted =
      role === UserRole.MENTOR
        ? await this.prisma.comment.count({
            where: {
              authorId: userId,
              isMentorCritique: true,
              deletedAt: null,
              post: { authorId: { not: userId } },
            },
          })
        : await this.prisma.comment.count({
            where: { post: { authorId: userId }, isMentorCritique: true, deletedAt: null },
          });

    const improvementTrend = await this.improvementTrend(userId);

    // Season (monthly) standing on the user's own leaderboard (Learner / Mentor).
    const season = await this.seasons.ensureCurrentSeason();
    const [seasonXp, standings, lastStanding] = await Promise.all([
      this.xp.seasonXp(userId),
      role ? this.seasons.standings(season, { role }) : Promise.resolve([]),
      this.prisma.seasonStanding.findFirst({
        where: { userId },
        orderBy: { season: { number: 'desc' } },
        include: { season: { select: { number: true } } },
      }),
    ]);
    const myStanding = standings.find((s) => s.userId === userId);

    // Re-fetch badges in case we just awarded new ones above.
    const finalBadgeRows =
      info.level >= 5 || (avgRating >= 4.5 && ratingCount >= 5)
        ? await this.prisma.badge.findMany({ where: { userId }, orderBy: { awardedAt: 'desc' } })
        : badgeRows;

    const badges = finalBadgeRows
      .map((b) => {
        const def = BADGE_DEFS[b.code];
        return def
          ? { id: b.id, title: def.title, icon: def.icon, bgColor: def.bgColor, color: def.color }
          : null;
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    return {
      weeklyTargetSessions: goal?.targetSessions ?? 5,
      completedTargetSessions: goal?.completedSessions ?? 0,
      weeklyTargetHours: goal?.targetHours ?? 4,
      completedTargetHours: goal ? Math.round((goal.completedMinutes / 60) * 10) / 10 : 0,
      streakDays: streak?.current ?? 0,
      longestStreak: streak?.longest ?? 0,
      // Lifetime XP → Level (never resets).
      xpPoints: xp,
      levelBadge: info.title,
      level: info.level,
      xpIntoLevel: info.xpIntoLevel,
      xpForNextLevel: info.xpForNextLevel,
      // Season XP → ranking (resets every month).
      seasonNumber: season.number,
      seasonEndsAt: season.endsAt.toISOString(),
      seasonXp,
      seasonRank: myStanding?.rank ?? 0,
      seasonRankTotal: standings.length,
      seasonBoard: roleLabelOf(role),
      lastSeason: lastStanding
        ? {
            seasonNumber: lastStanding.season.number,
            rank: lastStanding.rank,
            xp: lastStanding.xp,
            board: lastStanding.role,
          }
        : null,
      accuracyRate,
      consistencyRate,
      critiquesCompleted,
      improvementTrend,
      badges,
    };
  }

  private async improvementTrend(userId: string): Promise<string> {
    const [last30, prev30] = await Promise.all([
      this.prisma.xpEvent.aggregate({
        where: { userId, createdAt: { gte: daysAgoUtc(30) } },
        _sum: { amount: true },
      }),
      this.prisma.xpEvent.aggregate({
        where: { userId, createdAt: { gte: daysAgoUtc(60), lt: daysAgoUtc(30) } },
        _sum: { amount: true },
      }),
    ]);
    const recent = last30._sum.amount ?? 0;
    const prior = prev30._sum.amount ?? 0;
    if (prior === 0) {
      return recent > 0 ? '+100% this month' : 'No activity yet';
    }
    const pct = Math.round(((recent - prior) / prior) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}% this month`;
  }

  // ---------- GOALS ----------

  private activeGoalRow(userId: string): Promise<Goal | null> {
    return this.prisma.goal.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private mapGoal(goal: Goal | null) {
    if (!goal) return null;
    return {
      id: goal.id,
      title: goal.title,
      targetSessions: goal.targetSessions,
      targetHours: goal.targetHours,
      targetDate: goal.targetDate ?? '',
      completedSessions: goal.completedSessions,
      dailyReminders: goal.dailyReminders,
    };
  }

  async getActiveGoal(userId: string) {
    return this.mapGoal(await this.activeGoalRow(userId));
  }

  /** Create or update the user's single active goal. */
  async saveGoal(userId: string, dto: SaveGoalDto) {
    const existing = await this.activeGoalRow(userId);
    if (existing) {
      const updated = await this.prisma.goal.update({
        where: { id: existing.id },
        data: {
          title: dto.title ?? existing.title,
          targetSessions: dto.targetSessions ?? existing.targetSessions,
          targetHours: dto.targetHours ?? existing.targetHours,
          targetDate: dto.targetDate ?? existing.targetDate,
          dailyReminders: dto.dailyReminders ?? existing.dailyReminders,
        },
      });
      return this.mapGoal(updated);
    }
    const created = await this.prisma.goal.create({
      data: {
        userId,
        title: dto.title ?? 'Practice Goal',
        targetSessions: dto.targetSessions ?? 5,
        targetHours: dto.targetHours ?? 4,
        targetDate: dto.targetDate,
        dailyReminders: dto.dailyReminders ?? true,
      },
    });
    return this.mapGoal(created);
  }

  /**
   * Daily check-in: marks the user active today (advances/creates their streak,
   * grants once-per-day XP, awards milestones — idempotent per day) and returns
   * the refreshed stats. Called by the app on launch so the streak is a real
   * "consecutive days you used the app" counter.
   */
  async checkIn(userId: string, role: UserRole | null) {
    await this.xp.recordActivity(userId);
    return this.getStats(userId, role);
  }

  /** Log a practice session — advances the goal, streak and XP. */
  async logSession(userId: string, minutes: number) {
    const goal = await this.activeGoalRow(userId);
    await this.prisma.practiceSession.create({
      data: { userId, goalId: goal?.id, minutes },
    });

    const awardedXp = await this.xp.onSessionLogged(userId);

    let updatedGoal = goal;
    if (goal) {
      updatedGoal = await this.prisma.goal.update({
        where: { id: goal.id },
        data: {
          completedSessions: { increment: 1 },
          completedMinutes: { increment: minutes },
        },
      });

      // Goal reached → milestone XP + badge (once).
      if (
        updatedGoal.completedSessions >= updatedGoal.targetSessions &&
        !updatedGoal.completedAt
      ) {
        await this.xp.onGoalCompleted(userId, goal.id);
        updatedGoal = await this.prisma.goal.update({
          where: { id: goal.id },
          data: { completedAt: new Date() },
        });
      }
    }

    return { goal: this.mapGoal(updatedGoal), awardedXp };
  }

  // ---------- QUESTS ----------

  private async measures(userId: string): Promise<Record<QuestMeasure, number>> {
    const dayStart = startOfUtcDay();
    const weekStart = startOfIsoWeek();

    // Count real activity (not XP rows — several rules may pay for one action).
    const publicPosts = (since: Date) =>
      this.prisma.post.count({
        where: { authorId: userId, isPrivate: false, deletedAt: null, createdAt: { gte: since } },
      });
    const critiquesGiven = (since: Date) =>
      this.prisma.comment.count({
        where: {
          authorId: userId,
          isMentorCritique: true,
          deletedAt: null,
          createdAt: { gte: since },
          post: { authorId: { not: userId } },
        },
      });

    const [sessionsToday, postsToday, critToday, postsWeek, critWeek, activeDays] =
      await Promise.all([
        this.prisma.practiceSession.count({ where: { userId, createdAt: { gte: dayStart } } }),
        publicPosts(dayStart),
        critiquesGiven(dayStart),
        publicPosts(weekStart),
        critiquesGiven(weekStart),
        this.activeDaysThisWeek(userId),
      ]);

    return {
      sessions_today: sessionsToday,
      posts_today: postsToday,
      critiques_given_today: critToday,
      posts_week: postsWeek,
      critiques_given_week: critWeek,
      active_days_week: activeDays,
    };
  }

  private async activeDaysThisWeek(userId: string): Promise<number> {
    const rows = await this.prisma.xpEvent.findMany({
      where: {
        userId,
        // Real work only (not check-ins or likes): practice, posting, mentoring.
        source: { in: [XpSource.SESSION, XpSource.POST, XpSource.CRITIQUE_GIVEN] },
        createdAt: { gte: startOfIsoWeek() },
      },
      select: { createdAt: true },
    });
    return new Set(rows.map((r) => utcDay(r.createdAt))).size;
  }

  async getQuests(userId: string, role: UserRole | null) {
    const roleLabel = role === UserRole.MENTOR ? 'Mentor' : 'Learner';
    const defs = QUEST_DEFS.filter((q) => q.role === roleLabel);
    const values = await this.measures(userId);

    const periodsToday = utcDay();
    const periodsWeek = isoWeek();

    const claims = await this.prisma.questClaim.findMany({
      where: {
        userId,
        OR: [
          { questId: { in: defs.map((d) => d.id) }, period: periodsToday },
          { questId: { in: defs.map((d) => d.id) }, period: periodsWeek },
        ],
      },
    });
    const claimedSet = new Set(claims.map((c) => `${c.questId}:${c.period}`));

    return defs.map((def) => {
      const period = def.category === 'daily' ? periodsToday : periodsWeek;
      const progress = Math.min(values[def.measure], def.target);
      const complete = values[def.measure] >= def.target;
      const claimed = claimedSet.has(`${def.id}:${period}`);
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        xpReward: def.xpReward,
        role: def.role,
        category: def.category,
        icon: def.icon,
        iconBg: def.iconBg,
        iconColor: def.iconColor,
        progress: { current: progress, total: def.target, unit: this.unitFor(def.measure) },
        completed: claimed,
        claimable: complete && !claimed,
      };
    });
  }

  private unitFor(measure: QuestMeasure): string {
    switch (measure) {
      case 'sessions_today':
        return 'session';
      case 'posts_today':
      case 'posts_week':
        return 'clip';
      case 'critiques_given_today':
      case 'critiques_given_week':
        return 'critique';
      case 'active_days_week':
        return 'days';
    }
  }

  async claimQuest(userId: string, role: UserRole | null, questId: string) {
    const roleLabel = role === UserRole.MENTOR ? 'Mentor' : 'Learner';
    const def = QUEST_DEFS.find((q) => q.id === questId && q.role === roleLabel);
    if (!def) throw new NotFoundException('Quest not found');

    const values = await this.measures(userId);
    if (values[def.measure] < def.target) {
      throw new BadRequestException('Quest is not complete yet');
    }

    const period = def.category === 'daily' ? utcDay() : isoWeek();
    try {
      await this.prisma.questClaim.create({ data: { userId, questId, period } });
    } catch {
      throw new ConflictException('Quest already claimed for this period');
    }

    await this.xp.award(userId, XpSource.QUEST, def.xpReward, `quest:${questId}:${period}`);
    const quests = await this.getQuests(userId, role);
    return { earnedXP: def.xpReward, taskTitle: def.title, quests };
  }

  // ---------- RULES ----------

  /**
   * The complete, live rulebook: how seasons work, every active XP rule (with its
   * current value and daily limit), all quests for both roles, level tiers and
   * the fair-play policy. Everything here is what the server actually enforces.
   */
  async getRules() {
    const season = await this.seasons.ensureCurrentSeason();
    const rules = await this.xp.getRules();

    return {
      season: {
        number: season.number,
        startsAt: season.startsAt.toISOString(),
        endsAt: season.endsAt.toISOString(),
        daysLeft: Math.max(0, Math.ceil((season.endsAt.getTime() - Date.now()) / 86400000)),
      },
      seasonRules: SEASON_RULES,
      rules: rules
        .filter((r) => r.isActive)
        .map((r) => ({
          key: r.key,
          trigger: r.trigger,
          title: r.title,
          description: r.description,
          role: r.role,
          category: r.category,
          xp: r.xp,
          dailyCap: r.dailyCap,
          isCore: r.isCore,
        })),
      quests: QUEST_DEFS.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        role: q.role,
        category: q.category,
        xpReward: q.xpReward,
        target: q.target,
      })),
      levels: levelTiers(),
      fairPlay: FAIR_PLAY_RULES,
    };
  }

  // ---------- XP HISTORY ----------

  /** The user's most recent XP ledger entries, labelled for display. */
  async getXpHistory(userId: string, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 100);
    const { startsAt } = seasonWindow();
    const rows = await this.prisma.xpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const rules = new Map((await this.xp.getRules()).map((x) => [x.key, x]));

    return rows.map((r) => {
      let label = SOURCE_LABEL[r.source];
      // Admin-created rules have no built-in wording, so show their own title.
      const rule = r.source === XpSource.CUSTOM_RULE && r.ruleKey ? rules.get(r.ruleKey) : undefined;
      if (rule) {
        label = rule.title;
      } else if (r.source === XpSource.QUEST && r.dedupeKey) {
        const questId = r.dedupeKey.split(':')[1];
        const quest = QUEST_DEFS.find((q) => q.id === questId);
        if (quest) label = `Quest: ${quest.title}`;
      } else if (r.source === XpSource.STREAK_MILESTONE && r.dedupeKey) {
        const days = r.dedupeKey.split(':')[2];
        if (days) label = `${days}-day streak milestone`;
      }
      return {
        id: r.id,
        source: r.source,
        label,
        icon: SOURCE_ICON[r.source],
        amount: r.amount,
        createdAt: r.createdAt.toISOString(),
        thisSeason: r.createdAt >= startsAt,
      };
    });
  }
}
