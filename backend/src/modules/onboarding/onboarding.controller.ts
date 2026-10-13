import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import type { AuthResult } from '../auth/auth.service.js';
import {
  OnboardingService,
  type QuizResultResponse,
  type QuizStartResponse,
  type UserSkillView,
} from './onboarding.service.js';
import { SkillDto, SubmitQuizDto } from './dto/submit-quiz.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Continue as Guest (no XP, not ranked). Returns a fresh session. */
  @HttpCode(HttpStatus.OK)
  @Post('continue-guest')
  continueAsGuest(@CurrentUser() user: AuthenticatedUser): Promise<AuthResult> {
    return this.onboarding.continueAsGuest(user.userId);
  }

  /**
   * Join a skill as a Learner — the first skill at sign-up, or another one
   * later (body: { skill }). Returns a fresh session.
   */
  @HttpCode(HttpStatus.OK)
  @Post('enroll-learner')
  enrollAsLearner(@CurrentUser() user: AuthenticatedUser, @Body() dto: SkillDto): Promise<AuthResult> {
    return this.onboarding.enrollAsLearner(user.userId, dto?.skill);
  }

  /** The member's skills, each with its role and XP. */
  @Get('skills')
  listSkills(@CurrentUser() user: AuthenticatedUser): Promise<UserSkillView[]> {
    return this.onboarding.listSkills(user.userId);
  }

  /** Make one of the member's skills their main skill. */
  @HttpCode(HttpStatus.OK)
  @Post('skills/primary')
  setPrimarySkill(@CurrentUser() user: AuthenticatedUser, @Body() dto: SkillDto): Promise<AuthResult> {
    return this.onboarding.setPrimarySkill(user.userId, dto?.skill);
  }

  /** Start a mentor quiz for a skill (?skill=) — questions only, no answer key. */
  @Get('mentor-quiz')
  startMentorQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Query('skill') skill?: string,
  ): Promise<QuizStartResponse> {
    return this.onboarding.startMentorQuiz(user.userId, skill);
  }

  /** Submit answers for server-side grading. Grants Mentor on a pass. */
  @HttpCode(HttpStatus.OK)
  @Post('mentor-quiz/submit')
  submitMentorQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitQuizDto,
  ): Promise<QuizResultResponse> {
    return this.onboarding.submitMentorQuiz(user.userId, dto.answers, dto.skill);
  }
}
