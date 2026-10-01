import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, type AuthResult, type SafeUser } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/login.dto.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type {
  AuthenticatedUser,
  AuthenticatedUserWithRefresh,
} from './types/authenticated-user.type.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Tight rate limits on credential endpoints to blunt brute-force attempts.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto.identifier);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.identifier, dto.code, dto.password);
  }

  // Uses the refresh token (not the access token), so it's Public + its own guard.
  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@CurrentUser() user: AuthenticatedUserWithRefresh): Promise<AuthResult> {
    return this.auth.refresh(user.userId, user.refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true }> {
    await this.auth.logout(user.userId);
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.auth.getProfile(user.userId);
  }
}
