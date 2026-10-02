import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Text,
  PanResponder,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer } from 'expo-video';
import { useApp } from '../../context/AppContext';
import { HomeHeader } from '../../components/home/HomeHeader';
import { SearchBar } from '../../components/home/SearchBar';
import { PostCard } from '../../components/home/PostCard';
import { CritiqueModal } from '../../components/community/CritiqueModal';
import { Avatar } from '../../components/common/Avatar';
import { searchUsersRequest, type FollowUserRow } from '../../api/social.api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { CommunityPost, CommunityEvent } from '../../types';
import { CommunityEventModal } from '../../components/community/CommunityEventModal';
import { phaseLabel } from '../../components/community/CommunityEventsSection';

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    selectedHobby,
    posts,
    getJoinedCommunityObjects,
    openMyProfile,
    playAudioPost,
    closeAudioPost,
    audioPost,
    openUserProfile,
    communityEvents,
  } = useApp();
  const [homeEvent, setHomeEvent] = useState<CommunityEvent | null>(null);
  const joinedCircles = getJoinedCommunityObjects();
  const activeEvents = communityEvents.filter((e) => e.phase === 'voting' || e.phase === 'live');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCritiquePost, setActiveCritiquePost] = useState<CommunityPost | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video' | 'audio' | 'text' | 'people'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  // People search results (when the "People" filter is active).
  const peopleMode = filterType === 'people';
  const [peopleResults, setPeopleResults] = useState<FollowUserRow[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  useEffect(() => {
    if (!peopleMode) return;
    const q = searchQuery.trim();
    if (q.length < 1) {
      setPeopleResults([]);
      setPeopleLoading(false);
      return;
    }
    setPeopleLoading(true);
    let active = true;
    const t = setTimeout(() => {
      searchUsersRequest(q)
        .then((rows) => active && setPeopleResults(rows))
        .catch(() => active && setPeopleResults([]))
        .finally(() => active && setPeopleLoading(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [searchQuery, peopleMode]);

  // ONE shared player for the whole feed; only the active card binds to it.
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedMuted, setFeedMuted] = useState(true); // feeds autoplay muted by default
  const [videoStarted, setVideoStarted] = useState(false); // show thumbnail before autoplay kicks in
  const playDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PanResponder for smooth screen swiping gesture (Slide Left -> Switch to Reels)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 35 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          navigation.navigate('ReelsTab');
        }
      },
    })
  ).current;

  const handleProfilePress = () => {
    openMyProfile();
  };

  const handleVideoPress = (post: CommunityPost) => {
    setActiveCritiquePost(post);
  };

  const publicPosts = posts.filter((p) => !p.isPrivate);

  const matchesType = (p: CommunityPost) => {
    if (filterType === 'all') return true;
    if (filterType === 'photo') return p.postType === 'image';
    const isAudio = p.postType === 'audio' || (!!p.audioUrl && !p.videoUrl);
    if (filterType === 'audio') return isAudio;
    if (filterType === 'video') return p.postType === 'video' && !isAudio;
    if (filterType === 'text') return p.postType === 'text';
    return true;
  };

  const filteredPosts = publicPosts
    .filter(matchesType)
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        p.authorSkill?.toLowerCase().includes(q) ||
        p.communityName.toLowerCase().includes(q) ||
        (p.videoTitle && p.videoTitle.toLowerCase().includes(q)) ||
        (p.tag && p.tag.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => (sortBy === 'popular' ? (b.likesCount || 0) - (a.likesCount || 0) : 0));

  const isSearchingOrFiltering = searchQuery.trim().length > 0 || filterType !== 'all' || sortBy !== 'recent';
  const feedPosts = isSearchingOrFiltering ? filteredPosts : publicPosts;

  const isAudioPost = (p?: CommunityPost) =>
    !!p && (p.postType === 'audio' || (!!p.audioUrl && !p.videoUrl));

  // Autoplay the active card (video → shared player; audio → app audio player).
  useEffect(() => {
    // Always show the thumbnail first, then start after a short delay.
    setVideoStarted(false);
    if (playDelayRef.current) {
      clearTimeout(playDelayRef.current);
      playDelayRef.current = null;
    }

    // While a post is open in the detail sheet, the feed must NOT play — otherwise
    // two videos play at once.
    if (activeCritiquePost) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      closeAudioPost();
      return;
    }
    const active = feedPosts[activeIndex];
    if (!active) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    if (isAudioPost(active)) {
      // Audio NEVER autoplays — it only plays when the user taps it.
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    } else if (active.videoUrl) {
      // Preview the thumbnail for ~1.6s, THEN load + play the video inline.
      playDelayRef.current = setTimeout(async () => {
        try {
          await player.replaceAsync(active.videoUrl!);
          player.muted = feedMuted;
          player.play();
          setVideoStarted(true);
        } catch {
          /* ignore */
        }
      }, 1600);
    } else {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    }
    return () => {
      if (playDelayRef.current) {
        clearTimeout(playDelayRef.current);
        playDelayRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, feedPosts[activeIndex]?.id, activeCritiquePost]);

  useEffect(() => {
    try {
      player.muted = feedMuted;
    } catch {
      /* ignore */
    }
  }, [feedMuted, player]);

  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    });
    return unsub;
  }, [navigation, player]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Fixed Top Header */}
      <View style={{ paddingTop: Math.max(insets.top, 12), backgroundColor: '#FFFFFF' }}>
        <HomeHeader
          onProfilePress={handleProfilePress}
        />
      </View>

      <FlatList
        data={peopleMode ? [] : feedPosts}
        keyExtractor={(item) => item.feedId ?? item.id}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 85, 100) },
        ]}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 65 }}
        ListHeaderComponent={
          <>
            {/* Floating Clean Search Bar */}
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={peopleMode ? 'Search people by name…' : 'Search videos, people, tags…'}
              onFilterPress={() => setShowFilters((v) => !v)}
            />

            {/* Filter Panel */}
            {showFilters && (
              <View style={styles.filterPanel}>
                <Text style={styles.filterLabel}>Type</Text>
                <View style={styles.filterRow}>
                  {([
                    { key: 'all', label: 'All', icon: 'apps-outline' },
                    { key: 'photo', label: 'Photos', icon: 'image-outline' },
                    { key: 'video', label: 'Videos', icon: 'videocam-outline' },
                    { key: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
                    { key: 'text', label: 'Discuss', icon: 'chatbubbles-outline' },
                    { key: 'people', label: 'People', icon: 'person-outline' },
                  ] as const).map((t) => {
                    const active = filterType === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        activeOpacity={0.8}
                        onPress={() => setFilterType(t.key)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Ionicons name={t.icon} size={13} color={active ? '#FFFFFF' : '#64748B'} />
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.filterLabel, { marginTop: 10 }]}>Sort by</Text>
                <View style={styles.filterRow}>
                  {([
                    { key: 'recent', label: 'Most recent', icon: 'time-outline' },
                    { key: 'popular', label: 'Most liked', icon: 'heart-outline' },
                  ] as const).map((s) => {
                    const active = sortBy === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        activeOpacity={0.8}
                        onPress={() => setSortBy(s.key)}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Ionicons name={s.icon} size={13} color={active ? '#FFFFFF' : '#64748B'} />
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {(filterType !== 'all' || sortBy !== 'recent') && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setFilterType('all');
                      setSortBy('recent');
                    }}
                    style={styles.filterResetBtn}
                  >
                    <Ionicons name="refresh" size={13} color="#4F46E5" />
                    <Text style={styles.filterResetText}>Reset filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Feed type tabs */}
            {!peopleMode && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeTabs}>
                {([
                  { key: 'all', label: 'For you', icon: 'sparkles' },
                  { key: 'photo', label: 'Photos', icon: 'image' },
                  { key: 'video', label: 'Videos', icon: 'play-circle' },
                  { key: 'audio', label: 'Audio', icon: 'musical-notes' },
                  { key: 'text', label: 'Discuss', icon: 'chatbubbles' },
                ] as const).map((t) => {
                  const on = filterType === t.key;
                  return (
                    <TouchableOpacity key={t.key} activeOpacity={0.85} onPress={() => setFilterType(t.key)}>
                      {on ? (
                        <LinearGradient colors={['#4F46E5', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.typeTab}>
                          <Ionicons name={t.icon} size={14} color="#FFFFFF" />
                          <Text style={[styles.typeTabText, { color: '#FFFFFF' }]}>{t.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.typeTab, styles.typeTabOff]}>
                          <Ionicons name={`${t.icon}-outline` as any} size={14} color="#475569" />
                          <Text style={styles.typeTabText}>{t.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Your circles (story-style row) */}
            {!peopleMode && !isSearchingOrFiltering && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circlesRow}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('CirclesTab')} style={styles.circleItem}>
                  <View style={[styles.circleRing, styles.circleRingAdd]}>
                    <Ionicons name="compass" size={26} color="#4F46E5" />
                  </View>
                  <Text style={styles.circleName} numberOfLines={1}>Discover</Text>
                </TouchableOpacity>
                {joinedCircles.map((c) => {
                  const hasEvent = activeEvents.some((e) => e.communityId === c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('CirclesTab', { openCircleId: c.id })}
                      style={styles.circleItem}
                    >
                      <LinearGradient
                        colors={hasEvent ? ['#F59E0B', '#EC4899', '#8B5CF6'] : ['#C7D2FE', '#E9D5FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.circleRing}
                      >
                        <View style={[styles.circleInner, { backgroundColor: c.iconBgColor || '#EEF2FF' }]}>
                          {c.avatarUrl ? (
                            <Image source={{ uri: c.avatarUrl }} style={styles.circleImg} />
                          ) : (
                            <Ionicons name={(c.iconName || 'people') as any} size={24} color={c.iconColor || '#4F46E5'} />
                          )}
                        </View>
                      </LinearGradient>
                      {hasEvent && (
                        <View style={styles.circleLive}>
                          <Text style={styles.circleLiveText}>EVENT</Text>
                        </View>
                      )}
                      <Text style={styles.circleName} numberOfLines={1}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Live & voting events */}
            {!peopleMode && !isSearchingOrFiltering && activeEvents.length > 0 && (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionHeadTitle}>⚡ Challenges</Text>
                  <Text style={styles.sectionHeadSub}>{activeEvents.length} active</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventsRow}>
                  {activeEvents.map((e) => {
                    const ph = phaseLabel(e);
                    return (
                      <TouchableOpacity key={e.id} activeOpacity={0.9} onPress={() => setHomeEvent(e)}>
                        <LinearGradient colors={e.bannerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.eventCard}>
                          <View style={styles.eventTop}>
                            <View style={styles.eventPill}>
                              <Ionicons name={ph.icon} size={11} color="#FFFFFF" />
                              <Text style={styles.eventPillText}>{ph.text}</Text>
                            </View>
                            <Text style={styles.eventXp}>{e.xpReward} XP</Text>
                          </View>
                          <Text style={styles.eventTitle} numberOfLines={2}>{e.title}</Text>
                          <Text style={styles.eventCircle} numberOfLines={1}>{e.communityName}</Text>
                          {e.my && e.phase === 'live' ? (
                            <View style={styles.eventProgress}>
                              <View style={styles.eventTrack}>
                                <View style={[styles.eventFill, { width: `${e.my.pct}%` }]} />
                              </View>
                              <Text style={styles.eventCta}>{e.my.pct}%</Text>
                            </View>
                          ) : (
                            <View style={styles.eventBtn}>
                              <Text style={styles.eventBtnText}>
                                {e.phase === 'voting' ? (e.hasVoted ? '✓ You’re in' : 'Vote to join') : 'View board'}
                              </Text>
                            </View>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {!peopleMode && !isSearchingOrFiltering && feedPosts.length > 0 && (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionHeadTitle}>Latest from your circles</Text>
              </View>
            )}

            <View style={styles.searchBarSpacer} />

            {/* People search results */}
            {peopleMode && (
              <View style={styles.peopleSection}>
                {searchQuery.trim().length < 1 ? (
                  <View style={styles.peopleHint}>
                    <Ionicons name="people-outline" size={34} color="#CBD5E1" />
                    <Text style={styles.peopleHintText}>Search people by name to find and follow them.</Text>
                  </View>
                ) : peopleLoading ? (
                  <Text style={styles.peopleStatus}>Searching…</Text>
                ) : peopleResults.length === 0 ? (
                  <Text style={styles.peopleStatus}>No people found for “{searchQuery.trim()}”.</Text>
                ) : (
                  peopleResults.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      activeOpacity={0.85}
                      onPress={() =>
                        openUserProfile({
                          id: u.id,
                          name: u.name,
                          avatarUrl: u.avatarUrl,
                          role: u.role ?? undefined,
                          badge: u.role === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                        })
                      }
                      style={styles.personRow}
                    >
                      <Avatar uri={u.avatarUrl} name={u.name} size={44} showRing={u.role === 'Mentor'} />
                      <View style={styles.personInfo}>
                        <Text style={styles.personName} numberOfLines={1}>{u.name}</Text>
                        <Text style={styles.personRole}>{u.role === 'Mentor' ? 'Verified Mentor' : 'Learner'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          peopleMode ? null : (
          <View style={styles.emptyFeed}>
            <Ionicons name="search-outline" size={36} color="#CBD5E1" />
            <Text style={styles.emptyFeedTitle}>
              {isSearchingOrFiltering ? 'No matching posts' : 'No posts yet'}
            </Text>
            <Text style={styles.emptyFeedSub}>
              {isSearchingOrFiltering
                ? 'Try a different search or clear your filters.'
                : 'Public posts from you and your circles will appear here.'}
            </Text>
          </View>
          )
        }
        renderItem={({ item, index }) => {
          // Discussion (text) posts are read-only inline — no detail modal.
          const openPost =
            item.postType === 'text' ? undefined : () => setActiveCritiquePost(item);
          return (
            <View style={styles.cardWrap}>
              <PostCard
                post={item}
                onPress={openPost}
                onCommentPress={openPost}
                showActions={false}
                showStats
                isActive={index === activeIndex}
                player={player}
                muted={feedMuted}
                onToggleMute={() =>
                  setFeedMuted((m) => {
                    // Unmuting a feed video stops a playing audio post (no overlap).
                    if (m && audioPost) closeAudioPost();
                    return !m;
                  })
                }
                videoStarted={index === activeIndex && videoStarted}
              />
            </View>
          );
        }}
      />

      <CommunityEventModal visible={!!homeEvent} event={homeEvent} onClose={() => setHomeEvent(null)} />

      {/* Interactive Critique & Comments Sheet */}
      <CritiqueModal
        visible={!!activeCritiquePost}
        post={activeCritiquePost}
        onClose={() => setActiveCritiquePost(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F3FB',
  },
  typeTabs: { gap: 8, paddingHorizontal: spacing.base, paddingTop: 12, paddingBottom: 4 },
  typeTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  typeTabOff: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  typeTabText: { fontSize: 13, fontWeight: '800', color: '#475569' },
  circlesRow: { gap: 14, paddingHorizontal: spacing.base, paddingTop: 14, paddingBottom: 4 },
  circleItem: { width: 68, alignItems: 'center' },
  circleRing: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  circleRingAdd: { backgroundColor: '#FFFFFF', borderWidth: 2, borderStyle: 'dashed', borderColor: '#A5B4FC' },
  circleInner: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: '#F4F3FB', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  circleImg: { width: '100%', height: '100%' },
  circleLive: { position: 'absolute', top: 54, backgroundColor: '#EC4899', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 2, borderColor: '#F4F3FB' },
  circleLiveText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
  circleName: { fontSize: 11, fontWeight: '700', color: '#334155', marginTop: 6, maxWidth: 68 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.base, marginTop: 16, marginBottom: 2 },
  sectionHeadTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
  sectionHeadSub: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  eventsRow: { gap: 12, paddingHorizontal: spacing.base, paddingTop: 10 },
  eventCard: { width: 236, borderRadius: 22, padding: 14, gap: 6 },
  eventTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(15,23,42,0.28)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  eventPillText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  eventXp: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  eventTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', lineHeight: 21, minHeight: 42 },
  eventCircle: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  eventProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  eventTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  eventFill: { height: '100%', borderRadius: 4, backgroundColor: '#FFFFFF' },
  eventCta: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
  eventBtn: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 4 },
  eventBtnText: { fontSize: 12, fontWeight: '800', color: '#312E81' },
  scrollContent: {
    paddingTop: spacing.xs,
  },
  cardWrap: {
    paddingHorizontal: spacing.base,
  },
  joinedSection: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  communityCountBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  communityCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  manageLink: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  joinedScroll: {
    gap: spacing.sm,
    paddingRight: spacing.base,
  },
  communityCardMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 180,
    maxWidth: 220,
    gap: 8,
  },
  miniIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInfo: {
    flex: 1,
  },
  miniName: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  miniMembers: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  seasonBannerCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  seasonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xxl,
    gap: 10,
  },
  seasonContentLeft: {
    flex: 1,
  },
  seasonBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  seasonPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FDE047',
  },
  seasonBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FDE047',
    letterSpacing: 0.5,
  },
  seasonPoolBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  seasonPoolText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  seasonBannerTitle: {
    fontSize: 17,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 4,
  },
  seasonBannerDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 15,
    marginBottom: 10,
  },
  seasonActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  seasonActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  seasonActionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  seasonStandingTag: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  seasonTrophyCol: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  seasonTrophyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  seasonRankPill: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#FDE047',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  seasonRankPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
  searchBarSpacer: {
    height: 14,
  },
  peopleSection: {
    paddingHorizontal: spacing.base,
    gap: 8,
    marginBottom: spacing.base,
  },
  peopleHint: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  peopleHintText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  peopleStatus: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 10,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  personRole: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  filterPanel: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
    ...shadows.soft,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  filterResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  filterResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  feedList: {
    gap: spacing.base,
  },
  emptyFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyFeedTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#334155',
  },
  emptyFeedSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomGoalOverlay: {
    position: 'absolute',
    bottom: 72,
    left: spacing.base,
    right: spacing.base,
    zIndex: 10,
  },
  bottomGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    gap: 6,
  },
  bottomGoalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  goalBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  goalDateTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  goalTitleText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  goalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalProgressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalProgressPercent: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  goalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  logSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  logSessionText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  editGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  editGoalText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});
