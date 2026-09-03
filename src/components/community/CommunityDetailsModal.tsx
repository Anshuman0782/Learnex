import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { Community, CommunityMember, CommunityEvent } from '../../types';
import { Avatar } from '../common/Avatar';
import { CommunityEventsSection } from './CommunityEventsSection';
import { CommunityEventModal } from './CommunityEventModal';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface CommunityDetailsModalProps {
  visible: boolean;
  community: Community | null;
  onClose: () => void;
  onRequestCritiqueFromMentor?: (mentor: CommunityMember) => void;
}

export const CommunityDetailsModal: React.FC<CommunityDetailsModalProps> = ({
  visible,
  community,
  onClose,
  onRequestCritiqueFromMentor,
}) => {
  const { openUserProfile, communityEvents, selectedRole } = useApp();
  const [activeTab, setActiveTab] = useState<'mentors' | 'members' | 'events' | 'about'>('mentors');
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null);

  if (!community) return null;

  const stats = community.stats || {
    totalMembers: community.memberCount || '15.8k',
    activeMentorsCount: 42,
    critiquesThisWeek: 318,
    responseRate: '98% (< 2h avg)',
    dailyActive: '1.4k online',
  };

  const mentors = community.mentors && community.mentors.length > 0 ? community.mentors : [
    {
      id: 'm-1',
      name: 'Alex Rivera',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      role: 'Mentor' as const,
      badge: 'Berklee Certified Coach',
      specialty: 'Head Voice & Pitch Correction',
      rating: 4.9,
      critiquesGiven: 245,
    },
    {
      id: 'm-2',
      name: 'Sarah Jenkins',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      role: 'Mentor' as const,
      badge: 'Opera & Vocal Health Lead',
      specialty: 'Breath Support & High Belting',
      rating: 4.8,
      critiquesGiven: 189,
    },
    {
      id: 'm-3',
      name: 'David Thorne',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      role: 'Mentor' as const,
      badge: 'Touring Artist Mentor',
      specialty: 'Agility, Runs & Vibrato',
      rating: 4.9,
      critiquesGiven: 112,
    },
  ];

  const members = community.members && community.members.length > 0 ? community.members : [
    {
      id: 'mem-1',
      name: 'Anshuman Sarkar',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      role: 'Learner' as const,
      badge: 'Rising Vocalist',
      streakDays: 6,
      xpPoints: 1240,
    },
    {
      id: 'mem-2',
      name: 'Elena Rostova',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      role: 'Learner' as const,
      badge: 'Level 3 Vocalist',
      streakDays: 14,
      xpPoints: 2150,
    },
    {
      id: 'mem-3',
      name: 'Maya Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
      role: 'Learner' as const,
      badge: 'Acoustic Explorer',
      streakDays: 9,
      xpPoints: 1480,
    },
    {
      id: 'mem-4',
      name: 'Lucas Rossi',
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
      role: 'Learner' as const,
      badge: 'Tenor Student',
      streakDays: 3,
      xpPoints: 650,
    },
  ];

  const handleMentorAction = (mentor: CommunityMember) => {
    if (onRequestCritiqueFromMentor) {
      onRequestCritiqueFromMentor(mentor);
    } else {
      Alert.alert(
        'Request Critique 🎯',
        `Direct critique ticket sent to ${mentor.name} (${mentor.specialty}). Upload a clip or tag your latest post to get reviewed.`
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalSheet}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.communityIdentity}>
              <View style={[styles.commIconCircle, { backgroundColor: community.iconBgColor }]}>
                <Ionicons
                  name={community.iconName as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={community.iconColor}
                />
              </View>
              <View style={styles.commTitleCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.commName} numberOfLines={1}>
                    {community.name}
                  </Text>
                  {community.isHot && (
                    <View style={styles.hotBadge}>
                      <Ionicons name="flame" size={10} color="#EA580C" />
                      <Text style={styles.hotBadgeText}>Active Hub</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.categorySub}>{community.category} • {stats.totalMembers} Members</Text>
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* 3-Col Basic Stats Cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, shadows.soft]}>
              <Ionicons name="people" size={16} color="#4F46E5" />
              <Text style={styles.statBig}>{stats.totalMembers}</Text>
              <Text style={styles.statLabel}>{stats.dailyActive}</Text>
            </View>

            <View style={[styles.statBox, shadows.soft]}>
              <Ionicons name="star" size={16} color="#7C3AED" />
              <Text style={styles.statBig}>{stats.activeMentorsCount}</Text>
              <Text style={styles.statLabel}>Verified Mentors</Text>
            </View>

            <View style={[styles.statBox, shadows.soft]}>
              <Ionicons name="flash" size={16} color="#15803D" />
              <Text style={[styles.statBig, { color: '#15803D' }]}>{stats.responseRate.split(' ')[0]}</Text>
              <Text style={styles.statLabel}>Fast Response</Text>
            </View>
          </View>

          {/* Segmented Tab Navigation */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('mentors')}
              style={[styles.tabBtn, activeTab === 'mentors' && styles.tabBtnActive]}
            >
              <Ionicons
                name="star"
                size={14}
                color={activeTab === 'mentors' ? '#4F46E5' : '#64748B'}
              />
              <Text style={[styles.tabBtnText, activeTab === 'mentors' && styles.tabBtnTextActive]}>
                Mentors ({mentors.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('members')}
              style={[styles.tabBtn, activeTab === 'members' && styles.tabBtnActive]}
            >
              <Ionicons
                name="people"
                size={14}
                color={activeTab === 'members' ? '#4F46E5' : '#64748B'}
              />
              <Text style={[styles.tabBtnText, activeTab === 'members' && styles.tabBtnTextActive]}>
                Members ({members.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('events')}
              style={[styles.tabBtn, activeTab === 'events' && styles.tabBtnActive]}
            >
              <Ionicons
                name={activeTab === 'events' ? 'flash' : 'flash-outline'}
                size={14}
                color={activeTab === 'events' ? '#4F46E5' : '#64748B'}
              />
              <Text style={[styles.tabBtnText, activeTab === 'events' && styles.tabBtnTextActive]}>
                Events
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('about')}
              style={[styles.tabBtn, activeTab === 'about' && styles.tabBtnActive]}
            >
              <Ionicons
                name="information-circle"
                size={14}
                color={activeTab === 'about' ? '#4F46E5' : '#64748B'}
              />
              <Text style={[styles.tabBtnText, activeTab === 'about' && styles.tabBtnTextActive]}>
                Guidelines
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            contentContainerStyle={styles.tabContentScroll}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'mentors' && (
              <View style={styles.mentorsList}>
                {mentors.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    activeOpacity={0.85}
                    onPress={() => openUserProfile(m)}
                    style={[styles.mentorCard, shadows.soft]}
                  >
                    <Avatar uri={m.avatarUrl} name={m.name} size={42} showRing />
                    <View style={styles.mentorInfo}>
                      <View style={styles.mentorNameRow}>
                        <Text style={styles.mentorName}>{m.name}</Text>
                        <View style={styles.mentorVerifiedBadge}>
                          <Ionicons name="checkmark-circle" size={13} color="#7C3AED" />
                          <Text style={styles.mentorVerifiedText}>Verified</Text>
                        </View>
                      </View>
                      <Text style={styles.mentorBadgeTitle}>{m.badge}</Text>
                      <Text style={styles.mentorSpecialty} numberOfLines={1}>
                        Focus: {m.specialty}
                      </Text>

                      <View style={styles.mentorMetaRow}>
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={11} color="#D97706" />
                          <Text style={styles.ratingText}>{m.rating} Rating</Text>
                        </View>
                        <Text style={styles.critiqueGivenText}>• {m.critiquesGiven} Critiques</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleMentorAction(m);
                      }}
                      style={styles.requestCritiqueBtn}
                    >
                      <Text style={styles.requestCritiqueBtnText}>Critique</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeTab === 'members' && (
              <View style={styles.membersList}>
                {members.map((mem) => (
                  <TouchableOpacity
                    key={mem.id}
                    activeOpacity={0.85}
                    onPress={() => openUserProfile(mem)}
                    style={styles.memberCard}
                  >
                    <Avatar uri={mem.avatarUrl} name={mem.name} size={38} showRing={false} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{mem.name}</Text>
                      <Text style={styles.memberBadge}>{mem.badge}</Text>
                    </View>

                    <View style={styles.memberStatsRight}>
                      <View style={styles.streakPill}>
                        <Ionicons name="flame" size={11} color="#EA580C" />
                        <Text style={styles.streakText}>{mem.streakDays}d</Text>
                      </View>
                      <Text style={styles.xpScore}>{mem.xpPoints} XP</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeTab === 'events' && (
              <View style={{ paddingTop: spacing.xs }}>
                <CommunityEventsSection
                  events={communityEvents}
                  communityId={community.id}
                  selectedRole={selectedRole}
                  onSelectEvent={(evt) => setSelectedEvent(evt)}
                />
              </View>
            )}

            {activeTab === 'about' && (
              <View style={styles.aboutContainer}>
                <View style={styles.guidelineCard}>
                  <Text style={styles.guidelineTitle}>About Circle</Text>
                  <Text style={styles.guidelineDesc}>{community.description}</Text>
                </View>

                <View style={styles.guidelineCard}>
                  <Text style={styles.guidelineTitle}>Practice & Critique Rules</Text>
                  <View style={styles.ruleItem}>
                    <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                    <Text style={styles.ruleText}>Keep videos under 3 minutes focused on one technique.</Text>
                  </View>
                  <View style={styles.ruleItem}>
                    <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                    <Text style={styles.ruleText}>State your specific difficulty in the post title.</Text>
                  </View>
                  <View style={styles.ruleItem}>
                    <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                    <Text style={styles.ruleText}>Mentors provide timestamped video/audio corrections.</Text>
                  </View>
                  <View style={styles.ruleItem}>
                    <Ionicons name="checkmark-circle" size={15} color="#15803D" />
                    <Text style={styles.ruleText}>Constructive, supportive feedback only.</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Circle Event Detail & Participation Modal */}
      <CommunityEventModal
        visible={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '85%',
    paddingTop: spacing.xs + 2,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  communityIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: spacing.sm,
  },
  commIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  commTitleCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commName: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  hotBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#EA580C',
  },
  categorySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  statBig: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  tabContentScroll: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  mentorsList: {
    gap: 10,
  },
  mentorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  mentorInfo: {
    flex: 1,
  },
  mentorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mentorName: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  mentorVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  mentorVerifiedText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  mentorBadgeTitle: {
    fontSize: 10,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 1,
  },
  mentorSpecialty: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  mentorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  ratingText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#D97706',
  },
  critiqueGivenText: {
    fontSize: 9,
    color: '#94A3B8',
  },
  requestCritiqueBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  requestCritiqueBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  membersList: {
    gap: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  memberBadge: {
    fontSize: 10,
    color: '#64748B',
  },
  memberStatsRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    gap: 2,
  },
  streakText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#EA580C',
  },
  xpScore: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
  },
  aboutContainer: {
    gap: spacing.sm,
  },
  guidelineCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  guidelineTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  guidelineDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  ruleText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
});
