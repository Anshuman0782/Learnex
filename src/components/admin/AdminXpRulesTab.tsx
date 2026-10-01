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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import {
  RULE_CATEGORIES,
  createXpRuleRequest,
  deleteXpRuleRequest,
  getAdminXpRulesRequest,
  getXpTriggersRequest,
  updateXpRuleRequest,
  type AdminXpRule,
  type XpTriggerDef,
} from '../../api/admin.api';
import {
  ADMIN_ACCENT,
  Badge,
  ChipPicker,
  EmptyState,
  Field,
  PrimaryButton,
  Section,
  errorMessage,
  isForbidden,
} from './adminUi';

type Role = 'Learner' | 'Mentor' | 'Both';

interface Draft {
  key?: string;
  trigger: string;
  title: string;
  description: string;
  role: Role;
  category: string;
  xp: string;
  dailyCap: string; // '' = no limit
  isActive: boolean;
  isBuiltIn: boolean;
  isCore: boolean;
}

const EMPTY_DRAFT: Draft = {
  trigger: 'post.published',
  title: '',
  description: '',
  role: 'Both',
  category: 'Practice',
  xp: '10',
  dailyCap: '',
  isActive: true,
  isBuiltIn: false,
  isCore: false,
};

const ROLE_OPTIONS = [
  { id: 'Both', label: 'Everyone' },
  { id: 'Learner', label: 'Learners' },
  { id: 'Mentor', label: 'Mentors' },
] as const;

