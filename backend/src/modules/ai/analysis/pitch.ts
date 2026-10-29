/**
 * Our own pitch analysis — no AI involved, so it always works and always gives
 * the same answer for the same recording. YIN pitch detection on 8 kHz mono
 * audio, then: how much of the sound is pitched, how close notes sit to the
 * nearest semitone (after allowing for the performer's own tuning reference),
 * and how steady held notes are.
 */

const SR = 8000;
const WIN = 512; // 64 ms
const HOP = 256; // 32 ms
const MIN_HZ = 70;
const MAX_HZ = 1000;
const YIN_THRESHOLD = 0.15;

export interface PitchMetrics {
  /** Seconds analysed. */
  seconds: number;
  /** Share of sounding time that has a clear pitch (0-1). */
  pitchedRatio: number;
  /** Median detected pitch (Hz), null if none. */
  medianHz: number | null;
  /** Performer's tuning offset from A=440 (cents, −50..50). */
  tuningOffsetCents: number | null;
  /** Share of pitched frames within ±25 cents of a note (0-1). */
  inTuneRatio: number | null;
  /** Average distance from the nearest note (cents). */
  meanDeviationCents: number | null;
  /** Average wobble within held notes (cents, lower = steadier). */
  steadinessCents: number | null;
  /** 0-100 score from the measurements (null when too little pitched sound). */
  pitchScore: number | null;
}

/** YIN fundamental frequency of one frame, or null if unpitched. */
function yin(frame: Float32Array): number | null {
  const tauMin = Math.floor(SR / MAX_HZ);
  const tauMax = Math.min(Math.floor(SR / MIN_HZ), frame.length - 1);
  const half = frame.length - tauMax;
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < half; j++) {
      const diff = frame[j] - frame[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalised difference.
  let running = 0;
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < YIN_THRESHOLD) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation for sub-sample accuracy.
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const s0 = cmnd[tau - 1];
    const s1 = cmnd[tau];
    const s2 = cmnd[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tau + (s2 - s0) / denom;
  }
  const hz = SR / better;
  return hz >= MIN_HZ && hz <= MAX_HZ ? hz : null;
}

const centsOf = (hz: number) => 1200 * Math.log2(hz / 440);
/** Wrap to −50..50 cents. */
const wrap = (c: number) => c - 100 * Math.round(c / 100);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function analysePitch(pcm: Float32Array): PitchMetrics {
  const seconds = Math.round((pcm.length / SR) * 10) / 10;
  // Loudness gate relative to the recording's own level.
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const gate = Math.max(0.01, peak * 0.05);

  const hzs: (number | null)[] = [];
  let sounding = 0;
  const frame = new Float32Array(WIN);
  for (let start = 0; start + WIN <= pcm.length; start += HOP) {
    let energy = 0;
    for (let i = 0; i < WIN; i++) {
      const v = pcm[start + i];
      frame[i] = v;
      energy += v * v;
    }
    const rms = Math.sqrt(energy / WIN);
    if (rms < gate) {
      hzs.push(null);
      continue;
    }
    sounding++;
    hzs.push(yin(frame));
  }

  const pitched = hzs.filter((h): h is number => h !== null);
  const empty: PitchMetrics = {
    seconds,
    pitchedRatio: sounding ? pitched.length / sounding : 0,
    medianHz: null,
    tuningOffsetCents: null,
    inTuneRatio: null,
    meanDeviationCents: null,
    steadinessCents: null,
    pitchScore: null,
  };
  // Need at least ~2 seconds of pitched sound to say anything.
  if (pitched.length < 60) return empty;

  const sorted = [...pitched].sort((a, b) => a - b);
  const medianHz = sorted[Math.floor(sorted.length / 2)];

  // Tuning reference: circular mean of the offsets (a choir tuned to A=432 is
  // consistently "off" from 440 but perfectly in tune with itself).
  let sx = 0;
  let sy = 0;
  for (const h of pitched) {
    const a = (wrap(centsOf(h)) / 100) * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  // Only trust the reference when the performance is CONSISTENTLY offset
  // (offsets tightly clustered); scattered tuning is just out of tune.
  const concentration = Math.sqrt(sx * sx + sy * sy) / pitched.length;
  const offset = concentration >= 0.8 ? (Math.atan2(sy, sx) / (2 * Math.PI)) * 100 : 0;

  let inTune = 0;
  let devSum = 0;
  for (const h of pitched) {
    const dev = Math.abs(wrap(centsOf(h) - offset));
    devSum += dev;
    if (dev <= 25) inTune++;
  }
  const meanDev = devSum / pitched.length;

  // Steadiness: wobble inside held notes (≥ 4 consecutive frames on one note).
  const wobble: number[] = [];
  let run: number[] = [];
  let runNote: number | null = null;
  const flush = () => {
    if (run.length >= 4) {
      const mean = run.reduce((a, b) => a + b, 0) / run.length;
      const sd = Math.sqrt(run.reduce((a, b) => a + (b - mean) ** 2, 0) / run.length);
      wobble.push(sd);
    }
    run = [];
    runNote = null;
  };
  for (const h of hzs) {
    if (h === null) {
      flush();
      continue;
    }
    const c = centsOf(h) - offset;
    const note = Math.round(c / 100);
    if (runNote !== null && note !== runNote) flush();
    runNote = note;
    run.push(c);
  }
  flush();
  const steadiness = wobble.length ? wobble.reduce((a, b) => a + b, 0) / wobble.length : null;

  // 0-100: mostly "how often in tune", plus "how far off on average".
  const inTuneRatio = inTune / pitched.length;
  const devScore = clamp(100 - ((meanDev - 8) / (40 - 8)) * 90, 10, 100);
  const pitchScore = Math.round(clamp(0.6 * inTuneRatio * 100 + 0.4 * devScore, 0, 100));

  return {
    seconds,
    pitchedRatio: Math.round((pitched.length / Math.max(1, sounding)) * 100) / 100,
    medianHz: Math.round(medianHz * 10) / 10,
    tuningOffsetCents: Math.round(offset),
    inTuneRatio: Math.round(inTuneRatio * 100) / 100,
    meanDeviationCents: Math.round(meanDev * 10) / 10,
    steadinessCents: steadiness === null ? null : Math.round(steadiness * 10) / 10,
    pitchScore,
  };
}
