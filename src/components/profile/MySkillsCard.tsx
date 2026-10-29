import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getMyMentorTestsRequest, type MentorApplication } from '../../api/ai.api';

interface Props {
  /** Run before leaving the profile (e.g. close the sheet this card sits in). */
  onBeforeNavigate?: () => void;
}

/**
 * The member's skills, each with its own role (Learner / Mentor) and XP, plus
 * "Add skill". Guests have no skills — this renders nothing for them (they see
 * the upgrade banner instead).
 */
export const MySkillsCard: React.FC<Props> = ({ onBeforeNavigate }) => {
  const navigation = useNavigation<any>();
  const { selectedRole, mySkills, refreshSkills, setPrimarySkill, showDialog } = useApp();

  // Latest mentor test per skill (to show "under review" / "retry after").
  const [tests, setTests] = useState<MentorApplication[]>([]);

  useEffect(() => {
    void refreshSkills();
    getMyMentorTestsRequest().then(setTests).catch(() => {});
  }, []);

  const latestTest = (skill: string) => tests.find((t) => t.skillLabel.trim().toLowerCase() === skill.trim().toLowerCase());

  if (selectedRole !== 'Learner' && selectedRole !== 'Mentor') return null;

  const go = (route: string, params?: object) => {
    onBeforeNavigate?.();
    navigation.navigate(route, params);
  };

  const makeMain = (skill: string) =>
    showDialog({
      title: skill,
      message: `Make ${skill} your main skill? Your profile will show ${skill} first, and daily check-ins and quests will count toward it.`,
      icon: 'star-outline',
      confirmText: 'Make main',
      cancelText: 'Cancel',
      onConfirm: () => {
        setPrimarySkill(skill).catch((err: any) =>
          showDialog({
            title: 'Could not switch',
            message: err?.message || 'Please try again.',
            icon: 'alert-circle-outline',
            confirmText: 'OK',
          }),
        );
      },
    });

  const becomeMentor = (skill: string) =>
    showDialog({
      title: `Mentor in ${skill}`,
      message: `Pass the mentor test to become a Mentor in ${skill}. Your other skills stay as they are.`,
      icon: 'ribbon-outline',
      confirmText: 'Take test',
      cancelText: 'Not now',
      onConfirm: () => go('MentorQuiz', { skill, addSkill: true }),
    });

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.title}>My skills</Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => go('AddSkill')} style={styles.addBtn}>
          <Ionicons name="add" size={15} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add skill</Text>
        </TouchableOpacity>
      </View>

      {mySkills.map((s) => {
        const mentor = s.role === 'Mentor';
        return (
          <TouchableOpacity
            key={s.skill}
            activeOpacity={0.8}
            disabled={s.isPrimary}
            onPress={() => makeMain(s.skill)}
            style={styles.row}
          >
            <View style={[styles.icon, mentor ? styles.iconMentor : styles.iconLearner]}>
              <Ionicons name={mentor ? 'ribbon' : 'school'} size={16} color={mentor ? '#7C3AED' : '#4F46E5'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameLine}>
                <Text style={styles.skillName} numberOfLines={1}>{s.skill}</Text>
                {s.isPrimary && (
                  <View style={styles.mainTag}>
                    <Ionicons name="star" size={9} color="#B45309" />
                    <Text style={styles.mainTagText}>Main</Text>
                  </View>
                )}
              </View>
              <Text style={styles.xpText}>
                {s.xp.toLocaleString()} XP · {s.seasonXp.toLocaleString()} this season
              </Text>
              {!mentor &&
                (() => {
                  const t = latestTest(s.skill);
                  const waiting = t && (t.status === 'SUBMITTED' || t.status === 'REVIEW');
                  const cooling = t?.status === 'FAILED' && t.retryAfter && new Date(t.retryAfter).getTime() > Date.now();
                  if (waiting || cooling) {
                    return (
                      <TouchableOpacity activeOpacity={0.7} onPress={() => go('MentorTest', { skill: s.skill, addSkill: true })} hitSlop={6}>
                        <Text style={[styles.mentorLink, { color: waiting ? '#D97706' : '#64748B' }]}>
                          {waiting
                            ? 'Mentor test is being reviewed'
                            : `Mentor test: retry after ${new Date(t!.retryAfter!).toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => becomeMentor(s.skill)} hitSlop={6}>
                      <Text style={styles.mentorLink}>Become a Mentor in {s.skill}</Text>
                    </TouchableOpacity>
                  );
                })()}
            </View>
            <View style={[styles.roleTag, mentor ? styles.roleMentor : styles.roleLearner]}>
              <Text style={[styles.roleText, mentor ? styles.roleTextMentor : styles.roleTextLearner]}>
                {s.role}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 14,
    marginTop: 12,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconLearner: { backgroundColor: '#EEF2FF' },
  iconMentor: { backgroundColor: '#F5F3FF' },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skillName: { fontSize: 14, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  mainTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mainTagText: { fontSize: 9, fontWeight: '800', color: '#B45309' },
  xpText: { fontSize: 11, color: '#64748B', marginTop: 2 },
  mentorLink: { fontSize: 11, fontWeight: '700', color: '#7C3AED', marginTop: 4 },
  roleTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleLearner: { backgroundColor: '#EEF2FF' },
  roleMentor: { backgroundColor: '#F5F3FF' },
  roleText: { fontSize: 11, fontWeight: '800' },
  roleTextLearner: { color: '#4338CA' },
  roleTextMentor: { color: '#7C3AED' },
});
