import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Share,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useApp } from '../../context/AppContext';
import { Avatar } from './Avatar';
import { MusicAnimation } from './NowPlayingBar';
import { CommentsSheet } from '../community/CommentsSheet';
import { borderRadius } from '../../theme';
import { CommunityPost } from '../../types';

const { width: SCREEN_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

interface ReelViewerModalProps {
  visible: boolean;
  reels: CommunityPost[];
  startIndex?: number;
  onClose: () => void;
}

/**
 * Full-screen, Instagram-style reels viewer shown as a modal. Used when a reel is
 * opened from somewhere other than the Reels tab (e.g. a user's profile) so reels
 * always open in reel format — never as a flat video sheet.
 *
 * Uses ONE shared video player for the whole list (creating a player per item
 * crashes Expo Go). The active reel's video shows through a transparent layer once
 * it is ready; a poster stays up until then for seamless scrolling.
 */
const ReelMedia: React.FC<{
  item: CommunityPost;
  isActive: boolean;
  paused: boolean;
  videoReady: boolean;
  isThisAudioActive: boolean;
  onSingleTap: () => void;
  onDoubleTapLike: () => void;
}> = ({ item, isActive, paused, videoReady, isThisAudioActive, onSingleTap, onDoubleTapLike }) => {
  const isAudioReel = item.postType === 'audio' || (!!item.audioUrl && !item.videoUrl);
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
      onDoubleTapLike();
      popHeart();
    } else {
      lastTap.current = now;
      singleTapTimer.current = setTimeout(() => {
        onSingleTap();
        singleTapTimer.current = null;
      }, 280);
    }
  };

  const showPlayIcon = isActive && (isAudioReel ? !isThisAudioActive : paused);

  return (
    <View style={styles.mediaFill}>
      {showVideo ? null : item.videoThumbnail ? (
        <Image source={{ uri: item.videoThumbnail }} style={styles.mediaImage} resizeMode="cover" />
      ) : isAudioReel ? (
        <View style={[styles.mediaImage, styles.audioBg]}>
          <MusicAnimation active={isThisAudioActive} live={isThisAudioActive} size={120} />
        </View>
      ) : (
        <LinearGradient colors={['#312E81', '#7C3AED', '#DB2777']} style={styles.mediaImage}>
          <View style={styles.posterCenter}>
            <Ionicons name="play-circle" size={72} color="rgba(255,255,255,0.9)" />
          </View>
        </LinearGradient>
      )}

      <LinearGradient
        colors={['rgba(15, 23, 42, 0.55)', 'transparent', 'rgba(15, 23, 42, 0.92)']}
        style={styles.vignette}
        pointerEvents="none"
      />

      <Pressable style={styles.mediaFill} onPress={onTap} />

      {showPlayIcon && (
        <View style={styles.playPauseArea} pointerEvents="none">
          <View style={styles.pausedCircle}>
            <Ionicons name="play" size={36} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}

      <View style={styles.heartOverlay} pointerEvents="none">
        <Animated.View style={{ transform: [{ scale: heartScale }], opacity: heartScale }}>
          <Ionicons name="heart" size={120} color="#FFFFFF" />
        </Animated.View>
      </View>
    </View>
  );
};

