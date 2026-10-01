import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import {
  getFollowersOfRequest,
  getFollowingOfRequest,
  followUserRequest,
  unfollowUserRequest,
  type FollowUserRow,
} from '../../api/social.api';
import { typography, spacing, borderRadius } from '../../theme';

interface Props {
  visible: boolean;
  userId: string | null;
  mode: 'followers' | 'following';
  onClose: () => void;
}

export const FollowListModal: React.FC<Props> = ({ visible, userId, mode, onClose }) => {
  const insets = useSafeAreaInsets();
  const { openUserProfile } = useApp();
  const [rows, setRows] = useState<FollowUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    const req = mode === 'followers' ? getFollowersOfRequest : getFollowingOfRequest;
    req(userId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [visible, userId, mode]);

  const toggleFollow = async (row: FollowUserRow) => {
    const next = !row.isFollowing;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isFollowing: next } : r)));
    setBusy((b) => ({ ...b, [row.id]: true }));
    try {
      if (next) await followUserRequest(row.id);
      else await unfollowUserRequest(row.id);
    } catch {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isFollowing: !next } : r)));
    } finally {
      setBusy((b) => ({ ...b, [row.id]: false }));
    }
  };

  const openProfile = (row: FollowUserRow) => {
    onClose();
    openUserProfile({ id: row.id, name: row.name, avatarUrl: row.avatarUrl, role: row.role || 'Learner' });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
          <View style={styles.pill} />
          <View style={styles.header}>
            <Text style={styles.title}>{mode === 'followers' ? 'Followers' : 'Following'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator size="small" color="#4F46E5" style={{ marginVertical: 24 }} />
            ) : rows.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={36} color="#CBD5E1" />
                <Text style={styles.emptyText}>
                  {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
                </Text>
              </View>
            ) : (
              rows.map((row) => (
                <View key={row.id} style={styles.row}>
                  <TouchableOpacity style={styles.rowLeft} activeOpacity={0.8} onPress={() => openProfile(row)}>
                    <Avatar name={row.name} uri={row.avatarUrl || undefined} size={42} showRing={row.role === 'Mentor'} />
                    <View>
                      <Text style={styles.name}>{row.name}</Text>
                      <Text style={styles.role}>{row.role || 'Member'}</Text>
                    </View>
                  </TouchableOpacity>
                  {!row.isSelf && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={busy[row.id]}
                      onPress={() => toggleFollow(row)}
                      style={[styles.followBtn, row.isFollowing && styles.followingBtn]}
                    >
                      <Text style={[styles.followText, row.isFollowing && styles.followingText]}>
                        {row.isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '78%',
    minHeight: '45%',
    paddingHorizontal: spacing.base,
  },
  pill: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  title: { fontSize: 17, fontWeight: typography.weights.bold, color: '#0F172A' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: '#94A3B8' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  role: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  followBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 7, borderRadius: borderRadius.full },
  followingBtn: { backgroundColor: '#F1F5F9' },
  followText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
  followingText: { color: '#475569' },
});
