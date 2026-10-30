import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { utcDay } from '../gamification/leveling.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { GroqProvider } from './providers/groq.provider.js';
import {
  ProviderError,
  type AiMedia,
  type AiProvider,
  type JsonRequest,
  type JsonResult,
  type Transcript,
} from './providers/provider.types.js';

/** No provider can serve this request right now (not configured / all cooling down). */
export class NoProviderError extends Error {
  constructor(
    message: string,
    /** When it makes sense to try again (ms epoch); null = nothing configured. */
    readonly retryAt: number | null,
  ) {
    super(message);
    this.name = 'NoProviderError';
  }
}

/**
 * Chooses which AI provider handles each request, in order of preference,
 * and keeps us inside the free tiers:
 *  - Gemini first (it can hear audio), Groq as backup for text/transcripts;
 *  - a minimum gap between requests (per-minute limits);
 *  - our own daily cap per provider (stops before the free daily quota);
 *  - a cooldown on a provider after rate-limit / auth / outage errors.
 * Swapping or adding a provider only touches this file.
 */
@Injectable()
export class AiRouterService {
  private readonly logger = new Logger(AiRouterService.name);
  readonly providers: AiProvider[];
  private readonly coolUntil = new Map<string, number>();
  private readonly lastError = new Map<string, string>();
  /** Last successful request per provider: when, and how long it took. */
  private readonly lastOk = new Map<string, { at: number; ms: number }>();
  private readonly dailyLimit: Record<string, number>;
  private readonly minGapMs: number;
  private lastCallAt = 0;
  private gate: Promise<void> = Promise.resolve();

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.providers = [new GeminiProvider(config), new GroqProvider(config)];
    const num = (k: string, d: number) => {
      const v = Number.parseInt(config.get<string>(k) ?? '', 10);
      return Number.isFinite(v) && v >= 0 ? v : d;
    };
    this.dailyLimit = { gemini: num('AI_DAILY_LIMIT_GEMINI', 200), groq: num('AI_DAILY_LIMIT_GROQ', 500) };
    this.minGapMs = num('AI_MIN_GAP_MS', 4500);
  }

  get(name: string): AiProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  anyConfigured(): boolean {
    return this.providers.some((p) => p.configured());
  }

  canHearConfigured(): boolean {
    return this.providers.some((p) => p.configured() && p.canHear);
  }

  /** Status for the admin panel. */
  async status() {
    const day = utcDay();
    const usage = await this.prisma.aiUsageDay.findMany({ where: { day } });
    return this.providers.map((p) => {
      const u = usage.find((x) => x.provider === p.name);
      const cool = this.coolUntil.get(p.name) ?? 0;
      return {
        name: p.name,
        model: p.model,
        configured: p.configured(),
        canHear: p.canHear,
        requestsToday: u?.requests ?? 0,
        failuresToday: u?.failures ?? 0,
        dailyLimit: this.dailyLimit[p.name] ?? null,
        coolingUntil: cool > Date.now() ? new Date(cool).toISOString() : null,
        lastError: this.lastError.get(p.name) ?? null,
        lastOkAt: this.lastOk.has(p.name) ? new Date(this.lastOk.get(p.name)!.at).toISOString() : null,
        lastOkMs: this.lastOk.get(p.name)?.ms ?? null,
      };
    });
  }

  private async usedToday(name: string): Promise<number> {
    const row = await this.prisma.aiUsageDay.findUnique({ where: { day_provider: { day: utcDay(), provider: name } } });
    return row?.requests ?? 0;
  }

  private async count(name: string, failed: boolean): Promise<void> {
    const day = utcDay();
    await this.prisma.aiUsageDay
      .upsert({
        where: { day_provider: { day, provider: name } },
        create: { day, provider: name, requests: 1, failures: failed ? 1 : 0 },
        update: { requests: { increment: 1 }, ...(failed ? { failures: { increment: 1 } } : {}) },
      })
      .catch(() => undefined);
  }

  /** Providers that are configured, not cooling down, and under today's cap. */
  private async usable(filter: (p: AiProvider) => boolean): Promise<{ list: AiProvider[]; retryAt: number | null }> {
    const now = Date.now();
    const list: AiProvider[] = [];
    let retryAt: number | null = null;
    for (const p of this.providers.filter((x) => x.configured() && filter(x))) {
      const cool = this.coolUntil.get(p.name) ?? 0;
      if (cool > now) {
        retryAt = retryAt === null ? cool : Math.min(retryAt, cool);
        continue;
      }
      const limit = this.dailyLimit[p.name];
      if (limit !== undefined && (await this.usedToday(p.name)) >= limit) {
        const d = new Date();
        const tomorrow = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 5);
        this.coolUntil.set(p.name, tomorrow);
        retryAt = retryAt === null ? tomorrow : Math.min(retryAt, tomorrow);
        continue;
      }
      list.push(p);
    }
    return { list, retryAt };
  }

  /** Requests are spaced out (one at a time, `minGapMs` apart). */
  private async spaced<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.gate;
    let release!: () => void;
    this.gate = new Promise<void>((r) => (release = r));
    await prev;
    try {
      const wait = this.lastCallAt + this.minGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCallAt = Date.now();
      return await fn();
    } finally {
      release();
    }
  }

  private async attempt<T>(p: AiProvider, fn: () => Promise<T>): Promise<T> {
    try {
      let started = 0;
      const out = await this.spaced(() => {
        started = Date.now();
        return fn();
      });
      this.lastOk.set(p.name, { at: Date.now(), ms: Date.now() - started });
      await this.count(p.name, false);
      this.lastError.delete(p.name);
      this.coolUntil.delete(p.name); // it works again → no need to keep it resting
      return out;
    } catch (e) {
      await this.count(p.name, true);
      const err = e instanceof ProviderError ? e : new ProviderError((e as Error).message, true, 15_000);
      this.lastError.set(p.name, err.message.slice(0, 300));
      if (err.cooldownMs > 0) this.coolUntil.set(p.name, Date.now() + err.cooldownMs);
      this.logger.warn(`${p.name} failed: ${err.message.slice(0, 200)}`);
      throw err;
    }
  }

  private noProvider(what: string, retryAt: number | null): NoProviderError {
    return new NoProviderError(
      retryAt ? `${what}: providers are resting until ${new Date(retryAt).toISOString()}` : `${what}: no AI provider is configured`,
      retryAt,
    );
  }

  /**
   * A JSON answer from the first provider that can do it. With `media`, only
   * providers that can hear are used. Throws NoProviderError when none is
   * usable, or the last ProviderError when all usable ones failed.
   */
  async json(req: JsonRequest): Promise<JsonResult> {
    const { list, retryAt } = await this.usable((p) => !req.media || p.canHear);
    if (list.length === 0) throw this.noProvider('AI judge', retryAt);
    let last: ProviderError | null = null;
    for (const p of list) {
      try {
        return await this.attempt(p, () => p.generateJson(req));
      } catch (e) {
        last = e as ProviderError;
      }
    }
    throw last!;
  }

  /** Speech-to-text: Groq Whisper first (timestamps), then Gemini. */
  async transcribe(media: AiMedia, language?: string): Promise<Transcript> {
    const { list, retryAt } = await this.usable((p) => p.canTranscribe && !!p.transcribe);
    const ordered = [...list].sort((a, b) => Number(b.name === 'groq') - Number(a.name === 'groq'));
    if (ordered.length === 0) throw this.noProvider('Transcription', retryAt);
    let last: ProviderError | null = null;
    for (const p of ordered) {
      try {
        return await this.attempt(p, () => p.transcribe!(media, language));
      } catch (e) {
        last = e as ProviderError;
      }
    }
    throw last!;
  }

  /**
   * Admin "test connection": a tiny text request per configured provider, plus
   * a short audio clip to the listening model and to speech-to-text — the same
   * paths Music and Spoken English use.
   */
  async ping(tone?: AiMedia | null) {
    const out: { name: string; label: string; ok: boolean; ms: number; error?: string }[] = [];
    const run = async (p: AiProvider, name: string, label: string, fn: () => Promise<unknown>, check: (r: any) => boolean) => {
      const t = Date.now();
      try {
        const r = await this.attempt(p, fn as () => Promise<any>);
        const ok = check(r);
        out.push({ name, label, ok, ms: Date.now() - t, ...(ok ? {} : { error: 'Unexpected reply' }) });
      } catch (e) {
        out.push({ name, label, ok: false, ms: Date.now() - t, error: (e as Error).message.slice(0, 300) });
      }
    };
    for (const p of this.providers) {
      if (!p.configured()) {
        out.push({ name: p.name, label: `${p.name} (text)`, ok: false, ms: 0, error: 'No API key set' });
        continue;
      }
      await run(p, p.name, `${p.name} · text`, () => p.generateJson({ system: 'Reply only with JSON.', prompt: 'Return {"ok": true}.' }), (r) => r?.data?.ok === true);
      if (tone && p.canHear) {
        await run(
          p,
          `${p.name}-audio`,
          `${p.name} · listening (audio)`,
          () => p.generateJson({ system: 'Reply only with JSON.', prompt: 'Listen to the attached short clip. Return {"ok": true, "heard": "<what you hear, 3 words>"}.', media: tone }),
          (r) => r?.data?.ok === true,
        );
      }
      if (tone && p.canTranscribe && p.name === 'groq' && p.transcribe) {
        await run(p, `${p.name}-speech`, `${p.name} · speech-to-text`, () => p.transcribe!(tone), (r) => typeof r?.text === 'string');
      }
    }
    return out;
  }
}
