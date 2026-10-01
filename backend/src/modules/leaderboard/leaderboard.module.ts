import { Module } from '@nestjs/common';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { LeaderboardService } from './leaderboard.service.js';
import { LeaderboardController } from './leaderboard.controller.js';

@Module({
  imports: [SeasonsModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
