import { useEffect, useState } from 'react';
import type { VideoPlayer } from 'expo-video';

type Fit = 'cover' | 'contain';
type Track = { size?: { width: number; height: number } } | null | undefined;

/**
 * Reels fit (Instagram-style): a vertical ~9:16 video FILLS the screen; any
 * other shape (16:9, square, …) is shown WHOLE, centred on black — never
 * cropped. Until the real size is known we use 'contain', so nothing is cut.
 */
export function useVideoFit(player: VideoPlayer | null | undefined, sourceKey?: string): Fit {
  const [fit, setFit] = useState<Fit>('contain');

  useEffect(() => {
    setFit('contain');
    if (!player) return;
    const decide = (t: Track) => {
      const s = t?.size;
      if (!s?.width || !s?.height) return;
      const ratio = s.width / s.height; // 9:16 = 0.5625
      setFit(ratio >= 0.5 && ratio <= 0.62 ? 'cover' : 'contain');
    };
    try {
      decide(player.videoTrack as Track);
    } catch {
      /* not loaded yet */
    }
    const sub = player.addListener('videoTrackChange', ({ videoTrack }) => decide(videoTrack as Track));
    return () => sub.remove();
  }, [player, sourceKey]);

  return fit;
}
