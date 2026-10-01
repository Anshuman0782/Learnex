import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PhotoCarouselProps {
  urls: string[];
  /** Fixed height. Omit for Instagram-style auto height from the first photo. */
  height?: number;
  radius?: number;
  /** Double tap on a photo (e.g. like) — shows a heart burst. */
  onDoubleTap?: () => void;
  /** Dots under the photo (Instagram) instead of on it. */
  dotsBelow?: boolean;
}

// Instagram's limits: portrait no taller than 4:5, landscape no wider than 1.91:1.
const MIN_RATIO = 0.8;
const MAX_RATIO = 1.91;
const clamp = (r: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));

/**
 * Swipeable photo carousel for photo posts. Shows the WHOLE photo: the frame
 * takes the first photo's aspect ratio (clamped like Instagram); any photo whose
 * shape differs is shown uncropped over a blurred copy of itself.
 */
export const PhotoCarousel: React.FC<PhotoCarouselProps> = ({
  urls,
  height: fixedHeight,
  radius = 18,
  onDoubleTap,
  dotsBelow = false,
}) => {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const lastTap = useRef(0);
  const heart = useRef(new Animated.Value(0)).current;

  // Real dimensions of every photo (cached by RN's image loader).
  useEffect(() => {
    let alive = true;
    urls.forEach((u) => {
      Image.getSize(
        u,
        (w, h) => alive && h > 0 && setRatios((prev) => (prev[u] ? prev : { ...prev, [u]: w / h })),
        () => undefined,
      );
    });
    return () => {
      alive = false;
    };
  }, [urls.join('|')]);

  const frameRatio = clamp(ratios[urls[0]] ?? 1);
  const height = fixedHeight ?? (width ? Math.round(width / frameRatio) : 0);
  const containerRatio = width && height ? width / height : frameRatio;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const handleTap = () => {
    const now = Date.now();
    if (onDoubleTap && now - lastTap.current < 300) {
      lastTap.current = 0;
      onDoubleTap();
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
        Animated.timing(heart, { toValue: 0, duration: 250, delay: 350, useNativeDriver: true }),
      ]).start();
      return;
    }
    lastTap.current = now;
  };

  const dots =
    urls.length > 1 ? (
      <View style={[styles.dots, dotsBelow ? styles.dotsBelow : styles.dotsOver]} pointerEvents="none">
        {urls.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, dotsBelow && styles.dotDark, i === index && (dotsBelow ? styles.dotOnDark : styles.dotOn)]}
          />
        ))}
      </View>
    ) : null;

  return (
    <View>
      <View
        style={[styles.wrap, { height: height || 300, borderRadius: radius }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && height > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            nestedScrollEnabled
          >
            {urls.map((u, i) => {
              const r = ratios[u];
              const fits = !r || Math.abs(r - containerRatio) / containerRatio < 0.04;
              return (
                <TouchableWithoutFeedback key={`${u}-${i}`} onPress={handleTap}>
                  <View style={{ width, height }}>
                    {fits ? (
                      <Image source={{ uri: u }} style={styles.img} resizeMode="cover" />
                    ) : (
                      <>
                        <Image source={{ uri: u }} style={styles.img} resizeMode="cover" blurRadius={25} />
                        <View style={styles.dim} />
                        <Image source={{ uri: u }} style={styles.img} resizeMode="contain" />
                      </>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              );
            })}
          </ScrollView>
        )}

        {urls.length > 1 && (
          <View style={styles.counter} pointerEvents="none">
            <Text style={styles.counterText}>
              {index + 1}/{urls.length}
            </Text>
          </View>
        )}

        <Animated.View
          pointerEvents="none"
          style={[
            styles.heart,
            { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
          ]}
        >
          <Ionicons name="heart" size={90} color="#FFFFFF" />
        </Animated.View>

        {!dotsBelow && dots}
      </View>
      {dotsBelow && dots}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#0F172A' },
  img: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.25)' },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15,23,42,0.6)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  counterText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  heart: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dotsOver: { position: 'absolute', bottom: 12, left: 0, right: 0 },
  dotsBelow: { marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotDark: { backgroundColor: '#CBD5E1' },
  dotOn: { width: 16, backgroundColor: '#FFFFFF' },
  dotOnDark: { width: 16, backgroundColor: '#4F46E5' },
});
