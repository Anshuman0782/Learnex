import { Module } from '@nestjs/common';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { RewardsService } from './rewards.service.js';
import { RewardsController } from './rewards.controller.js';

@Module({
  imports: [SeasonsModule],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
