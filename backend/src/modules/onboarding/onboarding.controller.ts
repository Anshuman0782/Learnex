import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthResult } from '../auth/auth.service.js';
import {
  OnboardingService,
  type QuizResultResponse,
  type QuizStartResponse,
} from './onboarding.service.js';
import { SubmitQuizDto } from './dto/submit-quiz.dto.js';
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

  /** Learner enrolls directly. Returns a fresh session with the new role. */
  @HttpCode(HttpStatus.OK)
  @Post('enroll-learner')
  enrollAsLearner(@CurrentUser() user: AuthenticatedUser): Promise<AuthResult> {
    return this.onboarding.enrollAsLearner(user.userId);
  }

  /** Start a mentor quiz — questions only, no answer key. */
  @Get('mentor-quiz')
  startMentorQuiz(@CurrentUser() user: AuthenticatedUser): Promise<QuizStartResponse> {
    return this.onboarding.startMentorQuiz(user.userId);
  }

  /** Submit answers for server-side grading. Grants Mentor on a pass. */
  @HttpCode(HttpStatus.OK)
  @Post('mentor-quiz/submit')
  submitMentorQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitQuizDto,
  ): Promise<QuizResultResponse> {
    return this.onboarding.submitMentorQuiz(user.userId, dto.answers);
  }
}
