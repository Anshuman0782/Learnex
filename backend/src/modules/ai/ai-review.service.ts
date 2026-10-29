import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AiJob, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { skillKey } from '../../common/utils/skill.js';
import { AiQueueService, SkipJob } from './ai-queue.service.js';
import { AiRouterService, NoProviderError } from './ai-router.service.js';
import { AiJudgeService, type Judgement } from './ai-judge.service.js';
import { AI_SKILLS, AI_SKILL_IDS, aiSkillOf, type AiSkillId } from './ai-skills.js';
import { prepareAudio, MediaError } from './analysis/media-prep.js';

/** Fewer than this many reviewed posts → "collecting", no trend yet. */
export const MIN_POSTS_FOR_TREND = 3;
/** Reviews below this confidence are shown but never used for trends. */
export const TREND_MIN_CONFIDENCE = 0.5;
const MIN_CODE_CHARS = 30;

/**
 * Learner Progress (AI 1): every public post in an AI skill gets a review in
 * the background; progress comes from comparing recent scores with earlier
 * ones (our maths, not the AI's opinion).
 */
@Injectable()
export class AiReviewService implements OnModuleInit {
  private readonly logger = new Logger(AiReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: AiQueueService,
    private readonly router: AiRouterService,
    private readonly judge: AiJudgeService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    this.queue.register('POST_REVIEW', {
      run: (job) => this.review(job),
      giveUp: (job, reason) => this.onGiveUp(job, reason),
    });
  }

  async settings() {
    const rows = await this.prisma.aiSkillSetting.findMany();
    const map = new Map(rows.map((r) => [r.skill, r]));
    return AI_SKILL_IDS.map((id) => ({
      skill: id,
      label: AI_SKILLS[id].label,
      progressEnabled: map.get(id)?.progressEnabled ?? true,
      mentorTestEnabled: map.get(id)?.mentorTestEnabled ?? true,
    }));
  }

  private async progressEnabled(skill: AiSkillId): Promise<boolean> {
    const row = await this.prisma.aiSkillSetting.findUnique({ where: { skill } });
    return row?.progressEnabled ?? true;
  }

  /**
   * Called right after a post is created. Never throws — a problem here must
   * never stop someone from posting.
   */
  async onPostPublished(post: { id: string; skill: string | null; isPrivate: boolean; scheduledAt: Date | null }): Promise<void> {
    try {
      if (post.isPrivate) return;
      const skill = aiSkillOf(post.skill);
      if (!skill || !(await this.progressEnabled(skill))) return;
      const runAfter = post.scheduledAt && post.scheduledAt.getTime() > Date.now() ? post.scheduledAt : new Date();
      await this.queue.enqueue('POST_REVIEW', post.id, runAfter);
    } catch (e) {
      this.logger.warn(`Could not queue AI review for ${post.id}: ${(e as Error).message}`);
    }
  }

