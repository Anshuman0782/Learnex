import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { GamificationService } from './gamification.service.js';
import { SaveGoalDto } from './dto/save-goal.dto.js';
import { LogSessionDto } from './dto/log-session.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  /** Real personal stats for the dashboard. */
  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.getStats(user.userId, user.role);
  }

  /** The live rulebook: season rules, XP rules, quests, levels, fair play. */
  @Get('rules')
  rules() {
    return this.gamification.getRules();
  }

  /** The current user's recent XP activity. */
  @Get('history')
  history(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const n = Number.parseInt(limit ?? '', 10);
    return this.gamification.getXpHistory(user.userId, Number.isFinite(n) ? n : 30);
  }

  /** Daily check-in — advances the streak and returns fresh stats. */
  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  checkIn(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.checkIn(user.userId, user.role);
  }

  /** The user's active practice goal (or null). */
  @Get('goal')
  goal(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.getActiveGoal(user.userId);
  }

  /** Create or update the active goal. */
  @Post('goal')
  @HttpCode(HttpStatus.OK)
  saveGoal(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveGoalDto) {
    return this.gamification.saveGoal(user.userId, dto);
  }

  /** Log a practice session. */
  @Post('sessions')
  logSession(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogSessionDto) {
    return this.gamification.logSession(user.userId, dto.minutes ?? 30);
  }

  /** Daily/weekly quests with real progress for the current period. */
  @Get('quests')
  quests(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.getQuests(user.userId, user.role);
  }

  /** Claim a completed quest (awards XP once per period). */
  @Post('quests/:id/claim')
  @HttpCode(HttpStatus.OK)
  claim(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.gamification.claimQuest(user.userId, user.role, id);
  }
}
