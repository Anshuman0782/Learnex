import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CommunityPost } from '../../types';
import { audioMeter, useAudioMetered } from '../../services/audioMeter';

interface NowPlayingBarProps {
  post: CommunityPost | null;
  isPlaying: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * A floating "now playing" bar for audio posts. Shows the cover image when the
 * post has a thumbnail, otherwise an animated music-equalizer (the song-play
 * animation). Audio keeps playing from the app-level player in the background.
 */
export const NowPlayingBar: React.FC<NowPlayingBarProps> = ({ post, isPlaying, onToggle, onClose }) => {
  if (!post) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.cover}>
          {post.videoThumbnail ? (
            <Image source={{ uri: post.videoThumbnail }} style={styles.coverImg} />
          ) : (
            <MusicAnimation active={isPlaying} live />
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {post.videoTitle || post.content || 'Audio take'}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {post.authorName} • {isPlaying ? 'Playing' : 'Paused'}
          </Text>
        </View>

        <TouchableOpacity onPress={onToggle} style={styles.playBtn} activeOpacity={0.8}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Equalizer used as the audio "song play" animation.
 * `live` = this is the post the app player is playing: bars then follow the
 * REAL loudness of the audio (when the device provides samples). Otherwise —
 * or when samples aren't available — bars gently idle while `active`.
 */
export const MusicAnimation: React.FC<{ active?: boolean; live?: boolean; color?: string; size?: number }> = ({
  active = true,
  live = false,
  color = '#FFFFFF',
  size = 44,
}) => {
  const metered = useAudioMetered();
  const useReal = live && active && metered;
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.4))).current;

  useEffect(() => {
    if (useReal || !active) {
      bars.forEach((v) => v.setValue(active ? 0.4 : 0.3));
      return;
    }
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0.55 + ((i * 37) % 45) / 100, duration: 260 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(v, { toValue: 0.25 + ((i * 53) % 20) / 100, duration: 300 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, useReal, bars]);

  return (
    <LinearGradient colors={['#4F46E5', '#7C3AED']} style={[styles.animBg, { width: size, height: size }]}>
      <View style={styles.animRow}>
        {bars.map((v, i) => {
          const src = useReal ? audioMeter.bands[[1, 0, 2, 3][i]] : v;
          return (
            <Animated.View
              key={i}
              style={{
                width: Math.max(3, size * 0.07),
                borderRadius: 2,
                backgroundColor: color,
                height: src.interpolate({ inputRange: [0, 1], outputRange: [size * 0.1, size * 0.6], extrapolate: 'clamp' }),
              }}
            />
          );
        })}
      </View>
    </LinearGradient>
  );
};

/**
 * Waveform strip for an audio post. Bar shape is stable per post; when this post
 * is the one playing, the played part fills with the REAL playback position and
 * the bars pulse with the REAL loudness (when the device provides samples).
 */
export const AudioWaveform: React.FC<{
  heights: number[];
  current: boolean;
  playing: boolean;
  playedColor?: string;
  idleColor?: string;
}> = ({ heights, current, playing, playedColor = '#A78BFA', idleColor = 'rgba(255,255,255,0.32)' }) => {
  const metered = useAudioMetered();
  const [w, setW] = React.useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const live = current && playing;

  // Fallback motion only when real loudness isn't available.
  useEffect(() => {
    if (!live || metered) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, metered, pulse]);

  const scaleFor = (i: number) => {
    if (!live) return 1;
    if (metered) {
      return audioMeter.bands[i % audioMeter.bands.length].interpolate({
        inputRange: [0, 1],
        outputRange: [0.45, 1.5],
        extrapolate: 'clamp',
      });
    }
    return pulse.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [0.8, 1.15] : [1.1, 0.85] });
  };

  const renderBars = (color: string) =>
    heights.map((h, i) => (
      <Animated.View
        key={i}
        style={[styles.waveBar, { height: h, backgroundColor: color, transform: [{ scaleY: scaleFor(i) as any }] }]}
      />
    ));

  return (
    <View style={styles.waveRow} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {renderBars(idleColor)}
      {current && w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wavePlayed,
            { width: audioMeter.progress.interpolate({ inputRange: [0, 1], outputRange: [0, w], extrapolate: 'clamp' }) },
          ]}
        >
          <View style={[styles.waveRow, { width: w }]}>{renderBars(playedColor)}</View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 30 },
  waveBar: { flex: 1, borderRadius: 2 },
  wavePlayed: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 92, // sit above the tab bar
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animBg: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: '55%',
  },
});
