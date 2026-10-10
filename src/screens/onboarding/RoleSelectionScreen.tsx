import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Header, Button } from '../../components/common';
import { RoleCard } from '../../components/role/RoleCard';
import { ROLE_OPTIONS } from '../../data/mockData';
import { RoleOption, UserRole } from '../../types';
import { colors, typography, spacing } from '../../theme';

const GUEST_OPTION: RoleOption = {
  id: 'Guest',
  title: 'Continue as Guest',
  subtitle: 'Explore • No XP • No ranking',
  description: 'Use the app like everyone else, without the XP and leaderboard game.',
  iconName: 'person-outline',
  iconBgColor: '#F1F5F9',
  iconColor: '#475569',
  perks: [
    'Post, comment, chat and join circles',
    'No XP, streaks, challenges or leaderboards',
    'Become a Learner or Mentor any time from your profile',
  ],
};

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
  // Guests upgrading only choose between Learner and Mentor.
  const options = isUpgrading ? ROLE_OPTIONS : [...ROLE_OPTIONS, GUEST_OPTION];

  const handleGuest = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleRoleSelect = (roleId: UserRole) => {
    setCurrentSelected(roleId);
  };

  const handleConfirm = async () => {
    if (currentSelected === 'Guest') {
      await handleGuest();
      return;
    }
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
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
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
          {options.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={currentSelected === role.id}
              onSelect={handleRoleSelect}
            />
          ))}
        </View>

      </ScrollView>

      {/* Pinned action — always visible, clear of the phone's navigation bar */}
      {currentSelected && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          {currentSelected === 'Mentor' && (
            <Text style={styles.footerHint}>
              5-question test · score 4/5 to qualify, otherwise you join as a Learner.
            </Text>
          )}
          <Button
            title={
              currentSelected === 'Mentor'
                ? 'Take Mentor Test (5 Qs) →'
                : currentSelected === 'Guest'
                ? 'Continue as Guest →'
                : 'Continue as Learner →'
            }
            onPress={handleConfirm}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  footerHint: { fontSize: 12, color: '#92400E', textAlign: 'center', marginBottom: 8, lineHeight: 17 },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
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
    marginBottom: spacing.lg,
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
});
