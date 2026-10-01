import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { GamificationModule } from '../gamification/gamification.module.js';
import { FollowService } from './follow.service.js';
import { FollowController } from './follow.controller.js';

@Module({
  imports: [NotificationsModule, GamificationModule],
  controllers: [FollowController],
  providers: [FollowService],
})
export class FollowModule {}
