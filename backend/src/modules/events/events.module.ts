import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { EventsService } from './events.service.js';
import { EventsController } from './events.controller.js';

@Module({
  imports: [GamificationModule, RealtimeModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
