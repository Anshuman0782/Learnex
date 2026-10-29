import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { httpError, parseJsonText, ProviderError, type AiMedia, type AiProvider, type JsonRequest, type JsonResult, type Transcript } from './provider.types.js';
import { isModelMissing, pickGeminiModel, suggestedModel } from './model-picker.js';

/**
 * Google Gemini (Google AI Studio API, free tier — no card needed).
 * Multimodal: it can listen to audio, so it is the primary judge for Music
 * and Spoken English.
 *
 * Model names get retired over time. GEMINI_MODEL is only a preference: if
 * Google answers "model not found / no longer available", we read the list of
 * models this key can use, pick the best one, and carry on — no redeploy.
 */
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger('GeminiProvider');
  readonly name = 'gemini';
  readonly canHear = true;
  readonly canTranscribe = true;
  private readonly preferred: string;
  private resolved: string | null = null;
  private readonly key: string;
  private readonly base: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('GEMINI_API_KEY') ?? '';
    this.preferred = config.get<string>('GEMINI_MODEL') || 'gemini-flash-latest';
    this.base = (config.get<string>('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  }

  get model(): string {
    return this.resolved ?? this.preferred;
  }

  configured(): boolean {
    return !!this.key;
  }

  /** Models this key may call for generateContent. */
  private async listModels(): Promise<string[]> {
    const names: string[] = [];
    let pageToken = '';
    for (let page = 0; page < 5; page++) {
      const res = await fetch(`${this.base}/v1beta/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, {
        headers: { 'x-goog-api-key': this.key },
        signal: AbortSignal.timeout(30_000),
      }).catch((e) => {
        throw new ProviderError(`gemini model list: ${(e as Error).message}`, true, 15_000);
      });
      const text = await res.text();
      if (!res.ok) throw httpError('gemini', res.status, text);
      const body = JSON.parse(text);
      for (const m of body?.models ?? []) {
        const methods: string[] = m?.supportedGenerationMethods ?? [];
        if (typeof m?.name === 'string' && methods.includes('generateContent')) names.push(m.name.replace(/^models\//, ''));
      }
      pageToken = body?.nextPageToken ?? '';
      if (!pageToken) break;
    }
    return names;
  }

  /** Switch to a model that exists for this key. Returns false if none fits. */
  private async reselect(errorText: string): Promise<boolean> {
    const hint = suggestedModel(errorText);
    let pick: string | null = null;
    try {
      pick = pickGeminiModel(await this.listModels(), hint);
    } catch {
      pick = hint; // listing failed — trust Google's own suggestion
    }
    if (!pick || pick === this.model) return false;
    this.logger.warn(`Model "${this.model}" is unavailable — switching to "${pick}"`);
    this.resolved = pick;
    return true;
  }

  private async call(parts: unknown[], system: string, json: boolean, retried = false): Promise<string> {
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
    if (!res.ok) {
      // Retired / unknown model → pick a current one and try once more.
      if (!retried && isModelMissing(res.status, text) && (await this.reselect(text))) {
        return this.call(parts, system, json, true);
      }
      throw httpError('gemini', res.status, text);
    }

    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ProviderError('gemini returned a non-JSON body', true);
    }
    const cand = body?.candidates?.[0];
    const out = (cand?.content?.parts ?? []).filter((p: any) => !p?.thought).map((p: any) => p?.text ?? '').join('');
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
