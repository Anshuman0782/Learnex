import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { CommunityEvent } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface CommunityEventModalProps {
  visible: boolean;
  event: CommunityEvent | null;
  onClose: () => void;
}

export const CommunityEventModal: React.FC<CommunityEventModalProps> = ({
  visible,
  event,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { user, selectedRole, joinCommunityEvent, completeCommunityEvent } = useApp();
  const [submitting, setSubmitting] = useState(false);

  if (!event) return null;

  const isRoleMatched =
    event.targetRole === 'Both' ||
    (selectedRole === 'Mentor' && event.targetRole === 'Mentor') ||
    (selectedRole !== 'Mentor' && event.targetRole === 'Learner');

  const handleJoin = () => {
    joinCommunityEvent(event.id);
    Alert.alert(
      'Challenge Joined',
      `You have entered "${event.title}". Complete the requirements before the cycle ends to earn +${event.xpReward} XP.`
    );
  };

  const handleCompleteSubmission = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      const res = completeCommunityEvent(event.id);
      if (res) {
        Alert.alert(
          'Challenge Completed',
          `You earned +${res.earnedXP} XP for "${res.eventTitle}".${
            res.bonusReward ? `\n\nBonus Perk: ${res.bonusReward}` : ''
          }\n\nYour rank on the seasonal leaderboard has been updated.`
        );
      }
    }, 600);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onClose}
            style={styles.backCircleBtn}
          >
            <Ionicons name="close" size={20} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.topBarTitleBlock}>
            <Text style={styles.topBarSub}>CIRCLE EVENT & CHALLENGE</Text>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {event.communityName}
            </Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 40, 60) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Banner */}
          <LinearGradient
            colors={event.bannerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroGradient, shadows.glow]}
          >
            <View style={styles.heroBadgeRow}>
              <View style={styles.categoryPill}>
                <Ionicons
                  name={event.icon as keyof typeof Ionicons.glyphMap}
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.categoryPillText}>
                  {event.category.toUpperCase()} • FOR {event.targetRole.toUpperCase()}S
                </Text>
              </View>

              <View style={styles.timerPill}>
                <Ionicons name="time-outline" size={12} color="#FDE047" />
                <Text style={styles.timerPillText}>{event.daysLeft}D LEFT</Text>
              </View>
            </View>

            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventSubtitle}>{event.subtitle}</Text>

            {/* Participants Bar */}
            <View style={styles.participantsRow}>
              <Ionicons name="people" size={15} color="#FFFFFF" />
              <Text style={styles.participantsText}>
                {event.participantsCount} Members Currently Competing
              </Text>
            </View>
          </LinearGradient>

          {/* XP & Rewards Highlight Card */}
          <View style={[styles.rewardPrizeCard, shadows.soft]}>
            <View style={styles.prizeHeader}>
              <View style={styles.prizeIconBox}>
                <Ionicons name="trophy" size={20} color="#D97706" />
              </View>
              <View style={styles.prizeTitleCol}>
                <Text style={styles.prizeCardTitle}>Event Reward Pool</Text>
                <Text style={styles.prizeCardSub}>Earned upon verified completion</Text>
              </View>
              <View style={styles.xpBigPill}>
                <Ionicons name="flash" size={14} color="#4F46E5" />
                <Text style={styles.xpBigText}>+{event.xpReward} XP</Text>
              </View>
            </View>

            {event.bonusReward && (
              <View style={styles.bonusBox}>
                <Ionicons name="sparkles" size={14} color="#CA8A04" />
                <Text style={styles.bonusText}>
                  <Text style={{ fontWeight: 'bold' }}>Bonus:</Text> {event.bonusReward}
                </Text>
              </View>
            )}
          </View>

          {/* About Event */}
          <View style={[styles.sectionCard, shadows.soft]}>
            <Text style={styles.sectionHeaderTitle}>About This Challenge</Text>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </View>

          {/* Step-by-Step Requirements */}
          <View style={[styles.sectionCard, shadows.soft]}>
            <Text style={styles.sectionHeaderTitle}>Rules & Submission Checklist</Text>
            <View style={styles.requirementsList}>
              {event.requirements.map((req, idx) => (
                <View key={idx} style={styles.reqItemRow}>
                  <View style={styles.stepNumCircle}>
                    <Text style={styles.stepNumText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.reqItemText}>{req}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Role Compatibility Alert */}
          {!isRoleMatched && (
            <View style={styles.roleMismatchBox}>
              <Ionicons name="information-circle" size={18} color="#D97706" />
              <Text style={styles.roleMismatchText}>
                Note: This event is specifically designed for{' '}
                <Text style={{ fontWeight: 'bold' }}>{event.targetRole}s</Text>. You are currently in{' '}
                <Text style={{ fontWeight: 'bold' }}>{selectedRole || 'Learner'}</Text> mode. You can
                still demo and submit!
              </Text>
            </View>
          )}

          {/* Interactive CTA Buttons */}
          <View style={styles.actionBlock}>
            {event.isCompleted ? (
              <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <View>
                  <Text style={styles.completedBannerTitle}>Challenge Completed!</Text>
                  <Text style={styles.completedBannerSub}>
                    +{event.xpReward} XP added to your seasonal balance
                  </Text>
                </View>
              </View>
            ) : event.isJoined ? (
              <TouchableOpacity
                activeOpacity={0.88}
                disabled={submitting}
                onPress={handleCompleteSubmission}
                style={[styles.primaryActionBtn, shadows.glow]}
              >
                <LinearGradient
                  colors={event.bannerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryActionGradient}
                >
                  <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>
                    {submitting
                      ? 'Validating Submission...'
                      : event.targetRole === 'Mentor'
                      ? `Complete Mentorship Task (+${event.xpReward} XP)`
                      : `Submit Practice Clip (+${event.xpReward} XP)`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleJoin}
                style={[styles.primaryActionBtn, shadows.glow]}
              >
                <LinearGradient
                  colors={['#4F46E5', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryActionGradient}
                >
                  <Ionicons name="flag" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>
                    Join Event (+{event.xpReward} XP Challenge)
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleBlock: {
    alignItems: 'center',
  },
  topBarSub: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  topBarTitle: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  scrollContent: {
    padding: spacing.base,
    gap: spacing.sm + 2,
  },
  heroGradient: {
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    position: 'relative',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  categoryPillText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  timerPillText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FDE047',
  },
  eventTitle: {
    fontSize: 19,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    lineHeight: 25,
    marginBottom: 4,
  },
  eventSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 17,
    marginBottom: 12,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
  },
  participantsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rewardPrizeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  prizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prizeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeTitleCol: {
    flex: 1,
    marginLeft: 10,
  },
  prizeCardTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  prizeCardSub: {
    fontSize: 11,
    color: '#64748B',
  },
  xpBigPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  xpBigText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  bonusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bonusText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  descriptionText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  requirementsList: {
    gap: 8,
    marginTop: 2,
  },
  reqItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  reqItemText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  roleMismatchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: borderRadius.lg,
    gap: 8,
  },
  roleMismatchText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  actionBlock: {
    marginTop: spacing.xs,
  },
  primaryActionBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    gap: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  completedBannerTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#15803D',
  },
  completedBannerSub: {
    fontSize: 11,
    color: '#166534',
  },
});
