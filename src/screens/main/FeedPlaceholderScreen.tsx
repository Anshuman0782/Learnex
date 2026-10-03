import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Platform,
  Share,
  PanResponder,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useVideoFit } from '../../hooks/useVideoFit';
import { useApp } from '../../context/AppContext';
import { followUserRequest, unfollowUserRequest } from '../../api/social.api';
import { Avatar } from '../../components/common/Avatar';
import { MusicAnimation } from '../../components/common/NowPlayingBar';
import { CommentsSheet } from '../../components/community/CommentsSheet';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { CommunityPost } from '../../types';

const { width: SCREEN_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

/**
 * A single reel's media layer (presentational — no video player of its own).
 * The ACTIVE reel binds to a single shared player passed from the screen; every
 * other reel just shows its poster. This avoids spinning up one native player
 * per list item (which crashes on Expo Go). Single tap = pause/play, double tap
 * = like with a heart pop.
 */
const ReelMedia: React.FC<{
  item: CommunityPost;
  isActive: boolean;
  paused: boolean;
  videoReady: boolean;
  onSingleTap: () => void;
}> = ({ item, isActive, paused, videoReady, onSingleTap }) => {
  const { toggleLikePost, audioPost, isAudioPlaying } = useApp();

  const isAudioReel = item.postType === 'audio' || (!!item.audioUrl && !item.videoUrl);
  const isThisAudioActive = audioPost?.id === item.id && isAudioPlaying;
  // The shared screen-level video only shows through once it is actually ready to
  // play. Until then we keep the poster/placeholder up so scrolling between reels
  // is seamless (no black flash / spinner on every reel).
  const showVideo = isActive && !isAudioReel && !!item.videoUrl && videoReady;

  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartScale = useRef(new Animated.Value(0)).current;

  const popHeart = () => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(heartScale, { toValue: 0, delay: 450, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastTap.current = 0;
      if (!item.isLiked) toggleLikePost(item.id);
      popHeart();
    } else {
      lastTap.current = now;
      singleTapTimer.current = setTimeout(() => {
        onSingleTap();
        singleTapTimer.current = null;
      }, 280);
    }
  };

  // Show the center play icon when the active media is paused / not playing.
  const showPlayIcon = isActive && (isAudioReel ? !isThisAudioActive : paused);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Background media. For the ACTIVE video we render nothing here — the
          single screen-level VideoView shows through this transparent area
          (mounting a VideoView per item crashes, so we never do that). */}
      {showVideo ? null : item.videoThumbnail ? (
        <Image source={{ uri: item.videoThumbnail }} style={styles.reelMediaImage} resizeMode="cover" />
      ) : isAudioReel ? (
        <View style={[styles.reelMediaImage, styles.reelAudioBg]}>
          <MusicAnimation active={isThisAudioActive} size={120} />
        </View>
      ) : (
        <View style={[styles.reelMediaImage, styles.reelVideoBg]}>
          <Ionicons name="videocam" size={64} color="#334155" />
        </View>
      )}

      {/* Vignette */}
      <LinearGradient
        colors={['rgba(15, 23, 42, 0.55)', 'transparent', 'rgba(15, 23, 42, 0.92)']}
        style={styles.vignetteOverlay}
        pointerEvents="none"
      />

      {/* Tap layer ON TOP of the video (native video would otherwise eat taps) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} />

      {/* Center play/pause indicator */}
      {showPlayIcon && (
        <View style={styles.playPauseTouchArea} pointerEvents="none">
          <View style={styles.pausedCenterIconCircle}>
            <Ionicons name="play" size={36} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}

      {/* Double-tap heart animation */}
      <View style={styles.heartOverlay} pointerEvents="none">
        <Animated.View style={{ transform: [{ scale: heartScale }], opacity: heartScale }}>
          <Ionicons name="heart" size={120} color="#FFFFFF" />
        </Animated.View>
      </View>
    </View>
  );
};

const WAVEFORM_HEIGHTS = [8, 16, 24, 18, 28, 14, 26, 32, 20, 15, 28, 34, 22, 12, 26, 18, 10, 22, 16, 28];

