import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getAdminMeRequest, getAdminStatsRequest, type AdminDashboard } from '../../api/admin.api';
import { AdminDashboardTab } from './AdminDashboardTab';
import { AdminAccessTab } from './AdminAccessTab';
import { AdminXpRulesTab } from './AdminXpRulesTab';
import { AdminRewardsTab } from './AdminRewardsTab';
import { AdminNotifyTab } from './AdminNotifyTab';
import { AdminAiTab } from './AdminAiTab';
import { ADMIN_ACCENT, errorMessage, isForbidden } from './adminUi';

type AdminTab = 'dashboard' | 'access' | 'xp' | 'rewards' | 'notify' | 'ai';

const TABS: Array<{ key: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'stats-chart' },
  { key: 'access', label: 'Admins', icon: 'shield-checkmark' },
  { key: 'xp', label: 'XP Rules', icon: 'flash' },
  { key: 'rewards', label: 'Rewards', icon: 'gift' },
  { key: 'notify', label: 'Notify', icon: 'megaphone' },
  { key: 'ai', label: 'AI', icon: 'sparkles' },
];

/**
 * The Admin Panel. Only reachable when the signed-in user has Admin access —
 * and every request is re-checked by the server, so a revoked admin is locked
 * out immediately (the panel closes itself if that happens while it's open).
 */
export const AdminPanelModal: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [isOwner, setIsOwner] = useState(false);
  const [stats, setStats] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closingRef = useRef(false);
  // Keep the latest onClose in a ref: the parent passes a new function on every
  // render, and depending on it would re-run the "panel opened" effect (which
  // resets to the Dashboard) after every change an admin makes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const lockOut = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onCloseRef.current();
    Alert.alert('Admin access removed', 'You no longer have access to the Admin Panel.');
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setError(null);
      setStats(await getAdminStatsRequest());
    } catch (e) {
      if (isForbidden(e)) lockOut();
      else setError(errorMessage(e, 'Could not load statistics.'));
    }
  }, [lockOut]);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    setTab('dashboard');
    setLoading(true);
    getAdminMeRequest()
      .then((me) => setIsOwner(me.isOwner))
      .catch((e) => {
        if (isForbidden(e)) lockOut();
      });
    loadStats().finally(() => setLoading(false));
    // Only when the panel opens — never on re-renders (that would reset the tab).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Access revoked live (realtime) while the panel is open → close it.
  useEffect(() => {
    if (visible && user && user.isAdmin === false) lockOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.isAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        <LinearGradient colors={['#134E4A', '#0F766E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>LERNEX ADMIN</Text>
              <Text style={styles.title}>Admin Panel</Text>
            </View>
            <View style={styles.roleBadge}>
              <Ionicons name={isOwner ? 'key' : 'shield-checkmark'} size={12} color="#CCFBF1" />
              <Text style={styles.roleBadgeText}>{isOwner ? 'Owner' : 'Admin'}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, active && styles.tabActive]}>
                  <Ionicons name={t.icon} size={14} color={active ? ADMIN_ACCENT : '#CCFBF1'} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom + 40, 60) }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            tab === 'dashboard' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
          }
        >
          {tab === 'dashboard' &&
            (loading && !stats ? (
              <ActivityIndicator color={ADMIN_ACCENT} style={{ marginTop: 40 }} />
            ) : error && !stats ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : stats ? (
              <AdminDashboardTab data={stats} />
            ) : null)}
          {tab === 'access' && <AdminAccessTab onForbidden={lockOut} />}
          {tab === 'xp' && <AdminXpRulesTab onForbidden={lockOut} />}
          {tab === 'rewards' && <AdminRewardsTab onForbidden={lockOut} />}
          {tab === 'notify' && <AdminNotifyTab onForbidden={lockOut} />}
          {tab === 'ai' && <AdminAiTab onForbidden={lockOut} />}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { fontSize: 10, fontWeight: '800', color: '#99F6E4', letterSpacing: 1.2 },
  title: { fontSize: 19, fontWeight: '800', color: '#FFFFFF' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '800', color: '#CCFBF1' },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 14, padding: 3, flexGrow: 1 },
  tab: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 11 },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 11, fontWeight: '700', color: '#CCFBF1' },
  tabTextActive: { color: ADMIN_ACCENT, fontWeight: '800' },
  body: { padding: 14 },
  errorBox: { alignItems: 'center', gap: 10, marginTop: 40 },
  errorText: { fontSize: 13, color: '#DC2626', textAlign: 'center' },
  retryBtn: { backgroundColor: ADMIN_ACCENT, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
