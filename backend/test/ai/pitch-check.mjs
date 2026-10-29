// Checks our own pitch analyser on generated audio (no AI, no network).
// Run from backend/ after `npx nest build`:  node test/ai/pitch-check.mjs
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const { analysePitch } = await import(new URL('../../dist/modules/ai/analysis/pitch.js', import.meta.url));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/** Render an ffmpeg audio expression to 8 kHz mono float samples. */
function render(expr, seconds) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=8000:d=${seconds}`, '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}

// A melody of exact semitones: A4, B4, C#5, D5, E5 — each 0.6 s.
const notes = [440, 493.88, 554.37, 587.33, 659.26];
// Per-note detune in cents (a real off-key singer is unevenly off).
const melody = (detune) => {
  const f = notes.map((hz, i) => `between(mod(t,3),${i * 0.6},${(i + 1) * 0.6})*${hz * 2 ** ((detune[i] ?? 0) / 1200)}`).join('+');
  // integrate frequency → phase via 2*PI*f*t is fine per constant segment for a pitch test
  return `0.5*sin(2*PI*(${f})*t)`;
};

const inTune = analysePitch(render(melody([0, 0, 0, 0, 0]), 6));
console.log('   in tune:', inTune);
ok(inTune.pitchScore >= 85, `exact notes score high (${inTune.pitchScore})`);
ok(inTune.inTuneRatio >= 0.85, `exact notes mostly in tune (${inTune.inTuneRatio})`);

const offKey = analysePitch(render(melody([40, -30, 15, -45, 30]), 6));
console.log('   unevenly off-key (+40, -30, +15, -45, +30 cents):', offKey);
ok(offKey.pitchScore < inTune.pitchScore - 25, `out-of-tune melody scores clearly lower (${offKey.pitchScore} vs ${inTune.pitchScore})`);

// Whole performance consistently 30 cents sharp (own tuning reference) → still in tune with itself.
const shifted = analysePitch(render(`0.5*sin(2*PI*${440 * 2 ** (30 / 1200)}*t)`, 4));
ok(shifted.inTuneRatio >= 0.9 && Math.abs(shifted.tuningOffsetCents - 30) <= 3, `consistent tuning offset is allowed (offset ${shifted.tuningOffsetCents}c, in-tune ${shifted.inTuneRatio})`);

// Wobbly pitch (±60 cents slow drift) → poor steadiness.
const wobbly = analysePitch(render(`0.5*sin(2*PI*440*(t + 0.012*sin(2*PI*1.5*t)))`, 4));
ok(wobbly.steadinessCents === null || wobbly.steadinessCents > 5 || wobbly.pitchScore < inTune.pitchScore, `unsteady pitch is detected (steadiness ${wobbly.steadinessCents}c, score ${wobbly.pitchScore})`);

// Noise / silence → no pitch score.
const noise = analysePitch(render('0.3*(random(0)*2-1)', 3));
ok(noise.pitchScore === null || noise.pitchedRatio < 0.3, `noise has no reliable pitch (ratio ${noise.pitchedRatio}, score ${noise.pitchScore})`);
const silence = analysePitch(render('0', 3));
ok(silence.pitchScore === null, 'silence → no score');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
