import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { XpService } from '../gamification/xp.service.js';

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | 'Guest' | null;
  hobby: string | null;
  bio: string | null;
  handle: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isSelf: boolean;
}

/** A lightweight person row for pickers (search / followers lists). */
export interface UserRow {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | 'Guest' | null;
  isFollowing?: boolean; // does the viewer follow this person
  isSelf?: boolean;
}

const toRow = (u: { id: string; name: string; avatarUrl: string | null; role: UserRole | null }): UserRow => ({
  id: u.id,
  name: u.name,
  avatarUrl: u.avatarUrl ?? '',
  role: u.role === UserRole.MENTOR ? 'Mentor' : u.role === UserRole.LEARNER ? 'Learner' : u.role === UserRole.GUEST ? 'Guest' : null,
});

@Injectable()
export class FollowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly xp: XpService,
  ) {}

  async follow(followerId: string, targetId: string): Promise<{ isFollowing: true; followersCount: number }> {
    if (followerId === targetId) {
      throw new BadRequestException('You cannot follow yourself');
    }
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');

    const created = await this.prisma.follow
      .create({ data: { followerId, followingId: targetId } })
      .then(() => true)
      .catch(() => false); // already following (unique) → no-op

    if (created) {
      const me = await this.prisma.user.findUnique({
        where: { id: followerId },
        select: { name: true },
      });
      await this.notifications.create({
        userId: targetId,
        type: 'FOLLOW',
        title: 'New follower 👤',
        body: `${me?.name ?? 'Someone'} started following you`,
        actorName: me?.name,
        actorId: followerId,
        data: { kind: 'profile', userId: followerId },
        dedupeKey: `follow:${followerId}`,
      });
      await this.xp.onFollowerGained(targetId, followerId);
    }

    const followersCount = await this.prisma.follow.count({ where: { followingId: targetId } });
    return { isFollowing: true, followersCount };
  }

  async unfollow(followerId: string, targetId: string): Promise<{ isFollowing: false; followersCount: number }> {
    await this.prisma.follow.deleteMany({ where: { followerId, followingId: targetId } });
    const followersCount = await this.prisma.follow.count({ where: { followingId: targetId } });
    return { isFollowing: false, followersCount };
  }

  /** Search users by name (for member pickers). Excludes self + deleted. */
  async searchUsers(viewerId: string, query: string): Promise<UserRow[]> {
    const q = query.trim();
    if (q.length < 1) return [];
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: viewerId },
        name: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, name: true, avatarUrl: true, role: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
    return users.map(toRow);
  }

  /** People who follow the current user (candidates to add to a circle). */
  async getFollowers(userId: string): Promise<UserRow[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followingId: userId, follower: { deletedAt: null } },
      select: { follower: { select: { id: true, name: true, avatarUrl: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => toRow(r.follower));
  }

  /** The set of ids the viewer currently follows (for isFollowing flags). */
  private async followingSet(viewerId: string): Promise<Set<string>> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    return new Set(rows.map((r) => r.followingId));
  }

  private decorate(viewerId: string, rows: UserRow[], following: Set<string>): UserRow[] {
    return rows.map((u) => ({
      ...u,
      isSelf: u.id === viewerId,
      isFollowing: following.has(u.id),
    }));
  }

  /** People who follow `targetId`, decorated with the viewer's follow status. */
  async getFollowersList(viewerId: string, targetId: string): Promise<UserRow[]> {
    const [rows, following] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: targetId, follower: { deletedAt: null } },
        select: { follower: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.followingSet(viewerId),
    ]);
    return this.decorate(viewerId, rows.map((r) => toRow(r.follower)), following);
  }

  /** People `targetId` follows, decorated with the viewer's follow status. */
  async getFollowingList(viewerId: string, targetId: string): Promise<UserRow[]> {
    const [rows, following] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: targetId, following: { deletedAt: null } },
        select: { following: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.followingSet(viewerId),
    ]);
    return this.decorate(viewerId, rows.map((r) => toRow(r.following)), following);
  }

  async getProfile(viewerId: string, targetId: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, name: true, avatarUrl: true, role: true, hobby: true, bio: true, handle: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [followersCount, followingCount, postsCount, followRow] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: targetId } }),
      this.prisma.follow.count({ where: { followerId: targetId } }),
      this.prisma.post.count({ where: { authorId: targetId, deletedAt: null, isHidden: false, isPrivate: false } }),
      viewerId === targetId
        ? Promise.resolve(null)
        : this.prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
          }),
    ]);

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? '',
      role: user.role === UserRole.MENTOR ? 'Mentor' : user.role === UserRole.LEARNER ? 'Learner' : user.role === UserRole.GUEST ? 'Guest' : null,
      hobby: user.hobby,
      bio: user.bio,
      handle: user.handle,
      followersCount,
      followingCount,
      postsCount,
      isFollowing: !!followRow,
      isSelf: viewerId === targetId,
    };
  }
}