  private async review(job: AiJob): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: job.refId },
      include: { author: { select: { id: true, role: true, deletedAt: true, skills: { select: { skillKey: true, role: true } } } } },
    });
    if (!post || post.deletedAt || post.isHidden || post.isPrivate) throw new SkipJob('Post not public');
    if (post.scheduledAt && post.scheduledAt.getTime() > Date.now() + 5_000) throw new SkipJob('Post not published yet');
    if (post.author.deletedAt || post.author.role === UserRole.GUEST) throw new SkipJob('Author not a member');
    const skill = aiSkillOf(post.skill);
    if (!skill) throw new SkipJob('Skill not AI-judged');
    // Only for members who actually hold this skill (Learner or Mentor in it).
    if (!post.author.skills.some((s) => s.skillKey === skillKey(post.skill))) throw new SkipJob('Author has not joined this skill');
    if (!(await this.progressEnabled(skill))) throw new SkipJob('AI progress disabled for this skill');

    let j: Judgement;
    if (skill === 'coding') {
      const text = `${post.content ?? ''}`.trim();
      if (text.replace(/\s/g, '').length < MIN_CODE_CHARS) throw new SkipJob('Not enough code/text to review');
      j = await this.judge.codingPost(post.title ?? '', text);
    } else {
      const url = post.audioUrl || post.videoUrl;
      if (!url) throw new SkipJob('No recording to review');
      const audio = await prepareAudio(url);
      try {
        j = await this.judge.audioPost(skill, audio, { title: post.title ?? '', description: post.content ?? '' });
      } catch (e) {
        // Music with no listening model configured at all → our measurements only.
        if (skill === 'music' && e instanceof NoProviderError && !this.router.canHearConfigured()) {
          const partial = this.judge.musicFromMeasurementsOnly(audio);
          if (!partial) throw new SkipJob('No clear pitched sound to measure');
          j = partial;
        } else throw e;
      }
    }
    if (j.overall === null) throw new SkipJob('Nothing could be scored');
    await this.save(post.id, post.authorId, skill, post.skill ?? AI_SKILLS[skill].label, j);
  }

  private async save(postId: string, userId: string, skill: AiSkillId, label: string, j: Judgement) {
    const data = {
      userId,
      skill,
      skillLabel: label,
      rubricVersion: AI_SKILLS[skill].version,
      overall: j.overall ?? 0,
      scores: j.scores as Prisma.InputJsonValue,
      strengths: j.strengths as Prisma.InputJsonValue,
      improvements: j.improvements as Prisma.InputJsonValue,
      summary: j.summary,
      confidence: j.confidence,
      metrics: (j.metrics ?? undefined) as Prisma.InputJsonValue | undefined,
      transcript: j.transcript,
      provider: j.provider,
      model: j.model,
    };
    await this.prisma.aiReview.upsert({ where: { postId }, create: { postId, ...data }, update: data });
    this.realtime.emitToUser(userId, 'ai:review', { postId, skill, overall: j.overall });
  }

  private async onGiveUp(job: AiJob, reason: string): Promise<void> {
    // Music: if we at least have the recording, keep our own pitch measurement.
    const post = await this.prisma.post.findUnique({ where: { id: job.refId } });
    if (!post || aiSkillOf(post.skill) !== 'music' || !(post.audioUrl || post.videoUrl)) return;
    try {
      const audio = await prepareAudio(post.audioUrl || post.videoUrl!);
      const partial = this.judge.musicFromMeasurementsOnly(audio);
      if (partial) await this.save(post.id, post.authorId, 'music', post.skill ?? 'Music', partial);
    } catch (e) {
      if (!(e instanceof MediaError)) this.logger.warn(`Music fallback failed (${reason}): ${(e as Error).message}`);
    }
  }

  // ---------------------------------------------------------------- reads

  /** The AI review of a post — only its author may see it. */
  async forPost(userId: string, postId: string) {
    const r = await this.prisma.aiReview.findUnique({ where: { postId } });
    if (!r || r.userId !== userId) {
      const pending = await this.prisma.aiJob.findUnique({ where: { kind_refId: { kind: 'POST_REVIEW', refId: postId } } });
      const own = await this.prisma.post.findFirst({ where: { id: postId, authorId: userId }, select: { id: true } });
      return { status: own && pending && ['PENDING', 'RUNNING'].includes(pending.status) ? 'reviewing' : 'none' } as const;
    }
    return { status: 'done' as const, review: this.view(r) };
  }

  private view(r: Prisma.AiReviewGetPayload<object>) {
    const def = AI_SKILLS[r.skill as AiSkillId];
    const scores = (r.scores ?? {}) as Record<string, number | null>;
    return {
      postId: r.postId,
      skill: r.skill,
      skillLabel: r.skillLabel,
      overall: r.overall,
      criteria: (def?.criteria ?? []).map((c) => ({ key: c.key, label: c.label, score: scores[c.key] ?? null })),
      strengths: (r.strengths ?? []) as string[],
      improvements: (r.improvements ?? []) as string[],
      summary: r.summary,
      confidence: Math.round(r.confidence * 100) / 100,
      partial: !!(r.metrics as any)?.partial,
      metrics: r.metrics,
      createdAt: r.createdAt.toISOString(),
    };
  }

  /**
   * Progress per AI skill for one member. Each post's score = AI overall,
   * blended 70/30 with real mentors' ratings when mentors rated it. Trend =
   * average of the recent half (max 5) vs the earlier posts (max 5).
   */
  async progress(userId: string) {
    const reviews = await this.prisma.aiReview.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        post: {
          select: {
            title: true,
            comments: {
              where: { isMentorCritique: true, mentorRating: { not: null }, deletedAt: null, authorId: { not: userId } },
              select: { mentorRating: true },
            },
          },
        },
      },
    });
    const pending = await this.prisma.aiJob.count({
      where: { kind: 'POST_REVIEW', status: { in: ['PENDING', 'RUNNING'] }, refId: { in: await this.myPostIds(userId) } },
    });

    const out = [];
    for (const id of AI_SKILL_IDS) {
      const mine = reviews.filter((r) => r.skill === id);
      if (mine.length === 0) continue;
      const def = AI_SKILLS[id];
      const points = mine.map((r) => {
        const ratings = r.post.comments.map((c) => c.mentorRating!).filter((n) => n >= 1 && n <= 5);
        const mentor = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20 : null;
        const score = mentor === null ? r.overall : Math.round(0.7 * r.overall + 0.3 * mentor);
        return { r, score, mentorRated: mentor !== null };
      });
      const trusted = points.filter((p) => p.r.confidence >= TREND_MIN_CONFIDENCE);
      const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

      let trend: 'up' | 'down' | 'steady' | null = null;
      let changePct: number | null = null;
      let recentAvg: number | null = null;
      let earlierAvg: number | null = null;
      if (trusted.length >= MIN_POSTS_FOR_TREND) {
        const recentN = Math.min(5, Math.ceil(trusted.length / 2));
        const recent = trusted.slice(-recentN);
        const earlier = trusted.slice(0, -recentN).slice(-5);
        recentAvg = avg(recent.map((p) => p.score));
        earlierAvg = avg(earlier.map((p) => p.score));
        if (recentAvg !== null && earlierAvg !== null) {
          changePct = Math.round(((recentAvg - earlierAvg) / Math.max(earlierAvg, 1)) * 100);
          trend = changePct >= 3 ? 'up' : changePct <= -3 ? 'down' : 'steady';
        }
      }

      // Per-criterion average over the recent reviews (what's strong / weak now).
      const recentReviews = (trusted.length ? trusted : points).slice(-5).map((p) => p.r);
      const criteria = def.criteria.map((c) => {
        const vals = recentReviews.map((r) => (r.scores as Record<string, number | null>)[c.key]).filter((v): v is number => typeof v === 'number');
        return { key: c.key, label: c.label, score: avg(vals) };
      });
      const scored = criteria.filter((c) => c.score !== null) as { key: string; label: string; score: number }[];
      const strongest = scored.length ? scored.reduce((a, b) => (b.score > a.score ? b : a)) : null;
      const weakest = scored.length ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null;
      const latest = mine[mine.length - 1];

      out.push({
        skill: id,
        label: def.label,
        skillLabel: latest.skillLabel,
        reviewedPosts: mine.length,
        status: trusted.length >= MIN_POSTS_FOR_TREND ? 'ready' : 'collecting',
        neededPosts: Math.max(0, MIN_POSTS_FOR_TREND - trusted.length),
        trend,
        changePct,
        currentScore: recentAvg ?? avg(points.slice(-3).map((p) => p.score)),
        earlierScore: earlierAvg,
        criteria,
        strongest: strongest?.label ?? null,
        weakest: weakest?.label ?? null,
        latest: {
          postId: latest.postId,
          title: latest.post.title ?? '',
          overall: latest.overall,
          strengths: (latest.strengths ?? []) as string[],
          improvements: (latest.improvements ?? []) as string[],
          summary: latest.summary,
          partial: !!(latest.metrics as any)?.partial,
          createdAt: latest.createdAt.toISOString(),
        },
        history: points.slice(-12).map((p) => ({ postId: p.r.postId, score: p.score, at: p.r.createdAt.toISOString(), mentorRated: p.mentorRated, partial: !!(p.r.metrics as any)?.partial })),
        since: mine[0].createdAt.toISOString(),
      });
    }
    // Skills the member holds that the AI can judge (even with no reviews yet).
    const held = await this.prisma.userSkill.findMany({ where: { userId }, select: { skill: true }, orderBy: { createdAt: 'asc' } });
    const eligible: { skill: AiSkillId; label: string; skillLabel: string }[] = [];
    for (const h of held) {
      const id = aiSkillOf(h.skill);
      if (id && !eligible.some((e) => e.skill === id)) eligible.push({ skill: id, label: AI_SKILLS[id].label, skillLabel: h.skill });
    }
    return { skills: out, reviewing: pending, eligible, minPosts: MIN_POSTS_FOR_TREND };
  }

  private async myPostIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.post.findMany({
      where: { authorId: userId, deletedAt: null, createdAt: { gte: new Date(Date.now() - 14 * 86400_000) } },
      select: { id: true },
      take: 200,
    });
    return rows.map((r) => r.id);
  }
}
