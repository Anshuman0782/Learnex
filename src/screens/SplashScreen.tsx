import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as NativeSplash from 'expo-splash-screen';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';
import { useApp } from '../context/AppContext';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

const LOGO = 168; // matches the native splash image width (seamless hand-off)
const MIN_SHOW_MS = 1900; // let the intro play at least once
const WORD = ['L', 'E', 'R', 'N', 'E', 'X'];

/**
 * Animated launch screen + the app's entry gate. The native splash shows the
 * logo; this screen picks up from exactly there, plays the intro while the
 * stored session is restored, then routes:
 *  - valid session with a role  -> Main
 *  - account but no role yet     -> finish onboarding (RoleSelection)
 *  - no session                  -> Login
 */
export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { bootstrapping, user, selectedRole } = useApp();
  const [introDone, setIntroDone] = useState(false);

  const logoScale = useRef(new Animated.Value(1)).current;
  const logoLift = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hand over from the static native splash to this animated one.
    void NativeSplash.hideAsync().catch(() => undefined);

    const ripple = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    ripple(ring1, 150).start();
    ripple(ring2, 950).start();

    Animated.sequence([
      // Pop: a quick squash then a springy settle.
      Animated.timing(logoScale, { toValue: 0.86, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1.06, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(logoLift, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.stagger(
          70,
          letters.map((v) =>
            Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
          ),
        ),
      ]),
      Animated.timing(tagline, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    Animated.timing(progress, {
      toValue: 0.85,
      duration: MIN_SHOW_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    const t = setTimeout(() => setIntroDone(true), MIN_SHOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route once the intro has played AND the session is restored.
  useEffect(() => {
    if (bootstrapping || !introDone) return;
    Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(fadeOut, { toValue: 0, duration: 320, delay: 160, useNativeDriver: true }),
    ]).start(() => {
      if (user && !user.emailVerified) {
        navigation.reset({ index: 0, routes: [{ name: 'VerifyEmail', params: { autoSend: true } }] });
      } else if (user && selectedRole) {
        navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });
      } else if (user) {
        navigation.reset({ index: 0, routes: [{ name: 'RoleSelection' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    });
  }, [bootstrapping, introDone, user, selectedRole, navigation, progress, fadeOut]);

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.1] }) }],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <Animated.View
        style={[
          styles.center,
          { transform: [{ translateY: logoLift.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) }] },
        ]}
      >
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.ring, ringStyle(ring1)]}>
            <LinearGradient colors={['#F59E0B', '#EC4899']} style={styles.ringFill} />
          </Animated.View>
          <Animated.View style={[styles.ring, ringStyle(ring2)]}>
            <LinearGradient colors={['#EC4899', '#8B5CF6']} style={styles.ringFill} />
          </Animated.View>
          <View style={styles.ringMask} />
          <Animated.Image
            source={require('../../assets/images/logo.png')}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.wordRow}>
          {WORD.map((ch, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                i >= 4 && (i === 4 ? styles.letterE : styles.letterX),
                {
                  opacity: letters[i],
                  transform: [
                    { translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                    { scale: letters[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                  ],
                },
              ]}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: tagline,
              transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          Learn · Practice · Grow together
        </Animated.Text>
      </Animated.View>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        >
          <LinearGradient colors={['#F59E0B', '#EC4899', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  logoWrap: { width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: LOGO * 0.78, height: LOGO * 0.78, borderRadius: LOGO, overflow: 'hidden' },
  ringFill: { flex: 1 },
  // White disc over the rings → only a glowing edge shows behind the logo.
  ringMask: {
    position: 'absolute',
    width: LOGO * 0.74,
    height: LOGO * 0.74,
    borderRadius: LOGO,
    backgroundColor: '#FFFFFF',
  },
  logo: { width: LOGO, height: LOGO },
  wordRow: { flexDirection: 'row', marginTop: 2 },
  letter: { fontSize: 38, fontWeight: '900', color: '#0B1533', letterSpacing: 4 },
  letterE: { color: '#F97316' },
  letterX: { color: '#EC4899' },
  tagline: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#64748B', letterSpacing: 0.5 },
  progressTrack: {
    position: 'absolute',
    bottom: 70,
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
});
