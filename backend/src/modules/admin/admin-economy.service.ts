import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { XpService } from '../gamification/xp.service.js';
import { seasonWindow } from '../gamification/leveling.js';
import { XP_RULE_DEF_BY_KEY, XP_TRIGGERS } from '../gamification/xp-rules.js';
import { rankLabel } from '../rewards/rewards.service.js';
import {
  CreateRewardDto,
  CreateXpRuleDto,
  UpdateRewardDto,
  UpdateXpRuleDto,
} from './dto/admin.dto.js';

const TRIGGER_LABEL = new Map<string, string>(XP_TRIGGERS.map((t) => [t.id, t.label]));

/** Default card colours per reward type (admins can override). */
const REWARD_COLORS: Record<string, [string, string]> = {
  voucher: ['#FF5722', '#F97316'],
  badge: ['#F59E0B', '#D97706'],
  tokens: ['#10B981', '#059669'],
  coaching: ['#6366F1', '#4F46E5'],
  top_mentor: ['#8B5CF6', '#7C3AED'],
  opportunities: ['#EC4899', '#DB2777'],
};

/**
 * Admin management of the XP economy and season rewards. Every change drops the
 * XP rule cache (so the very next award uses the new values) and broadcasts a
 * realtime event so every open app refreshes its rules/rewards instantly.
 */
