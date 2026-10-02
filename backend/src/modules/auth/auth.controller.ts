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
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
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

class CodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code!: string;
}

class ContactChangeDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ]{7,20}$/, { message: 'Enter a valid phone number' })
  phone?: string;
}

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

  // ---- Email verification (signed-in user) ----
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-email/send')
  sendVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.sendVerification(user.userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-email/confirm')
  confirmVerification(@CurrentUser() user: AuthenticatedUser, @Body() dto: CodeDto): Promise<SafeUser> {
    return this.auth.confirmVerification(user.userId, dto.code);
  }

  // ---- Change email / phone (code goes to the CURRENT email) ----
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('contact/request')
  requestContactChange(@CurrentUser() user: AuthenticatedUser, @Body() dto: ContactChangeDto) {
    return this.auth.requestContactChange(user.userId, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('contact/confirm')
  confirmContactChange(@CurrentUser() user: AuthenticatedUser, @Body() dto: CodeDto): Promise<SafeUser> {
    return this.auth.confirmContactChange(user.userId, dto.code);
  }
}