export const AdminXpRulesTab: React.FC<{ onForbidden: () => void }> = ({ onForbidden }) => {
  const { showDialog } = useApp();
  const [rules, setRules] = useState<AdminXpRule[]>([]);
  const [triggers, setTriggers] = useState<XpTriggerDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const handleError = (e: unknown) => {
    if (isForbidden(e)) onForbidden();
    else Alert.alert('XP rules', errorMessage(e));
  };

  useEffect(() => {
    Promise.all([getAdminXpRulesRequest(), getXpTriggersRequest()])
      .then(([r, t]) => {
        setRules(r);
        setTriggers(t);
      })
      .catch(handleError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (rule: AdminXpRule, isActive: boolean) => {
    setTogglingKey(rule.key);
    setRules((prev) => prev.map((r) => (r.key === rule.key ? { ...r, isActive } : r)));
    try {
      setRules(await updateXpRuleRequest(rule.key, { isActive }));
    } catch (e) {
      setRules((prev) => prev.map((r) => (r.key === rule.key ? { ...r, isActive: !isActive } : r)));
      handleError(e);
    } finally {
      setTogglingKey(null);
    }
  };

  const openEditor = (rule?: AdminXpRule) => {
    setDraft(
      rule
        ? {
            key: rule.key,
            trigger: rule.trigger,
            title: rule.title,
            description: rule.description,
            role: rule.role,
            category: rule.category,
            xp: String(rule.xp),
            dailyCap: rule.dailyCap ? String(rule.dailyCap) : '',
            isActive: rule.isActive,
            isBuiltIn: rule.isBuiltIn,
            isCore: rule.isCore,
          }
        : { ...EMPTY_DRAFT },
    );
  };

  const save = async () => {
    if (!draft) return;
    const xp = Number.parseInt(draft.xp, 10);
    const cap = draft.dailyCap.trim() === '' ? null : Number.parseInt(draft.dailyCap, 10);
    if (draft.title.trim().length < 2) return Alert.alert('Check the rule', 'Give the rule a title (2+ characters).');
    if (!Number.isFinite(xp) || xp < 1 || xp > 5000) return Alert.alert('Check the rule', 'XP must be a whole number between 1 and 5000.');
    if (cap !== null && (!Number.isFinite(cap) || cap < 1 || cap > 100)) {
      return Alert.alert('Check the rule', 'Daily limit must be between 1 and 100, or empty for no limit.');
    }

    const body = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      role: draft.role,
      category: draft.category,
      xp,
      dailyCap: cap,
      isActive: draft.isActive,
      ...(draft.isBuiltIn ? {} : { trigger: draft.trigger }),
    };

    setSaving(true);
    try {
      setRules(draft.key ? await updateXpRuleRequest(draft.key, body) : await createXpRuleRequest(body));
      setDraft(null);
    } catch (e) {
      handleError(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!draft?.key) return;
    const key = draft.key;
    showDialog({
      title: 'Delete this rule?',
      message: 'It stops paying XP immediately. XP members already earned from it is kept.',
      icon: 'trash-outline',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setRules(await deleteXpRuleRequest(key));
          setDraft(null);
        } catch (e) {
          handleError(e);
        }
      },
    });
  };

  const renderRule = (r: AdminXpRule) => (
    <TouchableOpacity key={r.key} activeOpacity={0.85} onPress={() => openEditor(r)} style={styles.ruleCard}>
      <View style={styles.ruleTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.ruleTitle, !r.isActive && styles.inactive]}>{r.title}</Text>
            {r.isCore ? (
              <Badge text="Core" icon="lock-closed" />
            ) : r.isBuiltIn ? (
              <Badge text="Built-in" color="#4F46E5" bg="#EEF2FF" />
            ) : (
              <Badge text="Custom" color="#0F766E" bg="#CCFBF1" />
            )}
          </View>
          <Text style={styles.trigger}>
            <Ionicons name="flash-outline" size={11} color="#64748B" /> {r.triggerLabel}
          </Text>
        </View>
        <Text style={[styles.xp, !r.isActive && styles.inactive]}>+{r.xp}</Text>
      </View>
      <View style={styles.ruleBottom}>
        <Text style={styles.meta}>
          {r.role === 'Both' ? 'Everyone' : `${r.role}s`} · {r.dailyCap ? `${r.dailyCap}×/day` : 'no daily limit'} · {r.category}
        </Text>
        {r.isCore ? (
          <Text style={styles.metaStrong}>Always on</Text>
        ) : togglingKey === r.key ? (
          <ActivityIndicator size="small" color={ADMIN_ACCENT} />
        ) : (
          <Switch
            value={r.isActive}
            onValueChange={(v) => toggleActive(r, v)}
            trackColor={{ true: '#5EEAD4', false: '#CBD5E1' }}
            thumbColor={r.isActive ? ADMIN_ACCENT : '#F8FAFC'}
          />
        )}
      </View>
      <Text style={styles.payout}>
        This season: paid {r.seasonPayouts}× · {r.seasonXpPaid.toLocaleString()} XP
      </Text>
    </TouchableOpacity>
  );

  const core = rules.filter((r) => r.isCore);
  const builtIn = rules.filter((r) => r.isBuiltIn && !r.isCore);
  const custom = rules.filter((r) => !r.isBuiltIn);
  const selectedTrigger = triggers.find((t) => t.id === draft?.trigger);

  return (
    <View style={styles.wrap}>
      <View style={styles.notice}>
        <Ionicons name="flash" size={15} color={ADMIN_ACCENT} />
        <Text style={styles.noticeText}>
          Changes apply instantly: the next matching action pays the new XP and every member’s Rules screen updates live.
        </Text>
      </View>

      <PrimaryButton label="Add a new XP rule" icon="add-circle" onPress={() => openEditor()} />

      {loading ? (
        <ActivityIndicator color={ADMIN_ACCENT} style={{ marginTop: 20 }} />
      ) : (
        <>
          <Section title="Custom rules" subtitle="Created by admins — fully editable" icon="construct">
            {custom.length === 0 ? (
              <EmptyState icon="construct-outline" title="No custom rules yet" body="Add one to reward any action — e.g. extra XP for publishing reels." />
            ) : (
              custom.map(renderRule)
            )}
          </Section>
          <Section title="Built-in rules" subtitle="Tune the XP, daily limit, text or turn them off" icon="options">
            {builtIn.map(renderRule)}
          </Section>
          <Section title="Core rules" subtitle="Fixed by the platform — can’t be changed" icon="lock-closed">
            {core.map(renderRule)}
          </Section>
        </>
      )}

      {/* Editor */}
      <Modal visible={!!draft} animationType="slide" transparent onRequestClose={() => setDraft(null)}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {draft?.isCore ? 'Core rule' : draft?.key ? 'Edit XP rule' : 'New XP rule'}
              </Text>
              <TouchableOpacity onPress={() => setDraft(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {draft && (
              <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
                {draft.isCore && (
                  <View style={styles.lockNote}>
                    <Ionicons name="lock-closed" size={14} color="#475569" />
                    <Text style={styles.lockNoteText}>
                      Core rules keep the economy fair and consistent, so they can’t be edited.
                    </Text>
                  </View>
                )}

                {/* Trigger */}
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>When does it pay?</Text>
                  {draft.isBuiltIn ? (
                    <View style={styles.triggerFixed}>
                      <Text style={styles.triggerFixedText}>{selectedTrigger?.label ?? draft.trigger}</Text>
                      <Text style={styles.help}>A built-in rule’s trigger is fixed. Add a custom rule to reward the same action differently.</Text>
                    </View>
                  ) : (
                    <View style={styles.triggerList}>
                      {triggers.map((t) => {
                        const active = draft.trigger === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            onPress={() => setDraft({ ...draft, trigger: t.id })}
                            style={[styles.triggerRow, active && styles.triggerRowActive]}
                          >
                            <Ionicons
                              name={active ? 'radio-button-on' : 'radio-button-off'}
                              size={16}
                              color={active ? ADMIN_ACCENT : '#94A3B8'}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.triggerLabel, active && { color: ADMIN_ACCENT }]}>{t.label}</Text>
                              <Text style={styles.help}>{t.description}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                <Field
                  label="Title (shown to members)"
                  value={draft.title}
                  onChangeText={(v) => setDraft({ ...draft, title: v })}
                  editable={!draft.isCore}
                  maxLength={60}
                  placeholder="e.g. Publish a reel"
                />
                <Field
                  label="Description"
                  value={draft.description}
                  onChangeText={(v) => setDraft({ ...draft, description: v })}
                  editable={!draft.isCore}
                  multiline
                  maxLength={200}
                  placeholder="Explain exactly what members need to do"
                />
                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="XP awarded"
                      value={draft.xp}
                      onChangeText={(v) => setDraft({ ...draft, xp: v.replace(/[^0-9]/g, '') })}
                      editable={!draft.isCore}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Daily limit"
                      value={draft.dailyCap}
                      onChangeText={(v) => setDraft({ ...draft, dailyCap: v.replace(/[^0-9]/g, '') })}
                      editable={!draft.isCore}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder="No limit"
                      help="Times per day it can pay"
                    />
                  </View>
                </View>
                <ChipPicker
                  label="Who can earn it"
                  options={ROLE_OPTIONS}
                  value={draft.role}
                  onChange={(v) => setDraft({ ...draft, role: v })}
                  disabled={draft.isCore}
                />
                <ChipPicker
                  label="Category"
                  options={RULE_CATEGORIES.map((c) => ({ id: c, label: c }))}
                  value={draft.category}
                  onChange={(v) => setDraft({ ...draft, category: v })}
                  disabled={draft.isCore}
                />
                {!draft.isCore && (
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Active</Text>
                      <Text style={styles.help}>Turned-off rules stop paying and are hidden from members.</Text>
                    </View>
                    <Switch
                      value={draft.isActive}
                      onValueChange={(v) => setDraft({ ...draft, isActive: v })}
                      trackColor={{ true: '#5EEAD4', false: '#CBD5E1' }}
                      thumbColor={draft.isActive ? ADMIN_ACCENT : '#F8FAFC'}
                    />
                  </View>
                )}

                {!draft.isCore && (
                  <PrimaryButton
                    label={draft.key ? 'Save changes' : 'Create rule'}
                    icon="checkmark-circle"
                    busy={saving}
                    onPress={save}
                  />
                )}
                {draft.key && !draft.isBuiltIn && (
                  <PrimaryButton label="Delete rule" icon="trash-outline" danger outline onPress={remove} />
                )}
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
  ruleCard: { borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 14, padding: 10, gap: 6, backgroundColor: '#FCFDFE' },
  ruleTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ruleTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  inactive: { color: '#94A3B8', textDecorationLine: 'line-through' },
  trigger: { fontSize: 11, color: '#64748B', marginTop: 2 },
  xp: { fontSize: 18, fontWeight: '800', color: '#16A34A' },
  ruleBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 },
  meta: { fontSize: 11, color: '#475569', flex: 1 },
  metaStrong: { fontSize: 11, fontWeight: '800', color: '#475569' },
  payout: { fontSize: 10, color: '#94A3B8' },

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
  lockNote: { flexDirection: 'row', gap: 8, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 10, alignItems: 'center' },
  lockNoteText: { flex: 1, fontSize: 12, color: '#475569' },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  help: { fontSize: 10, color: '#94A3B8', lineHeight: 14 },
  triggerFixed: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 10, gap: 3 },
  triggerFixedText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  triggerList: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' },
  triggerRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  triggerRowActive: { backgroundColor: '#F0FDFA' },
  triggerLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  twoCol: { flexDirection: 'row', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
