import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Button, Header } from '../../components/common';
import { CommunityCard } from '../../components/community/CommunityCard';
import { colors, typography, spacing, borderRadius } from '../../theme';

type NavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'CommunityRecommendation'
>;

export const CommunityRecommendationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const {
    selectedHobby,
    joinedCommunities,
    toggleCommunityJoin,
    getRecommendedCommunities,
  } = useApp();

  const recommendedList = getRecommendedCommunities();
  const hasJoinedAny = joinedCommunities.length > 0;
  // No real circles in this category yet → don't block onboarding.
  const noneAvailable = recommendedList.length === 0;
  const canContinue = hasJoinedAny || noneAvailable;

  const handleContinue = () => {
    if (!canContinue) {
      Alert.alert(
        'Join a Community',
        'Please join at least one community to personalize your feed and connect with peers.'
      );
      return;
    }
    navigation.navigate('RoleSelection');
  };

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} title="" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 100, 120) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Step 1 of 2 • Communities</Text>
        </View>

        <View style={styles.headerSection}>
          <Text style={styles.title}>Recommended for You</Text>
          <Text style={styles.subtitle}>
            Based on your interest in{' '}
            <Text style={styles.hobbyHighlight}>"{selectedHobby}"</Text>, join at least one
            community to get started.
          </Text>
        </View>

        {!noneAvailable && (
        <View
          style={[
            styles.statusBanner,
            hasJoinedAny ? styles.statusBannerSuccess : styles.statusBannerPending,
          ]}
        >
          <Ionicons
            name={hasJoinedAny ? 'checkmark-circle' : 'information-circle'}
            size={18}
            color={hasJoinedAny ? colors.success : colors.primary}
          />
          <Text
            style={[
              styles.statusBannerText,
              hasJoinedAny && styles.statusBannerTextSuccess,
            ]}
          >
            {hasJoinedAny
              ? `${joinedCommunities.length} ${
                  joinedCommunities.length === 1 ? 'community' : 'communities'
                } joined. Ready to continue!`
              : 'Please join at least 1 community'}
          </Text>
        </View>
        )}

        {noneAvailable && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-circle-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No {selectedHobby} circles yet</Text>
            <Text style={styles.emptyText}>
              You’re early! Continue setting up — you can start the first {selectedHobby} circle
              from the Circles tab, and others who share your interest will find it.
            </Text>
          </View>
        )}

        <View style={styles.list}>
          {recommendedList.map((comm) => (
            <CommunityCard
              key={comm.id}
              community={comm}
              isJoined={joinedCommunities.includes(comm.id)}
              onToggleJoin={toggleCommunityJoin}
            />
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom + 8, 16) },
        ]}
      >
        <Button
          title={
            hasJoinedAny
              ? `Continue (${joinedCommunities.length} Joined) →`
              : noneAvailable
              ? 'Continue →'
              : 'Join at least 1 Community'
          }
          onPress={handleContinue}
          disabled={!canContinue}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19 },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
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
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  hobbyHighlight: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  statusBannerPending: {
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  statusBannerSuccess: {
    backgroundColor: colors.accentGreenLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBannerText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  statusBannerTextSuccess: {
    color: colors.success,
  },
  list: {
    marginBottom: spacing.base,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});
