import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, UserRole, XpRule, XpSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { startOfUtcDay, utcDay, dayDiff, seasonWindow } from './leveling.js';
import { XP_RULE_DEFS, XP_RULE_DEF_BY_KEY, type XpTrigger } from './xp-rules.js';

/** Streak lengths that fire a milestone trigger. */
const STREAK_TRIGGERS: Record<number, XpTrigger> = {
  7: 'streak.7',
  30: 'streak.30',
  100: 'streak.100',
};

const RULE_CACHE_MS = 30_000;

export type PostKind = 'video' | 'reel' | 'audio' | 'photo' | 'discussion';

@Injectable()
export class XpService implements OnModuleInit {
  private rules = new Map<string, XpRule>();
  private rulesLoadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureRules();
  }

  // ---------- rule table ----------

  /**
   * Makes sure every built-in rule exists. Core rules are re-asserted from code
   * (values can't drift). Tunable built-ins get their defaults only when first
   * created, so an admin's later edits (xp / cap / on-off / text / role) are kept.
   * The trigger of a built-in rule is always fixed by code.
   */
  async ensureRules(): Promise<void> {
    for (const def of XP_RULE_DEFS) {
      const fixed = { trigger: def.trigger, isCore: def.isCore, sortOrder: def.sortOrder };
      const defaults = {
        title: def.title,
        description: def.description,
        role: def.role,
        category: def.category,
        xp: def.xp,
        dailyCap: def.dailyCap,
      };
      await this.prisma.xpRule.upsert({
        where: { key: def.key },
        create: { key: def.key, ...fixed, ...defaults, isActive: true },
        update: def.isCore ? { ...fixed, ...defaults, isActive: true } : fixed,
      });
    }
    this.invalidateRules();
  }

  /** Drop the cache so the next read sees fresh values (called after admin edits). */
  invalidateRules(): void {
    this.rulesLoadedAt = 0;
  }

  /** All rules, ordered for display. Cached briefly — awards happen on hot paths. */
  async getRules(): Promise<XpRule[]> {
    if (Date.now() - this.rulesLoadedAt > RULE_CACHE_MS) {
      const rows = await this.prisma.xpRule.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] });
      this.rules = new Map(rows.map((r) => [r.key, r]));
      this.rulesLoadedAt = Date.now();
    }
    return [...this.rules.values()];
  }

  // ---------- awarding ----------

  /**
   * Fire an app event. Every active rule listening to `trigger` that applies to
   * the user's role pays out, respecting each rule's daily cap. `dedupeBase`
   * makes it idempotent per rule (e.g. the post id). Returns total XP granted.
   */
  async trigger(userId: string, trigger: XpTrigger, dedupeBase?: string): Promise<number> {
    const rules = (await this.getRules()).filter(
      (r) => r.isActive && r.trigger === trigger && r.xp > 0,
    );
    if (rules.length === 0) return 0;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return 0;
    const role = user.role === UserRole.MENTOR ? 'Mentor' : user.role === UserRole.LEARNER ? 'Learner' : null;

    let total = 0;
    for (const rule of rules) {
      if (rule.role !== 'Both' && rule.role !== role) continue;
      if (rule.dailyCap !== null) {
        const todayCount = await this.prisma.xpEvent.count({
          where: { userId, ruleKey: rule.key, createdAt: { gte: startOfUtcDay() } },
        });
        if (todayCount >= rule.dailyCap) continue;
      }
      const source = XP_RULE_DEF_BY_KEY.get(rule.key as never)?.source ?? XpSource.CUSTOM_RULE;
      total += await this.award(
        userId,
        source,
        rule.xp,
        dedupeBase ? `${rule.key}:${dedupeBase}` : undefined,
        rule.key,
      );
    }
    return total;
  }

  /**
   * Low-level, idempotent ledger write. Used directly for amounts decided
   * elsewhere (quest and event rewards). Returns 0 if `dedupeKey` was used.
   */
  async award(
    userId: string,
    source: XpSource,
    amount: number,
    dedupeKey?: string,
    ruleKey?: string,
  ): Promise<number> {
    try {
      await this.prisma.xpEvent.create({ data: { userId, source, amount, dedupeKey, ruleKey } });
      return amount;
    } catch (e) {
      // Unique violation on dedupeKey → already awarded; treat as no-op.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return 0;
      }
      throw e;
    }
  }

  /** Lifetime XP (sum of the whole ledger) — drives Level, never resets. */
  async totalXp(userId: string): Promise<number> {
    const agg = await this.prisma.xpEvent.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  /** XP earned in the current season (calendar month) — drives ranking. */
  async seasonXp(userId: string): Promise<number> {
    const { startsAt, endsAt } = seasonWindow();
    const agg = await this.prisma.xpEvent.aggregate({
      where: { userId, createdAt: { gte: startsAt, lt: endsAt } },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  /** Grant a badge once (idempotent). Returns true if newly awarded. */
  async awardBadge(userId: string, code: string): Promise<boolean> {
    try {
      await this.prisma.badge.create({ data: { userId, code } });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return false;
      }
      throw e;
    }
  }

  /**
   * Marks the user active "today": advances/creates their streak, fires the
   * daily check-in, and fires streak milestones (once per season each).
   * Idempotent per day.
   */
  async recordActivity(userId: string): Promise<void> {
    const today = utcDay();
    const streak = await this.prisma.streak.findUnique({ where: { userId } });

    let current: number;
    if (!streak) {
      current = 1;
      await this.prisma.streak.create({
        data: { userId, current: 1, longest: 1, lastActiveDay: today },
      });
    } else if (streak.lastActiveDay === today) {
      current = streak.current; // already counted today
    } else {
      const gap = streak.lastActiveDay ? dayDiff(streak.lastActiveDay, today) : 999;
      current = gap === 1 ? streak.current + 1 : 1;
      await this.prisma.streak.update({
        where: { userId },
        data: {
          current,
          longest: Math.max(streak.longest, current),
          lastActiveDay: today,
        },
      });
    }

    await this.trigger(userId, 'daily.checkin', `${userId}:${today}`);

    const milestone = STREAK_TRIGGERS[current];
    if (milestone) {
      await this.trigger(userId, milestone, `${userId}:s${seasonWindow().number}`);
    }
    if (current >= 7) await this.awardBadge(userId, 'streak_7');
    if (current >= 30) await this.awardBadge(userId, 'streak_30');
  }

  // ---------- activity hooks (called by feature modules) ----------

  /** A user published a public post of the given kind. */
  async onPostCreated(userId: string, postId: string, kind: PostKind): Promise<void> {
    await this.trigger(userId, 'post.published', postId);
    await this.trigger(userId, `${kind}.published` as XpTrigger, postId);
    await this.recordActivity(userId);
    await this.awardBadge(userId, 'first_post');
  }

  /** A practice session was logged. */
  async onSessionLogged(userId: string): Promise<number> {
    const awarded = await this.trigger(userId, 'session.logged');
    await this.recordActivity(userId);
    return awarded;
  }

  /** The user's active goal was completed. */
  async onGoalCompleted(userId: string, goalId: string): Promise<void> {
    await this.trigger(userId, 'goal.completed', goalId);
    await this.awardBadge(userId, 'goal_crusher');
  }

  /**
   * A mentor left a critique; credit both the mentor and the post's author.
   * Critiquing your own post earns nothing.
   */
  async onCritiqueGiven(mentorId: string, postAuthorId: string, commentId: string): Promise<void> {
    if (mentorId === postAuthorId) return;

    await this.trigger(mentorId, 'critique.given', commentId);
    await this.recordActivity(mentorId);
    await this.awardBadge(mentorId, 'first_critique_given');

    await this.trigger(postAuthorId, 'critique.received', commentId);
    await this.awardBadge(postAuthorId, 'first_critique_received');
  }

  /** A regular comment was posted. Commenting on your own post earns nothing. */
  async onCommentPosted(userId: string, postAuthorId: string, commentId: string): Promise<void> {
    if (userId === postAuthorId) return;
    await this.trigger(userId, 'comment.posted', commentId);
  }

  /** Someone liked a post: pays the author once per liker per post. */
  async onLikeReceived(postAuthorId: string, likerId: string, postId: string): Promise<void> {
    if (postAuthorId === likerId) return;
    await this.trigger(postAuthorId, 'like.received', `${postId}:${likerId}`);
  }

  /** Someone reposted a post: pays the author once per reposter per post. */
  async onRepostReceived(postAuthorId: string, reposterId: string, postId: string): Promise<void> {
    if (postAuthorId === reposterId) return;
    await this.trigger(postAuthorId, 'repost.received', `${postId}:${reposterId}`);
  }

  /** Someone followed a user: pays once per follower (unfollow/refollow can't farm). */
  async onFollowerGained(followedId: string, followerId: string): Promise<void> {
    if (followedId === followerId) return;
    await this.trigger(followedId, 'follower.gained', followerId);
  }

  /** A circle event was completed (in addition to the event's own XP reward). */
  async onEventCompleted(userId: string, eventId: string): Promise<void> {
    await this.trigger(userId, 'event.completed', eventId);
  }
}
