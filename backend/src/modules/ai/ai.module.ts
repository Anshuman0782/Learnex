import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { AdminGuard } from '../admin/admin.guard.js';
import { AiController, AiAdminController } from './ai.controller.js';
import { AiRouterService } from './ai-router.service.js';
import { AiQueueService } from './ai-queue.service.js';
import { AiJudgeService } from './ai-judge.service.js';
import { AiReviewService } from './ai-review.service.js';
import { MentorTestService } from './mentor-test.service.js';

/**
 * AI Stage 1: Learner Progress + AI Mentor Test for Coding, Music and Spoken
 * English. Gemini (free) is the main judge, Groq (free) the backup, and our
 * own pitch / speech measurements always run. Everything is background work.
 */
@Module({
  imports: [RealtimeModule, NotificationsModule, OnboardingModule],
  controllers: [AiController, AiAdminController],
  providers: [AdminGuard, AiRouterService, AiQueueService, AiJudgeService, AiReviewService, MentorTestService],
  exports: [AiReviewService],
})
export class AiModule {}
