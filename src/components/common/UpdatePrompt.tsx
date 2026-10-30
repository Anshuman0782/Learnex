import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';

/** Check at most this often when the app comes back to the foreground. */
const CHECK_EVERY_MS = 15 * 60_000;

/**
 * Over-the-air app updates (EAS Update). When a new version of the app's code
 * has been published, it is downloaded in the background and a popup offers
 * "Update now" — no new APK needed. Native changes (new native libraries,
 * permissions, icon) still need a new APK; those builds get their own version.
 *
 * Does nothing in development, Expo Go, or when updates aren't configured.
 */
export const UpdatePrompt: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);
  const checking = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const check = async () => {
      if (checking.current || Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      checking.current = true;
      lastCheck.current = Date.now();
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          const fetched = await Updates.fetchUpdateAsync();
          if (fetched.isNew) {
            setDismissed(false);
            setReady(true);
          }
        }
      } catch {
        // Offline / update server unreachable — the app keeps working; try later.
        lastCheck.current = 0;
      } finally {
        checking.current = false;
      }
    };

    // Give the app a moment to start, then check; check again on returning.
    const t = setTimeout(() => void check(), 4000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);

  const restart = async () => {
    setRestarting(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setRestarting(false);
      setDismissed(true); // applied automatically next time the app starts
    }
  };

  return (
    <Modal visible={ready && !dismissed} transparent animationType="fade" onRequestClose={() => setDismissed(true)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="rocket" size={26} color="#4F46E5" />
          </View>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.body}>A new version of LERNEX is ready with fixes and improvements. It takes a few seconds.</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={restart} disabled={restarting} style={styles.primary}>
            {restarting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Update now</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDismissed(true)} disabled={restarting} style={styles.secondary}>
            <Text style={styles.secondaryText}>Later (updates next time you open the app)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  body: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginTop: 6, marginBottom: 18 },
  primary: { alignSelf: 'stretch', backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondary: { paddingVertical: 12 },
  secondaryText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
});
