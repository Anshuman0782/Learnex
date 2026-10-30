import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AdminGuard } from '../admin/admin.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { AiReviewService } from './ai-review.service.js';
import { MentorTestService } from './mentor-test.service.js';
import { AiRouterService } from './ai-router.service.js';
import { AiQueueService } from './ai-queue.service.js';
import { AI_SKILL_IDS } from './ai-skills.js';
import { ffmpegPath, testToneMp3 } from './analysis/media-prep.js';

class StartTestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  skill!: string;
}

class SubmitTestDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  codeAnswer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  recordingUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recordingMime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30 * 60_000)
  durationMs?: number;

  @IsString()
  @MaxLength(6000)
  critiqueText!: string;
}

class DecideDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class SkillSettingDto {
  @IsOptional()
  @IsBoolean()
  progressEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  mentorTestEnabled?: boolean;
}

/** Learner progress + AI mentor test (members). */
@Controller('ai')
export class AiController {
  constructor(
    private readonly reviews: AiReviewService,
    private readonly tests: MentorTestService,
    private readonly onboarding: OnboardingService,
    private readonly prisma: PrismaService,
  ) {}

  /** My AI progress per skill (only I can see it). */
  @Get('progress')
  progress(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.progress(user.userId);
  }

  /** The AI review of one of my posts. */
  @Get('reviews/post/:postId')
  postReview(@CurrentUser() user: AuthenticatedUser, @Param('postId') postId: string) {
    return this.reviews.forPost(user.userId, postId);
  }

  /** Does this skill use the AI mentor test, and where do I stand? */
  @Get('mentor-test/eligibility')
  eligibility(@CurrentUser() user: AuthenticatedUser, @Query('skill') skill?: string) {
    return this.tests.eligibility(user.userId, skill);
  }

  @Get('mentor-test/mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.tests.mine(user.userId);
  }

  /** Start (or resume) a test — the random task is drawn now. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('mentor-test/start')
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartTestDto) {
    return this.tests.start(user.userId, dto.skill);
  }

  /**
   * Hand in the test. Someone without a Learner/Mentor account yet (new
   * sign-up or a Guest) joins the skill as a Learner straight away, so they
   * can use LERNEX while the test is judged — and gets a fresh session.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('mentor-test/:id/submit')
  async submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SubmitTestDto) {
    let session: Awaited<ReturnType<OnboardingService['enrollAsLearner']>> | undefined;
    const application = await this.tests.submit(user.userId, id, dto, async (skillLabel) => {
      const me = await this.prisma.user.findUnique({ where: { id: user.userId }, select: { role: true } });
      const isMember = me?.role === UserRole.LEARNER || me?.role === UserRole.MENTOR;
      if (!isMember) session = await this.onboarding.enrollAsLearner(user.userId, skillLabel);
    });
    return { application, session };
  }
}

/** Admin: AI status, switches, and mentor tests awaiting a decision. */
@Controller('admin/ai')
@UseGuards(AdminGuard)
export class AiAdminController {
  constructor(
    private readonly reviews: AiReviewService,
    private readonly tests: MentorTestService,
    private readonly router: AiRouterService,
    private readonly queue: AiQueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async status() {
    const [providers, queue, skills, waiting] = await Promise.all([
      this.router.status(),
      this.queue.counts(),
      this.reviews.settings(),
      this.prisma.mentorApplication.count({ where: { status: 'REVIEW' } }),
    ]);
    return { providers, queue, skills, mentorTestsWaiting: waiting, audioTool: !!ffmpegPath() };
  }

  /** Send one tiny request to each configured provider. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('test')
  async test() {
    return this.router.ping(await testToneMp3());
  }

  @Patch('skills/:skill')
  async setSkill(@Param('skill') skill: string, @Body() dto: SkillSettingDto) {
    if (!(AI_SKILL_IDS as string[]).includes(skill)) return this.reviews.settings();
    await this.prisma.aiSkillSetting.upsert({
      where: { skill },
      create: { skill, progressEnabled: dto.progressEnabled ?? true, mentorTestEnabled: dto.mentorTestEnabled ?? true },
      update: { ...(dto.progressEnabled !== undefined ? { progressEnabled: dto.progressEnabled } : {}), ...(dto.mentorTestEnabled !== undefined ? { mentorTestEnabled: dto.mentorTestEnabled } : {}) },
    });
    return this.reviews.settings();
  }

  @Get('mentor-tests')
  list(@Query('status') status?: string) {
    return this.tests.adminList(status && /^[A-Z]+$/.test(status) ? status : undefined);
  }

  @Get('mentor-tests/:id')
  detail(@Param('id') id: string) {
    return this.tests.adminDetail(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mentor-tests/:id/decide')
  async decide(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: DecideDto) {
    await this.tests.decide(id, dto.decision === 'approve' ? 'PASSED' : 'FAILED', user.userId, dto.note?.trim() || null);
    return this.tests.adminDetail(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mentor-tests/:id/rerun')
  rerun(@Param('id') id: string) {
    return this.tests.adminRerun(id);
  }
}
