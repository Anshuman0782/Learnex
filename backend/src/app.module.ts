import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OnboardingModule } from './modules/onboarding/onboarding.module.js';
import { CommunitiesModule } from './modules/communities/communities.module.js';
import { SkillsModule } from './modules/skills/skills.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { GamificationModule } from './modules/gamification/gamification.module.js';
import { SeasonsModule } from './modules/seasons/seasons.module.js';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module.js';
import { RewardsModule } from './modules/rewards/rewards.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PushModule } from './modules/push/push.module.js';
import { CallsModule } from './modules/calls/calls.module.js';
import { FollowModule } from './modules/follow/follow.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { UsageModule } from './modules/usage/usage.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { JwtAccessGuard } from './modules/auth/guards/jwt-access.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Global rate limiting baseline: 100 requests / minute per IP.
    // Auth endpoints tighten this further with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    MailModule,

    // Feature modules (one per domain — grows each phase).
    HealthModule,
    UsersModule,
    AuthModule,
    OnboardingModule,
    CommunitiesModule,
    SkillsModule,
    PostsModule,
    MediaModule,
    GamificationModule,
    SeasonsModule,
    LeaderboardModule,
    RewardsModule,
    EventsModule,
    RealtimeModule,
    NotificationsModule,
    PushModule,
    CallsModule,
    FollowModule,
    ReportsModule,
    AdminModule,
    UsageModule,
    ChatModule,
    AiModule,
  ],
  providers: [
    // Order matters: rate limit, then authenticate, then authorize by role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
