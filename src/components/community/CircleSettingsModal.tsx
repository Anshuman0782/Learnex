import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { getMyFollowersRequest, searchUsersRequest } from '../../api/communities.api';
import { pickPhoto } from '../../services/imagePicker';
import { uploadFileRequest } from '../../api/media.api';
import { Community, CommunityMember, UserRow } from '../../types';
import { typography, spacing, borderRadius } from '../../theme';
import { circleTheme } from '../../theme/circleTheme';

interface Props {
  visible: boolean;
  community: Community | null;
  onClose: () => void;
  onDeletedOrLeft?: () => void;
}

const ACCENT = circleTheme.accent;

export const CircleSettingsModal: React.FC<Props> = ({ visible, community: propCommunity, onClose, onDeletedOrLeft }) => {
  const insets = useSafeAreaInsets();
  const {
    user,
    getJoinedCommunityObjects,
    updateCircle,
    addCircleMembers,
    setCircleAdmin,
    removeCircleMember,
    deleteCircle,
    toggleCommunityJoin,
    showDialog,
  } = useApp();

  const joined = getJoinedCommunityObjects();

  // Live copy from context so the list updates after mutations.
  const community = useMemo(() => {
    if (!propCommunity) return null;
    return joined.find((c) => c.id === propCommunity.id) ?? propCommunity;
  }, [propCommunity, joined]);

  const isAdmin = !!community?.isAdmin;
  const isCreator = !!community?.isCreator;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [busy, setBusy] = useState(false);

  // Add-people picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tab, setTab] = useState<'followers' | 'search'>('followers');
  const [followers, setFollowers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [adding, setAdding] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (community) {
      setName(community.name);
      setAbout(community.description);
      setEditing(false);
      setPickerOpen(false);
    }
  }, [community?.id, visible]);

  useEffect(() => {
    if (!pickerOpen) return;
    setLoadingPeople(true);
    setTab('followers');
    setQuery('');
    setResults([]);
    getMyFollowersRequest()
      .then(setFollowers)
      .catch(() => setFollowers([]))
      .finally(() => setLoadingPeople(false));
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen || tab !== 'search') return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoadingPeople(true);
    const t = setTimeout(() => {
      searchUsersRequest(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoadingPeople(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query, tab, pickerOpen]);

  if (!community) return null;

  const members: CommunityMember[] =
    community.allMembers && community.allMembers.length > 0
      ? community.allMembers
      : [...(community.mentors || []), ...(community.members || [])];

  const existingIds = new Set(members.map((m) => m.id));
  const policyAdminsOnly = community.postPolicy === 'ADMINS';

  const saveInfo = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Name too short', 'Circle name needs at least 2 characters.');
      return;
    }
    setSavingInfo(true);
    try {
      await updateCircle(community.id, { name: name.trim(), description: about.trim() });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Please try again.');
    } finally {
      setSavingInfo(false);
    }
  };

  const changeLogo = async () => {
    const res = await pickPhoto();
    if (res.status === 'denied') {
      Alert.alert('Access Needed', 'Please allow photo access to set a logo.');
      return;
    }
    if (res.status !== 'ok') return;
    setBusy(true);
    try {
      const mime = res.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const up = await uploadFileRequest(res.uri, mime);
      await updateCircle(community.id, { avatarUrl: up.url });
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const setPolicy = async (adminsOnly: boolean) => {
    try {
      await updateCircle(community.id, { postPolicy: adminsOnly ? 'ADMINS' : 'ALL' });
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Please try again.');
    }
  };

  const toggleAdmin = (m: CommunityMember) => {
    const makeAdmin = !m.isAdmin;
    showDialog({
      title: makeAdmin ? 'Make Admin' : 'Dismiss Admin',
      message: makeAdmin
        ? `Make ${m.name} an admin? They'll be able to manage the circle.`
        : `Remove ${m.name} as an admin?`,
      icon: 'shield-checkmark-outline',
      confirmText: makeAdmin ? 'Make Admin' : 'Dismiss',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await setCircleAdmin(community.id, m.id, makeAdmin);
        } catch (e: any) {
          Alert.alert('Failed', e?.message || 'Please try again.');
        }
      },
    });
  };

  const removeMember = (m: CommunityMember) => {
    showDialog({
      title: 'Remove Member',
      message: `Remove ${m.name} from this circle?`,
      icon: 'person-remove-outline',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await removeCircleMember(community.id, m.id);
        } catch (e: any) {
          Alert.alert('Failed', e?.message || 'Please try again.');
        }
      },
    });
  };

  const leave = () => {
    showDialog({
      title: 'Leave Circle',
      message: `Leave "${community.name}"? You can rejoin later.`,
      icon: 'exit-outline',
      confirmText: 'Leave',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        await toggleCommunityJoin(community.id);
        onDeletedOrLeft?.();
        onClose();
      },
    });
  };

  const remove = () => {
    showDialog({
      title: 'Delete Circle',
      message: `Permanently delete "${community.name}"? This removes it for everyone and cannot be undone.`,
      icon: 'trash-outline',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteCircle(community.id);
          onDeletedOrLeft?.();
          onClose();
        } catch (e: any) {
          Alert.alert('Failed', e?.message || 'Please try again.');
        }
      },
    });
  };

  const addPerson = async (p: UserRow) => {
    setAdding((prev) => ({ ...prev, [p.id]: true }));
    try {
      await addCircleMembers(community.id, [{ userId: p.id, isAdmin: false }]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Please try again.');
    } finally {
      setAdding((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  const peopleList = tab === 'followers' ? followers : results;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Gradient banner */}
        <LinearGradient colors={circleTheme.banner as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.banner, { paddingTop: Math.max(insets.top + 8, 20) }]}>
          <View style={styles.bannerTop}>
            <TouchableOpacity onPress={onClose} style={styles.bannerBtn}>
              <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.bannerTitle}>Circle Info</Text>
            <View style={{ width: 36 }} />
          </View>

          <TouchableOpacity activeOpacity={isAdmin ? 0.85 : 1} onPress={isAdmin ? changeLogo : undefined} style={styles.logoWrap}>
            {community.avatarUrl ? (
              <Image source={{ uri: community.avatarUrl }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoFallback]}>
                <Ionicons name="people" size={40} color="#FFFFFF" />
              </View>
            )}
            {isAdmin && (
              <View style={styles.logoEdit}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="camera" size={14} color="#FFFFFF" />}
              </View>
            )}
          </TouchableOpacity>

          {!editing ? (
            <>
              <Text style={styles.circleName}>{community.name}</Text>
              <Text style={styles.circleMeta}>
                {community.category} • {community.memberCount} member{community.memberCount === 1 ? '' : 's'}
              </Text>
            </>
          ) : null}
        </LinearGradient>

        <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 30, 40) }} showsVerticalScrollIndicator={false}>
          {/* About / Edit info */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>About</Text>
              {isAdmin && !editing && (
                <TouchableOpacity onPress={() => setEditing(true)} style={styles.editLink}>
                  <Ionicons name="pencil" size={13} color={ACCENT} />
                  <Text style={styles.editLinkText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {editing ? (
              <>
                <Text style={styles.fieldLabel}>Circle Name</Text>
                <TextInput value={name} onChangeText={setName} style={styles.input} maxLength={60} placeholder="Circle name" placeholderTextColor="#94A3B8" />
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>About</Text>
                <TextInput value={about} onChangeText={setAbout} style={[styles.input, styles.textarea]} multiline maxLength={500} placeholder="What is this circle about?" placeholderTextColor="#94A3B8" />
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => { setEditing(false); setName(community.name); setAbout(community.description); }} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveInfo} disabled={savingInfo} style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>{savingInfo ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.aboutText}>{community.description || 'No description yet.'}</Text>
            )}
          </View>

          {/* Post policy (admin) */}
          {isAdmin && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Who can post</Text>
              <View style={styles.policyRow}>
                <TouchableOpacity onPress={() => setPolicy(false)} style={[styles.policyBtn, !policyAdminsOnly && styles.policyBtnActive]}>
                  <Ionicons name="people-outline" size={15} color={!policyAdminsOnly ? '#FFFFFF' : '#64748B'} />
                  <Text style={[styles.policyText, !policyAdminsOnly && styles.policyTextActive]}>All members</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPolicy(true)} style={[styles.policyBtn, policyAdminsOnly && styles.policyBtnActive]}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={policyAdminsOnly ? '#FFFFFF' : '#64748B'} />
                  <Text style={[styles.policyText, policyAdminsOnly && styles.policyTextActive]}>Admins only</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Members */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>{community.memberCount} Member{community.memberCount === 1 ? '' : 's'}</Text>
              {isAdmin && (
                <TouchableOpacity onPress={() => setPickerOpen((v) => !v)} style={styles.editLink}>
                  <Ionicons name={pickerOpen ? 'close' : 'person-add'} size={14} color={ACCENT} />
                  <Text style={styles.editLinkText}>{pickerOpen ? 'Done' : 'Add People'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Add-people picker */}
            {pickerOpen && (
              <View style={styles.picker}>
                <View style={styles.pickerTabs}>
                  <TouchableOpacity onPress={() => setTab('followers')} style={[styles.pickerTab, tab === 'followers' && styles.pickerTabActive]}>
                    <Text style={[styles.pickerTabText, tab === 'followers' && styles.pickerTabTextActive]}>Followers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setTab('search')} style={[styles.pickerTab, tab === 'search' && styles.pickerTabActive]}>
                    <Text style={[styles.pickerTabText, tab === 'search' && styles.pickerTabTextActive]}>Search</Text>
                  </TouchableOpacity>
                </View>
                {tab === 'search' && (
                  <View style={styles.searchWrap}>
                    <Ionicons name="search" size={15} color="#94A3B8" />
                    <TextInput value={query} onChangeText={setQuery} placeholder="Search by name…" placeholderTextColor="#94A3B8" style={styles.searchInput} autoCapitalize="none" />
                  </View>
                )}
                {loadingPeople ? (
                  <ActivityIndicator size="small" color={ACCENT} style={{ marginVertical: 12 }} />
                ) : peopleList.length === 0 ? (
                  <Text style={styles.pickerEmpty}>{tab === 'followers' ? 'No followers to add.' : query.trim() ? 'No people found.' : 'Type to search.'}</Text>
                ) : (
                  peopleList.map((p) => {
                    const already = existingIds.has(p.id);
                    return (
                      <View key={p.id} style={styles.pickerRow}>
                        <Avatar name={p.name} uri={p.avatarUrl || undefined} size={34} />
                        <Text style={styles.pickerName} numberOfLines={1}>{p.name}</Text>
                        {already ? (
                          <Text style={styles.alreadyText}>Added</Text>
                        ) : (
                          <TouchableOpacity onPress={() => addPerson(p)} disabled={adding[p.id]} style={styles.addBtn}>
                            <Text style={styles.addBtnText}>{adding[p.id] ? '…' : 'Add'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Member rows */}
            {members.map((m) => {
              const isMe = m.id === user?.id;
              const isTheCreator = community.createdById === m.id;
              return (
                <View key={m.id} style={styles.memberRow}>
                  <Avatar name={m.name} uri={m.avatarUrl || undefined} size={40} showRing={m.role === 'Mentor'} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.name}{isMe ? ' (You)' : ''}</Text>
                    <Text style={styles.memberRole}>{m.role}{isTheCreator ? ' • Creator' : ''}</Text>
                  </View>
                  {m.isAdmin && (
                    <View style={styles.adminBadge}>
                      <Ionicons name="shield-checkmark" size={11} color={ACCENT} />
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                  {isAdmin && !isMe && !isTheCreator && (
                    <>
                      <TouchableOpacity onPress={() => toggleAdmin(m)} style={styles.memberAction}>
                        <Ionicons name={m.isAdmin ? 'star' : 'star-outline'} size={17} color={m.isAdmin ? '#F59E0B' : '#94A3B8'} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeMember(m)} style={styles.memberAction}>
                        <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </View>

          {/* Danger zone */}
          <View style={styles.card}>
            <TouchableOpacity onPress={leave} style={styles.dangerRow}>
              <Ionicons name="exit-outline" size={18} color="#EF4444" />
              <Text style={styles.dangerText}>Leave Circle</Text>
            </TouchableOpacity>
            {isCreator && (
              <TouchableOpacity onPress={remove} style={[styles.dangerRow, { borderTopWidth: 1, borderTopColor: '#FEE2E2' }]}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={styles.dangerText}>Delete Circle (creator only)</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: circleTheme.bg },
  banner: { paddingHorizontal: spacing.base, paddingBottom: spacing.lg, alignItems: 'center' },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: spacing.sm },
  bannerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: typography.weights.bold, color: '#FFFFFF' },
  logoWrap: { position: 'relative', marginTop: 4, marginBottom: 10 },
  logo: { width: 92, height: 92, borderRadius: 30, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  logoFallback: { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  logoEdit: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: circleTheme.accentDark, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  circleName: { fontSize: 21, fontWeight: typography.weights.bold, color: '#FFFFFF', textAlign: 'center' },
  circleMeta: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  card: { backgroundColor: '#FFFFFF', marginHorizontal: spacing.base, marginTop: spacing.base, borderRadius: borderRadius.xl, padding: spacing.base, borderWidth: 1, borderColor: '#EEE9FB' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontSize: 12, fontWeight: '700', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.4 },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editLinkText: { fontSize: 12, fontWeight: '700', color: ACCENT },
  aboutText: { fontSize: 14, color: '#334155', lineHeight: 20, marginTop: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 5, marginTop: 8 },
  input: { backgroundColor: '#F8FAFC', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A' },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: borderRadius.full, backgroundColor: '#F1F5F9' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: borderRadius.full, backgroundColor: ACCENT },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  policyRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  policyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: borderRadius.lg, backgroundColor: '#F1F5F9' },
  policyBtnActive: { backgroundColor: ACCENT },
  policyText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  policyTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F5F3FB' },
  memberName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  memberRole: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: circleTheme.accentLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  adminBadgeText: { fontSize: 10, fontWeight: 'bold', color: circleTheme.accentDark },
  memberAction: { paddingHorizontal: 4, paddingVertical: 4 },
  picker: { marginTop: 10, backgroundColor: '#FAF9FF', borderRadius: borderRadius.lg, padding: 10 },
  pickerTabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pickerTab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: borderRadius.md, backgroundColor: '#F1F5F9' },
  pickerTabActive: { backgroundColor: circleTheme.accentLight },
  pickerTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  pickerTabTextActive: { color: circleTheme.accentDark, fontWeight: 'bold' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, marginBottom: 8 },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 13, color: '#0F172A' },
  pickerEmpty: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 10 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  pickerName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0F172A' },
  alreadyText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  addBtn: { backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 6, borderRadius: borderRadius.full },
  addBtnText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  dangerText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
});
