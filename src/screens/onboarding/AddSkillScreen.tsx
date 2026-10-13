import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Header, Button } from '../../components/common';
import { RoleCard } from '../../components/role/RoleCard';
import { ROLE_OPTIONS, POPULAR_HOBBIES } from '../../data/mockData';
import { getLeaderboardCategoriesRequest } from '../../api/competition.api';
import { UserRole } from '../../types';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'AddSkill'>;

/**
 * Add another skill to the account. The member picks the skill, then chooses
 * their role IN THAT SKILL: Learner joins straight away, Mentor takes the
 * 5-question test for that skill. Roles in their other skills are untouched.
 */
export const AddSkillScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { mySkills, addLearnerSkill, showDialog } = useApp();

  const [skill, setSkill] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom] = useState('');
  const [role, setRole] = useState<UserRole>('Learner');
  const [liveCategories, setLiveCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Skills members already use, so people land in the same skill names.
  useEffect(() => {
    getLeaderboardCategoriesRequest()
      .then((cats: any) =>
        setLiveCategories((Array.isArray(cats) ? cats : []).filter((c: any) => typeof c === 'string')),
      )
      .catch(() => {});
  }, []);

  const owned = useMemo(() => new Set(mySkills.map((s) => s.skill.trim().toLowerCase())), [mySkills]);
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    [...liveCategories, ...POPULAR_HOBBIES, 'Dance', 'Art', 'Cooking', 'Languages'].forEach((h) => {
      const k = h.trim().toLowerCase();
      if (!k || seen.has(k) || owned.has(k)) return;
      seen.add(k);
      out.push(h.trim());
    });
    return out.slice(0, 16);
  }, [liveCategories, owned]);

  const chosen = (customMode ? custom : skill).trim().replace(/\s+/g, ' ');
  const alreadyMine = owned.has(chosen.toLowerCase());
  const valid = chosen.length >= 2 && !alreadyMine;

  const handleContinue = async () => {
    if (!valid) return;
    if (role === 'Mentor') {
      navigation.navigate('MentorQuiz', { skill: chosen, addSkill: true });
      return;
    }
    setSaving(true);
    try {
      await addLearnerSkill(chosen);
      navigation.goBack();
      showDialog({
        title: 'Skill added',
        message: `You’ve joined ${chosen} as a Learner. XP you earn on ${chosen} posts now counts toward your ${chosen} ranking.`,
        icon: 'checkmark-circle-outline',
        confirmText: 'Great',
      });
    } catch (err: any) {
      showDialog({
        title: 'Couldn’t add skill',
        message: err?.message || 'Please check your connection and try again.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} title="Add a skill" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepLabel}>1 · Choose the skill</Text>
        <View style={styles.chipsWrap}>
          {suggestions.map((s) => {
            const active = !customMode && skill.toLowerCase() === s.toLowerCase();
            return (
              <TouchableOpacity
                key={s}
                activeOpacity={0.8}
                onPress={() => {
                  setCustomMode(false);
                  setSkill(s);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setCustomMode(true)}
            style={[styles.chip, customMode && styles.chipActive]}
          >
            <Ionicons name="add" size={14} color={customMode ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.chipText, customMode && styles.chipTextActive]}>Other</Text>
          </TouchableOpacity>
        </View>
        {customMode && (
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder="Type the skill name"
            placeholderTextColor="#94A3B8"
            maxLength={40}
            autoFocus
            style={styles.input}
          />
        )}
        {alreadyMine && <Text style={styles.warn}>You’ve already added {chosen}.</Text>}

        <Text style={[styles.stepLabel, { marginTop: spacing.lg }]}>
          2 · Your role{chosen.length >= 2 ? ` in ${chosen}` : ''}
        </Text>
        <Text style={styles.hint}>
          This only applies to this skill — your role in your other skills stays the same.
        </Text>
        {ROLE_OPTIONS.map((r) => (
          <RoleCard key={r.id} role={r} isSelected={role === r.id} onSelect={setRole} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        {role === 'Mentor' && (
          <Text style={styles.footerHint}>
            5-question test · score 4/5 to become a Mentor in this skill.
          </Text>
        )}
        <Button
          title={
            role === 'Mentor'
              ? 'Take Mentor Test (5 Qs) →'
              : chosen.length >= 2
              ? `Add ${chosen} as Learner →`
              : 'Add as Learner →'
          }
          onPress={handleContinue}
          loading={saving}
          disabled={!valid}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  stepLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  hint: { fontSize: 12, color: '#64748B', lineHeight: 17, marginTop: -4, marginBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  input: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.sizes.sm + 1,
    color: '#0F172A',
  },
  warn: { fontSize: 12, color: '#B45309', marginTop: 8 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  footerHint: { fontSize: 12, color: '#92400E', textAlign: 'center', marginBottom: 8, lineHeight: 17 },
});
