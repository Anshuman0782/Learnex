import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * All database access for users lives here, so auth and later feature modules
 * share one consistent, soft-delete-aware data layer.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Find an active (not soft-deleted) user by id. */
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  /** Find an active user by email OR phone — used for login. */
  findByEmailOrPhone(identifier: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });
  }

  /** True if any active account already uses this email or phone. */
  async existsByEmailOrPhone(email: string, phone?: string): Promise<boolean> {
    const found = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email }, ...(phone ? [{ phone }] : [])],
      },
      select: { id: true },
    });
    return found !== null;
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Store the hashed refresh token for the active session (null = logged out). */
  setHashedRefreshToken(id: string, hashedRefreshToken: string | null): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { hashedRefreshToken },
    });
  }
}
