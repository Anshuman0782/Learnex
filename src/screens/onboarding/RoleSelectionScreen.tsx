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
import { UserRole } from '../../types';
import { colors, typography, spacing } from '../../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'RoleSelection'>;

export const RoleSelectionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { enrollAsLearner, selectedRole, showDialog } = useApp();

  const [currentSelected, setCurrentSelected] = useState<UserRole | null>(
    selectedRole || 'Learner'
  );
  const [loading, setLoading] = useState(false);

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
          <Text style={styles.title}>Choose your role</Text>
          <Text style={styles.subtitle}>
            This personalizes your feed, recommendations, and mentor tools.
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
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
