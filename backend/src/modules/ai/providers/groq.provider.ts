import { ConfigService } from '@nestjs/config';
import { httpError, parseJsonText, ProviderError, type AiMedia, type AiProvider, type JsonRequest, type JsonResult, type Transcript } from './provider.types.js';

/**
 * Groq (free tier) — the backup provider. It can't listen to music, but it
 * has fast speech-to-text (Whisper) with timestamps and a strong text model,
 * so it can judge Coding, mentor critiques, and Spoken English from a
 * transcript plus our own speaking measurements.
 */
export class GroqProvider implements AiProvider {
  readonly name = 'groq';
  readonly canHear = false;
  readonly canTranscribe = true;
  readonly model: string;
  private readonly whisperModel: string;
  private readonly key: string;
  private readonly base: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('GROQ_API_KEY') ?? '';
    this.model = config.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';
    this.whisperModel = config.get<string>('GROQ_WHISPER_MODEL') || 'whisper-large-v3-turbo';
    this.base = (config.get<string>('GROQ_BASE_URL') || 'https://api.groq.com').replace(/\/+$/, '');
  }

  configured(): boolean {
    return !!this.key;
  }

  private async send(path: string, init: RequestInit): Promise<any> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.key}`, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e) {
      throw new ProviderError(`groq network error: ${(e as Error).message}`, true, 15_000);
    }
    const text = await res.text();
    if (!res.ok) throw httpError('groq', res.status, text);
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError('groq returned a non-JSON body', true);
    }
  }

  async generateJson(req: JsonRequest): Promise<JsonResult> {
    if (req.media) throw new ProviderError('groq cannot listen to audio', false);
    const body = await this.send('/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
      }),
    });
    const out = body?.choices?.[0]?.message?.content;
    if (typeof out !== 'string' || !out) throw new ProviderError('groq returned no text', true);
    return { data: parseJsonText(out), provider: this.name, model: this.model };
  }

  async transcribe(media: AiMedia, language?: string): Promise<Transcript> {
    const form = new FormData();
    const ext = media.mime.includes('mpeg') || media.mime.includes('mp3') ? 'mp3' : media.mime.split('/')[1] || 'bin';
    form.append('file', new Blob([new Uint8Array(media.data)], { type: media.mime }), `audio.${ext}`);
    form.append('model', this.whisperModel);
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    if (language) form.append('language', language);
    const body = await this.send('/openai/v1/audio/transcriptions', { method: 'POST', body: form });
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
