import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { CommunityCard } from '../../components/community/CommunityCard';
import { colors, typography, spacing, borderRadius } from '../../theme';

export const CommunityPlaceholderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { getJoinedCommunityObjects, toggleCommunityJoin, selectedHobby } = useApp();
  const joinedCommunities = getJoinedCommunityObjects();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + spacing.xs, spacing.md) }]}>
        <Text style={styles.headerTitle}>Communities</Text>
        <Text style={styles.headerSubtitle}>
          Connect, collaborate, and share with {selectedHobby} peers
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 80, 100) },
        ]}
      >
        <View style={styles.infoBanner}>
          <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Active Communities</Text>
            <Text style={styles.infoText}>
              Detailed group channels, live audio rooms, and study sessions will be expanded in the next step.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Your Subscribed Communities</Text>
        {joinedCommunities.map((c) => (
          <CommunityCard
            key={c.id}
            community={c}
            isJoined={true}
            onToggleJoin={toggleCommunityJoin}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs + 1,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.base,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPurpleLight,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  infoText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.xs + 2,
  },
  sectionHeading: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
});
