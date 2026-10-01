import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { DEFAULT_USER_STATS } from '../../data/mockData';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface PersonalStatsDashboardProps {
  onExploreMorePress?: () => void;
  onAnalyticsPress?: () => void;
}

export const PersonalStatsDashboard: React.FC<PersonalStatsDashboardProps> = ({
  onExploreMorePress,
  onAnalyticsPress,
}) => {
  const { user, selectedRole, userStats } = useApp();
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);

  // Real stats from the backend; fall back to a zeroed shape while loading.
  const stats = userStats ?? DEFAULT_USER_STATS;
  const targetPercent =
    stats.weeklyTargetSessions > 0
      ? Math.min(Math.round((stats.completedTargetSessions / stats.weeklyTargetSessions) * 100), 100)
      : 0;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.sectionTitle}>Growth & Stats</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>{selectedRole || 'Learner'}</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (onAnalyticsPress) {
              onAnalyticsPress();
            } else {
              setIsAnalyticsModalOpen(true);
            }
          }}
          style={styles.viewMoreHeaderBtn}
        >
          <Text style={styles.viewMoreHeaderText}>Analytics</Text>
          <Ionicons name="chevron-forward" size={13} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Target & Weekly Goal Card with Visual Glow */}
      <View style={[styles.targetCard, shadows.soft]}>
        <View style={styles.targetCardHeader}>
          <View style={styles.targetTitleRow}>
            <View style={styles.targetIconBox}>
              <Ionicons name="flag" size={14} color="#4F46E5" />
            </View>
            <Text style={styles.targetTitle}>Weekly Goal</Text>
          </View>
          <View style={styles.targetPercentBadge}>
            <Text style={styles.targetPercentText}>{targetPercent}%</Text>
          </View>
        </View>

        {/* Progress Bar for Sessions */}
        <View style={styles.progressBlock}>
          <View style={styles.progressBarTrack}>
            <LinearGradient
              colors={['#4F46E5', '#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { width: `${targetPercent}%` }]}
            />
          </View>
          <View style={styles.progressLabelRow}>
            <View style={styles.miniStatItem}>
              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
              <Text style={styles.progressLabel}>
                {stats.completedTargetSessions}/{stats.weeklyTargetSessions} Sessions
              </Text>
            </View>
            <View style={styles.miniStatItem}>
              <Ionicons name="time" size={12} color="#6366F1" />
              <Text style={styles.progressLabel}>{stats.completedTargetHours}h Logged</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3-Col Visual Stat Cards */}
      <View style={styles.metricsGrid}>
        {/* Metric 1 */}
        <View style={[styles.metricCard, shadows.soft]}>
          <View style={[styles.metricIconCircle, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="trending-up" size={16} color="#15803D" />
          </View>
          <Text style={styles.metricBigValue}>
            {stats.accuracyRate > 0 ? `${stats.accuracyRate}%` : '—'}
          </Text>
          <Text style={styles.metricTitle}>Accuracy</Text>
        </View>

        {/* Metric 2 */}
        <View style={[styles.metricCard, shadows.soft]}>
          <View style={[styles.metricIconCircle, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="speedometer" size={16} color="#1D4ED8" />
          </View>
          <Text style={styles.metricBigValue}>{stats.consistencyRate}%</Text>
          <Text style={styles.metricTitle}>Consistency</Text>
        </View>

        {/* Metric 3 */}
        <View style={[styles.metricCard, shadows.soft]}>
          <View style={[styles.metricIconCircle, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="chatbubbles" size={16} color="#7E22CE" />
          </View>
          <Text style={styles.metricBigValue}>{stats.critiquesCompleted}</Text>
          <Text style={styles.metricTitle}>Critiques</Text>
        </View>
      </View>

      {/* Badges Jewel Showcase */}
      <View style={[styles.achievementsCard, shadows.soft]}>
        <View style={styles.achievementsHeader}>
          <View style={styles.achievementsTitleRow}>
            <Ionicons name="trophy" size={15} color="#D97706" />
            <Text style={styles.achievementsTitle}>Earned Badges</Text>
          </View>
          <View style={styles.xpPill}>
            <Ionicons name="sparkles" size={11} color="#4F46E5" />
            <Text style={styles.xpText}>{stats.xpPoints} XP</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgesScroll}
        >
          {stats.badges.map((badge) => (
            <View key={badge.id} style={[styles.badgeChip, { backgroundColor: badge.bgColor }]}>
              <Ionicons
                name={badge.icon as keyof typeof Ionicons.glyphMap}
                size={13}
                color={badge.color}
              />
              <Text style={[styles.badgeChipText, { color: badge.color }]}>
                {badge.title}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Analytics Modal */}
      <Modal
        visible={isAnalyticsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAnalyticsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Performance Breakdown</Text>
              <TouchableOpacity
                onPress={() => setIsAnalyticsModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.previewStatsBox}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Weekly Sessions</Text>
                <Text style={styles.previewValue}>
                  {stats.completedTargetSessions} of {stats.weeklyTargetSessions}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total XP Points</Text>
                <Text style={styles.previewValue}>{stats.xpPoints} XP</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Technique Growth</Text>
                <Text style={[styles.previewValue, { color: '#166534' }]}>+18%</Text>
              </View>
              <View style={[styles.previewRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.previewLabel}>Consistency Rate</Text>
                <Text style={[styles.previewValue, { color: '#2563EB' }]}>{stats.consistencyRate}%</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsAnalyticsModalOpen(false)}
              style={styles.modalGotItBtn}
            >
              <Text style={styles.modalGotItText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  roleTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  viewMoreHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewMoreHeaderText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  targetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.sm,
  },
  targetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  targetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  targetPercentBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  targetPercentText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  progressBlock: {
    gap: 6,
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  miniStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 3,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  metricBigValue: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  metricTitle: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  achievementsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  achievementsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  achievementsTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  xpText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  badgesScroll: {
    gap: 7,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  badgeChipText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewStatsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  previewLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  previewValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalGotItBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  modalGotItText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
});
