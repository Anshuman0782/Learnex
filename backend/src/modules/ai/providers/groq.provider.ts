import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { httpError, parseJsonText, ProviderError, type AiMedia, type AiProvider, type JsonRequest, type JsonResult, type Transcript } from './provider.types.js';
import { isModelMissing, pickGroqChatModel, pickGroqWhisperModel } from './model-picker.js';

/**
 * Groq (free tier) — the backup provider. It can't listen to music, but it
 * has fast speech-to-text (Whisper) with timestamps and a strong text model,
 * so it can judge Coding, mentor critiques, and Spoken English from a
 * transcript plus our own speaking measurements.
 *
 * GROQ_MODEL / GROQ_WHISPER_MODEL are preferences: when Groq retires a model
 * ("model_not_found"), we read Groq's current model list and switch.
 */
export class GroqProvider implements AiProvider {
  private readonly logger = new Logger('GroqProvider');
  readonly name = 'groq';
  readonly canHear = false;
  readonly canTranscribe = true;
  private chatModel: string;
  private whisperModel: string;
  private jsonMode = true;
  private readonly key: string;
  private readonly base: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('GROQ_API_KEY') ?? '';
    this.chatModel = config.get<string>('GROQ_MODEL') || 'openai/gpt-oss-120b';
    this.whisperModel = config.get<string>('GROQ_WHISPER_MODEL') || 'whisper-large-v3-turbo';
    this.base = (config.get<string>('GROQ_BASE_URL') || 'https://api.groq.com').replace(/\/+$/, '');
  }

  get model(): string {
    return this.chatModel;
  }

  configured(): boolean {
    return !!this.key;
  }

  /** Raw request → { ok, status, text } (never throws for HTTP errors). */
  private async raw(path: string, init: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
    try {
      const res = await fetch(`${this.base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.key}`, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(90_000),
      });
      return { ok: res.ok, status: res.status, text: await res.text() };
    } catch (e) {
      throw new ProviderError(`groq network error: ${(e as Error).message}`, true, 15_000);
    }
  }

  private parse(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError('groq returned a non-JSON body', true);
    }
  }

  private async listModels(): Promise<string[]> {
    const r = await this.raw('/openai/v1/models', { method: 'GET' });
    if (!r.ok) throw httpError('groq', r.status, r.text);
    const body = this.parse(r.text);
    return (body?.data ?? [])
      .filter((m: any) => typeof m?.id === 'string' && m.active !== false)
      .map((m: any) => m.id as string);
  }

  private async reselect(kind: 'chat' | 'whisper'): Promise<boolean> {
    let list: string[];
    try {
      list = await this.listModels();
    } catch {
      return false;
    }
    const pick = kind === 'chat' ? pickGroqChatModel(list) : pickGroqWhisperModel(list);
    const current = kind === 'chat' ? this.chatModel : this.whisperModel;
    if (!pick || pick === current) return false;
    this.logger.warn(`Model "${current}" is unavailable — switching to "${pick}"`);
    if (kind === 'chat') this.chatModel = pick;
    else this.whisperModel = pick;
    return true;
  }

  async generateJson(req: JsonRequest, retried = false): Promise<JsonResult> {
    if (req.media) throw new ProviderError('groq cannot listen to audio', false);
    const r = await this.raw('/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.chatModel,
        temperature: 0.2,
        ...(this.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
      }),
    });
    if (!r.ok) {
      if (!retried && isModelMissing(r.status, r.text) && (await this.reselect('chat'))) return this.generateJson(req, true);
      // Some models don't support JSON mode — ask for JSON in plain text instead.
      if (!retried && r.status === 400 && this.jsonMode && /response_format|json_object|json mode/i.test(r.text)) {
        this.jsonMode = false;
        return this.generateJson(req, true);
      }
      throw httpError('groq', r.status, r.text);
    }
    const body = this.parse(r.text);
    const out = body?.choices?.[0]?.message?.content;
    if (typeof out !== 'string' || !out) throw new ProviderError('groq returned no text', true);
    return { data: parseJsonText(out), provider: this.name, model: this.chatModel };
  }

  async transcribe(media: AiMedia, language?: string, retried = false): Promise<Transcript> {
    const form = new FormData();
    const ext = media.mime.includes('mpeg') || media.mime.includes('mp3') ? 'mp3' : media.mime.split('/')[1] || 'bin';
    form.append('file', new Blob([new Uint8Array(media.data)], { type: media.mime }), `audio.${ext}`);
    form.append('model', this.whisperModel);
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    if (language) form.append('language', language);
    const r = await this.raw('/openai/v1/audio/transcriptions', { method: 'POST', body: form });
    if (!r.ok) {
      if (!retried && isModelMissing(r.status, r.text) && (await this.reselect('whisper'))) return this.transcribe(media, language, true);
      throw httpError('groq', r.status, r.text);
    }
    const body = this.parse(r.text);
    const segments = Array.isArray(body?.segments)
      ? body.segments
          .map((s: any) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text ?? '') }))
          .filter((s: { end: number; start: number }) => s.end >= s.start)
      : [];
    return {
      text: typeof body?.text === 'string' ? body.text.trim() : '',
      durationSec: typeof body?.duration === 'number' ? body.duration : null,
      segments,
      provider: this.name,
    };
  }
}
