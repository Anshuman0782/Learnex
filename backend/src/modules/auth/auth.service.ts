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
import { MailService } from '../mail/mail.service.js';
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

/** One-time code rules (verification, contact change, password reset). */
const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  /** Create a new account, then log it in. Role stays null until onboarding. */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const phone = dto.phone?.replace(/\s+/g, '');

    if (dto.dob) {
      // Must be a real calendar date and the user at least 13 (max 100).
      const [y, m, d] = dto.dob.split('-').map(Number);
      const born = new Date(Date.UTC(y, m - 1, d));
      const real = born.getUTCFullYear() === y && born.getUTCMonth() === m - 1 && born.getUTCDate() === d;
      const now = new Date();
      const age =
        now.getUTCFullYear() - y - (now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d) ? 1 : 0);
      if (!real) throw new BadRequestException('Date of birth is not a real date');
      if (age < 13) throw new BadRequestException('You must be at least 13 years old to join');
      if (age > 100) throw new BadRequestException('Please check your date of birth');
    }

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

    // Send the "verify your email" code right away (sign-up still succeeds if
    // the email can't be sent — they can resend from the app).
    await this.sendVerification(user.id, true).catch((e) => this.logger.warn(`Verify email not sent: ${String(e)}`));
    return this.issueSession(await this.ensureOwnerAdmin(user));
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

    return this.issueSession(await this.ensureOwnerAdmin(user));
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
    return this.toSafeUser(await this.ensureOwnerAdmin(user));
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

    await this.mail.sendCode({ email: user.email, name: user.name }, 'reset', code);
    // Dev convenience only (no email provider configured locally).
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    return !isProd && !this.mail.configured ? { sent: true, devCode: code } : { sent: true };
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
    if (!reset || reset.attempts >= MAX_CODE_ATTEMPTS) {
      throw new BadRequestException('Invalid or expired reset code');
    }
    if (!(await argon2.verify(reset.codeHash, code))) {
      await this.prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Invalid or expired reset code');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      // Setting a new password also revokes any active session. Receiving the
      // code proves they own the email, so it counts as verified too.
      data: { passwordHash, hashedRefreshToken: null, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
    await this.prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });
    return { success: true };
  }

  // --- email verification & contact changes ---

  /** Owners (ADMIN_EMAILS) get Admin Panel access the moment they sign up / log in. */
  private async ensureOwnerAdmin(user: User): Promise<User> {
    const owners = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().replace(/^["']|["']$/g, '').toLowerCase())
      .filter(Boolean);
    if (user.isAdmin || !owners.includes(user.email.toLowerCase())) return user;
    return this.prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true, adminGrantedAt: new Date() },
    });
  }

  /** Creates a fresh code for (user, purpose), invalidating older ones. */
  private async newEmailCode(
    userId: string,
    purpose: 'VERIFY_EMAIL' | 'CHANGE_CONTACT',
    extra: { newEmail?: string | null; newPhone?: string | null } = {},
    /** Skip the 60s resend gap (system-triggered, e.g. right after an email change). */
    force = false,
  ): Promise<string> {
    if (!force) {
      const recent = await this.prisma.emailCode.findFirst({
        where: { userId, purpose, createdAt: { gt: new Date(Date.now() - RESEND_GAP_MS) } },
      });
      if (recent) throw new BadRequestException('Please wait a minute before requesting another code');
    }
    await this.prisma.emailCode.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
    const code = String(randomInt(100000, 1000000));
    await this.prisma.emailCode.create({
      data: {
        userId,
        purpose,
        codeHash: await argon2.hash(code),
        newEmail: extra.newEmail ?? null,
        newPhone: extra.newPhone ?? null,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    return code;
  }

  /** Checks a code; burns it after 5 wrong tries. Returns the code row. */
  private async useEmailCode(userId: string, purpose: 'VERIFY_EMAIL' | 'CHANGE_CONTACT', code: string) {
    const row = await this.prisma.emailCode.findFirst({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.attempts >= MAX_CODE_ATTEMPTS) throw new BadRequestException('Invalid or expired code');
    if (!(await argon2.verify(row.codeHash, code))) {
      await this.prisma.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Invalid or expired code');
    }
    await this.prisma.emailCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return row;
  }

  /** Email a "verify your email" code to the account's current address. */
  async sendVerification(userId: string, force = false): Promise<{ sent: true; alreadyVerified?: true }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    if (user.emailVerifiedAt) return { sent: true, alreadyVerified: true };
    const code = await this.newEmailCode(userId, 'VERIFY_EMAIL', {}, force);
    await this.mail.sendCode({ email: user.email, name: user.name }, 'verify', code);
    return { sent: true };
  }

  async confirmVerification(userId: string, code: string): Promise<SafeUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    if (!user.emailVerifiedAt) await this.useEmailCode(userId, 'VERIFY_EMAIL', code);
    const updated = user.emailVerifiedAt
      ? user
      : await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return this.toSafeUser(updated);
  }

  /** Start changing email and/or phone: a code goes to the CURRENT email. */
  async requestContactChange(userId: string, input: { email?: string; phone?: string }): Promise<{ sent: true; to: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    const newEmail = input.email?.trim().toLowerCase() || null;
    const newPhone = input.phone?.replace(/\s+/g, '') || null;
    const emailChanges = !!newEmail && newEmail !== user.email.toLowerCase();
    const phoneChanges = !!newPhone && newPhone !== (user.phone ?? '');
    if (!emailChanges && !phoneChanges) throw new BadRequestException('Nothing to change');
    if (emailChanges && (await this.prisma.user.findFirst({ where: { email: { equals: newEmail!, mode: 'insensitive' }, id: { not: userId } } }))) {
      throw new ConflictException('That email is already used by another account');
    }
    if (phoneChanges && (await this.prisma.user.findFirst({ where: { phone: newPhone!, id: { not: userId } } }))) {
      throw new ConflictException('That phone number is already used by another account');
    }
    const code = await this.newEmailCode(userId, 'CHANGE_CONTACT', {
      newEmail: emailChanges ? newEmail : null,
      newPhone: phoneChanges ? newPhone : null,
    });
    await this.mail.sendCode({ email: user.email, name: user.name }, 'change', code);
    // Mask the address we sent to (e.g. an***@gmail.com).
    const [local, domain] = user.email.split('@');
    return { sent: true, to: `${local.slice(0, 2)}***@${domain}` };
  }

  /** Finish the change with the code from the current email. */
  async confirmContactChange(userId: string, code: string): Promise<SafeUser> {
    const row = await this.useEmailCode(userId, 'CHANGE_CONTACT', code);
    const before = await this.users.findById(userId);
    if (!before) throw new UnauthorizedException('Account not found');
    let updated: User;
    try {
      updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(row.newEmail ? { email: row.newEmail, emailVerifiedAt: null } : {}),
          ...(row.newPhone ? { phone: row.newPhone } : {}),
        },
      });
    } catch {
      throw new ConflictException('That email or phone was just taken by another account');
    }
    if (row.newEmail) {
      // The new address must prove itself too; the old one gets a heads-up.
      await this.sendVerification(userId, true).catch((e) => this.logger.warn(`New-email verification not sent: ${String(e)}`));
      await this.mail.sendNotice(
        { email: before.email, name: before.name },
        'Your LERNEX email was changed',
        `The email on your LERNEX account was changed to ${row.newEmail}. If this wasn't you, reset your password right away.`,
      );
    }
    return this.toSafeUser(updated);
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
