import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { CodeInput } from '../../components/common/CodeInput';

/**
 * "Verify your email" step: shown right after sign-up, and whenever a signed-in
 * account hasn't verified yet. 6-digit code with resend (60s cooldown).
 */
export const VerifyEmailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, sendEmailVerification, confirmEmailVerification, logout } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(route.params?.autoSend ? 0 : 60);
  const [info, setInfo] = useState('');

  const goNext = () => {
    if (user?.role) navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });
    else navigation.reset({ index: 0, routes: [{ name: 'CommunityRecommendation' }] });
  };

  const resend = async (silent = false) => {
    setError('');
    try {
      await sendEmailVerification();
      setCooldown(60);
      if (!silent) setInfo('A new code is on its way.');
    } catch (e: any) {
      setError(e?.message || 'Could not send the code. Try again in a minute.');
    }
  };

  // Coming back later (not right after sign-up) → send a fresh code automatically.
  useEffect(() => {
    if (route.params?.autoSend) void resend(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (c = code) => {
    if (c.length !== 6) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await confirmEmailVerification(c);
      goNext();
    } catch (e: any) {
      setError(e?.status === 400 ? 'That code is wrong or expired. Check your email or resend.' : e?.message || 'Please try again.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + 24 }]} behavior="padding" automaticOffset>
      <View style={styles.iconWrap}>
        <LinearGradient colors={['#F59E0B', '#EC4899']} style={styles.icon}>
          <Ionicons name="mail-open" size={34} color="#FFFFFF" />
        </LinearGradient>
      </View>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.sub}>
        We sent a 6-digit code to{'\n'}
        <Text style={styles.email}>{user?.email}</Text>
      </Text>

      <View style={{ marginTop: 26 }}>
        <CodeInput value={code} onChange={(v) => { setCode(v); setError(''); }} onComplete={(v) => void verify(v)} error={!!error} />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!info && <Text style={styles.info}>{info}</Text>}

      <TouchableOpacity activeOpacity={0.85} disabled={busy} onPress={() => void verify()} style={{ marginTop: 22 }}>
        <LinearGradient colors={['#4F46E5', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Verify email</Text>}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity disabled={cooldown > 0} onPress={() => void resend()} style={styles.linkRow}>
        <Text style={[styles.link, cooldown > 0 && styles.linkDisabled]}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.tip}>Can’t find it? Check your Spam / Promotions folder.</Text>

      <TouchableOpacity
        onPress={async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }}
        style={[styles.linkRow, { marginTop: 'auto', marginBottom: insets.bottom + 16 }]}
      >
        <Text style={styles.logout}>Use a different account</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24 },
  iconWrap: { alignItems: 'center', marginTop: 12 },
  icon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginTop: 18 },
  sub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 21 },
  email: { fontWeight: '800', color: '#0F172A' },
  error: { color: '#DC2626', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  info: { color: '#16A34A', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  btn: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  linkRow: { alignItems: 'center', marginTop: 16 },
  link: { fontSize: 14, fontWeight: '800', color: '#4F46E5' },
  linkDisabled: { color: '#94A3B8' },
  tip: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 6 },
  logout: { fontSize: 13, fontWeight: '700', color: '#64748B' },
});
