import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Header, Button } from '../../components/common';
import { RoleCard } from '../../components/role/RoleCard';
import { ROLE_OPTIONS } from '../../data/mockData';
import { UserRole } from '../../types';
import { colors, typography, spacing } from '../../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'RoleSelection'>;

export const RoleSelectionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { enrollAsLearner, continueAsGuest, selectedRole, showDialog } = useApp();
  // A Guest opening this page again is upgrading to Learner / Mentor.
  const isUpgrading = selectedRole === 'Guest';

  const [currentSelected, setCurrentSelected] = useState<UserRole | null>(
    selectedRole && selectedRole !== 'Guest' ? selectedRole : 'Learner'
  );
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const handleGuest = async () => {
    setGuestLoading(true);
    try {
      await continueAsGuest();
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });
    } catch (err: any) {
      showDialog({
        title: 'Something went wrong',
        message: err?.message || 'We couldn’t continue as guest right now. Please try again.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
    } finally {
      setGuestLoading(false);
    }
  };

  const handleRoleSelect = (roleId: UserRole) => {
    setCurrentSelected(roleId);
  };

  const handleConfirm = async () => {
    if (currentSelected === 'Mentor') {
      navigation.navigate('MentorQuiz');
      return;
    }
    if (currentSelected === 'Learner') {
      setLoading(true);
      try {
        await enrollAsLearner();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'HomeTab' } }],
        });
      } catch (err: any) {
        showDialog({
          title: 'Something went wrong',
          message:
            err?.message ||
            'We couldn’t set up your account right now. Please check your connection and try again.',
          icon: 'alert-circle-outline',
          confirmText: 'Try Again',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} title="" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 32) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Step Badge */}
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Step 2 of 2 • Persona</Text>
        </View>

        <View style={styles.headerSection}>
          <Text style={styles.title}>{isUpgrading ? 'Upgrade your account' : 'Choose your role'}</Text>
          <Text style={styles.subtitle}>
            {isUpgrading
              ? 'Become a Learner or Mentor to earn XP, join challenges and appear on the leaderboards.'
              : 'This personalizes your feed, recommendations, and mentor tools.'}
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {ROLE_OPTIONS.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={currentSelected === role.id}
              onSelect={handleRoleSelect}
            />
          ))}
        </View>

        {currentSelected === 'Mentor' && (
          <View style={styles.mentorNoticeBox}>
            <Text style={styles.mentorNoticeText}>
              📝 <Text style={{ fontWeight: 'bold' }}>Mentor Assessment:</Text> You will take a 5-question test. Score at least 4/5 to qualify as a Mentor; otherwise, you'll join as a Learner.
            </Text>
          </View>
        )}

        {currentSelected && (
          <View style={styles.buttonWrapper}>
            <Button
              title={
                currentSelected === 'Mentor'
                  ? 'Take Mentor Test (5 Qs) →'
                  : 'Continue as Learner →'
              }
              onPress={handleConfirm}
              loading={loading && currentSelected === 'Learner'}
              fullWidth
              size="lg"
            />
          </View>
        )}

        {/* Guest: explore without the XP / ranking game */}
        {!isUpgrading && (
          <>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={guestLoading || loading}
              onPress={handleGuest}
              style={styles.guestCard}
            >
              <View style={styles.guestIcon}>
                {guestLoading ? (
                  <ActivityIndicator color="#475569" />
                ) : (
                  <Ionicons name="person-outline" size={22} color="#475569" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guestTitle}>Continue as Guest</Text>
                <Text style={styles.guestText}>
                  Post, comment, chat and join circles like everyone else. Guests don’t earn XP and aren’t on
                  the leaderboards. You can become a Learner or Mentor any time from your profile.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  orText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    padding: 14,
  },
  guestIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  guestTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  guestText: { fontSize: 12, color: '#64748B', lineHeight: 17, marginTop: 2 },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    flexGrow: 1,
  },
  stepBadge: {
    alignSelf: 'center',
    backgroundColor: colors.accentPurpleLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: spacing.sm,
  },
  stepText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.sm + 1,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  cardsContainer: {
    marginBottom: spacing.base,
  },
  mentorNoticeBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  mentorNoticeText: {
    fontSize: typography.sizes.xs + 1,
    color: '#92400E',
    lineHeight: 18,
  },
  buttonWrapper: {
    marginTop: spacing.xs,
  },
});
