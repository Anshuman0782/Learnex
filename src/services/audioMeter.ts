import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import type { AudioSample } from 'expo-audio';

/**
 * Live meter for the app-level audio player (audio posts).
 *
 * - `progress` (0..1) is the real playback position — always available.
 * - `bands` (0..1 each) are real loudness levels computed from the PCM samples
 *   the player emits. Android only delivers samples when the mic permission
 *   is already granted (the system Visualizer requires it); we never prompt for
 *   it just for visuals. `metered` tells the UI whether bands are live.
 *
 * Plain Animated.Values (not React state) so 30+ updates/sec don't re-render
 * the app — only the bound views move.
 */
export const BAND_COUNT = 5;

export const audioMeter = {
  progress: new Animated.Value(0),
  bands: Array.from({ length: BAND_COUNT }, () => new Animated.Value(0)),
  metered: false,
};

const smoothed = new Array(BAND_COUNT).fill(0);

/** Splits one PCM buffer into BAND_COUNT chunks and pushes their RMS loudness. */
export function pushAudioSample(sample: AudioSample) {
  const frames = sample.channels?.[0]?.frames;
  if (!frames || frames.length === 0) return;
  const chunk = Math.max(1, Math.floor(frames.length / BAND_COUNT));
  for (let b = 0; b < BAND_COUNT; b++) {
    let sum = 0;
    let n = 0;
    for (let i = b * chunk; i < Math.min(frames.length, (b + 1) * chunk); i++) {
      sum += frames[i] * frames[i];
      n++;
    }
    const rms = n ? Math.sqrt(sum / n) : 0;
    // Perceptual boost + fast attack / slower release, like a real VU meter.
    const target = Math.min(1, Math.pow(rms * 3.2, 0.7));
    smoothed[b] = target > smoothed[b] ? target : smoothed[b] * 0.75 + target * 0.25;
    audioMeter.bands[b].setValue(smoothed[b]);
  }
}

const listeners = new Set<(metered: boolean) => void>();

export function setAudioMetered(v: boolean) {
  if (audioMeter.metered === v) return;
  audioMeter.metered = v;
  listeners.forEach((l) => l(v));
}

/** Re-renders when live loudness becomes (un)available. */
export function useAudioMetered(): boolean {
  const [m, setM] = useState(audioMeter.metered);
  useEffect(() => {
    listeners.add(setM);
    setM(audioMeter.metered);
    return () => {
      listeners.delete(setM);
    };
  }, []);
  return m;
}

export function resetAudioMeter() {
  setAudioMetered(false);
  audioMeter.progress.setValue(0);
  for (let b = 0; b < BAND_COUNT; b++) {
    smoothed[b] = 0;
    audioMeter.bands[b].setValue(0);
  }
}

export function quietAudioMeter() {
  for (let b = 0; b < BAND_COUNT; b++) {
    smoothed[b] = 0;
    audioMeter.bands[b].setValue(0);
  }
}
