import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Season, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { seasonWindow } from '../gamification/leveling.js';
import { skillKey } from '../../common/utils/skill.js';

export interface StandingRow {
  userId: string;
  xp: number;
  rank: number;
}

interface Window {
  startsAt: Date;
  endsAt: Date;
}

@Injectable()
export class SeasonService {
  private readonly logger = new Logger(SeasonService.name);
  /** Season number whose predecessors we've already finalized (in-process memo). */
  private finalizedUpTo = 0;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureSeason(w: { number: number; startsAt: Date; endsAt: Date }): Promise<Season> {
    const existing = await this.prisma.season.findUnique({ where: { number: w.number } });
    if (existing) return existing;
    try {
      return await this.prisma.season.create({
        data: { number: w.number, title: `Season ${w.number}`, startsAt: w.startsAt, endsAt: w.endsAt },
      });
    } catch {
      // Race: another request created it first.
      return this.prisma.season.findUniqueOrThrow({ where: { number: w.number } });
    }
  }

  /**
   * The season covering "now" (created lazily). The first call in a new month
   * also locks the previous season's final standings.
   */
  async ensureCurrentSeason(): Promise<Season> {
    const w = seasonWindow();
    const season = await this.ensureSeason(w);
    if (this.finalizedUpTo < w.number) {
      try {
        await this.finalizePastSeasons();
        this.finalizedUpTo = w.number;
      } catch (e) {
        this.logger.warn(`Season finalization failed, will retry: ${(e as Error).message}`);
      }
    }
    return season;
  }

  /**
   * Canonical season ranking: users ordered by XP earned inside the window,
   * highest first; ties go to whoever reached their score first. Users with no
   * positive XP in the window aren't ranked. Optional role/hobby filters.
   */
  async standings(
    window: Window,
    filter: { role?: UserRole; category?: string } = {},
  ): Promise<StandingRow[]> {
    // A member can be a Learner in one skill and a Mentor in another, so a board
    // counts the XP that was EARNED in that role (and skill), not the account.
    const where: Prisma.XpEventWhereInput = {
      createdAt: { gte: window.startsAt, lt: window.endsAt },
      user: { deletedAt: null },
    };
    if (filter.role === UserRole.MENTOR) where.role = 'Mentor';
    else if (filter.role === UserRole.LEARNER) where.role = 'Learner';
    if (filter.category && filter.category !== 'All') where.skill = skillKey(filter.category);

    const sums = await this.prisma.xpEvent.groupBy({
      by: ['userId'],
      where,
      _sum: { amount: true },
      _max: { createdAt: true },
    });

    return sums
      .map((s) => ({
        userId: s.userId,
        xp: s._sum.amount ?? 0,
        reachedAt: s._max.createdAt?.getTime() ?? 0,
      }))
      .filter((r) => r.xp > 0)
      .sort((a, b) => b.xp - a.xp || a.reachedAt - b.reachedAt)
      .map((r, i) => ({ userId: r.userId, xp: r.xp, rank: i + 1 }));
  }

  /** Current-season standings. */
  async currentStandings(filter: { role?: UserRole; category?: string } = {}): Promise<StandingRow[]> {
    const season = await this.ensureCurrentSeason();
    return this.standings(season, filter);
  }

  /**
   * Snapshot the final Learner and Mentor standings of every season that has
   * ended but isn't finalized yet. Idempotent and safe under concurrency.
   */
  async finalizePastSeasons(): Promise<void> {
    const now = new Date();

    // Make sure last month has a Season row if anyone earned XP in it (seasons are
    // otherwise only created when someone opens the app during that month).
    const prev = seasonWindow(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)));
    const hadActivity = await this.prisma.xpEvent.findFirst({
      where: { createdAt: { gte: prev.startsAt, lt: prev.endsAt } },
      select: { id: true },
    });
    if (hadActivity) await this.ensureSeason(prev);

    const pending = await this.prisma.season.findMany({
      where: { endsAt: { lte: now }, finalizedAt: null },
      orderBy: { number: 'asc' },
    });

    for (const season of pending) {
      const [learners, mentors] = await Promise.all([
        this.standings(season, { role: UserRole.LEARNER }),
        this.standings(season, { role: UserRole.MENTOR }),
      ]);
      const rows: Prisma.SeasonStandingCreateManyInput[] = [
        ...learners.map((r) => ({ seasonId: season.id, userId: r.userId, role: 'Learner', rank: r.rank, xp: r.xp })),
        ...mentors.map((r) => ({ seasonId: season.id, userId: r.userId, role: 'Mentor', rank: r.rank, xp: r.xp })),
      ];
      if (rows.length > 0) {
        await this.prisma.seasonStanding.createMany({ data: rows, skipDuplicates: true });
      }
      await this.prisma.season.updateMany({
        where: { id: season.id, finalizedAt: null },
        data: { finalizedAt: now },
      });
      this.logger.log(`Finalized Season ${season.number}: ${rows.length} standings saved.`);
    }
  }

  /** Info card for the current season (all values real). */
  async getCurrentSeasonInfo() {
    const season = await this.ensureCurrentSeason();
    const daysLeft = Math.max(0, Math.ceil((season.endsAt.getTime() - Date.now()) / 86400000));
    const monthLabel = season.startsAt.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const participants = await this.prisma.xpEvent.findMany({
      where: { createdAt: { gte: season.startsAt, lt: season.endsAt } },
      distinct: ['userId'],
      select: { userId: true },
    });
    const count = participants.length;

    return {
      id: season.id,
      seasonNumber: season.number,
      title: `Season ${season.number} · ${monthLabel}`,
      subtitle: 'Earn XP this month to climb your leaderboard. Rankings reset on the 1st.',
      daysLeft,
      startsAt: season.startsAt.toISOString(),
      endsAt: season.endsAt.toISOString(),
      endsAtDate: season.endsAt.toISOString().slice(0, 10),
      participantsCount: count,
      activeParticipants: `${count} active ${count === 1 ? 'member' : 'members'}`,
      totalPrizePool: '',
    };
  }
}
