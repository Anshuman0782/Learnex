import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService, type LeaderboardEntry } from './leaderboard.service.js';
import { SeasonService } from '../seasons/season.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller()
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly seasons: SeasonService,
  ) {}

  /** Ranking by season XP. ?role=Learner|Mentor, optional ?category=Music. */
  @Get('leaderboard')
  getLeaderboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('role') role?: string,
    @Query('category') category?: string,
  ): Promise<LeaderboardEntry[]> {
    const roleLabel = role === 'Mentor' ? 'Mentor' : 'Learner';
    return this.leaderboard.getLeaderboard(user.userId, { role: roleLabel, category });
  }

  /** Hobby categories that real members have (for the ranking filter chips). */
  @Get('leaderboard/categories')
  categories(): Promise<string[]> {
    return this.leaderboard.categories();
  }

  /** Current season info card. */
  @Get('seasons/current')
  currentSeason() {
    return this.seasons.getCurrentSeasonInfo();
  }
}
