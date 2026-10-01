import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller.js';
import { CommentsController } from './comments.controller.js';
import { PostsService } from './posts.service.js';
import { GamificationModule } from '../gamification/gamification.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [GamificationModule, RealtimeModule, NotificationsModule],
  controllers: [PostsController, CommentsController],
  providers: [PostsService],
})
export class PostsModule {}
