import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

const roleLabel = (r: UserRole | null) =>
  r === UserRole.MENTOR ? 'Mentor' : r === UserRole.LEARNER ? 'Learner' : r === UserRole.GUEST ? 'Guest' : null;

/**
 * Who can use the Admin Panel. Owners come from ADMIN_EMAILS: they're always
 * admins and can't be revoked (so the app can never be locked out). Any admin
 * can grant access to another user, and revoke it from any non-owner.
 */
@Injectable()
export class AdminAccessService implements OnModuleInit {
  private readonly logger = new Logger(AdminAccessService.name);
  private readonly owners: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    config: ConfigService,
  ) {
    this.owners = new Set(
      (config.get<string>('ADMIN_EMAILS') ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async onModuleInit(): Promise<void> {
    if (this.owners.size === 0) return;
    const res = await this.prisma.user.updateMany({
      where: {
        isAdmin: false,
        OR: [...this.owners].map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })),
      },
      data: { isAdmin: true, adminGrantedAt: new Date() },
    });
    if (res.count > 0) this.logger.log(`Granted owner admin access to ${res.count} account(s).`);
  }

  isOwnerEmail(email: string): boolean {
    return this.owners.has(email.toLowerCase());
  }

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    return { isAdmin: true, isOwner: this.isOwnerEmail(u.email) };
  }

  async listAdmins() {
    const admins = await this.prisma.user.findMany({
      where: { isAdmin: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        adminGrantedAt: true,
        adminGrantedById: true,
      },
      orderBy: { adminGrantedAt: 'asc' },
    });
    const granterIds = [...new Set(admins.map((a) => a.adminGrantedById).filter((x): x is string => !!x))];
    const granters = granterIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: granterIds } }, select: { id: true, name: true } })
      : [];
    const granterName = new Map(granters.map((g) => [g.id, g.name]));

    return admins.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      avatarUrl: a.avatarUrl ?? '',
      role: roleLabel(a.role),
      isOwner: this.isOwnerEmail(a.email),
      grantedAt: a.adminGrantedAt?.toISOString() ?? null,
      grantedByName: a.adminGrantedById ? granterName.get(a.adminGrantedById) ?? null : null,
    }));
  }

  /** Find users by name or email to grant access. */
  async searchUsers(q: string) {
    const query = q.trim();
    if (query.length < 2) return [];
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, isAdmin: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl ?? '',
      role: roleLabel(u.role),
      isAdmin: u.isAdmin,
      isOwner: this.isOwnerEmail(u.email),
    }));
  }

  async grant(actorId: string, targetId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, isAdmin: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!target.isAdmin) {
      await this.prisma.user.update({
        where: { id: targetId },
        data: { isAdmin: true, adminGrantedAt: new Date(), adminGrantedById: actorId },
      });
      this.realtime.emitToUser(targetId, 'admin:access-changed', { isAdmin: true });
    }
    return this.listAdmins();
  }

  async revoke(actorId: string, targetId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, isAdmin: true },
    });
    if (!target || !target.isAdmin) throw new NotFoundException('This user is not an admin');
    if (this.isOwnerEmail(target.email)) {
      throw new ForbiddenException('Owner accounts always keep Admin access.');
    }
    if (targetId === actorId) {
      throw new BadRequestException('You can’t remove your own Admin access. Ask another admin.');
    }
    await this.prisma.user.update({
      where: { id: targetId },
      data: { isAdmin: false, adminGrantedAt: null, adminGrantedById: null },
    });
    this.realtime.emitToUser(targetId, 'admin:access-changed', { isAdmin: false });
    return this.listAdmins();
  }
}
