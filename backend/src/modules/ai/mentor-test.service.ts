import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AiJob, MentorApplication, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { cleanSkill, MAX_SKILLS, skillKey } from '../../common/utils/skill.js';
import { isOwnUpload } from '../../common/utils/own-upload.js';
import { AiQueueService } from './ai-queue.service.js';
import { AiRouterService } from './ai-router.service.js';
import { AiJudgeService, type CritiqueJudgement, type Judgement } from './ai-judge.service.js';
import { AI_SKILLS, aiSkillOf, type AiSkillId } from './ai-skills.js';
import { drawTask, publicTask, type MentorTask } from './mentor-tasks.js';
import { prepareAudio } from './analysis/media-prep.js';

/** Decision thresholds on the combined score (70% performance, 30% critique). */
export const PASS_SCORE = 75;
export const FAIL_SCORE = 55;
/** Below this confidence the AI never decides alone — an admin reviews. */
const MIN_CONFIDENCE = 0.6;
export const RETRY_DAYS = 7;
const GRACE_MS = 2 * 60_000; // upload time on slow networks

type Decision = 'PASSED' | 'REVIEW' | 'FAILED';

/**
 * AI mentor test (AI 2, part 1). Replaces the 5-question quiz for skills the
 * AI can judge. A random live task + a critique task; the AI scores both;
 * clear passes become Mentors, clear fails can retry after 7 days, and
 * everything uncertain goes to an admin.
 */
@Injectable()
export class MentorTestService implements OnModuleInit {
  private readonly logger = new Logger(MentorTestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: AiQueueService,
    private readonly router: AiRouterService,
    private readonly judge: AiJudgeService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    this.queue.register('MENTOR_TEST', {
      run: (job) => this.evaluate(job),
      giveUp: (job, reason) => this.toReview(job.refId, `AI could not finish: ${reason}`),
    });
  }

  private async testEnabled(skill: AiSkillId): Promise<boolean> {
    const row = await this.prisma.aiSkillSetting.findUnique({ where: { skill } });
    return row?.mentorTestEnabled ?? true;
  }

  private async expireStale(userId: string) {
    await this.prisma.mentorApplication.updateMany({
      where: { userId, status: 'STARTED', expiresAt: { lt: new Date(Date.now() - GRACE_MS) } },
      data: { status: 'EXPIRED' },
    });
  }

  private view(a: MentorApplication, includeTask = false) {
    const result = (a.aiResult ?? null) as any;
    return {
      id: a.id,
      skill: a.skill,
      skillLabel: a.skillLabel,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
      expiresAt: a.expiresAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      score: a.aiScore,
      performanceScore: a.performanceScore,
      critiqueScore: a.critiqueScore,
      // Feedback for the applicant (no hidden judge notes).
      feedback:
        a.status === 'PASSED' || a.status === 'FAILED'
          ? {
              summary: result?.performance?.summary ?? '',
              strengths: result?.performance?.strengths ?? [],
              improvements: result?.performance?.improvements ?? [],
              critiqueSummary: result?.critique?.summary ?? '',
            }
          : null,
      decisionNote: a.status === 'FAILED' || a.status === 'PASSED' ? a.decisionNote : null,
      retryAfter: a.retryAfter?.toISOString() ?? null,
      ...(includeTask ? { task: publicTask(a.task as unknown as MentorTask) } : {}),
    };
  }

  // ---------------------------------------------------------------- applicant

  /** Which kind of mentor test a skill uses, and where the member stands. */
  async eligibility(userId: string, label?: string) {
    const skillLabel = cleanSkill(label);
    const skill = aiSkillOf(skillLabel);
    if (!skill || !(await this.testEnabled(skill))) return { mode: 'quiz' as const, skill: null, application: null };
    await this.expireStale(userId);
    const last = await this.prisma.mentorApplication.findFirst({
      where: { userId, skill },
      orderBy: { createdAt: 'desc' },
    });
    return { mode: 'ai' as const, skill, label: AI_SKILLS[skill].label, application: last ? this.view(last, last.status === 'STARTED') : null };
  }

