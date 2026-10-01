import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { getMyFollowersRequest, searchUsersRequest } from '../../api/communities.api';
import { pickPhoto } from '../../services/imagePicker';
import { uploadFileRequest } from '../../api/media.api';
import { UserRow } from '../../types';
import { typography, spacing, borderRadius } from '../../theme';
import { circleTheme } from '../../theme/circleTheme';

interface CreateCircleModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

const ACCENT = circleTheme.accent;
const ACCENT_DARK = circleTheme.accentDark;
const ACCENT_LIGHT = circleTheme.accentLight;

const CATEGORIES = ['Music', 'Coding', 'Design', 'Art', 'Fitness', 'Business', 'Language', 'Other'];

export const CreateCircleModal: React.FC<CreateCircleModalProps> = ({ visible, onClose, onCreated }) => {
  const insets = useSafeAreaInsets();
  const { user, createCommunity, showDialog } = useApp();

  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [category, setCategory] = useState('Music');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Member picker
  const [tab, setTab] = useState<'followers' | 'search'>('followers');
  const [followers, setFollowers] = useState<UserRow[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);

  // selected members: id -> { person, isAdmin }
  const [selected, setSelected] = useState<Record<string, { person: UserRow; isAdmin: boolean }>>({});

  useEffect(() => {
    if (!visible) return;
    // reset
    setName('');
    setAbout('');
    setCategory('Music');
    setLogoUri(null);
    setSelected({});
    setQuery('');
    setResults([]);
    setTab('followers');
    setLoadingFollowers(true);
    getMyFollowersRequest()
      .then(setFollowers)
      .catch(() => setFollowers([]))
      .finally(() => setLoadingFollowers(false));
  }, [visible]);

  // Debounced search
  useEffect(() => {
    if (tab !== 'search') return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchUsersRequest(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query, tab]);

  const toggleSelect = (p: UserRow) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = { person: p, isAdmin: false };
      return next;
    });
  };

  const toggleAdmin = (id: string) => {
    setSelected((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], isAdmin: !prev[id].isAdmin } } : prev,
    );
  };

  const handlePickLogo = async () => {
    const res = await pickPhoto();
    if (res.status === 'denied') {
      Alert.alert('Access Needed', 'Please allow photo access to set a circle logo.');
      return;
    }
    if (res.status === 'ok') setLogoUri(res.uri);
  };

  const selectedList = Object.values(selected);

  const handleCreate = async () => {
    if (name.trim().length < 2) {
      showDialog({ title: 'Name Required', message: 'Give your circle a name (min 2 characters).', icon: 'alert-circle-outline', confirmText: 'OK' });
      return;
    }
    if (!about.trim()) {
      showDialog({ title: 'About Required', message: 'Add a short bio / about for your circle.', icon: 'alert-circle-outline', confirmText: 'OK' });
      return;
    }
    setCreating(true);
    try {
      // Upload the logo first (if picked).
      let avatarUrl: string | undefined;
      if (logoUri) {
        const mime = logoUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const up = await uploadFileRequest(logoUri, mime);
        avatarUrl = up.url;
      }
      const memberIds = selectedList.map((s) => s.person.id);
      const adminIds = selectedList.filter((s) => s.isAdmin).map((s) => s.person.id);
      const created = await createCommunity({
        name: name.trim(),
        description: about.trim(),
        category,
        avatarUrl,
        memberIds,
        adminIds,
      });
      onCreated?.(created.id);
      onClose();
      showDialog({
        title: 'Circle Created 🎉',
        message: `"${created.name}" is live. You're the admin${memberIds.length ? ` and ${memberIds.length} member(s) were added` : ''}.`,
        icon: 'checkmark-circle',
        confirmText: 'Great',
      });
    } catch (err: any) {
      showDialog({ title: 'Could Not Create', message: err?.message || 'Please try again.', icon: 'alert-circle-outline', confirmText: 'OK' });
    } finally {
      setCreating(false);
    }
  };

  const list = tab === 'followers' ? followers : results;
  const loading = tab === 'followers' ? loadingFollowers : searching;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 6, 16) }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Circle</Text>
          <TouchableOpacity onPress={handleCreate} disabled={creating} style={styles.createBtn}>
            <LinearGradient colors={[ACCENT, ACCENT_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createGradient}>
              <Text style={styles.createText}>{creating ? '...' : 'Create'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Logo picker */}
          <View style={styles.iconPreviewRow}>
            <TouchableOpacity activeOpacity={0.85} onPress={handlePickLogo} style={styles.iconPreviewTouch}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.iconPreview} />
              ) : (
                <LinearGradient colors={[ACCENT, ACCENT_DARK]} style={styles.iconPreview}>
                  <Ionicons name="camera" size={26} color="#FFFFFF" />
                </LinearGradient>
              )}
              <View style={styles.iconEditBadge}>
                <Ionicons name="pencil" size={11} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.iconHint}>
              {logoUri ? 'Tap to change the circle logo.' : 'Tap to add a circle logo (optional).'}
            </Text>
          </View>

          <Text style={styles.label}>Circle Name</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="pricetag-outline" size={17} color={ACCENT} style={{ marginRight: 8 }} />
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Late Night Jam Crew" placeholderTextColor="#94A3B8" style={styles.input} maxLength={60} />
          </View>

          <Text style={styles.label}>About / Bio</Text>
          <View style={[styles.inputWrap, styles.textareaWrap]}>
            <TextInput value={about} onChangeText={setAbout} placeholder="What is this circle about?" placeholderTextColor="#94A3B8" style={styles.textarea} multiline maxLength={500} />
          </View>

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.catChip, active && styles.catChipActive]}>
                  <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected members preview */}
          <Text style={styles.label}>Members {selectedList.length > 0 ? `(${selectedList.length})` : ''}</Text>
          {selectedList.length > 0 && (
            <View style={styles.selectedWrap}>
              {selectedList.map((s) => (
                <View key={s.person.id} style={styles.selectedChip}>
                  <Avatar name={s.person.name} uri={s.person.avatarUrl || undefined} size={24} />
                  <Text style={styles.selectedName} numberOfLines={1}>{s.person.name}</Text>
                  <TouchableOpacity onPress={() => toggleAdmin(s.person.id)} style={styles.adminToggle}>
                    <Ionicons name={s.isAdmin ? 'star' : 'star-outline'} size={14} color={s.isAdmin ? '#F59E0B' : '#94A3B8'} />
                    <Text style={[styles.adminToggleText, s.isAdmin && { color: '#B45309' }]}>Admin</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleSelect(s.person)}>
                    <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Picker tabs */}
          <View style={styles.pickerTabs}>
            <TouchableOpacity onPress={() => setTab('followers')} style={[styles.pickerTab, tab === 'followers' && styles.pickerTabActive]}>
              <Text style={[styles.pickerTabText, tab === 'followers' && styles.pickerTabTextActive]}>Your Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('search')} style={[styles.pickerTab, tab === 'search' && styles.pickerTabActive]}>
              <Text style={[styles.pickerTabText, tab === 'search' && styles.pickerTabTextActive]}>Search People</Text>
            </TouchableOpacity>
          </View>

          {tab === 'search' && (
            <View style={styles.inputWrap}>
              <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Search by name…" placeholderTextColor="#94A3B8" style={styles.input} autoCapitalize="none" />
            </View>
          )}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          ) : list.length === 0 ? (
            <Text style={styles.emptyPicker}>
              {tab === 'followers' ? 'No followers yet. Use Search to add people.' : query.trim() ? 'No people found.' : 'Type a name to search.'}
            </Text>
          ) : (
            list.map((p) => {
              const isSel = !!selected[p.id];
              return (
                <TouchableOpacity key={p.id} onPress={() => toggleSelect(p)} style={styles.personRow}>
                  <Avatar name={p.name} uri={p.avatarUrl || undefined} size={38} showRing={p.role === 'Mentor'} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{p.name}</Text>
                    <Text style={styles.personRole}>{p.role || 'Member'}</Text>
                  </View>
                  <View style={[styles.selectCircle, isSel && styles.selectCircleActive]}>
                    {isSel && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: typography.weights.bold, color: '#0F172A' },
  createBtn: { borderRadius: borderRadius.full, overflow: 'hidden' },
  createGradient: { paddingHorizontal: 18, paddingVertical: 9 },
  createText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  iconPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.base },
  iconPreviewTouch: { position: 'relative' },
  iconPreview: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9FE',
  },
  iconEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHint: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#0F172A' },
  textareaWrap: { alignItems: 'flex-start', paddingVertical: 4 },
  textarea: { flex: 1, minHeight: 64, paddingVertical: 8, fontSize: 14, color: '#0F172A' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  catChipActive: { backgroundColor: ACCENT_LIGHT },
  catChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  catChipTextActive: { color: ACCENT_DARK, fontWeight: 'bold' },
  selectedWrap: { gap: 8, marginBottom: 4 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  selectedName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0F172A' },
  adminToggle: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3 },
  adminToggleText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  pickerTabs: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  pickerTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    backgroundColor: '#F1F5F9',
  },
  pickerTabActive: { backgroundColor: ACCENT_LIGHT },
  pickerTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  pickerTabTextActive: { color: ACCENT_DARK, fontWeight: 'bold' },
  loadingRow: { paddingVertical: 20, alignItems: 'center' },
  emptyPicker: { fontSize: 12, color: '#94A3B8', paddingVertical: 16, textAlign: 'center' },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  personName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  personRole: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: { backgroundColor: ACCENT, borderColor: ACCENT },
});
