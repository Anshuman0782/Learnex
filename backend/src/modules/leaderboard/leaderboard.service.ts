import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SeasonService } from '../seasons/season.service.js';
import { levelInfo } from '../gamification/leveling.js';

interface RankedRow {
  rank: number;
  userId: string;
  seasonXp: number;
  name: string;
  avatarUrl: string | null;
  role: UserRole | null;
  hobby: string | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor';
  rank: number;
  xpPoints: number;
  badge: string;
  specialtyOrHobby: string;
  keyMetricLabel: string;
  keyMetricValue: string;
  isCurrentUser?: boolean;
}

const TOP_N = 20;

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasons: SeasonService,
  ) {}

  /** Users ordered by season XP (canonical ranking), filtered by role and hobby. */
  private async ranking(filter: { role?: UserRole; category?: string }): Promise<RankedRow[]> {
    const standings = await this.seasons.currentStandings(filter);
    if (standings.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: standings.map((s) => s.userId) } },
      select: { id: true, name: true, avatarUrl: true, role: true, hobby: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return standings.flatMap((s) => {
      const u = userMap.get(s.userId);
      if (!u) return [];
      return [
        {
          rank: s.rank,
          userId: s.userId,
          seasonXp: s.xp,
          name: u.name,
          avatarUrl: u.avatarUrl,
          role: u.role,
          hobby: u.hobby,
        },
      ];
    });
  }

  /**
   * Distinct hobby categories among active members (with a role), most common
   * first — so the ranking filter only offers categories that actually exist.
   */
  async categories(): Promise<string[]> {
    const rows = await this.prisma.user.groupBy({
      by: ['hobby'],
      where: { deletedAt: null, role: { not: null }, hobby: { not: null } },
      _count: { _all: true },
    });
    const merged = new Map<string, { label: string; count: number }>();
    for (const r of rows) {
      const label = (r.hobby ?? '').trim();
      if (!label) continue;
      const key = label.toLowerCase(); // "music" and "Music" are one category
      const prev = merged.get(key);
      merged.set(key, { label: prev?.label ?? label, count: (prev?.count ?? 0) + r._count._all });
    }
    return [...merged.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map((c) => c.label);
  }

  /** A user's rank within a scope for reward eligibility (0 = unranked). */
  async rankOf(userId: string, scope: 'overall' | 'learner' | 'mentor'): Promise<number> {
    const role =
      scope === 'learner' ? UserRole.LEARNER : scope === 'mentor' ? UserRole.MENTOR : undefined;
    const rows = await this.ranking({ role });
    return rows.find((r) => r.userId === userId)?.rank ?? 0;
  }

  async getLeaderboard(
    currentUserId: string,
    opts: { role: 'Learner' | 'Mentor'; category?: string },
  ): Promise<LeaderboardEntry[]> {
    const role = opts.role === 'Mentor' ? UserRole.MENTOR : UserRole.LEARNER;
    const rows = await this.ranking({ role, category: opts.category });

    const page = rows.slice(0, TOP_N);
    const me = rows.find((r) => r.userId === currentUserId);
    if (me && !page.some((r) => r.userId === currentUserId)) {
      page.push(me);
    }
    if (page.length === 0) return [];

    const pageIds = page.map((r) => r.userId);

    // Batch enrichment.
    const [streaks, totalSums, critSums] = await Promise.all([
      this.prisma.streak.findMany({ where: { userId: { in: pageIds } } }),
      this.prisma.xpEvent.groupBy({
        by: ['userId'],
        where: { userId: { in: pageIds } },
        _sum: { amount: true },
      }),
      this.prisma.comment.groupBy({
        by: ['authorId'],
        where: { authorId: { in: pageIds }, isMentorCritique: true, deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const streakMap = new Map(streaks.map((s) => [s.userId, s.current]));
    const totalMap = new Map(totalSums.map((s) => [s.userId, s._sum.amount ?? 0]));
    const critMap = new Map(critSums.map((c) => [c.authorId, c._count._all]));

    return page.map((r) => {
      const isMentor = r.role === UserRole.MENTOR;
      const streak = streakMap.get(r.userId) ?? 0;
      const crit = critMap.get(r.userId) ?? 0;
      return {
        id: r.userId,
        name: r.userId === currentUserId ? `${r.name} (You)` : r.name,
        avatarUrl: r.avatarUrl ?? '',
        role: isMentor ? 'Mentor' : 'Learner',
        rank: r.rank,
        xpPoints: r.seasonXp,
        badge: levelInfo(totalMap.get(r.userId) ?? 0).title,
        specialtyOrHobby: r.hobby ?? 'General',
        keyMetricLabel: isMentor ? 'Critiques Delivered' : 'Consistency',
        keyMetricValue: isMentor ? `${crit} critiques` : `${streak}d streak`,
        isCurrentUser: r.userId === currentUserId,
      };
    });
  }
}
