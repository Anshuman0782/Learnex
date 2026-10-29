/** Media sent to a model (already converted to a small audio file). */
export interface AiMedia {
  mime: string;
  data: Buffer;
}

export interface JsonRequest {
  system: string;
  prompt: string;
  /** Audio the model must listen to (only providers that can hear accept it). */
  media?: AiMedia;
}

export interface JsonResult {
  /** The parsed JSON object the model returned. */
  data: unknown;
  provider: string;
  model: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  text: string;
  durationSec: number | null;
  segments: TranscriptSegment[];
  provider: string;
}

/**
 * A provider failure. `retryable` = worth trying again later (rate limit,
 * overload, network). `cooldownMs` = don't call this provider again for a
 * while (e.g. free-tier limit reached).
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly cooldownMs = 0,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  /** Can listen to audio itself (multimodal). */
  readonly canHear: boolean;
  /** Has a speech-to-text endpoint. */
  readonly canTranscribe: boolean;
  configured(): boolean;
  generateJson(req: JsonRequest): Promise<JsonResult>;
  transcribe?(media: AiMedia, language?: string): Promise<Transcript>;
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences). */
export function parseJsonText(text: string): unknown {
  const t = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const body = fenced ? fenced[1] : t;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ProviderError('Model did not return JSON', true);
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new ProviderError('Model returned invalid JSON', true);
  }
}

/** Map an HTTP failure to retry/cooldown behaviour. */
export function httpError(provider: string, status: number, body: string): ProviderError {
  const msg = `${provider} HTTP ${status}: ${body.slice(0, 300)}`;
  if (status === 429) {
    // Daily quota → wait until tomorrow (UTC); per-minute limit → a minute.
    const daily = /per.?day|daily|RequestsPerDay/i.test(body);
    if (daily) {
      const now = new Date();
      const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5);
      return new ProviderError(msg, true, tomorrow - now.getTime());
    }
    return new ProviderError(msg, true, 60_000);
  }
  if (status === 401 || status === 403) return new ProviderError(msg, true, 60 * 60_000); // bad/blocked key
  if (status >= 500) return new ProviderError(msg, true, 30_000);
  if (status === 404) return new ProviderError(msg, true, 60 * 60_000); // model renamed/removed → check config
  return new ProviderError(msg, false);
}
