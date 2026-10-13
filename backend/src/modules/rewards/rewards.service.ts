import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SeasonService } from '../seasons/season.service.js';

export interface RewardView {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  tag: string;
  targetRole: string;
  minRank: number;
  minRankRequired: string;
  perks: string[];
  gradientColors: [string, string];
  /** Claimable now: earned from the last finished season's locked standings. */
  eligible: boolean;
  /** Current season: the user is currently ranked inside this reward's range. */
  onTrack: boolean;
  claimed: boolean;
  claimedCode?: string;
  /** The finished season this reward can be claimed for (if any). */
  earnedSeasonNumber?: number;
}

/** "Top 10 Learners" / "Top 3 Mentors" / "Top 5 on your board". */
export function rankLabel(minRank: number, targetRole: string): string {
  if (targetRole === 'Learner') return `Top ${minRank} Learners`;
  if (targetRole === 'Mentor') return `Top ${minRank} Mentors`;
  return `Top ${minRank} on your board`;
}

/**
 * Season rewards. Rewards are earned from a season's FINAL (locked) standings,
 * so they're claimed after the month ends, once per season. During the month the
 * app shows whether the user is currently on track for each reward.
 */
@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasons: SeasonService,
  ) {}

  private boardOf(role: UserRole | null): 'Learner' | 'Mentor' | null {
    return role === UserRole.MENTOR ? 'Mentor' : role === UserRole.LEARNER ? 'Learner' : null;
  }

  private appliesTo(targetRole: string, board: string | null): boolean {
    return !!board && (targetRole === 'Both' || targetRole === board);
  }

  /**
   * The most recent finished season and the user's locked standings in it — one
   * per board they were ranked on (a member can be on both Learner and Mentor).
   */
  private async lastFinished(userId: string) {
    const season = await this.prisma.season.findFirst({
      where: { finalizedAt: { not: null } },
      orderBy: { number: 'desc' },
    });
    if (!season) return { season: null, standings: [] };
    const standings = await this.prisma.seasonStanding.findMany({
      where: { seasonId: season.id, userId },
    });
    return { season, standings };
  }

  /** Did any of the user's final standings earn this reward? */
  private earnedBy(
    reward: { targetRole: string; minRank: number },
    standings: { role: string; rank: number }[],
  ): boolean {
    return standings.some((s) => this.appliesTo(reward.targetRole, s.role) && s.rank <= reward.minRank);
  }

  async list(userId: string, role: UserRole | null): Promise<RewardView[]> {
    const ranked = !!this.boardOf(role); // guests / new accounts aren't on any board
    const current = await this.seasons.ensureCurrentSeason();
    const [rewards, learners, mentors, last] = await Promise.all([
      this.prisma.seasonReward.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      ranked ? this.seasons.standings(current, { role: UserRole.LEARNER }) : Promise.resolve([]),
      ranked ? this.seasons.standings(current, { role: UserRole.MENTOR }) : Promise.resolve([]),
      this.lastFinished(userId),
    ]);
    // Where the user stands right now on each board they earn XP on.
    const live = [
      { role: 'Learner', rank: learners.find((s) => s.userId === userId)?.rank ?? 0 },
      { role: 'Mentor', rank: mentors.find((s) => s.userId === userId)?.rank ?? 0 },
    ].filter((s) => s.rank > 0);
    const claims = last.season
      ? await this.prisma.rewardClaim.findMany({ where: { userId, seasonId: last.season.id } })
      : [];
    const claimMap = new Map(claims.map((c) => [c.rewardId, c]));

    return rewards.map((r) => {
      const claim = claimMap.get(r.id);
      const earned = this.earnedBy(r, last.standings);
      return {
        id: r.id,
        type: r.type,
        title: r.title,
        subtitle: r.subtitle,
        description: r.description,
        icon: r.icon,
        tag: r.tag,
        targetRole: r.targetRole,
        minRank: r.minRank,
        minRankRequired: r.minRankLabel,
        perks: r.perks as string[],
        gradientColors: r.gradientColors as [string, string],
        eligible: earned && !claim,
        onTrack: this.earnedBy(r, live),
        claimed: !!claim,
        claimedCode: claim?.code,
        earnedSeasonNumber: earned ? last.season?.number : undefined,
      };
    });
  }

  async claim(userId: string, _role: UserRole | null, rewardId: string) {
    const reward = await this.prisma.seasonReward.findUnique({ where: { id: rewardId } });
    if (!reward || !reward.isActive) throw new NotFoundException('Reward not found');

    const { season, standings } = await this.lastFinished(userId);
    if (!season || !this.earnedBy(reward, standings)) {
      throw new BadRequestException(
        'This reward is earned from a finished season’s final rank. Finish inside its range to claim it.',
      );
    }

    const prefix = (reward.sampleCode || reward.type || 'LRNX').replace(/[^A-Z0-9-]/gi, '').toUpperCase() || 'LRNX';
    const code = `${prefix}-${randomBytes(3).toString('hex').toUpperCase()}`;

    try {
      await this.prisma.rewardClaim.create({
        data: { userId, rewardId, seasonId: season.id, code },
      });
    } catch {
      throw new ConflictException('Reward already claimed for this season');
    }

    return { rewardId, title: reward.title, code };
  }
}
