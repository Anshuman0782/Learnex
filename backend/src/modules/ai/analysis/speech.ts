import type { Transcript } from '../providers/provider.types.js';

/**
 * Our own speaking measurements from a transcript: pace, filler words and
 * long pauses. No AI judgement — just counting — so it's consistent.
 */

export interface SpeechMetrics {
  words: number;
  /** Seconds of the recording. */
  seconds: number | null;
  wordsPerMinute: number | null;
  fillers: number;
  fillersPerMinute: number | null;
  /** Gaps over 1.5 s between phrases (needs timestamps). */
  longPauses: number | null;
  /** 0-100 fluency estimate from pace + fillers + pauses (null if too short). */
  fluencyScore: number | null;
}

const FILLERS = /\b(u+m+|u+h+m*|e+r+m+|e+r+|hmm+|you know|i mean)\b/gi;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function analyseSpeech(t: Transcript, fallbackSeconds: number | null): SpeechMetrics {
  const text = t.text.trim();
  const words = text ? text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length : 0;
  const fillers = (text.match(FILLERS) ?? []).length;

  // Speaking time: from first to last phrase when we have timestamps.
  let seconds: number | null = null;
  if (t.segments.length > 0) {
    seconds = Math.max(0, t.segments[t.segments.length - 1].end - t.segments[0].start);
  }
  seconds ??= t.durationSec ?? fallbackSeconds;

  let longPauses: number | null = null;
  if (t.segments.length > 1) {
    longPauses = 0;
    for (let i = 1; i < t.segments.length; i++) {
      if (t.segments[i].start - t.segments[i - 1].end > 1.5) longPauses++;
    }
  }

  const minutes = seconds && seconds > 0 ? seconds / 60 : null;
  const wpm = minutes ? Math.round(words / minutes) : null;
  const fpm = minutes ? Math.round((fillers / minutes) * 10) / 10 : null;

  let fluencyScore: number | null = null;
  if (wpm !== null && fpm !== null && words >= 25) {
    // Comfortable conversational pace ≈ 110-160 words/min.
    const pace = wpm >= 110 && wpm <= 160 ? 100 : wpm < 110 ? clamp(100 - (110 - wpm) * 1.2, 20, 100) : clamp(100 - (wpm - 160) * 1.0, 40, 100);
    const filler = clamp(100 - Math.max(0, fpm - 2) * 10, 30, 100);
    const pauses = longPauses === null || !minutes ? 100 : clamp(100 - Math.max(0, longPauses / minutes - 1) * 12, 40, 100);
    fluencyScore = Math.round(0.45 * pace + 0.35 * filler + 0.2 * pauses);
  }

  return {
    words,
    seconds: seconds === null ? null : Math.round(seconds * 10) / 10,
    wordsPerMinute: wpm,
    fillers,
    fillersPerMinute: fpm,
    longPauses,
    fluencyScore,
  };
}

/** Did the speaker say the check phrase? (≥ 2 of its 3 words, anywhere.) */
export function heardCheckPhrase(transcript: string, phrase: string): boolean {
  const said = new Set(transcript.toLowerCase().match(/[a-z]+/g) ?? []);
  const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.filter((w) => said.has(w)).length;
  return hits >= Math.min(2, words.length);
}
