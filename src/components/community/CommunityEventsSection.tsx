import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CommunityEvent, UserRole } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface CommunityEventsSectionProps {
  events: CommunityEvent[];
  communityId?: string;
  selectedRole?: UserRole | null;
  onSelectEvent: (event: CommunityEvent) => void;
}

export const CommunityEventsSection: React.FC<CommunityEventsSectionProps> = ({
  events,
  communityId,
  selectedRole,
  onSelectEvent,
}) => {
  const [roleFilter, setRoleFilter] = useState<'Learner' | 'Mentor'>(
    selectedRole === 'Mentor' ? 'Mentor' : 'Learner'
  );

  const filteredEvents = events.filter((e) => {
    const matchesCommunity = !communityId || e.communityId === communityId;
    const matchesRole = e.targetRole === roleFilter || e.targetRole === 'Both';
    return matchesCommunity && matchesRole;
  });

  return (
    <View style={styles.container}>
      {/* Role Switcher Segment */}
      <View style={styles.segmentWrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setRoleFilter('Learner')}
          style={[
            styles.segmentBtn,
            roleFilter === 'Learner' && styles.segmentBtnActive,
          ]}
        >
          <Ionicons
            name="school-outline"
            size={14}
            color={roleFilter === 'Learner' ? '#FFFFFF' : '#64748B'}
          />
          <Text
            style={[
              styles.segmentBtnText,
              roleFilter === 'Learner' && styles.segmentBtnTextActive,
            ]}
          >
            Learner Challenges
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setRoleFilter('Mentor')}
          style={[
            styles.segmentBtn,
            roleFilter === 'Mentor' && styles.segmentBtnActive,
          ]}
        >
          <Ionicons
            name="ribbon-outline"
            size={14}
            color={roleFilter === 'Mentor' ? '#FFFFFF' : '#64748B'}
          />
          <Text
            style={[
              styles.segmentBtnText,
              roleFilter === 'Mentor' && styles.segmentBtnTextActive,
            ]}
          >
            Mentor Tasks
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionSubtitle}>
        {roleFilter === 'Mentor'
          ? 'Speed critiques and masterclass workshops to rack up Mentorship XP.'
          : 'Practice drills and stage challenges to sharpen technique and earn XP.'}
      </Text>

      {/* Events Vertical Cards List */}
      <View style={styles.eventsList}>
        {filteredEvents.map((event) => (
          <TouchableOpacity
            key={event.id}
            activeOpacity={0.9}
            onPress={() => onSelectEvent(event)}
            style={[styles.eventCard, shadows.soft]}
          >
            {/* Card Header Gradient */}
            <LinearGradient
              colors={event.bannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardHeaderGradient}
            >
              <View style={styles.headerLeftRow}>
                <View style={styles.categoryPill}>
                  <Ionicons
                    name={event.icon as keyof typeof Ionicons.glyphMap}
                    size={12}
                    color="#FFFFFF"
                  />
                  <Text style={styles.categoryText}>
                    {event.category.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.daysBadge}>
                  <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                  <Text style={styles.daysText}>{event.daysLeft}d left</Text>
                </View>
              </View>

              <View style={styles.xpBadge}>
                <Ionicons name="flash" size={12} color="#FDE047" />
                <Text style={styles.xpBadgeText}>+{event.xpReward} XP</Text>
              </View>
            </LinearGradient>

            {/* Card Body */}
            <View style={styles.cardBody}>
              <Text style={styles.eventCardTitle}>{event.title}</Text>
              <Text style={styles.eventCardSub}>{event.subtitle}</Text>

              {event.bonusReward && (
                <View style={styles.bonusBox}>
                  <Ionicons name="gift-outline" size={13} color="#D97706" />
                  <Text style={styles.bonusText} numberOfLines={1}>
                    Bonus: {event.bonusReward}
                  </Text>
                </View>
              )}

              {/* Bottom Info and Action Row */}
              <View style={styles.cardFooter}>
                <View style={styles.participantsRow}>
                  <Ionicons name="people-outline" size={13} color="#64748B" />
                  <Text style={styles.participantsText}>
                    {event.participantsCount} competing
                  </Text>
                </View>

                <View
                  style={[
                    styles.actionPill,
                    event.isCompleted && styles.actionPillCompleted,
                    event.isJoined && !event.isCompleted && styles.actionPillJoined,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionPillText,
                      event.isCompleted && styles.actionPillTextCompleted,
                      event.isJoined && !event.isCompleted && styles.actionPillTextJoined,
                    ]}
                  >
                    {event.isCompleted
                      ? 'Completed'
                      : event.isJoined
                      ? 'Submit Take'
                      : 'Join Challenge'}
                  </Text>
                  <Ionicons
                    name={
                      event.isCompleted
                        ? 'checkmark-circle'
                        : event.isJoined
                        ? 'cloud-upload-outline'
                        : 'chevron-forward'
                    }
                    size={12}
                    color={
                      event.isCompleted
                        ? '#15803D'
                        : event.isJoined
                        ? '#4338CA'
                        : '#4F46E5'
                    }
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filteredEvents.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyText}>No events currently active for this role</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.base,
  },
  segmentWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.lg,
    padding: 3,
    gap: 4,
    marginBottom: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 15,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  daysText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.35)',
  },
  xpBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FDE047',
  },
  cardBody: {
    padding: spacing.md,
    gap: 6,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  eventCardSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  bonusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    marginTop: 2,
  },
  bonusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  participantsText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  actionPillJoined: {
    backgroundColor: '#E0E7FF',
  },
  actionPillCompleted: {
    backgroundColor: '#DCFCE7',
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  actionPillTextJoined: {
    color: '#4338CA',
  },
  actionPillTextCompleted: {
    color: '#15803D',
  },
  emptyBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
