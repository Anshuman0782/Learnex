import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { PostCard } from '../../components/home/PostCard';
import { CritiqueModal } from '../../components/community/CritiqueModal';
import { CreatePostModal } from '../../components/community/CreatePostModal';
import { CommunityDetailsModal } from '../../components/community/CommunityDetailsModal';
import { CommunityEventsSection } from '../../components/community/CommunityEventsSection';
import { CommunityEventModal } from '../../components/community/CommunityEventModal';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { Community, CommunityPost, CommunityEvent } from '../../types';

export const CommunityScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    user,
    selectedRole,
    setRole,
    joinedCommunities,
    posts,
    communityEvents,
    toggleLikePost,
    toggleCommunityJoin,
    getJoinedCommunityObjects,
    getRecommendedCommunities,
  } = useApp();

  const joinedCommunityObjects = getJoinedCommunityObjects();
  const recommendedCommunities = getRecommendedCommunities();

  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const [activeCritiquePost, setActiveCritiquePost] = useState<CommunityPost | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [roomTab, setRoomTab] = useState<'feed' | 'events'>('feed');
  const [feedFilter, setFeedFilter] = useState<'all' | 'video' | 'text' | 'reviewed'>('all');
  const [communityCategoryFilter, setCommunityCategoryFilter] = useState('All');

  // Return to root community hub whenever Community tab icon is clicked
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setActiveCommunity(null);
      setRoomTab('feed');
      setActiveCritiquePost(null);
      setSelectedEvent(null);
      setIsCreateModalOpen(false);
      setIsDetailsModalOpen(false);
    });
    return unsubscribe;
  }, [navigation]);

  const isMentor = selectedRole === 'Mentor';

  // Events for current active community
  const circleEvents = activeCommunity
    ? communityEvents.filter((e) => e.communityId === activeCommunity.id)
    : [];

  // Filter posts for the selected community room (both public & circle-private posts)
  const communityPosts = activeCommunity
    ? posts.filter((p) => {
        const matchesCommunity =
          p.communityId === activeCommunity.id ||
          (p.communityIds && p.communityIds.includes(activeCommunity.id));
        if (!matchesCommunity) return false;
        if (feedFilter === 'video') return p.postType === 'video' || !!p.videoThumbnail;
        if (feedFilter === 'text') return p.postType === 'text' && !p.videoThumbnail;
        if (feedFilter === 'reviewed') return (p.mentorCritiqueCount || 0) > 0;
        return true;
      })
    : [];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      {activeCommunity ? (
        /* Inside Community Room Top Header */
        <View
          style={[
            styles.roomHeader,
            { paddingTop: Math.max(insets.top + spacing.xs, spacing.md) },
          ]}
        >
          <View style={styles.roomHeaderRow}>
            {/* Back Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setActiveCommunity(null);
                setRoomTab('feed');
              }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
            </TouchableOpacity>

            {/* Clickable Community Name & Subtitle -> Opens Mentors, Members & Basic Stats */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setIsDetailsModalOpen(true)}
              style={styles.roomTitleButton}
            >
              <View style={styles.roomTitleRow}>
                <Text style={styles.roomHeaderTitle} numberOfLines={1}>
                  {activeCommunity.name}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#4F46E5" />
              </View>
              <View style={styles.roomSubRow}>
                <Text style={styles.roomHeaderSub}>
                  {activeCommunity.memberCount} members
                </Text>
                <Text style={styles.tapInfoNotice}>• Mentors & Stats ℹ️</Text>
              </View>
            </TouchableOpacity>

            {/* User Static Role Badge */}
            <View style={[styles.miniRoleChip, isMentor && styles.miniRoleChipMentor]}>
              <Text style={[styles.miniRoleText, isMentor && styles.miniRoleTextMentor]}>
                {isMentor ? 'Mentor' : 'Learner'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* Top Header for Communities List */
        <View
          style={[
            styles.mainHeader,
            { paddingTop: Math.max(insets.top + spacing.xs, spacing.md) },
          ]}
        >
          <View style={styles.mainHeaderRow}>
            <View>
              <Text style={styles.mainTitle}>Community Circles</Text>
              <Text style={styles.mainSub}>Your joined groups & practice rooms</Text>
            </View>

            {/* User Static Role Badge */}
            <View style={[styles.roleChip, isMentor && styles.roleChipMentor]}>
              <Text style={[styles.roleChipText, isMentor && styles.roleChipTextMentor]}>
                {isMentor ? '✨ Mentor' : '🎓 Learner'}
              </Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 95, 120) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeCommunity ? (
          /* ================= INSIDE A SPECIFIC COMMUNITY ROOM ================= */
          <View style={styles.roomContainer}>
            {/* Top Room Navigation: Circle Feed vs Events */}
            <View style={styles.roomSegmentRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setRoomTab('feed')}
                style={[styles.roomSegmentBtn, roomTab === 'feed' && styles.roomSegmentBtnActive]}
              >
                <Ionicons
                  name="newspaper-outline"
                  size={14}
                  color={roomTab === 'feed' ? '#4F46E5' : '#64748B'}
                />
                <Text style={[styles.roomSegmentText, roomTab === 'feed' && styles.roomSegmentTextActive]}>
                  Circle Feed
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setRoomTab('events')}
                style={[styles.roomSegmentBtn, roomTab === 'events' && styles.roomSegmentBtnActive]}
              >
                <Ionicons
                  name="flash-outline"
                  size={14}
                  color={roomTab === 'events' ? '#4F46E5' : '#64748B'}
                />
                <Text style={[styles.roomSegmentText, roomTab === 'events' && styles.roomSegmentTextActive]}>
                  Events & Challenges
                </Text>
                {circleEvents.length > 0 && (
                  <View style={styles.roomEventBadge}>
                    <Text style={styles.roomEventBadgeText}>{circleEvents.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {roomTab === 'events' ? (
              /* Events View */
              <CommunityEventsSection
                events={communityEvents}
                communityId={activeCommunity.id}
                selectedRole={selectedRole}
                onSelectEvent={(evt) => setSelectedEvent(evt)}
              />
            ) : (
              /* Feed View */
              <>
                {/* Active Circle Challenge Slim Callout */}
                {circleEvents.length > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setRoomTab('events')}
                    style={[styles.slimChallengeBanner, shadows.soft]}
                  >
                    <View style={styles.slimChallengeLeft}>
                      <Ionicons name="flash" size={14} color="#D97706" />
                      <Text style={styles.slimChallengeTitle} numberOfLines={1}>
                        {circleEvents[0].title} (+{circleEvents[0].xpReward} XP)
                      </Text>
                    </View>
                    <View style={styles.slimChallengeRight}>
                      <Text style={styles.slimChallengeLink}>View Events</Text>
                      <Ionicons name="chevron-forward" size={12} color="#4F46E5" />
                    </View>
                  </TouchableOpacity>
                )}

                {/* ONE Prominent Post Action */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => setIsCreateModalOpen(true)}
                  style={[styles.singlePostBox, shadows.soft]}
                >
                  <View style={styles.singlePostLeft}>
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      style={styles.singlePostIcon}
                    >
                      <Ionicons name="add" size={22} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={styles.singlePostTextCol}>
                      <Text style={styles.singlePostTitle}>
                        {isMentor ? 'Share Guide or Technique Fix' : 'Share Practice Video or Question'}
                      </Text>
                      <Text style={styles.singlePostSub}>
                        Directly to {activeCommunity.name.split('&')[0].trim()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.postNowPill}>
                    <Text style={styles.postNowPillText}>+ Post</Text>
                  </View>
                </TouchableOpacity>

                {/* Clean Feed Filter Pill Bar */}
                <View style={styles.feedFilterBar}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setFeedFilter('all')}
                    style={[styles.feedFilterBtn, feedFilter === 'all' && styles.feedFilterBtnActive]}
                  >
                    <Text style={[styles.feedFilterText, feedFilter === 'all' && styles.feedFilterTextActive]}>
                      All ({posts.filter((p) => p.communityId === activeCommunity.id).length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setFeedFilter('video')}
                    style={[styles.feedFilterBtn, feedFilter === 'video' && styles.feedFilterBtnActive]}
                  >
                    <Ionicons
                      name="videocam"
                      size={12}
                      color={feedFilter === 'video' ? '#FFFFFF' : '#64748B'}
                    />
                    <Text style={[styles.feedFilterText, feedFilter === 'video' && styles.feedFilterTextActive]}>
                      Videos
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setFeedFilter('text')}
                    style={[styles.feedFilterBtn, feedFilter === 'text' && styles.feedFilterBtnActive]}
                  >
                    <Ionicons
                      name="chatbubbles"
                      size={12}
                      color={feedFilter === 'text' ? '#FFFFFF' : '#64748B'}
                    />
                    <Text style={[styles.feedFilterText, feedFilter === 'text' && styles.feedFilterTextActive]}>
                      Topics
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setFeedFilter('reviewed')}
                    style={[styles.feedFilterBtn, feedFilter === 'reviewed' && styles.feedFilterBtnActive]}
                  >
                    <Ionicons
                      name="star"
                      size={12}
                      color={feedFilter === 'reviewed' ? '#FFFFFF' : '#7C3AED'}
                    />
                    <Text style={[styles.feedFilterText, feedFilter === 'reviewed' && styles.feedFilterTextActive]}>
                      Critiqued
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Posts Feed */}
                <View style={styles.feedList}>
                  {communityPosts.length > 0 ? (
                    communityPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onPress={() => setActiveCritiquePost(post)}
                        onCommentPress={() => setActiveCritiquePost(post)}
                        onCritiquePress={() => setActiveCritiquePost(post)}
                        onLikePress={() => toggleLikePost(post.id)}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Ionicons name="videocam-outline" size={38} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No posts matching this filter</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setIsCreateModalOpen(true)}
                        style={styles.firstPostBtn}
                      >
                        <Text style={styles.firstPostBtnText}>Upload First Practice Clip</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        ) : (
          /* ================= LEVEL 1: COMMUNITIES LIST VIEW ================= */
          <View style={styles.listContainer}>
            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {['All', 'Music', 'Coding', 'Design'].map((cat) => {
                const isSelected = communityCategoryFilter === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    activeOpacity={0.8}
                    onPress={() => setCommunityCategoryFilter(cat)}
                    style={[styles.catFilterChip, isSelected && styles.catFilterChipActive]}
                  >
                    <Text style={[styles.catFilterText, isSelected && styles.catFilterTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Joined Communities Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>
                My Joined Circles ({joinedCommunityObjects.length})
              </Text>
              <Text style={styles.sectionHint}>Tap circle to view feed & mentors</Text>
            </View>

            <View style={styles.joinedCardsList}>
              {joinedCommunityObjects
                .filter(
                  (c) =>
                    communityCategoryFilter === 'All' ||
                    c.category.toLowerCase() === communityCategoryFilter.toLowerCase()
                )
                .map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.88}
                    onPress={() => setActiveCommunity(c)}
                    style={[styles.joinedCard, shadows.card]}
                  >
                    <View style={[styles.cardIconBox, { backgroundColor: c.iconBgColor }]}>
                      <Ionicons
                        name={c.iconName as keyof typeof Ionicons.glyphMap}
                        size={24}
                        color={c.iconColor}
                      />
                    </View>

                    <View style={styles.cardInfo}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {c.name}
                        </Text>
                        {c.isHot && (
                          <View style={styles.hotPillMini}>
                            <Ionicons name="flame" size={10} color="#EA580C" />
                            <Text style={styles.hotPillMiniText}>Active</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardCategory}>
                        {c.category} • {c.memberCount} members
                      </Text>

                      {/* Avatars Stack */}
                      <View style={styles.avatarRow}>
                        <View style={styles.stackWrap}>
                          {c.avatarStack?.map((uri, idx) => (
                            <Image
                              key={idx}
                              source={{ uri }}
                              style={[
                                styles.stackImg,
                                { marginLeft: idx === 0 ? 0 : -8, zIndex: 5 - idx },
                              ]}
                            />
                          ))}
                        </View>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeLabel}>Live Mentors</Text>
                      </View>
                    </View>

                    <View style={styles.enterArrowBox}>
                      <Ionicons name="chevron-forward" size={18} color="#4F46E5" />
                    </View>
                  </TouchableOpacity>
                ))}
            </View>

            {/* Discover More Communities Section */}
            <View style={styles.discoverSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Discover More Circles</Text>
                <Text style={styles.sectionHint}>Expand your skill mastery</Text>
              </View>

              <View style={styles.discoverList}>
                {recommendedCommunities
                  .filter((c) => !joinedCommunities.includes(c.id))
                  .filter(
                    (c) =>
                      communityCategoryFilter === 'All' ||
                      c.category.toLowerCase() === communityCategoryFilter.toLowerCase()
                  )
                  .map((c) => (
                    <View key={c.id} style={[styles.discoverCard, shadows.soft]}>
                      <View style={[styles.discoverIconBox, { backgroundColor: c.iconBgColor }]}>
                        <Ionicons
                          name={c.iconName as keyof typeof Ionicons.glyphMap}
                          size={20}
                          color={c.iconColor}
                        />
                      </View>

                      <View style={styles.discoverInfo}>
                        <Text style={styles.discoverName}>{c.name}</Text>
                        <Text style={styles.discoverMeta}>
                          {c.category} • {c.memberCount} members
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => toggleCommunityJoin(c.id)}
                        style={styles.joinBtn}
                      >
                        <Text style={styles.joinBtnText}>+ Join</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Discussion & Mentor Video Critique Sheet */}
      <CritiqueModal
        visible={!!activeCritiquePost}
        post={activeCritiquePost}
        onClose={() => setActiveCritiquePost(null)}
      />

      {/* Unified Create / Upload Post Modal (No Community Picker, Single Action) */}
      <CreatePostModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        community={activeCommunity}
      />

      {/* Community Details Modal: Mentors, Members & Basic Stats */}
      <CommunityDetailsModal
        visible={isDetailsModalOpen}
        community={activeCommunity}
        onClose={() => setIsDetailsModalOpen(false)}
      />

      {/* Community Event & Challenge Participation Modal */}
      <CommunityEventModal
        visible={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  mainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  mainSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  roleChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  roleChipMentor: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  roleChipTextMentor: {
    color: '#7C3AED',
  },
  roomHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  roomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTitleButton: {
    flex: 1,
    paddingHorizontal: 4,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomHeaderTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  roomSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  roomHeaderSub: {
    fontSize: 10,
    color: '#64748B',
  },
  tapInfoNotice: {
    fontSize: 10,
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  miniRoleChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  miniRoleChipMentor: {
    backgroundColor: '#FAF5FF',
  },
  miniRoleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  miniRoleTextMentor: {
    color: '#7C3AED',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  roomContainer: {
    gap: spacing.sm + 2,
  },
  roomSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.lg,
    padding: 3,
    gap: 4,
  },
  roomSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  roomSegmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  roomSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  roomSegmentTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  roomEventBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  roomEventBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  slimChallengeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  slimChallengeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  slimChallengeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  slimChallengeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  slimChallengeLink: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  singlePostBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  singlePostLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  singlePostIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singlePostTextCol: {
    flex: 1,
  },
  singlePostTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  singlePostSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  postNowPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  postNowPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  feedFilterBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: borderRadius.lg,
    gap: 4,
  },
  feedFilterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  feedFilterBtnActive: {
    backgroundColor: '#4F46E5',
  },
  feedFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  feedFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  feedList: {
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  firstPostBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  firstPostBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  listContainer: {
    gap: spacing.md,
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  catFilterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catFilterChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  catFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  catFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sectionHeaderRow: {
    marginBottom: 4,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  sectionHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  joinedCardsList: {
    gap: 10,
  },
  joinedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  cardIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  hotPillMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    gap: 2,
  },
  hotPillMiniText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#EA580C',
  },
  cardCategory: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  stackWrap: {
    flexDirection: 'row',
  },
  stackImg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeLabel: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: 'bold',
  },
  enterArrowBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverSection: {
    gap: 10,
    marginTop: spacing.xs,
  },
  discoverList: {
    gap: 8,
  },
  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },
  discoverIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverInfo: {
    flex: 1,
  },
  discoverName: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  discoverMeta: {
    fontSize: 10,
    color: '#64748B',
  },
  joinBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  joinBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
});