export const FeedPlaceholderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    reels: reelsData,
    loadReels,
    user,
    toggleLikePost,
    toggleSavePost,
    pressRepost,
    playAudioPost,
    closeAudioPost,
    toggleAudioPlayback,
    openUserProfile,
    recordPostView,
  } = useApp();

  // Reels whose view has already been counted this session (avoid double counting).
  const viewedReelIds = useRef<Set<string>>(new Set());
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real follow state keyed by the author's user id.
  // Local overrides on top of the server's `authorFollowed` (after a tap).
  const [followedIds, setFollowedIds] = useState<Record<string, boolean>>({});
  // Just followed → show a ✓ briefly, then the button disappears (Instagram-style).
  const [justFollowed, setJustFollowed] = useState<Record<string, boolean>>({});
  // Reels whose long description is expanded ("more").
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const tabBarHeight = useBottomTabBarHeight();
  // Gentle slide-in each time Reels opens (pairs with Home's swipe-out).
  const enterAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      enterAnim.setValue(0);
      Animated.timing(enterAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
    return unsub;
  }, [navigation, enterAnim]);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
        setToast(null),
      );
    }, 2200);
  };

  const handleFollowAuthor = async (item: CommunityPost) => {
    if (!item.authorId) {
      Alert.alert('Unavailable', 'This creator can’t be followed from here yet.');
      return;
    }
    if (item.authorId === user?.id) {
      showToast("That's you 🙂");
      return;
    }
    const currently = followedIds[item.authorId] ?? !!item.authorFollowed;
    const next = !currently;
    setFollowedIds((prev) => ({ ...prev, [item.authorId as string]: next }));
    if (next) {
      const id = item.authorId as string;
      setJustFollowed((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => setJustFollowed((prev) => ({ ...prev, [id]: false })), 1500);
    }
    showToast(next ? `You're now following ${item.authorName}` : `Unfollowed ${item.authorName}`);
    try {
      if (next) await followUserRequest(item.authorId);
      else await unfollowUserRequest(item.authorId);
    } catch {
      // revert on failure
      setFollowedIds((prev) => ({ ...prev, [item.authorId as string]: currently }));
      showToast('Could not update follow. Try again.');
    }
  };

  // ONE shared video player for the whole reels feed (only the active reel uses
  // it). Creating a player per item crashes Expo Go, so we never do that.
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  // True once the active video reel is decoded and showing frames.
  const [videoReady, setVideoReady] = useState(false);

  // Refresh the shorts feed when this tab mounts.
  useEffect(() => {
    void loadReels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PanResponder for smooth screen swiping gesture (Slide Right -> Switch to Home)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 35 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          navigation.navigate('HomeTab');
        }
      },
    })
  ).current;

  const [containerHeight, setContainerHeight] = useState<number>(
    WINDOW_HEIGHT - (Platform.OS === 'ios' ? 88 : 75)
  );
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // The Reels feed is server-provided shorts (isShort=true) that are public.
  const reels = reelsData.filter((p) => !p.isPrivate);

  const handleShare = async (post: CommunityPost) => {
    try {
      await Share.share({
        message: `Check out this practice reel by ${post.authorName} on Lernex: "${post.videoTitle || post.content.substring(0, 50)}"`,
      });
    } catch {
      Alert.alert('Share', 'Share link copied to clipboard! 🔗');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveReelIndex(viewableItems[0].index || 0);
    }
  }).current;

  const activeReel = reels[activeReelIndex];
  // Vertical videos fill the screen; other shapes show whole (never cropped).
  const videoFit = useVideoFit(player, activeReel?.videoUrl);
  const activeIsAudio =
    !!activeReel && (activeReel.postType === 'audio' || (!!activeReel.audioUrl && !activeReel.videoUrl));

  // Drive the single shared player from the active reel.
  useEffect(() => {
    const active = reels[activeReelIndex];
    if (!active) return;
    const isAudio = active.postType === 'audio' || (!!active.audioUrl && !active.videoUrl);
    setIsVideoPaused(false);
    setVideoReady(false);

    // Count a view after the reel has been on screen for ~2.5s (once per session).
    if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    if (!viewedReelIds.current.has(active.id)) {
      viewTimerRef.current = setTimeout(() => {
        viewedReelIds.current.add(active.id);
        void recordPostView(active.id);
      }, 2500);
    }

    let cancelled = false;
    let sub: { remove: () => void } | null = null;

    if (isAudio) {
      setVideoReady(true); // audio reels show their art immediately
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      if (active.audioUrl) playAudioPost(active);
    } else if (active.videoUrl) {
      closeAudioPost(); // stop any audio when a video reel is shown
      sub = player.addListener('statusChange', ({ status }) => {
        if (cancelled) return;
        if (status === 'readyToPlay') {
          setVideoReady(true);
          try {
            player.play();
          } catch {
            /* ignore */
          }
        }
      });
      (async () => {
        try {
          await player.replaceAsync(active.videoUrl!);
          player.muted = isMuted;
          if (!cancelled) player.play();
        } catch {
          /* ignore */
        }
      })();
    } else {
      setVideoReady(true);
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    }

    return () => {
      cancelled = true;
      if (sub) sub.remove();
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReelIndex, reels.length]);

  // Keep the shared player's mute in sync with the header toggle.
  useEffect(() => {
    try {
      player.muted = isMuted;
    } catch {
      /* ignore */
    }
  }, [isMuted, player]);

  // Stop playback when leaving the Reels tab.
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      setIsVideoPaused(true);
    });
    return unsub;
  }, [navigation, player]);

  const toggleActivePause = () => {
    if (activeIsAudio) {
      toggleAudioPlayback();
      return;
    }
    setIsVideoPaused((prev) => {
      const next = !prev;
      try {
        if (next) player.pause();
        else player.play();
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: enterAnim,
          transform: [{ translateX: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        },
      ]}
      {...panResponder.panHandlers}
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
          </View>

          {/* Right Header Actions */}
          <View style={styles.headerRightActions}>
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
      </View>

      {/* Top follow/action toast */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              top: Math.max(insets.top, 12) + 54,
              opacity: toastAnim,
              transform: [
                { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}

      {/* Single persistent video layer (behind the list). Only the active video
          reel is transparent, so this shows through there. Never unmounts → no
          per-item VideoView crash. */}
      <VideoView
        player={player}
        style={styles.reelBgVideo}
        contentFit={videoFit}
        nativeControls={false}
        pointerEvents="none"
      />

      {/* Main Reels Vertical Swiper */}
      {reels.length > 0 ? (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          style={styles.reelList}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={containerHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onLayout={(e) => {
            // Measure the actual list area so each reel fills it exactly (no gap).
            const h = e.nativeEvent.layout.height;
            if (h > 200 && Math.abs(h - containerHeight) > 1) setContainerHeight(h);
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item, index }) => {
            const isSaved = !!item.isSaved;
            const isFollowing = item.authorId
              ? followedIds[item.authorId] ?? !!item.authorFollowed
              : false;
            const showFollow = !isFollowing || (!!item.authorId && !!justFollowed[item.authorId]);
            const isSelfAuthor = !!item.authorId && item.authorId === user?.id;
            const mentorCritique = item.comments?.find((c) => c.isMentorCritique || c.commentType === 'mentor');
            const mentorCritiqueCount = item.mentorCritiqueCount || item.comments?.filter((c) => c.isMentorCritique).length || 0;

            return (
              <View style={[styles.reelContainer, { height: containerHeight }]}>
                {/* Inline autoplay media (tap = pause/play, double-tap = like) */}
                <ReelMedia
                  item={item}
                  isActive={index === activeReelIndex}
                  paused={isVideoPaused}
                  videoReady={index === activeReelIndex && videoReady}
                  onSingleTap={toggleActivePause}
                />

                {/* Soft bottom fade so white text stays readable on bright videos */}
                <LinearGradient
                  pointerEvents="none"
                  colors={['transparent', 'rgba(0,0,0,0.55)']}
                  style={[styles.bottomFade, { height: tabBarHeight + 220 }]}
                />

                {/* ================= RIGHT ACTIONS (Instagram style) ================= */}
                <View style={[styles.actionDock, { bottom: tabBarHeight + 18 }]}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => toggleLikePost(item.id)} style={styles.dockBtn}>
                    <Ionicons name={item.isLiked ? 'heart' : 'heart-outline'} size={30} color={item.isLiked ? '#FF3B5C' : '#FFFFFF'} style={styles.iconShadow} />
                    <Text style={styles.dockCountText}>{item.likesCount}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity activeOpacity={0.7} onPress={() => setCommentsPost(item)} style={styles.dockBtn}>
                    <Ionicons name="chatbubble-outline" size={27} color="#FFFFFF" style={styles.iconShadow} />
                    <Text style={styles.dockCountText}>{item.commentsCount || 0}</Text>
                    {mentorCritiqueCount > 0 && <Text style={styles.mentorMiniSub}>{mentorCritiqueCount} ★</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity activeOpacity={0.7} onPress={() => pressRepost(item)} style={styles.dockBtn}>
                    <MaterialCommunityIcons name="repeat-variant" size={30} color={item.isReposted ? '#4ADE80' : '#FFFFFF'} style={styles.iconShadow} />
                    <Text style={[styles.dockCountText, item.isReposted && { color: '#4ADE80' }]}>{item.repostsCount ?? 0}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity activeOpacity={0.7} onPress={() => handleShare(item)} style={styles.dockBtn}>
                    <Ionicons name="paper-plane-outline" size={26} color="#FFFFFF" style={styles.iconShadow} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      toggleSavePost(item.id);
                      showToast(!isSaved ? 'Saved 🔖' : 'Removed from saved');
                    }}
                    style={styles.dockBtn}
                  >
                    <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={26} color={isSaved ? '#F59E0B' : '#FFFFFF'} style={styles.iconShadow} />
                  </TouchableOpacity>
                </View>

                {/* ================= BOTTOM INFO (Instagram style) ================= */}
                <View style={[styles.bottomContentOverlay, { paddingBottom: tabBarHeight + 14 }]}>
                  {/* Avatar · name · Follow */}
                  <View style={styles.authorRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() =>
                        openUserProfile({
                          id: item.authorId,
                          name: item.authorName,
                          avatarUrl: item.authorAvatar,
                          role: item.authorRole,
                          specialty: item.authorSkill,
                          badge: item.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                        })
                      }
                      style={styles.authorTap}
                    >
                      <Avatar uri={item.authorAvatar} name={item.authorName} size={34} showRing={item.authorRole === 'Mentor'} />
                      <Text style={styles.authorNameReels} numberOfLines={1}>{item.authorName}</Text>
                      {item.authorRole === 'Mentor' && <Ionicons name="checkmark-circle" size={15} color="#A78BFA" />}
                    </TouchableOpacity>
                    {!isSelfAuthor && showFollow && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={isFollowing}
                        onPress={() => handleFollowAuthor(item)}
                        style={[styles.followPill, isFollowing && styles.followPillDone]}
                      >
                        {isFollowing ? (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.followPillText}>Follow</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Title (highlighted) */}
                  {!!item.videoTitle && (
                    <Text style={styles.videoTitleReels} numberOfLines={2}>
                      {item.videoTitle}
                    </Text>
                  )}

                  {/* Description with "more" */}
                  {!!item.content && item.content !== item.videoTitle && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
                    >
                      <Text style={styles.captionReels} numberOfLines={expanded[item.id] ? 8 : 2}>
                        {item.content}
                      </Text>
                      {item.content.length > 90 && (
                        <Text style={styles.moreText}>{expanded[item.id] ? 'less' : 'more'}</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Circle · mentor critique */}
                  <View style={styles.metaRow}>
                    {!!item.communityName && (
                      <View style={styles.circleChip}>
                        <Ionicons name="people" size={11} color="#FFFFFF" />
                        <Text style={styles.circleChipText} numberOfLines={1}>{item.communityName}</Text>
                      </View>
                    )}
                    {mentorCritique && (
                      <TouchableOpacity activeOpacity={0.85} onPress={() => setCommentsPost(item)} style={styles.critiqueChip}>
                        <Ionicons name="star" size={11} color="#FBBF24" />
                        <Text style={styles.critiqueChipText}>Mentor critique · {mentorCritique.mentorRating || 5}.0</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      ) : (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-off-outline" size={44} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No reels yet</Text>
          <Text style={styles.emptySubtitle}>
            Publish a Short from the + tab and it will appear here.
          </Text>
        </View>
      )}

      {/* Comments-only sheet */}
      <CommentsSheet
        visible={!!commentsPost}
        post={commentsPost}
        onClose={() => setCommentsPost(null)}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  reelBgVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  reelList: {
    backgroundColor: 'transparent',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xs,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(22, 163, 74, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    maxWidth: '88%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
    // Transparent so the persistent screen-level video shows through the active reel.
    backgroundColor: 'transparent',
  },
  reelMediaImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  reelAudioBg: {
    backgroundColor: '#1E1B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelVideoBg: {
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vignetteOverlay: {
    ...StyleSheet.absoluteFill,
  },
  playPauseTouchArea: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartOverlay: {
    ...StyleSheet.absoluteFill,
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
    right: 10,
    bottom: 115,
    alignItems: 'center',
    gap: 20,
    zIndex: 10,
  },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5 },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  followPill: { borderWidth: 1.2, borderColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  followPillDone: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'transparent' },
  followPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  moreText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700', marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  circleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: 180,
  },
  circleChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  critiqueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  critiqueChipText: { color: '#FDE68A', fontSize: 11, fontWeight: '700' },
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
  dockIconRepostedCircle: {
    backgroundColor: 'rgba(22, 163, 74, 0.28)',
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
    right: 72,
    bottom: 0,
    gap: 7,
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
    fontSize: 15,
    flexShrink: 1,
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
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captionReels: {
    fontSize: 13.5,
    color: '#F1F5F9',
    lineHeight: 19,
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
