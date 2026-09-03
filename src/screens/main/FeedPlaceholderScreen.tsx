import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../../components/common/Avatar';
import { CritiqueModal } from '../../components/community/CritiqueModal';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { CommunityPost } from '../../types';

const { width: SCREEN_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const WAVEFORM_HEIGHTS = [8, 16, 24, 18, 28, 14, 26, 32, 20, 15, 28, 34, 22, 12, 26, 18, 10, 22, 16, 28];

export const FeedPlaceholderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    posts,
    toggleLikePost,
    toggleSavePost,
    openUserProfile,
  } = useApp();

  const [containerHeight, setContainerHeight] = useState<number>(
    WINDOW_HEIGHT - (Platform.OS === 'ios' ? 88 : 75)
  );
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [activeCritiquePost, setActiveCritiquePost] = useState<CommunityPost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playingStates, setPlayingStates] = useState<Record<string, boolean>>({});
  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});

  // Filter reels based on Search Query, Public visibility, and Media availability
  // (Private community posts are never shown in the public Reels feed)
  const reels = posts.filter((p) => {
    // Only public videos appear in Reels feed
    if (p.isPrivate) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = (p.videoTitle || '').toLowerCase().includes(q);
      const matchesContent = p.content.toLowerCase().includes(q);
      const matchesAuthor = p.authorName.toLowerCase().includes(q);
      const matchesTag = (p.tag || '').toLowerCase().includes(q);
      const matchesCommunity = p.communityName.toLowerCase().includes(q);
      if (!matchesTitle && !matchesContent && !matchesAuthor && !matchesTag && !matchesCommunity) {
        return false;
      }
    }

    return true;
  });

  const togglePlayPause = (id: string) => {
    setPlayingStates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShare = async (post: CommunityPost) => {
    try {
      await Share.share({
        message: `Check out this practice reel by ${post.authorName} on Lernex: "${post.videoTitle || post.content.substring(0, 50)}"`,
      });
    } catch {
      Alert.alert('Share', 'Share link copied to clipboard! 🔗');
    }
  };

  const handleToggleFollow = (authorName: string) => {
    setFollowedAuthors((prev) => {
      const next = !prev[authorName];
      Alert.alert(
        next ? 'Connected! ✨' : 'Unfollowed',
        next
          ? `You are now following ${authorName}. You'll see their practice takes first.`
          : `Removed ${authorName} from followed peers.`
      );
      return { ...prev, [authorName]: next };
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveReelIndex(viewableItems[0].index || 0);
    }
  }).current;

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 200) setContainerHeight(h);
      }}
    >
      {/* Top Floating Glass Header */}
      <View style={[styles.floatingHeader, { paddingTop: Math.max(insets.top, spacing.xs) }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.reelsMainTitle}>Reels</Text>
            <LinearGradient
              colors={['#F43F5E', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.liveFeedPill}
            >
              <View style={styles.livePulseDot} />
              <Text style={styles.liveFeedPillText}>Live Practice</Text>
            </LinearGradient>
          </View>

          {/* Right Header Actions */}
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsSearchOpen(!isSearchOpen)}
              style={[styles.headerIconBtn, isSearchOpen && styles.headerIconBtnActive]}
            >
              <Ionicons
                name={isSearchOpen ? 'close' : 'search'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsMuted(!isMuted)}
              style={styles.headerIconBtn}
            >
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Search Input */}
        {isSearchOpen && (
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={16} color="#94A3B8" style={{ marginLeft: 10 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search reels by skill, mentor, #tag, or topic..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
                <Ionicons name="close-circle" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Main Reels Vertical Swiper */}
      {reels.length > 0 ? (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={containerHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item, index }) => {
            const isPaused = playingStates[item.id] || false;
            const isSaved = !!item.isSaved;
            const isFollowing = followedAuthors[item.authorName];
            const mentorCritique = item.comments?.find((c) => c.isMentorCritique || c.commentType === 'mentor');
            const generalCount = item.generalCommentsCount || item.comments?.filter((c) => !c.isMentorCritique).length || 0;
            const mentorCritiqueCount = item.mentorCritiqueCount || item.comments?.filter((c) => c.isMentorCritique).length || 0;

            return (
              <View style={[styles.reelContainer, { height: containerHeight }]}>
                {/* Background Video Media / Thumbnail */}
                <Image
                  source={{
                    uri:
                      item.videoThumbnail ||
                      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&auto=format&fit=crop&q=80',
                  }}
                  style={styles.reelMediaImage}
                  resizeMode="cover"
                />

                {/* Cinematic Vignette Gradients */}
                <LinearGradient
                  colors={['rgba(15, 23, 42, 0.65)', 'transparent', 'rgba(15, 23, 42, 0.95)']}
                  style={styles.vignetteOverlay}
                />

                {/* Center Tap to Play/Pause Area */}
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => togglePlayPause(item.id)}
                  style={styles.playPauseTouchArea}
                >
                  {isPaused && (
                    <View style={styles.pausedCenterIconCircle}>
                      <Ionicons name="play" size={36} color="#FFFFFF" style={{ marginLeft: 3 }} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* ================= RIGHT ACTION DOCK (INSTAGRAM REELS STYLE) ================= */}
                <View style={styles.actionDock}>
                  {/* Author Avatar with Follow Pill */}
                  <View style={styles.avatarDockItem}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() =>
                        openUserProfile({
                          name: item.authorName,
                          avatarUrl: item.authorAvatar,
                          role: item.authorRole,
                          specialty: item.authorSkill,
                          badge: item.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                        })
                      }
                      style={styles.dockAvatarBorder}
                    >
                      <Avatar
                        uri={item.authorAvatar}
                        name={item.authorName}
                        size={46}
                        showRing={item.authorRole === 'Mentor'}
                      />
                    </TouchableOpacity>

                    {item.authorRole !== 'Mentor' && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleToggleFollow(item.authorName)}
                        style={[styles.followPlusBtn, isFollowing && styles.followPlusBtnActive]}
                      >
                        <Ionicons
                          name={isFollowing ? 'checkmark' : 'add'}
                          size={13}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Like Button */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleLikePost(item.id)}
                    style={styles.dockBtn}
                  >
                    <View style={[styles.dockIconCircle, item.isLiked && styles.dockIconLikedCircle]}>
                      <Ionicons
                        name={item.isLiked ? 'heart' : 'heart-outline'}
                        size={25}
                        color={item.isLiked ? '#EF4444' : '#FFFFFF'}
                      />
                    </View>
                    <Text style={[styles.dockCountText, item.isLiked && styles.dockCountLikedText]}>
                      {item.likesCount}
                    </Text>
                  </TouchableOpacity>

                  {/* Comment & Critique Button (Dual Type Trigger) */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setActiveCritiquePost(item)}
                    style={styles.dockBtn}
                  >
                    <View style={styles.dockIconCircle}>
                      <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
                      {mentorCritiqueCount > 0 && (
                        <View style={styles.mentorMiniBadge}>
                          <Ionicons name="star" size={9} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.dockCountText}>{item.commentsCount || 0}</Text>
                    {mentorCritiqueCount > 0 && (
                      <Text style={styles.mentorMiniSub}>{mentorCritiqueCount} ★</Text>
                    )}
                  </TouchableOpacity>

                  {/* Save / Bookmark Button */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      toggleSavePost(item.id);
                      Alert.alert(
                        !isSaved ? 'Saved to Vault 🔖' : 'Removed from Vault',
                        !isSaved
                          ? 'This practice reel was saved to your private library.'
                          : 'Removed from your saved collection.'
                      );
                    }}
                    style={styles.dockBtn}
                  >
                    <View style={[styles.dockIconCircle, isSaved && styles.dockIconSavedCircle]}>
                      <Ionicons
                        name={isSaved ? 'bookmark' : 'bookmark-outline'}
                        size={23}
                        color={isSaved ? '#F59E0B' : '#FFFFFF'}
                      />
                    </View>
                    <Text style={[styles.dockCountText, isSaved && { color: '#F59E0B' }]}>
                      {isSaved ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>

                  {/* Share Button */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleShare(item)}
                    style={styles.dockBtn}
                  >
                    <View style={styles.dockIconCircle}>
                      <Ionicons name="paper-plane" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.dockCountText}>Share</Text>
                  </TouchableOpacity>

                  {/* Spinning Vinyl Audio Record */}
                  <View style={styles.spinningVinylBox}>
                    <LinearGradient
                      colors={['#1E293B', '#0F172A']}
                      style={styles.vinylCircle}
                    >
                      <Avatar
                        uri={item.authorAvatar}
                        name={item.authorName}
                        size={22}
                        showRing={false}
                      />
                    </LinearGradient>
                  </View>
                </View>

                {/* ================= BOTTOM LEFT CONTENT & PRACTICE OVERLAY ================= */}
                <View
                  style={[
                    styles.bottomContentOverlay,
                    { paddingBottom: Math.max(insets.bottom + 75, 95) },
                  ]}
                >
                  {/* Origin Community Pill */}
                  <View style={styles.commPillRow}>
                    <View style={styles.commOriginPill}>
                      <Ionicons name="people" size={11} color="#4F46E5" />
                      <Text style={styles.commOriginText} numberOfLines={1}>
                        {item.communityName}
                      </Text>
                    </View>

                    <View style={styles.reelTagPill}>
                      <Text style={styles.reelTagText}>{item.tag || '#Practice'}</Text>
                    </View>
                  </View>

                  {/* Author Handle & Role */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      openUserProfile({
                        name: item.authorName,
                        avatarUrl: item.authorAvatar,
                        role: item.authorRole,
                        specialty: item.authorSkill,
                        badge: item.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                      })
                    }
                    style={styles.authorHandleRow}
                  >
                    <Text style={styles.authorNameReels}>{item.authorName}</Text>
                    {item.authorRole === 'Mentor' ? (
                      <View style={styles.mentorVerifiedChip}>
                        <Ionicons name="star" size={10} color="#7C3AED" />
                        <Text style={styles.mentorVerifiedChipText}>Verified Mentor</Text>
                      </View>
                    ) : (
                      <View style={styles.learnerChip}>
                        <Text style={styles.learnerChipText}>Learner</Text>
                      </View>
                    )}
                    <Text style={styles.timeAgoReels}>• {item.timeAgo}</Text>
                  </TouchableOpacity>

                  {/* Reel Video Title */}
                  {item.videoTitle && (
                    <Text style={styles.videoTitleReels} numberOfLines={1}>
                      {item.videoTitle}
                    </Text>
                  )}

                  {/* Post Caption / Question */}
                  <Text style={styles.captionReels} numberOfLines={2}>
                    {item.content}
                  </Text>

                  {/* Inline Verified Mentor Critique Highlight (If reviewed) */}
                  {mentorCritique && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setActiveCritiquePost(item)}
                      style={styles.mentorCritiquePreviewBox}
                    >
                      <View style={styles.mentorPreviewTop}>
                        <View style={styles.mentorPreviewBadge}>
                          <Ionicons name="star" size={11} color="#D97706" />
                          <Text style={styles.mentorPreviewBadgeText}>
                            MENTOR CRITIQUE ({mentorCritique.mentorRating || 5}.0 ★)
                          </Text>
                        </View>
                        <Text style={styles.watchFixPrompt}>Tap to Watch Fix ▶</Text>
                      </View>
                      <Text style={styles.mentorPreviewText} numberOfLines={1}>
                        "{mentorCritique.text}"
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Audio Track & Dynamic Waveform Bar */}
                  <View style={styles.audioWaveformRow}>
                    <Ionicons name="musical-note" size={12} color="#38BDF8" />
                    <Text style={styles.audioTrackName} numberOfLines={1}>
                      Original Practice Audio • {item.authorName} ({item.videoDuration || '0:45'})
                    </Text>

                    {/* Mini Waveform Bars */}
                    <View style={styles.miniWaveformBars}>
                      {WAVEFORM_HEIGHTS.slice(0, 10).map((h, i) => (
                        <View
                          key={i}
                          style={[
                            styles.miniWaveBar,
                            { height: isPaused ? 4 : (h % 14) + 4 },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
        />
      ) : (
        /* Empty State for Reel Filter */
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-off-outline" size={44} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No practice reels found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting or clearing your search term.
          </Text>
          {searchQuery.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSearchQuery('')}
              style={styles.resetFilterBtn}
            >
              <Text style={styles.resetFilterBtnText}>Clear Search</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Dual-Type Comment & Critique Modal */}
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
    backgroundColor: '#0F172A',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xs,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reelsMainTitle: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  liveFeedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveFeedPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: {
    backgroundColor: '#4F46E5',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  categoryChipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  catChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  catChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  catChipTextActive: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  reelMediaImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  vignetteOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  playPauseTouchArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedCenterIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  actionDock: {
    position: 'absolute',
    right: 12,
    bottom: 115,
    alignItems: 'center',
    gap: 14,
    zIndex: 10,
  },
  avatarDockItem: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  dockAvatarBorder: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 25,
    padding: 1,
  },
  followPlusBtn: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#EC4899',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  followPlusBtnActive: {
    backgroundColor: '#10B981',
  },
  dockBtn: {
    alignItems: 'center',
    gap: 2,
  },
  dockIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dockIconLikedCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  dockIconSavedCircle: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  mentorMiniBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#7C3AED',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dockCountText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dockCountLikedText: {
    color: '#EF4444',
  },
  mentorMiniSub: {
    fontSize: 9,
    color: '#C084FC',
    fontWeight: 'bold',
  },
  spinningVinylBox: {
    marginTop: 4,
  },
  vinylCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  bottomContentOverlay: {
    position: 'absolute',
    left: 14,
    right: 80,
    bottom: 0,
    gap: 6,
    zIndex: 10,
  },
  commPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commOriginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 4,
    maxWidth: '70%',
  },
  commOriginText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  reelTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  reelTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  authorHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorNameReels: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mentorVerifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  mentorVerifiedChipText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  learnerChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  learnerChipText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  timeAgoReels: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  videoTitleReels: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captionReels: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 17,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mentorCritiquePreviewBox: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: borderRadius.md,
    padding: 8,
    borderWidth: 1,
    borderColor: '#A855F7',
    marginTop: 2,
    gap: 3,
  },
  mentorPreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mentorPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mentorPreviewBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FDE047',
  },
  watchFixPrompt: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mentorPreviewText: {
    fontSize: 11,
    color: '#FAF5FF',
    fontStyle: 'italic',
  },
  audioWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  audioTrackName: {
    fontSize: 10,
    color: '#94A3B8',
    flex: 1,
  },
  miniWaveformBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 16,
  },
  miniWaveBar: {
    width: 2.5,
    borderRadius: 1,
    backgroundColor: '#38BDF8',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  resetFilterBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    marginTop: 6,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