export const ReelViewerModal: React.FC<ReelViewerModalProps> = ({
  visible,
  reels,
  startIndex = 0,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const {
    toggleLikePost,
    toggleSavePost,
    pressRepost,
    playAudioPost,
    closeAudioPost,
    toggleAudioPlayback,
    audioPost,
    isAudioPlaying,
    recordPostView,
    posts,
    reels: allReels,
  } = useApp();

  const listRef = useRef<FlatList<CommunityPost>>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);

  const viewedIds = useRef<Set<string>>(new Set());
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });

  // Always render the freshest copy of each reel so likes/saves reflect instantly.
  const data = React.useMemo(
    () =>
      reels.map(
        (r) => posts.find((p) => p.id === r.id) ?? allReels.find((p) => p.id === r.id) ?? r
      ),
    [reels, posts, allReels]
  );

  const [containerHeight, setContainerHeight] = useState<number>(WINDOW_HEIGHT);

  // Jump to the requested reel when the viewer opens.
  useEffect(() => {
    if (visible) {
      setActiveIndex(startIndex);
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({ index: startIndex, animated: false });
        } catch {
          /* ignore */
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, startIndex]);

  const activeReel = data[activeIndex];
  const activeIsAudio =
    !!activeReel && (activeReel.postType === 'audio' || (!!activeReel.audioUrl && !activeReel.videoUrl));
  const isThisAudioActive = !!activeReel && audioPost?.id === activeReel.id && isAudioPlaying;

  // Drive the shared player from the active reel while the viewer is open.
  useEffect(() => {
    if (!visible) return;
    const active = data[activeIndex];
    if (!active) return;
    const isAudio = active.postType === 'audio' || (!!active.audioUrl && !active.videoUrl);
    setIsVideoPaused(false);
    setVideoReady(false);

    if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    if (!viewedIds.current.has(active.id)) {
      viewTimerRef.current = setTimeout(() => {
        viewedIds.current.add(active.id);
        void recordPostView(active.id);
      }, 2500);
    }

    let cancelled = false;
    let sub: { remove: () => void } | null = null;

    if (isAudio) {
      setVideoReady(true);
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      if (active.audioUrl) playAudioPost(active);
    } else if (active.videoUrl) {
      closeAudioPost();
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
  }, [activeIndex, visible, data.length]);

  // Keep mute in sync.
  useEffect(() => {
    try {
      player.muted = isMuted;
    } catch {
      /* ignore */
    }
  }, [isMuted, player]);

  // Pause + release audio when the viewer closes.
  useEffect(() => {
    if (!visible) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      closeAudioPost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

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

  const handleShare = async (post: CommunityPost) => {
    try {
      await Share.share({
        message: `Check out this reel by ${post.authorName} on Lernex: "${post.videoTitle || post.content.substring(0, 50)}"`,
      });
    } catch {
      /* ignore */
    }
  };

  const handleClose = () => {
    try {
      player.pause();
    } catch {
      /* ignore */
    }
    closeAudioPost();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View
        style={styles.container}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 200) setContainerHeight(h);
        }}
      >
        {/* Persistent shared video layer (shows through the active reel) */}
        <VideoView
          player={player}
          style={styles.bgVideo}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />

        {/* Header: close + mute */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reels</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setIsMuted((m) => !m)} style={styles.headerBtn}>
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {data.length > 0 ? (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(item) => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={containerHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            initialScrollIndex={startIndex}
            getItemLayout={(_, index) => ({
              length: containerHeight,
              offset: containerHeight * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                try {
                  listRef.current?.scrollToIndex({ index, animated: false });
                } catch {
                  /* ignore */
                }
              }, 120);
            }}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            renderItem={({ item, index }) => {
              const isActive = index === activeIndex;
              const audioActive = audioPost?.id === item.id && isAudioPlaying;
              return (
                <View style={[styles.reelContainer, { height: containerHeight }]}>
                  <ReelMedia
                    item={item}
                    isActive={isActive}
                    paused={isVideoPaused}
                    videoReady={isActive && videoReady}
                    isThisAudioActive={audioActive}
                    onSingleTap={toggleActivePause}
                    onDoubleTapLike={() => {
                      if (!item.isLiked) toggleLikePost(item.id);
                    }}
                  />

                  {/* Right action dock */}
                  <View style={styles.actionDock}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => toggleLikePost(item.id)} style={styles.dockBtn}>
                      <View style={[styles.dockIconCircle, item.isLiked && styles.dockLiked]}>
                        <Ionicons name={item.isLiked ? 'heart' : 'heart-outline'} size={25} color={item.isLiked ? '#EF4444' : '#FFFFFF'} />
                      </View>
                      <Text style={styles.dockText}>{item.likesCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} onPress={() => setCommentsPost(item)} style={styles.dockBtn}>
                      <View style={styles.dockIconCircle}>
                        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
                      </View>
                      <Text style={styles.dockText}>{item.commentsCount || 0}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} onPress={() => toggleSavePost(item.id)} style={styles.dockBtn}>
                      <View style={[styles.dockIconCircle, item.isSaved && styles.dockSaved]}>
                        <Ionicons name={item.isSaved ? 'bookmark' : 'bookmark-outline'} size={23} color={item.isSaved ? '#F59E0B' : '#FFFFFF'} />
                      </View>
                      <Text style={styles.dockText}>{item.isSaved ? 'Saved' : 'Save'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} onPress={() => pressRepost(item)} style={styles.dockBtn}>
                      <View style={[styles.dockIconCircle, item.isReposted && styles.dockReposted]}>
                        <MaterialCommunityIcons name="repeat" size={24} color={item.isReposted ? '#16A34A' : '#FFFFFF'} />
                      </View>
                      <Text style={styles.dockText}>{item.repostsCount ?? 0}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleShare(item)} style={styles.dockBtn}>
                      <View style={styles.dockIconCircle}>
                        <Ionicons name="paper-plane" size={22} color="#FFFFFF" />
                      </View>
                      <Text style={styles.dockText}>Share</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bottom caption */}
                  <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}>
                    <View style={styles.authorRow}>
                      <Avatar uri={item.authorAvatar} name={item.authorName} size={38} showRing={item.authorRole === 'Mentor'} />
                      <Text style={styles.authorName}>{item.authorName}</Text>
                      <Text style={styles.timeAgo}>• {item.timeAgo}</Text>
                    </View>
                    {!!item.videoTitle && (
                      <Text style={styles.reelTitle} numberOfLines={1}>
                        {item.videoTitle}
                      </Text>
                    )}
                    <Text style={styles.caption} numberOfLines={2}>
                      {item.content}
                    </Text>
                    <View style={styles.viewsRow}>
                      <Ionicons name="eye-outline" size={13} color="#E2E8F0" />
                      <Text style={styles.viewsText}>{item.viewsCount ?? 0} views</Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="videocam-off-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyText}>No reels to show.</Text>
          </View>
        )}

        <CommentsSheet visible={!!commentsPost} post={commentsPost} onClose={() => setCommentsPost(null)} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  bgVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  mediaFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mediaImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  audioBg: { backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center' },
  posterCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  playPauseArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  heartOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pausedCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  reelContainer: { width: SCREEN_WIDTH, position: 'relative', backgroundColor: 'transparent' },
  actionDock: { position: 'absolute', right: 12, bottom: 120, alignItems: 'center', gap: 16, zIndex: 10 },
  dockBtn: { alignItems: 'center', gap: 3 },
  dockIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockLiked: { backgroundColor: 'rgba(239, 68, 68, 0.25)' },
  dockSaved: { backgroundColor: 'rgba(245, 158, 11, 0.25)' },
  dockReposted: { backgroundColor: 'rgba(22, 163, 74, 0.28)' },
  dockText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomOverlay: { position: 'absolute', left: 14, right: 80, bottom: 0, gap: 6, zIndex: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeAgo: { fontSize: 11, color: '#CBD5E1' },
  reelTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  caption: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 17,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  viewsText: { fontSize: 11, color: '#E2E8F0', fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: '#94A3B8' },
});
