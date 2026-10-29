import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AiJob } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NoProviderError } from './ai-router.service.js';
import { MediaError } from './analysis/media-prep.js';
import { ProviderError } from './providers/provider.types.js';

export type AiJobKind = 'POST_REVIEW' | 'MENTOR_TEST';

/** Thrown by a handler when there's nothing to do (post deleted, not eligible...). */
export class SkipJob extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SkipJob';
  }
}

export interface JobHandler {
  run(job: AiJob): Promise<void>;
  /** Called once when the job is given up (out of retries / unusable input). */
  giveUp(job: AiJob, reason: string): Promise<void>;
}

const MAX_ATTEMPTS = 6;
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000, 6 * 60 * 60_000];
const LEASE_MS = 5 * 60_000;
const NOT_CONFIGURED_WAIT_MS = 24 * 60 * 60_000;

/**
 * Background AI work queue, stored in Postgres (no extra service needed).
 *
 * Why it can't break the app: requests only INSERT a job and return; the work
 * happens here, one job at a time. Failures are retried with back-off, a
 * crashed worker's job is picked up again after its lease expires, and when no
 * AI provider is available jobs simply wait. The worker only wakes when a job
 * is due — an idle app makes no database calls (so the free DB can sleep).
 */
@Injectable()
export class AiQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiQueueService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private timer?: NodeJS.Timeout;
  private nextAt = 0;
  private running = false;
  private stopped = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Pick up anything left from before a restart, shortly after boot.
    this.scheduleAt(Date.now() + 15_000);
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  register(kind: AiJobKind, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  /** Add (or re-arm) a job. Safe to call twice for the same thing. */
  async enqueue(kind: AiJobKind, refId: string, runAfter = new Date()): Promise<void> {
    await this.prisma.aiJob.upsert({
      where: { kind_refId: { kind, refId } },
      create: { kind, refId, runAfter },
      update: { status: 'PENDING', attempts: 0, runAfter, lockedUntil: null, lastError: null },
    });
    this.scheduleAt(runAfter.getTime() + 500);
  }

  private scheduleAt(ts: number): void {
    if (this.stopped) return;
    const at = Math.max(ts, Date.now() + 200);
    if (this.timer && this.nextAt && this.nextAt <= at) return;
    if (this.timer) clearTimeout(this.timer);
    this.nextAt = at;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.nextAt = 0;
      void this.drain();
    }, Math.min(at - Date.now(), 2_147_000_000));
    this.timer.unref?.();
  }

  /** Atomically take the next due job (or a RUNNING one whose lease expired). */
  private async claim(): Promise<AiJob | null> {
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const job = await this.prisma.aiJob.findFirst({
        where: {
          OR: [
            { status: 'PENDING', runAfter: { lte: now } },
            { status: 'RUNNING', lockedUntil: { lt: now } },
          ],
        },
        orderBy: { runAfter: 'asc' },
      });
      if (!job) return null;
      const res = await this.prisma.aiJob.updateMany({
        where: { id: job.id, status: job.status, lockedUntil: job.lockedUntil },
        data: { status: 'RUNNING', lockedUntil: new Date(Date.now() + LEASE_MS), attempts: { increment: 1 } },
      });
      if (res.count === 1) return { ...job, status: 'RUNNING', attempts: job.attempts + 1 };
    }
    return null;
  }

  /** Process due jobs one by one, then sleep until the next one is due. */
  async drain(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      for (;;) {
        if (this.stopped) return;
        const job = await this.claim();
        if (!job) break;
        await this.process(job);
      }
      const next = await this.prisma.aiJob.findFirst({
        where: { status: { in: ['PENDING', 'RUNNING'] } },
        orderBy: { runAfter: 'asc' },
        select: { runAfter: true, lockedUntil: true, status: true },
      });
      if (next) {
        const due = next.status === 'RUNNING' && next.lockedUntil ? next.lockedUntil : next.runAfter;
        this.scheduleAt(due.getTime() + 500);
      }
    } catch (e) {
      this.logger.warn(`AI queue paused: ${(e as Error).message}`);
      this.scheduleAt(Date.now() + 5 * 60_000); // DB hiccup → try again later
    } finally {
      this.running = false;
    }
  }

  private async finish(job: AiJob, status: 'DONE' | 'SKIPPED' | 'FAILED', lastError?: string) {
    await this.prisma.aiJob.update({
      where: { id: job.id },
      data: { status, lockedUntil: null, lastError: lastError?.slice(0, 500) ?? null },
    });
  }

  private async giveUp(job: AiJob, handler: JobHandler, reason: string) {
    try {
      await handler.giveUp(job, reason);
    } catch (e) {
      this.logger.warn(`AI give-up handler failed for ${job.kind} ${job.refId}: ${(e as Error).message}`);
    }
    await this.finish(job, 'FAILED', reason);
  }

  private async process(job: AiJob): Promise<void> {
    const handler = this.handlers.get(job.kind);
    if (!handler) {
      await this.finish(job, 'FAILED', `No handler for ${job.kind}`);
      return;
    }
    try {
      await handler.run(job);
      await this.finish(job, 'DONE');
    } catch (e) {
      const err = e as Error;
      if (e instanceof SkipJob) {
        await this.finish(job, 'SKIPPED', err.message);
      } else if (e instanceof MediaError) {
        await this.giveUp(job, handler, err.message); // the file itself is unusable
      } else if (e instanceof NoProviderError) {
        // Nobody can serve it right now: wait without using up a retry.
        const at = e.retryAt ? e.retryAt + 1_000 : Date.now() + NOT_CONFIGURED_WAIT_MS;
        await this.prisma.aiJob.update({
          where: { id: job.id },
          data: { status: 'PENDING', attempts: { decrement: 1 }, runAfter: new Date(at), lockedUntil: null, lastError: err.message.slice(0, 500) },
        });
      } else if ((e instanceof ProviderError && !e.retryable) || job.attempts >= MAX_ATTEMPTS) {
        await this.giveUp(job, handler, err.message);
      } else {
        const wait = BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)];
        await this.prisma.aiJob.update({
          where: { id: job.id },
          data: { status: 'PENDING', runAfter: new Date(Date.now() + wait), lockedUntil: null, lastError: err.message.slice(0, 500) },
        });
      }
      if (!(e instanceof SkipJob)) this.logger.warn(`AI ${job.kind} ${job.refId} (try ${job.attempts}): ${err.message.slice(0, 200)}`);
    }
  }

  /** Queue counts for the admin panel. */
  async counts() {
    const rows = await this.prisma.aiJob.groupBy({ by: ['kind', 'status'], _count: { _all: true } });
    return rows.map((r) => ({ kind: r.kind, status: r.status, count: r._count._all }));
  }
}