  /** Start (or resume) a test: draws a random task and starts the clock. */
  async start(userId: string, label: string) {
    const skillLabel = cleanSkill(label);
    const skill = aiSkillOf(skillLabel);
    if (!skill) throw new BadRequestException('This skill uses the written mentor quiz');
    if (!(await this.testEnabled(skill))) throw new BadRequestException('The AI mentor test is turned off for this skill');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true, skills: { select: { skillKey: true, role: true } } },
    });
    if (!user || user.deletedAt) throw new NotFoundException('Account not found');
    const mine = user.skills.find((s) => s.skillKey === skillKey(skillLabel));
    if (mine?.role === UserRole.MENTOR) throw new BadRequestException(`You’re already a Mentor in ${skillLabel}`);
    if (!mine && user.skills.length >= MAX_SKILLS) throw new BadRequestException(`You can have up to ${MAX_SKILLS} skills`);

    await this.expireStale(userId);
    const recent = await this.prisma.mentorApplication.findFirst({ where: { userId, skill }, orderBy: { createdAt: 'desc' } });
    if (recent?.status === 'STARTED') return this.view(recent, true); // resume
    if (recent && ['SUBMITTED', 'REVIEW'].includes(recent.status)) {
      throw new ConflictException('Your mentor test is being reviewed — we’ll notify you');
    }
    if (recent?.retryAfter && recent.retryAfter.getTime() > Date.now()) {
      throw new ForbiddenException(`You can retake the test after ${recent.retryAfter.toDateString()}`);
    }

    const task = drawTask(skill);
    const app = await this.prisma.mentorApplication.create({
      data: {
        userId,
        skill,
        skillLabel,
        task: task as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + task.timeLimitSec * 1000),
      },
    });
    return this.view(app, true);
  }

  /** Hand in the test. The AI judges it in the background. */
  async submit(
    userId: string,
    id: string,
    body: { codeAnswer?: string; recordingUrl?: string; recordingMime?: string; durationMs?: number; critiqueText: string },
    /** Runs after the answer is saved but BEFORE judging starts. */
    beforeJudging?: (skillLabel: string) => Promise<void>,
  ) {
    const app = await this.prisma.mentorApplication.findUnique({ where: { id } });
    if (!app || app.userId !== userId) throw new NotFoundException('Mentor test not found');
    if (app.status !== 'STARTED') throw new BadRequestException('This test was already handed in');
    if (app.expiresAt.getTime() + GRACE_MS < Date.now()) {
      await this.prisma.mentorApplication.update({ where: { id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Time is up for this test — start a new one');
    }
    const task = app.task as unknown as MentorTask;
    const critique = (body.critiqueText ?? '').trim();
    if (critique.length < 40) throw new BadRequestException('Write a little more feedback for the learner (at least 40 characters)');

    const data: Prisma.MentorApplicationUpdateInput = {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      critiqueText: critique.slice(0, 6000),
    };
    if (task.mode === 'code') {
      const code = (body.codeAnswer ?? '').trim();
      if (code.length < 20) throw new BadRequestException('Write your solution before handing in');
      data.codeAnswer = code.slice(0, 20000);
    } else {
      const url = body.recordingUrl ?? '';
      if (!url || !isOwnUpload(url)) throw new BadRequestException('Record your performance in the app first');
      const mime = (body.recordingMime ?? '').toLowerCase();
      if (mime && !mime.startsWith('audio/') && !mime.startsWith('video/')) throw new BadRequestException('The recording must be audio');
      data.recordingUrl = url;
      data.recordingMime = mime || null;
      data.durationMs = Number.isFinite(body.durationMs) ? Math.max(0, Math.round(body.durationMs!)) : null;
    }
    const updated = await this.prisma.mentorApplication.update({ where: { id }, data });
    if (beforeJudging) await beforeJudging(updated.skillLabel);
    await this.queue.enqueue('MENTOR_TEST', id);
    return this.view(updated);
  }

  async mine(userId: string) {
    await this.expireStale(userId);
    const rows = await this.prisma.mentorApplication.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return rows.map((r) => this.view(r));
  }

  // ---------------------------------------------------------------- evaluation

  private async evaluate(job: AiJob): Promise<void> {
    const app = await this.prisma.mentorApplication.findUnique({ where: { id: job.refId } });
    if (!app || app.status !== 'SUBMITTED') return; // already decided / withdrawn
    const task = app.task as unknown as MentorTask;

    // No AI configured at all → straight to a human instead of waiting a day.
    if (!this.router.anyConfigured() || (task.mode === 'audio' && task.skill === 'music' && !this.router.canHearConfigured())) {
      await this.toReview(app.id, 'AI is not set up for this skill yet — an admin will review your test');
      return;
    }

    let perf: Judgement;
    if (task.mode === 'code') {
      perf = await this.judge.codingTest(task.prompt, task.judgeNotes, app.codeAnswer ?? '');
    } else {
      const audio = await prepareAudio(app.recordingUrl!, app.recordingMime);
      perf = await this.judge.audioPost(task.skill as 'music' | 'spoken_english', audio, {
        task: task.prompt,
        checkPhrase: task.checkPhrase,
        judgeNotes: task.judgeNotes,
      });
    }
    const crit: CritiqueJudgement = await this.judge.critique(task.skill, task.critique.content, task.critique.keyIssues, app.critiqueText ?? '');

    const perfScore = perf.overall ?? 0;
    const critScore = crit.overall ?? 0;
    // Doing the wrong task can't pass, however well it was done.
    const compliance = perf.taskCompliance ?? 100;
    const combined = Math.round(0.7 * Math.min(perfScore, compliance >= 50 ? 100 : compliance + 20) + 0.3 * critScore);
    const confidence = Math.min(perf.confidence, crit.confidence);

    const notes: string[] = [];
    if (task.mode === 'audio') {
      const seconds = (perf.metrics?.pitch?.seconds ?? perf.metrics?.speech?.seconds ?? (app.durationMs ?? 0) / 1000) || 0;
      if (task.minSec && seconds > 0 && seconds < task.minSec * 0.8) notes.push(`Recording is short (${Math.round(seconds)}s, asked for at least ${task.minSec}s)`);
      if (perf.checkPhraseHeard === false) notes.push('The check phrase was not heard at the start');
      if (perf.checkPhraseHeard == null) notes.push('Could not verify the check phrase');
    }
    if (confidence < MIN_CONFIDENCE) notes.push(`AI confidence is low (${Math.round(confidence * 100)}%)`);
    if (perf.metrics?.partial) notes.push('Only partial measurements were available');

    let decision: Decision = combined >= PASS_SCORE ? 'PASSED' : combined < FAIL_SCORE ? 'FAILED' : 'REVIEW';
    // Any doubt about who performed or how sure the AI is → a human decides.
    if (notes.length > 0 && decision !== 'REVIEW') decision = 'REVIEW';

    const aiResult = {
      performance: { ...perf, metrics: perf.metrics ?? null },
      critique: crit,
      combined,
      confidence,
      thresholds: { pass: PASS_SCORE, fail: FAIL_SCORE },
    } as unknown as Prisma.InputJsonValue;

    await this.prisma.mentorApplication.update({
      where: { id: app.id },
      data: {
        aiScore: combined,
        performanceScore: perfScore,
        critiqueScore: critScore,
        aiResult,
        aiNote: notes.join(' · ') || null,
      },
    });
    await this.decide(app.id, decision, null, decision === 'REVIEW' ? notes.join(' · ') || 'Score is close to the pass mark' : null);
  }

  private async toReview(id: string, note: string) {
    await this.prisma.mentorApplication.updateMany({ where: { id, status: 'SUBMITTED' }, data: { aiNote: note } });
    await this.decide(id, 'REVIEW', null, note);
  }

  /** Apply a decision (by the AI, or by an admin). */
  async decide(id: string, decision: Decision, adminId: string | null, note: string | null) {
    const app = await this.prisma.mentorApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Mentor test not found');
    const open = adminId ? ['SUBMITTED', 'REVIEW'] : ['SUBMITTED'];
    if (!open.includes(app.status)) {
      if (adminId) throw new BadRequestException('This test was already decided');
      return;
    }
    const retryAfter = decision === 'FAILED' ? new Date(Date.now() + RETRY_DAYS * 86400_000) : null;
    const res = await this.prisma.mentorApplication.updateMany({
      where: { id, status: { in: open } },
      data: {
        status: decision,
        retryAfter,
        ...(adminId ? { decidedById: adminId, decidedAt: new Date(), decisionNote: note } : decision !== 'REVIEW' ? { decidedAt: new Date() } : {}),
      },
    });
    if (res.count !== 1) return;

    if (decision === 'PASSED') await this.grantMentor(app.userId, app.skillLabel);
    const label = app.skillLabel;
    const title =
      decision === 'PASSED' ? `You’re now a ${label} Mentor 🎉` : decision === 'FAILED' ? `${label} mentor test result` : `${label} mentor test is being reviewed`;
    const body =
      decision === 'PASSED'
        ? `Congratulations! You passed the ${label} mentor test${app.aiScore != null ? ` with ${app.aiScore}/100` : ''}.`
        : decision === 'FAILED'
        ? `Not this time${app.aiScore != null ? ` (${app.aiScore}/100, pass mark ${PASS_SCORE})` : ''}. See your feedback and try again after ${RETRY_DAYS} days.`
        : 'An admin will check your test soon. Keep learning in the meantime!';
    await this.notifications
      .create({ userId: app.userId, type: 'SYSTEM', title, body, data: { kind: 'mentor-test', applicationId: id, skill: app.skill } })
      .catch((e) => this.logger.warn(`Mentor-test notification failed: ${(e as Error).message}`));
    this.realtime.emitToUser(app.userId, 'mentor-test:updated', { id, status: decision });
  }

  /** Become a Mentor in this skill only — other skills keep their roles. */
  private async grantMentor(userId: string, label: string) {
    const key = skillKey(label);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, hobby: true, skills: { select: { id: true, skillKey: true } } },
    });
    if (!user) return;
    const existing = user.skills.find((s) => s.skillKey === key);
    if (existing) await this.prisma.userSkill.update({ where: { id: existing.id }, data: { role: UserRole.MENTOR } });
    else await this.prisma.userSkill.create({ data: { userId, skill: label, skillKey: key, role: UserRole.MENTOR } });
    // The account's own role follows its main skill.
    const isMember = user.role === UserRole.LEARNER || user.role === UserRole.MENTOR;
    if (!isMember || user.skills.length === 0 || skillKey(user.hobby) === key) {
      await this.prisma.user.update({ where: { id: userId }, data: { role: UserRole.MENTOR, hobby: existing ? undefined : label } });
    }
  }

  // ---------------------------------------------------------------- admin

  async adminList(status?: string) {
    const rows = await this.prisma.mentorApplication.findMany({
      where: status ? { status } : { status: { not: 'STARTED' } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    return rows.map((r) => ({
      ...this.view(r),
      user: { id: r.user.id, name: r.user.name, email: r.user.email, avatarUrl: r.user.avatarUrl ?? '' },
      aiNote: r.aiNote,
    }));
  }

  async adminDetail(id: string) {
    const r = await this.prisma.mentorApplication.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    if (!r) throw new NotFoundException('Mentor test not found');
    return {
      ...this.view(r),
      user: { id: r.user.id, name: r.user.name, email: r.user.email, avatarUrl: r.user.avatarUrl ?? '' },
      task: r.task, // full task incl. hidden notes — admins only
      recordingUrl: r.recordingUrl,
      codeAnswer: r.codeAnswer,
      critiqueText: r.critiqueText,
      aiResult: r.aiResult,
      aiNote: r.aiNote,
      decisionNote: r.decisionNote,
    };
  }

  async adminRerun(id: string) {
    const r = await this.prisma.mentorApplication.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Mentor test not found');
    if (!['SUBMITTED', 'REVIEW'].includes(r.status)) throw new BadRequestException('Only tests awaiting a decision can be re-run');
    await this.prisma.mentorApplication.update({ where: { id }, data: { status: 'SUBMITTED', aiNote: null } });
    await this.queue.enqueue('MENTOR_TEST', id);
    return { queued: true };
  }
}
