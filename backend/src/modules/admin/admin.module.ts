import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AdminAccessService } from './admin-access.service.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AdminEconomyService } from './admin-economy.service.js';
import { AdminBroadcastService } from './admin-broadcast.service.js';
import { PushModule } from '../push/push.module.js';

/** Admin Panel: access management, statistics, XP rules and rewards. */
@Module({
  imports: [GamificationModule, RealtimeModule, PushModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminAccessService, AdminStatsService, AdminEconomyService, AdminBroadcastService],
})
export class AdminModule {}
