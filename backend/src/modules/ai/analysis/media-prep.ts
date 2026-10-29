import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isOwnUpload, localUploadPath } from '../../../common/utils/own-upload.js';
import type { AiMedia } from '../providers/provider.types.js';

/** Longest part of a recording we analyse / send to the AI. */
export const MAX_ANALYSIS_SEC = 180;
const MAX_DOWNLOAD_BYTES = 110 * 1024 * 1024;
/** Without ffmpeg we can only send the original file inline if it's this small. */
const MAX_RAW_INLINE_BYTES = 14 * 1024 * 1024;

/** Thrown for media we can't use at all (not retryable). */
export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaError';
  }
}

let ffmpegChecked = false;
let ffmpegBin: string | null = null;

/** Path to the bundled ffmpeg (optional dependency), or null if unavailable. */
export function ffmpegPath(): string | null {
  if (ffmpegChecked) return ffmpegBin;
  ffmpegChecked = true;
  try {
    const req = createRequire(import.meta.url);
    const p = req('ffmpeg-static') as string | null;
    ffmpegBin = p || null;
  } catch {
    ffmpegBin = null;
  }
  return ffmpegBin;
}

function run(bin: string, args: string[], timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out: Buffer[] = [];
    let err = '';
    let size = 0;
    child.stdout.on('data', (d: Buffer) => {
      size += d.length;
      if (size > 64 * 1024 * 1024) child.kill('SIGKILL');
      else out.push(d);
    });
    child.stderr.on('data', (d: Buffer) => {
      err = (err + d.toString()).slice(-2000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg exited ${code}: ${err.slice(-300)}`));
    });
  });
}

/** Read one of OUR uploads (disk in development, CDN in production). */
export async function loadUpload(url: string): Promise<Buffer> {
  if (!isOwnUpload(url)) throw new MediaError('Not a LERNEX upload');
  const local = localUploadPath(url);
  if (local) {
    try {
      const stat = await fs.stat(local);
      if (stat.size > MAX_DOWNLOAD_BYTES) throw new MediaError('Recording is too large');
      return await fs.readFile(local);
    } catch (e) {
      if (e instanceof MediaError) throw e;
      throw new MediaError('Recording file not found');
    }
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (res.status === 404) throw new MediaError('Recording file not found');
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`); // retryable
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_DOWNLOAD_BYTES) throw new MediaError('Recording is too large');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_DOWNLOAD_BYTES) throw new MediaError('Recording is too large');
  return buf;
}

export interface PreparedAudio {
  /** Small mono MP3 for the AI (or the original file when ffmpeg is missing). */
  media: AiMedia;
  /** 8 kHz mono samples for our own analysers (null without ffmpeg). */
  pcm8k: Float32Array | null;
  durationSec: number | null;
  /** Whether our own measurements could run. */
  analysed: boolean;
}

/**
 * Turn an uploaded audio/video file into what the judges need: a compact
 * mono MP3 (first 3 minutes) and raw samples for pitch/pace analysis.
 */
const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

export async function prepareAudio(url: string, mime?: string | null): Promise<PreparedAudio> {
  const input = await loadUpload(url);
  const bin = ffmpegPath();
  if (!bin) {
    // No ffmpeg: send the original if it's small and a format the AI accepts.
    const ext = /\.([a-z0-9]{2,4})(?:$|\?)/i.exec(url)?.[1]?.toLowerCase() ?? '';
    const m = (mime || MIME_BY_EXT[ext] || '').toLowerCase();
    if (input.length <= MAX_RAW_INLINE_BYTES && (m.startsWith('audio/') || m === 'video/mp4')) {
      return { media: { mime: m === 'audio/m4a' || m === 'audio/x-m4a' ? 'audio/mp4' : m, data: input }, pcm8k: null, durationSec: null, analysed: false };
    }
    throw new MediaError('This recording is too large to analyse without the audio tool');
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lernex-ai-'));
  const src = path.join(dir, `in-${randomUUID()}`);
  try {
    await fs.writeFile(src, input);
    const common = ['-hide_banner', '-loglevel', 'error', '-i', src, '-t', String(MAX_ANALYSIS_SEC), '-vn', '-ac', '1'];
    let mp3: Buffer;
    try {
      mp3 = await run(bin, [...common, '-ar', '16000', '-b:a', '48k', '-f', 'mp3', 'pipe:1'], 120_000);
    } catch {
      throw new MediaError('This file has no readable audio');
    }
    if (mp3.length < 1000) throw new MediaError('This file has no readable audio');
    const raw = await run(bin, [...common, '-ar', '8000', '-f', 'f32le', 'pipe:1'], 120_000);
    const pcm = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
    return {
      media: { mime: 'audio/mp3', data: mp3 },
      pcm8k: Float32Array.from(pcm),
      durationSec: Math.round((pcm.length / 8000) * 10) / 10,
      analysed: true,
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
