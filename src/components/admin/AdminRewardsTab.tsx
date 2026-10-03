import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import {
  REWARD_TYPES,
  createRewardRequest,
  deleteRewardRequest,
  getAdminRewardsRequest,
  updateRewardRequest,
  type AdminReward,
} from '../../api/admin.api';
import {
  ADMIN_ACCENT,
  Badge,
  ChipPicker,
  EmptyState,
  Field,
  PrimaryButton,
  errorMessage,
  isForbidden,
} from './adminUi';

type Role = 'Learner' | 'Mentor' | 'Both';
type RewardType = (typeof REWARD_TYPES)[number]['id'];

interface Draft {
  id?: string;
  title: string;
  subtitle: string;
  description: string;
  type: RewardType;
  targetRole: Role;
  minRank: string;
  perks: string; // one per line
  codePrefix: string;
  isActive: boolean;
  claims: number;
}

const EMPTY: Draft = {
  title: '',
  subtitle: '',
  description: '',
  type: 'voucher',
  targetRole: 'Both',
  minRank: '10',
  perks: '',
  codePrefix: '',
  isActive: true,
  claims: 0,
};

const ROLE_OPTIONS = [
  { id: 'Both', label: 'Both boards' },
  { id: 'Learner', label: 'Learners' },
  { id: 'Mentor', label: 'Mentors' },
] as const;

const iconFor = (type: string) => REWARD_TYPES.find((t) => t.id === type)?.icon ?? 'gift';

