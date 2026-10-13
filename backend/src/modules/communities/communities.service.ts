import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Community, CommunityRole, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { roleLabelIn } from '../../common/utils/skill.js';

/** A real community member — an actual user who joined. No fabricated fields. */
export interface CommunityMemberView {
  id: string;
  name: string;
  role: 'Mentor' | 'Learner' | 'Guest';
  isAdmin: boolean;
}

/** A community plus real, computed membership data for the current user. */
export interface CommunityView extends Community {
  isJoined: boolean;
  isAdmin: boolean; // is the current viewer an admin of this circle
  isCreator: boolean; // is the current viewer the creator
  memberCount: number;
  mentorCount: number;
  adminCount: number;
  mentors: CommunityMemberView[];
  members: CommunityMemberView[];
  admins: CommunityMemberView[];
  allMembers: CommunityMemberView[]; // everyone, in join order
}

export interface UpdateCommunityInput {
  name?: string;
  description?: string;
  category?: string;
  avatarUrl?: string;
  postPolicy?: 'ALL' | 'ADMINS';
}

export interface CreateCommunityInput {
  name: string;
  description: string;
  category: string;
  avatarUrl?: string;
  tags?: string[];
  memberIds?: string[]; // people to add as members
  adminIds?: string[]; // subset promoted to admin
}

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Tell open apps a circle changed (new / edited / deleted / members) → they refresh. */
  private changed(communityId: string) {
    this.realtime.emitToAll('communities:changed', { communityId });
  }

  private async joinedIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.communityMembership.findMany({
      where: { userId },
      select: { communityId: true },
    });
    return new Set(rows.map((r) => r.communityId));
  }

  /** Ids of communities where this user is an ADMIN. */
  private async adminIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.communityMembership.findMany({
      where: { userId, role: CommunityRole.ADMIN },
      select: { communityId: true },
    });
    return new Set(rows.map((r) => r.communityId));
  }

  private async assertAdmin(userId: string, communityId: string): Promise<void> {
    const membership = await this.prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId, communityId } },
      select: { role: true },
    });
    if (!membership || membership.role !== CommunityRole.ADMIN) {
      throw new ForbiddenException('Only circle admins can do that');
    }
  }

  /**
   * Attaches real membership data (counts + actual joined users) to each
   * community. Everything here is derived from the memberships table.
   */
  private async enrich(communities: Community[], userId: string): Promise<CommunityView[]> {
    if (communities.length === 0) return [];
    const ids = communities.map((c) => c.id);

    const [memberships, joined, myAdmin] = await Promise.all([
      this.prisma.communityMembership.findMany({
        where: { communityId: { in: ids }, user: { deletedAt: null } },
        select: {
          communityId: true,
          role: true,
          user: { select: { id: true, name: true, role: true, hobby: true, skills: { select: { skill: true, skillKey: true, role: true } }, } },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      this.joinedIds(userId),
      this.adminIds(userId),
    ]);

    // A member counts as a Mentor of a circle only if they mentor ITS skill.
    const categoryOf = new Map(communities.map((c) => [c.id, c.category]));
    // Group real members by community.
    const byCommunity = new Map<string, CommunityMemberView[]>();
    for (const m of memberships) {
      const list = byCommunity.get(m.communityId) ?? [];
      list.push({
        id: m.user.id,
        name: m.user.name,
        role: roleLabelIn(m.user, categoryOf.get(m.communityId)),
        isAdmin: m.role === CommunityRole.ADMIN,
      });
      byCommunity.set(m.communityId, list);
    }

    return communities.map((c) => {
      const people = byCommunity.get(c.id) ?? [];
      const mentors = people.filter((p) => p.role === 'Mentor');
      const members = people.filter((p) => p.role === 'Learner');
      const admins = people.filter((p) => p.isAdmin);
      return {
        ...c,
        isJoined: joined.has(c.id),
        isAdmin: myAdmin.has(c.id),
        isCreator: c.createdById === userId,
        memberCount: people.length,
        mentorCount: mentors.length,
        adminCount: admins.length,
        mentors,
        members,
        admins,
        allMembers: people,
      };
    });
  }

  /** Create a new circle. The creator becomes the first ADMIN + member. */
  async create(userId: string, dto: CreateCommunityInput): Promise<CommunityView> {
    const id = `circle-${randomUUID().slice(0, 8)}`;
    const adminSet = new Set(dto.adminIds ?? []);
    // Everyone in memberIds is added; adminIds among them become admins.
    const memberSet = new Set((dto.memberIds ?? []).filter((mid) => mid !== userId));

    const created = await this.prisma.community.create({
      data: {
        id,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        // Neutral defaults; a custom-avatar upload can replace these later.
        iconName: 'people',
        iconBgColor: '#EEF2FF',
        iconColor: '#4F46E5',
        isHot: false,
        tags: dto.tags ?? [],
        avatarUrl: dto.avatarUrl,
        createdById: userId,
        memberships: {
          create: [
            { userId, role: CommunityRole.ADMIN },
            ...[...memberSet].map((mid) => ({
              userId: mid,
              role: adminSet.has(mid) ? CommunityRole.ADMIN : CommunityRole.MEMBER,
            })),
          ],
        },
      },
    });
    const [view] = await this.enrich([created], userId);
    this.changed(view.id);
    return view;
  }

  /** Add members to a circle (admin only). Each may optionally be an admin. */
  async addMembers(
    userId: string,
    communityId: string,
    members: { userId: string; isAdmin?: boolean }[],
  ): Promise<CommunityView> {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Circle not found');
    await this.assertAdmin(userId, communityId);

    for (const m of members) {
      await this.prisma.communityMembership.upsert({
        where: { userId_communityId: { userId: m.userId, communityId } },
        create: {
          userId: m.userId,
          communityId,
          role: m.isAdmin ? CommunityRole.ADMIN : CommunityRole.MEMBER,
        },
        update: m.isAdmin ? { role: CommunityRole.ADMIN } : {},
      });
    }
    const [view] = await this.enrich([community], userId);
    this.changed(communityId);
    return view;
  }

  /** Promote/demote a member's admin status (admin only). */
  async setMemberRole(
    userId: string,
    communityId: string,
    targetId: string,
    isAdmin: boolean,
  ): Promise<CommunityView> {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Circle not found');
    await this.assertAdmin(userId, communityId);

    await this.prisma.communityMembership.updateMany({
      where: { userId: targetId, communityId },
      data: { role: isAdmin ? CommunityRole.ADMIN : CommunityRole.MEMBER },
    });
    const [view] = await this.enrich([community], userId);
    this.changed(communityId);
    return view;
  }

  /** A circle is "real" when at least one active person belongs to it. */
  private readonly hasMembers: Prisma.CommunityWhereInput = {
    memberships: { some: { user: { deletedAt: null } } },
  };

  /** Real circles only (empty ones are never listed), optionally by category. */
  async findAll(userId: string, category?: string): Promise<CommunityView[]> {
    const communities = await this.prisma.community.findMany({
      where: {
        ...this.hasMembers,
        ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ isHot: 'desc' }, { name: 'asc' }],
    });
    return this.enrich(communities, userId);
  }

  /**
   * Real circles in the user's OWN category only — no fallback to other
   * categories. If none exist yet, the list is simply empty (they can create one).
   */
  async findRecommended(userId: string, hobby?: string | null): Promise<CommunityView[]> {
    if (!hobby?.trim()) return [];
    const communities = await this.prisma.community.findMany({
      where: { ...this.hasMembers, category: { equals: hobby.trim(), mode: 'insensitive' } },
      orderBy: [{ isHot: 'desc' }, { name: 'asc' }],
    });
    return this.enrich(communities, userId);
  }

  async findJoined(userId: string): Promise<CommunityView[]> {
    const memberships = await this.prisma.communityMembership.findMany({
      where: { userId },
      include: { community: true },
      orderBy: { joinedAt: 'desc' },
    });
    return this.enrich(
      memberships.map((m) => m.community),
      userId,
    );
  }

  /** Update circle settings (admin only). */
  async updateSettings(
    userId: string,
    communityId: string,
    dto: UpdateCommunityInput,
  ): Promise<CommunityView> {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Circle not found');
    await this.assertAdmin(userId, communityId);

    const updated = await this.prisma.community.update({
      where: { id: communityId },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        category: dto.category ?? undefined,
        avatarUrl: dto.avatarUrl ?? undefined,
        postPolicy: dto.postPolicy ?? undefined,
      },
    });
    const [view] = await this.enrich([updated], userId);
    this.changed(communityId);
    return view;
  }

  /** Delete a circle — only the original creator may do this. */
  async deleteCircle(userId: string, communityId: string): Promise<{ success: true }> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { createdById: true },
    });
    if (!community) throw new NotFoundException('Circle not found');
    if (!community.createdById || community.createdById !== userId) {
      throw new ForbiddenException('Only the circle creator can delete it');
    }
    await this.prisma.community.delete({ where: { id: communityId } });
    this.changed(communityId);
    return { success: true };
  }

  /** Remove a member (admin only). The creator can never be removed. */
  async removeMember(
    userId: string,
    communityId: string,
    targetId: string,
  ): Promise<CommunityView> {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Circle not found');
    await this.assertAdmin(userId, communityId);
    if (community.createdById && community.createdById === targetId) {
      throw new ForbiddenException('The creator cannot be removed');
    }
    await this.prisma.communityMembership.deleteMany({
      where: { userId: targetId, communityId },
    });
    const [view] = await this.enrich([community], userId);
    this.changed(communityId);
    return view;
  }

  async join(userId: string, communityId: string): Promise<{ isJoined: true }> {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    await this.prisma.communityMembership.upsert({
      where: { userId_communityId: { userId, communityId } },
      create: { userId, communityId },
      update: {},
    });
    this.changed(communityId);
    return { isJoined: true };
  }

  async leave(userId: string, communityId: string): Promise<{ isJoined: false }> {
    await this.prisma.communityMembership.deleteMany({ where: { userId, communityId } });
    this.changed(communityId);
    return { isJoined: false };
  }
}
