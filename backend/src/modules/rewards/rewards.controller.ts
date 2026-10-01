import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { RewardsService, type RewardView } from './rewards.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  /** Season reward catalog with the user's eligibility + claim status. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<RewardView[]> {
    return this.rewards.list(user.userId, user.role);
  }

  /** Claim a reward the user is eligible for (once per season). */
  @HttpCode(HttpStatus.OK)
  @Post(':id/claim')
  claim(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rewards.claim(user.userId, user.role, id);
  }
}
