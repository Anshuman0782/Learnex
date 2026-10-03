import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  Dimensions,
} from 'react-native';
import { useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { PostCard } from '../../components/home/PostCard';
import { CritiqueModal } from '../../components/community/CritiqueModal';
import { CircleReelCard } from '../../components/community/CircleReelCard';
import { ReelViewerModal } from '../../components/common/ReelViewerModal';
import { getFeedRequest } from '../../api/posts.api';
import { CreateCircleModal } from '../../components/community/CreateCircleModal';
import { CircleSettingsModal } from '../../components/community/CircleSettingsModal';
import { CommunityDetailsModal } from '../../components/community/CommunityDetailsModal';
import { CommunityEventsSection, EventCard } from '../../components/community/CommunityEventsSection';
import { CommunityEventModal } from '../../components/community/CommunityEventModal';
import { Avatar } from '../../components/common/Avatar';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { circleTheme } from '../../theme/circleTheme';
import { Community, CommunityPost, CommunityEvent } from '../../types';
import { postKind } from '../../utils/postKind';

// Circle section theme (distinct from Home's indigo).
const CIRCLE_ACCENT = circleTheme.accent;
const CIRCLE_ACCENT_DARK = circleTheme.accentDark;
const CIRCLE_ACCENT_LIGHT = circleTheme.accentLight;
const CIRCLE_BG = circleTheme.bg;

export const CommunityScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    user,
    selectedRole,
    joinedCommunities,
    posts,
    reels,
    communityEvents,
    feedVersion,
    playAudioPost,
    closeAudioPost,
    toggleCommunityJoin,
    getJoinedCommunityObjects,
    getRecommendedCommunities,
  } = useApp();

  const joinedCommunityObjects = getJoinedCommunityObjects();
  const recommendedCommunities = getRecommendedCommunities();

  // Categories are derived from the circles that actually exist — so the filter
  // chips always match real data (nothing hardcoded) and only show available ones.
  const availableCategories = React.useMemo(() => {
    const set = new Set<string>();
    [...joinedCommunityObjects, ...recommendedCommunities].forEach((c) => {
      if (c.category && c.category.trim()) set.add(c.category.trim());
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedCommunityObjects.length, recommendedCommunities.length]);

  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const [activeCritiquePost, setActiveCritiquePost] = useState<CommunityPost | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateCircleOpen, setIsCreateCircleOpen] = useState(false);
  const [settingsCommunity, setSettingsCommunity] = useState<Community | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [roomTab, setRoomTab] = useState<'feed' | 'events'>('feed');
  const [feedFilter, setFeedFilter] = useState<'all' | 'video' | 'text' | 'reviewed'>('all');
  const [communityCategoryFilter, setCommunityCategoryFilter] = useState('All');
  const [circleSearch, setCircleSearch] = useState('');

  // Deep link from Home: open a specific circle room (circles row / event card).
  const route = useRoute<any>();
  const openCircleId: string | undefined = route.params?.openCircleId;
  useEffect(() => {
    if (!openCircleId) return;
    const c = joinedCommunityObjects.find((x) => x.id === openCircleId);
    if (c) {
      setActiveCommunity(c);
      setRoomTab('feed');
    }
    navigation.setParams({ openCircleId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCircleId]);

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

  // ---- Circle room feed ----
  // Loaded from the server for this circle (posts AND reels — the Home feed
  // excludes reels, so filtering it would hide reels tagged to the circle).
  const [roomFeed, setRoomFeed] = useState<CommunityPost[]>([]);
  const [reelViewer, setReelViewer] = useState<{ reels: CommunityPost[]; index: number } | null>(null);

  useEffect(() => {
    if (!activeCommunity) {
      setRoomFeed([]);
      return;
    }
    let active = true;
    getFeedRequest({ communityId: activeCommunity.id })
      .then((rows) => active && setRoomFeed(rows))
      .catch(() => active && setRoomFeed([]));
    return () => {
      active = false;
    };
    // Re-sync when posts are created/deleted anywhere in the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCommunity?.id, posts.length, reels.length, feedVersion]);

  // Prefer the live copy from the app feeds so likes/comments update instantly.
  const fresh = (p: CommunityPost) =>
    posts.find((x) => x.id === p.id && !x.repostedByName) ?? reels.find((x) => x.id === p.id) ?? p;
  const roomItems = roomFeed.map(fresh);

  const communityPosts = roomItems.filter((p) => {
    if (feedFilter === 'video') return postKind(p) !== 'discussion';
    if (feedFilter === 'text') return postKind(p) === 'discussion';
    if (feedFilter === 'reviewed') return (p.mentorCritiqueCount || 0) > 0;
    return true;
  });
  const roomReels = communityPosts.filter((p) => p.isShort);

  // ---- Home-style autoplay for the circle feed ----
  // One shared player; the video card most visible on screen plays (muted).
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [videoStarted, setVideoStarted] = useState(false);
  const [feedMuted, setFeedMuted] = useState(true);
  const cardRefs = useRef(new Map<string, View>());
  const playDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPickRef = useRef(0);
  const videoIdsKey = communityPosts
    .filter((p) => !p.isShort && !!p.videoUrl && p.postType !== 'audio')
    .map((p) => p.id)
    .join(',');

  /** Pick the video card that is at least 60% visible (the most visible wins). */
  const pickActiveVideo = useCallback(() => {
    const ids = videoIdsKey ? videoIdsKey.split(',').filter((id) => cardRefs.current.has(id)) : [];
    if (ids.length === 0) {
      setActiveVideoId(null);
      return;
    }
    const screenH = Dimensions.get('window').height;
    let bestId: string | null = null;
    let bestVisible = 0;
    let pending = ids.length;
    ids.forEach((id) => {
      cardRefs.current.get(id)?.measureInWindow((_x, y, _w, h) => {
        // Visible band excludes the header (top) and the tab bar (bottom).
        const visible = h > 0 ? Math.max(0, Math.min(y + h, screenH - 90) - Math.max(y, 120)) / h : 0;
        if (visible >= 0.6 && visible > bestVisible) {
          bestVisible = visible;
          bestId = id;
        }
        pending -= 1;
        if (pending === 0) setActiveVideoId(bestId);
      });
    });
  }, [videoIdsKey]);

  const onFeedScroll = () => {
    const now = Date.now();
    if (now - lastPickRef.current > 250) {
      lastPickRef.current = now;
      pickActiveVideo();
    }
  };

  // Re-evaluate once the feed renders / changes.
  useEffect(() => {
    if (!activeCommunity || roomTab !== 'feed') return;
    const t = setTimeout(pickActiveVideo, 400);
    return () => clearTimeout(t);
  }, [activeCommunity, roomTab, feedFilter, pickActiveVideo]);

  const roomVideoPaused =
    !activeCommunity || roomTab !== 'feed' || !!activeCritiquePost || !!reelViewer;

  // Thumbnail first, then play the active card inline after a short delay.
  useEffect(() => {
    setVideoStarted(false);
    if (playDelayRef.current) clearTimeout(playDelayRef.current);
    const active = activeVideoId ? communityPosts.find((p) => p.id === activeVideoId) : undefined;
    if (roomVideoPaused || !active?.videoUrl) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    const url = active.videoUrl;
    playDelayRef.current = setTimeout(async () => {
      try {
        await player.replaceAsync(url);
        player.muted = feedMuted;
        player.play();
        setVideoStarted(true);
      } catch {
        /* ignore */
      }
    }, 1600);
    return () => {
      if (playDelayRef.current) clearTimeout(playDelayRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideoId, roomVideoPaused]);

  useEffect(() => {
    try {
      player.muted = feedMuted;
    } catch {
      /* ignore */
    }
  }, [feedMuted, player]);

  // Leaving the Circles tab stops playback.
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      setActiveVideoId(null);
    });
    return unsub;
  }, [navigation, player]);

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

            {/* Circle logo */}
            {activeCommunity.avatarUrl ? (
              <Image source={{ uri: activeCommunity.avatarUrl }} style={styles.roomLogo} />
            ) : (
              <View style={[styles.roomLogo, styles.roomLogoFallback]}>
                <Ionicons name="people" size={18} color={CIRCLE_ACCENT_DARK} />
              </View>
            )}

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
                <Ionicons name="chevron-down" size={16} color="#7C3AED" />
              </View>
              <View style={styles.roomSubRow}>
                <Text style={styles.roomHeaderSub}>
                  {activeCommunity.memberCount} members
                </Text>
                <Text style={styles.tapInfoNotice}>• Mentors & Stats ℹ️</Text>
              </View>
            </TouchableOpacity>

            {/* Circle settings / group info */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSettingsCommunity(activeCommunity)}
              style={styles.roomSettingsBtn}
            >
              <Ionicons name="settings-outline" size={19} color={CIRCLE_ACCENT_DARK} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Top Header for Communities List — gradient banner */
        <LinearGradient
          colors={circleTheme.banner as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.mainHeader,
            { paddingTop: Math.max(insets.top + spacing.sm, spacing.md) },
          ]}
        >
          <View style={styles.mainHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mainTitle}>Circles</Text>
              <Text style={styles.mainSub}>Your groups, communities & practice rooms</Text>
            </View>

            {/* Create a new circle */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIsCreateCircleOpen(true)}
              style={styles.createCircleBtn}
            >
              <Ionicons name="add" size={16} color={CIRCLE_ACCENT_DARK} />
              <Text style={styles.createCircleText}>Create</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 95, 120) },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={100}
        onScroll={activeCommunity ? onFeedScroll : undefined}
        onMomentumScrollEnd={activeCommunity ? pickActiveVideo : undefined}
        onScrollEndDrag={activeCommunity ? pickActiveVideo : undefined}
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
                  color={roomTab === 'feed' ? '#7C3AED' : '#64748B'}
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
                  color={roomTab === 'events' ? '#7C3AED' : '#64748B'}
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
                communityName={activeCommunity.name}
                selectedRole={selectedRole}
                onSelectEvent={(evt) => setSelectedEvent(evt)}
              />
            ) : (
              /* Feed View */
              <>
                {/* Pinned event posts — vote to join / open your challenge */}
                {circleEvents
                  .filter((e) => e.phase === 'voting' || e.phase === 'live')
                  .map((e) => (
                    <View key={e.id} style={styles.pinnedEvent}>
                      <View style={styles.pinnedLabel}>
                        <Ionicons name="pin" size={11} color="#7C3AED" />
                        <Text style={styles.pinnedLabelText}>PINNED EVENT</Text>
                      </View>
                      <EventCard event={e} onPress={() => setSelectedEvent(e)} />
                    </View>
                  ))}

                {/* Clean Feed Filter Pill Bar */}
                <View style={styles.feedFilterBar}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setFeedFilter('all')}
                    style={[styles.feedFilterBtn, feedFilter === 'all' && styles.feedFilterBtnActive]}
                  >
                    <Text style={[styles.feedFilterText, feedFilter === 'all' && styles.feedFilterTextActive]}>
                      All ({roomItems.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setFeedFilter('video')}
                    style={[styles.feedFilterBtn, feedFilter === 'video' && styles.feedFilterBtnActive]}
                  >
                    <Ionicons
                      name="grid"
                      size={12}
                      color={feedFilter === 'video' ? '#FFFFFF' : '#64748B'}
                    />
                    <Text style={[styles.feedFilterText, feedFilter === 'video' && styles.feedFilterTextActive]}>
                      Posts
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
                      Discuss
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
                    communityPosts.map((post) => {
                      // Reels: vertical 9:16 card → opens the full-screen reels viewer.
                      if (post.isShort) {
                        const idx = roomReels.findIndex((r) => r.id === post.id);
                        return (
                          <CircleReelCard
                            key={post.id}
                            post={post}
                            onOpen={() => setReelViewer({ reels: roomReels, index: Math.max(0, idx) })}
                          />
                        );
                      }
                      // Discussion (text) posts are read-only inline — no detail modal.
                      const openPost = post.postType === 'text' ? undefined : () => setActiveCritiquePost(post);
                      return (
                        <View
                          key={post.id}
                          collapsable={false}
                          ref={(r) => {
                            if (r) cardRefs.current.set(post.id, r);
                            else cardRefs.current.delete(post.id);
                          }}
                        >
                          {/* Same card as the Home feed (stats bar + inline autoplay) */}
                          <PostCard
                            post={post}
                            onPress={openPost}
                            onCommentPress={openPost}
                            showActions={false}
                            showStats
                            isActive={post.id === activeVideoId}
                            player={player}
                            muted={feedMuted}
                            onToggleMute={() => setFeedMuted((m) => !m)}
                            videoStarted={post.id === activeVideoId && videoStarted}
                          />
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.emptyCard}>
                      <Ionicons name="videocam-outline" size={38} color="#94A3B8" />
                      <Text style={styles.emptyTitle}>No posts matching this filter</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('AddTab', { circleId: activeCommunity.id })}
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
              {availableCategories.map((cat) => {
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

            {/* Search circles */}
            <View style={styles.circleSearchBar}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.circleSearchInput}
                placeholder="Search circles by name or category"
                placeholderTextColor="#94A3B8"
                value={circleSearch}
                onChangeText={setCircleSearch}
                returnKeyType="search"
              />
              {circleSearch.length > 0 && (
                <TouchableOpacity onPress={() => setCircleSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            </View>

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
                .filter(
                  (c) =>
                    circleSearch.trim() === '' ||
                    c.name.toLowerCase().includes(circleSearch.trim().toLowerCase()) ||
                    c.category.toLowerCase().includes(circleSearch.trim().toLowerCase())
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

                      {/* Real members */}
                      <View style={styles.avatarRow}>
                        {c.members.length > 0 ? (
                          <>
                            <View style={styles.stackWrap}>
                              {c.members.slice(0, 4).map((m, idx) => (
                                <View
                                  key={m.id}
                                  style={[
                                    styles.stackAvatarWrap,
                                    { marginLeft: idx === 0 ? 0 : -8, zIndex: 5 - idx },
                                  ]}
                                >
                                  <Avatar name={m.name} size={22} />
                                </View>
                              ))}
                            </View>
                            <Text style={styles.activeLabel}>
                              {c.mentorCount > 0
                                ? `${c.mentorCount} mentor${c.mentorCount === 1 ? '' : 's'} active`
                                : `${c.memberCount} member${c.memberCount === 1 ? '' : 's'}`}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.activeLabel}>Be the first to practice here</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.enterArrowBox}>
                      <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
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
                  .filter(
                    (c) =>
                      circleSearch.trim() === '' ||
                      c.name.toLowerCase().includes(circleSearch.trim().toLowerCase()) ||
                      c.category.toLowerCase().includes(circleSearch.trim().toLowerCase())
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

      {/* Circle reels open in the full-screen reels format */}
      <ReelViewerModal
        visible={!!reelViewer}
        reels={reelViewer?.reels ?? []}
        startIndex={reelViewer?.index ?? 0}
        onClose={() => setReelViewer(null)}
      />

      {/* Create a new Circle */}
      <CreateCircleModal
        visible={isCreateCircleOpen}
        onClose={() => setIsCreateCircleOpen(false)}
      />

      {/* Circle settings / group info */}
      <CircleSettingsModal
        visible={!!settingsCommunity}
        community={settingsCommunity}
        onClose={() => setSettingsCommunity(null)}
        onDeletedOrLeft={() => setActiveCommunity(null)}
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
    // Circle section theme (teal tint) — distinct from Home.
    backgroundColor: CIRCLE_BG,
  },
  mainHeader: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  mainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  mainSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  createCircleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: borderRadius.full,
  },
  createCircleText: {
    color: CIRCLE_ACCENT_DARK,
    fontWeight: 'bold',
    fontSize: 13,
  },
  roomSettingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CIRCLE_ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChip: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  roleChipMentor: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7C3AED',
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
  roomLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  roomLogoFallback: {
    backgroundColor: CIRCLE_ACCENT_LIGHT,
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
    color: '#7C3AED',
    fontWeight: 'bold',
  },
  miniRoleChip: {
    backgroundColor: '#EDE9FE',
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
    color: '#7C3AED',
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
    color: '#7C3AED',
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
  pinnedEvent: { marginHorizontal: spacing.base, marginBottom: 12, gap: 6 },
  pinnedLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pinnedLabelText: { fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.6 },
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
    color: '#7C3AED',
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
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  postNowPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7C3AED',
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
    backgroundColor: '#7C3AED',
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
    backgroundColor: '#7C3AED',
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
  circleSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  circleSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
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
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
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
  stackAvatarWrap: {
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
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
    backgroundColor: '#EDE9FE',
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
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  joinBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
});
