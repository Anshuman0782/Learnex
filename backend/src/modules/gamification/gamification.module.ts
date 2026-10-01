import { Module } from '@nestjs/common';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { GamificationController } from './gamification.controller.js';
import { GamificationService } from './gamification.service.js';
import { XpService } from './xp.service.js';

/**
 * The XP engine. XpService is exported so feature modules (e.g. posts) can award
 * XP when real actions happen, without duplicating the economy rules.
 */
@Module({
  imports: [SeasonsModule],
  controllers: [GamificationController],
  providers: [GamificationService, XpService],
  exports: [XpService],
})
export class GamificationModule {}