@Injectable()
export class AdminEconomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ---------- XP rules ----------

  triggers() {
    return XP_TRIGGERS;
  }

  async listRules() {
    const season = seasonWindow();
    const [rules, payouts] = await Promise.all([
      this.prisma.xpRule.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
      this.prisma.xpEvent.groupBy({
        by: ['ruleKey'],
        where: { ruleKey: { not: null }, createdAt: { gte: season.startsAt, lt: season.endsAt } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    const paid = new Map(payouts.map((p) => [p.ruleKey, p]));
    return rules.map((r) => ({
      key: r.key,
      trigger: r.trigger,
      triggerLabel: TRIGGER_LABEL.get(r.trigger) ?? r.trigger,
      title: r.title,
      description: r.description,
      role: r.role,
      category: r.category,
      xp: r.xp,
      dailyCap: r.dailyCap,
      isActive: r.isActive,
      isCore: r.isCore,
      isBuiltIn: XP_RULE_DEF_BY_KEY.has(r.key as never),
      updatedAt: r.updatedAt.toISOString(),
      seasonPayouts: paid.get(r.key)?._count._all ?? 0,
      seasonXpPaid: paid.get(r.key)?._sum.amount ?? 0,
    }));
  }

  async createRule(actorId: string, dto: CreateXpRuleDto) {
    const maxOrder = await this.prisma.xpRule.aggregate({ _max: { sortOrder: true } });
    await this.prisma.xpRule.create({
      data: {
        key: `CUSTOM_${randomBytes(4).toString('hex').toUpperCase()}`,
        trigger: dto.trigger,
        title: dto.title.trim(),
        description: dto.description.trim(),
        role: dto.role,
        category: dto.category,
        xp: dto.xp,
        dailyCap: dto.dailyCap ?? null,
        isActive: dto.isActive ?? true,
        isCore: false,
        sortOrder: Math.max(100, (maxOrder._max.sortOrder ?? 0) + 1),
        createdById: actorId,
      },
    });
    this.rulesChanged();
    return this.listRules();
  }

  async updateRule(key: string, dto: UpdateXpRuleDto) {
    const rule = await this.prisma.xpRule.findUnique({ where: { key } });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.isCore) {
      throw new ForbiddenException('Core rules are fixed by the platform and can’t be edited.');
    }
    const isBuiltIn = XP_RULE_DEF_BY_KEY.has(key as never);
    if (isBuiltIn && dto.trigger && dto.trigger !== rule.trigger) {
      throw new BadRequestException('A built-in rule’s trigger can’t be changed. Create a new rule instead.');
    }

    const data: Prisma.XpRuleUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.xp !== undefined) data.xp = dto.xp;
    if (dto.dailyCap !== undefined) data.dailyCap = dto.dailyCap;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (!isBuiltIn && dto.trigger !== undefined) data.trigger = dto.trigger;

    await this.prisma.xpRule.update({ where: { key }, data });
    this.rulesChanged();
    return this.listRules();
  }

  async deleteRule(key: string) {
    const rule = await this.prisma.xpRule.findUnique({ where: { key } });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.isCore || XP_RULE_DEF_BY_KEY.has(key as never)) {
      throw new ForbiddenException('Built-in rules can be turned off, but not deleted.');
    }
    // Past XP stays in the ledger; the rule just stops paying.
    await this.prisma.xpRule.delete({ where: { key } });
    this.rulesChanged();
    return this.listRules();
  }

  private rulesChanged(): void {
    this.xp.invalidateRules();
    this.realtime.emitToAll('xp:rules-updated', { at: Date.now() });
  }

  // ---------- Rewards ----------

  async listRewards() {
    const rewards = await this.prisma.seasonReward.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { claims: true } } },
    });
    return rewards.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      subtitle: r.subtitle,
      description: r.description,
      icon: r.icon,
      tag: r.tag,
      targetRole: r.targetRole,
      minRank: r.minRank,
      minRankRequired: r.minRankLabel,
      perks: r.perks as string[],
      gradientColors: r.gradientColors as [string, string],
      codePrefix: r.sampleCode ?? '',
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      claims: r._count.claims,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async createReward(dto: CreateRewardDto) {
    await this.prisma.seasonReward.create({
      data: {
        id: randomUUID(),
        type: dto.type,
        title: dto.title.trim(),
        subtitle: dto.subtitle.trim(),
        description: dto.description.trim(),
        icon: dto.icon,
        tag: `Top ${dto.minRank}`,
        targetRole: dto.targetRole,
        minRank: dto.minRank,
        minRankLabel: rankLabel(dto.minRank, dto.targetRole),
        rankScope: 'board',
        sampleCode: dto.codePrefix?.toUpperCase() || null,
        perks: dto.perks.map((p) => p.trim()).filter(Boolean),
        gradientColors: dto.gradientColors?.length === 2 ? dto.gradientColors : REWARD_COLORS[dto.type],
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    this.rewardsChanged();
    return this.listRewards();
  }

  async updateReward(id: string, dto: UpdateRewardDto) {
    const reward = await this.prisma.seasonReward.findUnique({ where: { id } });
    if (!reward) throw new NotFoundException('Reward not found');

    const minRank = dto.minRank ?? reward.minRank;
    const targetRole = dto.targetRole ?? reward.targetRole;
    const data: Prisma.SeasonRewardUpdateInput = {
      minRank,
      targetRole,
      tag: `Top ${minRank}`,
      minRankLabel: rankLabel(minRank, targetRole),
    };
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.subtitle !== undefined) data.subtitle = dto.subtitle.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.perks !== undefined) data.perks = dto.perks.map((p) => p.trim()).filter(Boolean);
    if (dto.gradientColors?.length === 2) data.gradientColors = dto.gradientColors;
    if (dto.codePrefix !== undefined) data.sampleCode = dto.codePrefix.toUpperCase();
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.seasonReward.update({ where: { id }, data });
    this.rewardsChanged();
    return this.listRewards();
  }

  async deleteReward(id: string) {
    const reward = await this.prisma.seasonReward.findUnique({
      where: { id },
      include: { _count: { select: { claims: true } } },
    });
    if (!reward) throw new NotFoundException('Reward not found');
    if (reward._count.claims > 0) {
      throw new ConflictException(
        'Members have already claimed this reward. Turn it off instead so their claim history is kept.',
      );
    }
    await this.prisma.seasonReward.delete({ where: { id } });
    this.rewardsChanged();
    return this.listRewards();
  }

  private rewardsChanged(): void {
    this.realtime.emitToAll('rewards:updated', { at: Date.now() });
  }
}
