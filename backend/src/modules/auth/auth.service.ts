import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './types/authenticated-user.type.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** User shape returned to clients — never includes secrets. */
export type SafeUser = Omit<User, 'passwordHash' | 'hashedRefreshToken'>;

export interface AuthResult {
  user: SafeUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Create a new account, then log it in. Role stays null until onboarding. */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const phone = dto.phone?.replace(/\s+/g, '');

    if (await this.users.existsByEmailOrPhone(dto.email, phone)) {
      throw new ConflictException('An account with this email or phone already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.users.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone,
      passwordHash,
      dob: dto.dob,
      hobby: dto.hobby,
    });

    return this.issueSession(user);
  }

  /** Verify credentials and start a session. */
  async login(dto: LoginDto): Promise<AuthResult> {
    const identifier = dto.identifier.trim().toLowerCase().replace(/\s+/g, '');
    const user = await this.users.findByEmailOrPhone(identifier);

    // Generic message either way — don't reveal whether the account exists.
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user);
  }

  /** Rotate tokens: only succeeds if the presented refresh token matches the stored hash. */
  async refresh(userId: string, presentedRefreshToken: string): Promise<AuthResult> {
    const user = await this.users.findById(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const matches = await argon2.verify(user.hashedRefreshToken, presentedRefreshToken);
    if (!matches) {
      // Token doesn't match the current session — treat as compromised, revoke.
      await this.users.setHashedRefreshToken(user.id, null);
      throw new UnauthorizedException('Session is no longer valid');
    }

    return this.issueSession(user);
  }

  /** End the session by clearing the stored refresh token. */
  async logout(userId: string): Promise<void> {
    await this.users.setHashedRefreshToken(userId, null);
  }

  /** Current user's profile (for GET /auth/me). */
  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    return this.toSafeUser(user);
  }

  /**
   * Start a password reset: generate a 6-digit code (hashed, 15-min expiry).
   * In production this would be emailed; in dev the code is logged and returned
   * so the flow is testable without an email provider. Always reports success so
   * we never reveal whether an account exists.
   */
  async requestPasswordReset(identifier: string): Promise<{ sent: true; devCode?: string }> {
    const user = await this.users.findByEmailOrPhone(
      identifier.trim().toLowerCase().replace(/\s+/g, ''),
    );
    if (!user) {
      return { sent: true }; // don't disclose existence
    }

    const code = String(randomInt(100000, 1000000)); // 6 digits
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Invalidate previous unused codes, then store the new one.
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.passwordReset.create({ data: { userId: user.id, codeHash, expiresAt } });

    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    this.logger.log(`Password reset code for ${user.email}: ${code}`);
    // TODO(prod): send `code` via a free email provider (e.g. Resend/Gmail SMTP).
    return isProd ? { sent: true } : { sent: true, devCode: code };
  }

  /** Complete a password reset with the emailed code. */
  async resetPassword(
    identifier: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const user = await this.users.findByEmailOrPhone(
      identifier.trim().toLowerCase().replace(/\s+/g, ''),
    );
    if (!user) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const reset = await this.prisma.passwordReset.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!reset || !(await argon2.verify(reset.codeHash, code))) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      // Setting a new password also revokes any active session.
      data: { passwordHash, hashedRefreshToken: null },
    });
    await this.prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });
    return { success: true };
  }

  // --- internals ---

  /**
   * Generate a fresh token pair, persist the hashed refresh token, return everything.
   * Public so other flows (e.g. onboarding role changes) can reissue a session
   * with an up-to-date role claim in the access token.
   */
  async issueSession(user: User): Promise<AuthResult> {
    const tokens = await this.generateTokens(user.id, user.role);
    const hashedRefreshToken = await argon2.hash(tokens.refreshToken);
    await this.users.setHashedRefreshToken(user.id, hashedRefreshToken);
    return { user: this.toSafeUser(user), tokens };
  }

  private async generateTokens(
    userId: string,
    role: UserRole | null,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.expiresIn('JWT_ACCESS_EXPIRES_IN'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.expiresIn('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /** Reads a duration string (e.g. "15m", "7d") in the type the JWT signer expects. */
  private expiresIn(key: string): JwtSignOptions['expiresIn'] {
    return this.config.get<string>(key) as JwtSignOptions['expiresIn'];
  }

  private toSafeUser(user: User): SafeUser {
    const { passwordHash: _p, hashedRefreshToken: _r, ...safe } = user;
    return safe;
  }
}
