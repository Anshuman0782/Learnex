import { ConfigService } from '@nestjs/config';
import { httpError, parseJsonText, ProviderError, type AiMedia, type AiProvider, type JsonRequest, type JsonResult, type Transcript } from './provider.types.js';

/**
 * Google Gemini (Google AI Studio API, free tier — no card needed).
 * Multimodal: it can listen to audio, so it is the primary judge for Music
 * and Spoken English. Model and endpoint are configurable, so a renamed or
 * retired model is a settings change, not a code change.
 */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  readonly canHear = true;
  readonly canTranscribe = true;
  readonly model: string;
  private readonly key: string;
  private readonly base: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('GEMINI_API_KEY') ?? '';
    this.model = config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.base = (config.get<string>('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  }

  configured(): boolean {
    return !!this.key;
  }

  private async call(parts: unknown[], system: string, json: boolean): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.2,
            ...(json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      throw new ProviderError(`gemini network error: ${(e as Error).message}`, true, 15_000);
    }
    const text = await res.text();
    if (!res.ok) throw httpError('gemini', res.status, text);

    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ProviderError('gemini returned a non-JSON body', true);
    }
    const cand = body?.candidates?.[0];
    const out = (cand?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('');
    if (!out) {
      const reason = cand?.finishReason ?? body?.promptFeedback?.blockReason ?? 'empty';
      // Blocked for safety → retrying the same content won't help.
      throw new ProviderError(`gemini returned no text (${reason})`, !/SAFETY|BLOCK|PROHIBITED/i.test(String(reason)));
    }
    return out;
  }

  private mediaPart(media: AiMedia) {
    return { inlineData: { mimeType: media.mime, data: media.data.toString('base64') } };
  }

  async generateJson(req: JsonRequest): Promise<JsonResult> {
    const parts: unknown[] = [{ text: req.prompt }];
    if (req.media) parts.push(this.mediaPart(req.media));
    const out = await this.call(parts, req.system, true);
    return { data: parseJsonText(out), provider: this.name, model: this.model };
  }

  async transcribe(media: AiMedia, language?: string): Promise<Transcript> {
    const out = await this.call(
      [
        { text: `Transcribe every spoken or sung word in this recording${language ? ` (language: ${language})` : ''}. Return JSON: {"text": "..."}. Use "" if there are no words.` },
        this.mediaPart(media),
      ],
      'You are a precise transcription service. Output only JSON.',
      true,
    );
    const data = parseJsonText(out) as { text?: unknown };
    return { text: typeof data.text === 'string' ? data.text : '', durationSec: null, segments: [], provider: this.name };
  }
}
