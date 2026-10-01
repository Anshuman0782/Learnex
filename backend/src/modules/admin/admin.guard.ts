import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

/**
 * Allows a request only if the signed-in user currently has Admin Panel access.
 * Checked against the database on every request (never trusted from the token),
 * so revoking access takes effect immediately.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Admin access required');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, deletedAt: true },
    });
    if (!user || user.deletedAt || !user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