export const AdminRewardsTab: React.FC<{ onForbidden: () => void }> = ({ onForbidden }) => {
  const insets = useSafeAreaInsets();
  const { showDialog } = useApp();
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const handleError = (e: unknown) => {
    if (isForbidden(e)) onForbidden();
    else Alert.alert('Rewards', errorMessage(e));
  };

  useEffect(() => {
    getAdminRewardsRequest()
      .then(setRewards)
      .catch(handleError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEditor = (r?: AdminReward) =>
    setDraft(
      r
        ? {
            id: r.id,
            title: r.title,
            subtitle: r.subtitle,
            description: r.description,
            type: (REWARD_TYPES.some((t) => t.id === r.type) ? r.type : 'voucher') as RewardType,
            targetRole: r.targetRole,
            minRank: String(r.minRank),
            perks: r.perks.join('\n'),
            codePrefix: r.codePrefix,
            isActive: r.isActive,
            claims: r.claims,
          }
        : { ...EMPTY },
    );

  const toggleActive = async (r: AdminReward, isActive: boolean) => {
    setRewards((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive } : x)));
    try {
      setRewards(await updateRewardRequest(r.id, { isActive }));
    } catch (e) {
      setRewards((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: !isActive } : x)));
      handleError(e);
    }
  };

  const save = async () => {
    if (!draft) return;
    const minRank = Number.parseInt(draft.minRank, 10);
    const perks = draft.perks.split('\n').map((p) => p.trim()).filter(Boolean);
    if (draft.title.trim().length < 2) return Alert.alert('Check the reward', 'Add a title (2+ characters).');
    if (!draft.description.trim()) return Alert.alert('Check the reward', 'Add a short description.');
    if (!Number.isFinite(minRank) || minRank < 1 || minRank > 1000) {
      return Alert.alert('Check the reward', 'Rank must be a whole number between 1 and 1000.');
    }
    if (perks.length > 6) return Alert.alert('Check the reward', 'Add at most 6 perks.');
    if (draft.codePrefix && !/^[A-Za-z0-9-]{2,20}$/.test(draft.codePrefix)) {
      return Alert.alert('Check the reward', 'Code prefix: 2–20 letters, numbers or dashes.');
    }

    const body = {
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      description: draft.description.trim(),
      type: draft.type,
      icon: iconFor(draft.type),
      targetRole: draft.targetRole,
      minRank,
      perks,
      isActive: draft.isActive,
      ...(draft.codePrefix ? { codePrefix: draft.codePrefix } : {}),
    };

    setSaving(true);
    try {
      setRewards(draft.id ? await updateRewardRequest(draft.id, body) : await createRewardRequest(body));
      setDraft(null);
    } catch (e) {
      handleError(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!draft?.id) return;
    const id = draft.id;
    showDialog({
      title: 'Delete this reward?',
      message: 'It will disappear from every member’s Rewards tab immediately.',
      icon: 'trash-outline',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setRewards(await deleteRewardRequest(id));
          setDraft(null);
        } catch (e) {
          handleError(e);
        }
      },
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.notice}>
        <Ionicons name="gift" size={15} color={ADMIN_ACCENT} />
        <Text style={styles.noticeText}>
          Members earn a reward by finishing a season inside its rank range, and claim it once after the season
          ends. New or changed rewards show up in everyone’s Rewards tab instantly.
        </Text>
      </View>

      <PrimaryButton label="Add a new reward" icon="add-circle" onPress={() => openEditor()} />

      {loading ? (
        <ActivityIndicator color={ADMIN_ACCENT} style={{ marginTop: 20 }} />
      ) : rewards.length === 0 ? (
        <EmptyState icon="gift-outline" title="No rewards yet" body="Members currently see an empty Rewards tab. Add your first reward to announce it." />
      ) : (
        rewards.map((r) => (
          <TouchableOpacity key={r.id} activeOpacity={0.9} onPress={() => openEditor(r)} style={[styles.card, !r.isActive && { opacity: 0.6 }]}>
            <LinearGradient colors={r.gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardHead}>
              <View style={styles.iconCircle}>
                <Ionicons name={r.icon as keyof typeof Ionicons.glyphMap} size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{r.title}</Text>
                {!!r.subtitle && <Text style={styles.cardSub}>{r.subtitle}</Text>}
              </View>
            </LinearGradient>
            <View style={styles.cardBody}>
              <View style={styles.badgeRow}>
                <Badge text={r.minRankRequired} icon="trophy" color="#B45309" bg="#FEF3C7" />
                <Badge text={`${r.claims} claimed`} icon="checkmark-done" />
                {!r.isActive && <Badge text="Hidden" icon="eye-off" color="#DC2626" bg="#FEE2E2" />}
              </View>
              <View style={styles.activeRow}>
                <Text style={styles.activeLabel}>{r.isActive ? 'Visible to members' : 'Hidden from members'}</Text>
                <Switch
                  value={r.isActive}
                  onValueChange={(v) => toggleActive(r, v)}
                  trackColor={{ true: '#5EEAD4', false: '#CBD5E1' }}
                  thumbColor={r.isActive ? ADMIN_ACCENT : '#F8FAFC'}
                />
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}

      <Modal visible={!!draft} animationType="slide" transparent onRequestClose={() => setDraft(null)}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{draft?.id ? 'Edit reward' : 'New reward'}</Text>
              <TouchableOpacity onPress={() => setDraft(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            {draft && (
              <ScrollView contentContainerStyle={[styles.sheetBody, { paddingBottom: 40 + insets.bottom }]} keyboardShouldPersistTaps="handled">
                <ChipPicker
                  label="Reward type"
                  options={REWARD_TYPES.map((t) => ({ id: t.id, label: t.label }))}
                  value={draft.type}
                  onChange={(v) => setDraft({ ...draft, type: v })}
                />
                <Field label="Title" value={draft.title} maxLength={60} onChangeText={(v) => setDraft({ ...draft, title: v })} placeholder="e.g. Amazon gift card" />
                <Field label="Subtitle" value={draft.subtitle} maxLength={80} onChangeText={(v) => setDraft({ ...draft, subtitle: v })} placeholder="e.g. ₹500 voucher" />
                <Field
                  label="Description"
                  value={draft.description}
                  maxLength={400}
                  multiline
                  onChangeText={(v) => setDraft({ ...draft, description: v })}
                  placeholder="What the member receives and how it’s delivered"
                />
                <ChipPicker
                  label="Which leaderboard"
                  options={ROLE_OPTIONS}
                  value={draft.targetRole}
                  onChange={(v) => setDraft({ ...draft, targetRole: v })}
                />
                <Field
                  label="Finish in the top…"
                  value={draft.minRank}
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(v) => setDraft({ ...draft, minRank: v.replace(/[^0-9]/g, '') })}
                  help="e.g. 10 = members who finish the season ranked #1–#10 on their board"
                />
                <Field
                  label="Perks (one per line, up to 6)"
                  value={draft.perks}
                  multiline
                  onChangeText={(v) => setDraft({ ...draft, perks: v })}
                  placeholder={'Delivered within 7 days\nValid for 3 months'}
                />
                <Field
                  label="Claim code prefix (optional)"
                  value={draft.codePrefix}
                  autoCapitalize="characters"
                  maxLength={20}
                  onChangeText={(v) => setDraft({ ...draft, codePrefix: v.replace(/[^A-Za-z0-9-]/g, '') })}
                  placeholder="e.g. LRNX-GIFT"
                  help="Each claim gets a unique code like PREFIX-3F9A21"
                />
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Visible to members</Text>
                    <Text style={styles.help}>Hidden rewards can’t be earned or claimed.</Text>
                  </View>
                  <Switch
                    value={draft.isActive}
                    onValueChange={(v) => setDraft({ ...draft, isActive: v })}
                    trackColor={{ true: '#5EEAD4', false: '#CBD5E1' }}
                    thumbColor={draft.isActive ? ADMIN_ACCENT : '#F8FAFC'}
                  />
                </View>
                <PrimaryButton label={draft.id ? 'Save changes' : 'Create reward'} icon="checkmark-circle" busy={saving} onPress={save} />
                {draft.id &&
                  (draft.claims > 0 ? (
                    <Text style={styles.help}>
                      {draft.claims} member(s) already claimed this reward, so it can’t be deleted — hide it instead to keep their claim history.
                    </Text>
                  ) : (
                    <PrimaryButton label="Delete reward" icon="trash-outline" danger outline onPress={remove} />
                  ))}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  notice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 14,
    padding: 10,
  },
  noticeText: { flex: 1, fontSize: 12, color: '#115E59', lineHeight: 17 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  cardSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  cardBody: { padding: 12, gap: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: 16, gap: 14, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  help: { fontSize: 10, color: '#94A3B8', lineHeight: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
