import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Share, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, type VideoPlayer } from 'expo-video';
import { CommunityPost } from '../../types';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { MusicAnimation, AudioWaveform } from '../common/NowPlayingBar';
import { postBackground } from '../../config/postBackgrounds';
import { PhotoCarousel } from '../common/PhotoCarousel';
import { CommentsSheet } from '../community/CommentsSheet';
import { spacing } from '../../theme';

interface PostCardProps {
  post: CommunityPost;
  onPress?: () => void;
  /** @deprecated kept for compatibility — the card has one unified action bar. */
  onLikePress?: () => void;
  onCommentPress?: () => void;
  /** @deprecated kept for compatibility. */
  onCritiquePress?: () => void;
  isLast?: boolean;
  /** @deprecated kept for compatibility. */
  showActions?: boolean;
  /** @deprecated kept for compatibility. */
  showStats?: boolean;
  /** This card is the active (autoplaying) one; binds the shared video player. */
  isActive?: boolean;
  /** Shared video player from the feed (only bound while isActive). */
  player?: VideoPlayer;
  muted?: boolean;
  onToggleMute?: () => void;
  /** When false, keep showing the thumbnail even if active (pre-autoplay delay). */
  videoStarted?: boolean;
}

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Stable small hash so a post always gets the same palette / waveform. */
const hashOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};


/**
 * "Cinematic" feed card (Home + circle feeds).
 * Video: the media is the hero — author + title live on the video itself.
 * Discussion: a bold gradient quote card. Audio: a dark player with a waveform.
 */
export const PostCard: React.FC<PostCardProps> = ({
  post,
  onPress,
  onCommentPress,
  isActive = false,
  player,
  muted = true,
  onToggleMute,
  videoStarted = true,
}) => {
  const {
    openUserProfile,
    playVideo,
    playAudioPost,
    audioPost,
    isAudioPlaying,
    pressRepost,
    toggleLikePost,
    toggleSavePost,
    joinedCommunities,
    toggleCommunityJoin,
  } = useApp();
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [photoComments, setPhotoComments] = React.useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;

  const circleNames = post.communityNames ?? [];
  const primaryCircle = circleNames[0] ?? post.communityName;
  const extraCircles = Math.max(0, circleNames.length - 1);

  const isRepostEntry = !!post.repostedByName;
  const repostCircleJoined = !!post.repostedCircleId && joinedCommunities.includes(post.repostedCircleId);
  const isMentor = post.authorRole === 'Mentor';

  const mentorCritiques = post.comments?.filter((c) => c.isMentorCritique || c.commentType === 'mentor') || [];
  const firstMentorCritique = mentorCritiques[0];

  const photoUrls = post.postType === 'image' ? post.imageUrls ?? [] : [];
  const isPhoto = photoUrls.length > 0;
  const isAudio = !isPhoto && (post.postType === 'audio' || (!!post.audioUrl && !post.videoUrl));
  const hasVideo = !isPhoto && !isAudio && (!!post.videoThumbnail || !!post.videoUrl);
  const isQuote = !isPhoto && !isAudio && !hasVideo;
  const isThisAudioPlaying = audioPost?.id === post.id && isAudioPlaying;
  const isPlayingInline = isActive && !!player && !!post.videoUrl && videoStarted;
  const firstTag = (post.tag || '').split(' ').find(Boolean);
  const seed = hashOf(post.id);
  const palette = postBackground(post.bgStyle);
  const waveform = React.useMemo(
    () => Array.from({ length: 30 }, (_, i) => 6 + (((seed >> (i % 16)) + i * 7) % 20)),
    [seed],
  );

  const openAuthor = () =>
    openUserProfile({
      id: post.authorId,
      name: post.authorName,
      avatarUrl: post.authorAvatar,
      role: post.authorRole,
      specialty: post.authorSkill,
      badge: isMentor ? 'Verified Mentor' : 'Community Member',
    });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${isAudio ? 'audio' : 'post'} by ${post.authorName} on Lernex: "${post.videoTitle || post.content.substring(0, 50)}"`,
      });
    } catch {
      /* ignore */
    }
  };

  const handleLike = () => {
    if (!post.isLiked) {
      likeScale.setValue(0.6);
      Animated.spring(likeScale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }).start();
    }
    toggleLikePost(post.id);
  };

  const handleMediaPress = () => {
    if (onPress) return onPress();
    if (post.videoUrl) playVideo(post.videoUrl);
    else Alert.alert('Video Unavailable', 'This clip is still processing or was not uploaded.');
  };

  const handlePlayAudio = () => {
    if (post.audioUrl) playAudioPost(post);
    else Alert.alert('Audio Unavailable', 'This audio is still processing or was not uploaded.');
  };

  const circleChip = (dark: boolean) => (
    <View style={[styles.circleChip, dark ? styles.circleChipDark : styles.circleChipLight]}>
      <Ionicons name="people" size={11} color={dark ? '#FFFFFF' : '#4F46E5'} />
      <Text style={[styles.circleChipText, { color: dark ? '#FFFFFF' : '#4338CA' }]} numberOfLines={1}>
        {primaryCircle}
      </Text>
      {extraCircles > 0 && (
        <View style={[styles.moreChip, { backgroundColor: dark ? 'rgba(255,255,255,0.3)' : '#4F46E5' }]}>
          <Text style={styles.moreChipText}>+{extraCircles}</Text>
        </View>
      )}
    </View>
  );

  /** Author row for non-video cards (video cards put the author on the media). */
  const authorRow = (
    <View style={styles.authorRow}>
      <TouchableOpacity activeOpacity={0.8} onPress={openAuthor} style={styles.authorTap}>
        <Avatar uri={post.authorAvatar} name={post.authorName} size={38} showRing={isMentor} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameLine}>
            <Text style={styles.authorName} numberOfLines={1}>{post.authorName}</Text>
            {isMentor && <Ionicons name="checkmark-circle" size={14} color="#7C3AED" />}
          </View>
          <Text style={styles.subLine} numberOfLines={1}>
            {post.timeAgo} · {post.isPrivate ? 'Private' : post.authorSkill}
          </Text>
        </View>
      </TouchableOpacity>
      {circleChip(false)}
    </View>
  );

  return (
    <View style={styles.card}>
      {/* Repost attribution */}
      {isRepostEntry && (
        <View style={styles.repostBanner}>
          <View style={styles.repostByRow}>
            <MaterialCommunityIcons name="repeat" size={14} color="#16A34A" />
            <Text style={styles.repostByText} numberOfLines={1}>
              <Text style={styles.repostByName}>{post.repostedByName}</Text> reposted
              {post.repostedCircleName ? ` in ${post.repostedCircleName}` : ''}
            </Text>
            {!!post.repostedCircleId && !repostCircleJoined && (
              <TouchableOpacity activeOpacity={0.85} onPress={() => toggleCommunityJoin(post.repostedCircleId!)} style={styles.repostJoinBtn}>
                <Text style={styles.repostJoinText}>Join</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!post.repostCaption && <Text style={styles.repostCaption}>{post.repostCaption}</Text>}
        </View>
      )}

      {/* ---------- VIDEO: YouTube-style 16:9 ---------- */}
      {hasVideo && (
        <>
          <TouchableOpacity activeOpacity={0.95} onPress={handleMediaPress} style={styles.videoBox}>
            {isPlayingInline ? (
              <VideoView player={player!} style={styles.fill} contentFit="cover" nativeControls={false} pointerEvents="none" />
            ) : post.videoThumbnail ? (
              <Image source={{ uri: post.videoThumbnail }} style={styles.fill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={['#1E1B4B', '#4C1D95']} style={[styles.fill, styles.center]}>
                <Ionicons name="videocam" size={34} color="rgba(255,255,255,0.45)" />
              </LinearGradient>
            )}

            {!isPlayingInline && (
              <View style={styles.centerPlay} pointerEvents="none">
                <Ionicons name="play" size={24} color="#FFFFFF" style={{ marginLeft: 3 }} />
              </View>
            )}

            {!!post.videoDuration && (
              <View style={styles.durationPill} pointerEvents="none">
                <Text style={styles.durationText}>{post.videoDuration}</Text>
              </View>
            )}

            {isActive && !!post.videoUrl && onToggleMute && (
              <TouchableOpacity activeOpacity={0.8} onPress={onToggleMute} style={styles.muteBtn}>
                <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={15} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Under the thumbnail: avatar · title · channel line (YouTube) */}
          <View style={styles.ytMeta}>
            <TouchableOpacity activeOpacity={0.8} onPress={openAuthor}>
              <Avatar uri={post.authorAvatar} name={post.authorName} size={38} showRing={isMentor} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={handleMediaPress} style={{ flex: 1, gap: 3 }}>
              <Text style={styles.ytTitle} numberOfLines={2}>
                {post.videoTitle || post.content}
              </Text>
              <Text style={styles.ytSub} numberOfLines={1}>
                {post.authorName}
                {isMentor ? ' ✓' : ''} · {compact(post.viewsCount ?? 0)} views · {post.timeAgo}
                {post.isPrivate ? ' · Private' : ''}
              </Text>
              <View style={styles.ytChips}>{circleChip(false)}</View>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ---------- PHOTOS: Instagram-style ---------- */}
      {isPhoto && (
        <>
          {authorRow}
          <PhotoCarousel
            urls={photoUrls}
            dotsBelow
            onDoubleTap={() => {
              if (!post.isLiked) handleLike();
            }}
          />
        </>
      )}

      {/* ---------- AUDIO: dark player ---------- */}
      {isAudio && (
        <>
          {authorRow}
          <TouchableOpacity activeOpacity={0.92} onPress={handlePlayAudio} style={styles.audioWrap}>
            <LinearGradient colors={['#0F172A', '#312E81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.audioBox}>
              <View style={styles.audioCover}>
                {post.videoThumbnail ? (
                  <Image source={{ uri: post.videoThumbnail }} style={styles.fill} />
                ) : (
                  <MusicAnimation active={isThisAudioPlaying} live={audioPost?.id === post.id} size={34} />
                )}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.audioTitle} numberOfLines={1}>{post.videoTitle || 'Voice take'}</Text>
                <AudioWaveform heights={waveform} current={audioPost?.id === post.id} playing={isThisAudioPlaying} />
                <Text style={styles.audioSub}>
                  {post.videoDuration ? `${post.videoDuration} · ` : ''}
                  {isThisAudioPlaying ? 'Playing now' : 'Tap to listen'}
                </Text>
              </View>
              <View style={styles.audioPlayBtn}>
                <Ionicons name={isThisAudioPlaying ? 'pause' : 'play'} size={20} color="#312E81" style={!isThisAudioPlaying && { marginLeft: 2 }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* ---------- DISCUSSION: gradient quote ---------- */}
      {isQuote && (
        <>
          {authorRow}
          <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={!onPress} style={styles.quoteWrap}>
            <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quoteBox}>
              <MaterialCommunityIcons name="format-quote-open" size={34} color="rgba(255,255,255,0.45)" />
              <Text
                style={[styles.quoteText, post.content.length > 140 && styles.quoteTextSmall]}
                numberOfLines={descExpanded ? undefined : 7}
              >
                {post.content}
              </Text>
              {!!firstTag && (
                <View style={styles.quoteTag}>
                  <Text style={styles.quoteTagText}>{firstTag}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* ---------- Action bar ---------- */}
      <View style={styles.actionBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={handleLike} style={styles.action}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons name={post.isLiked ? 'heart' : 'heart-outline'} size={24} color={post.isLiked ? '#F43F5E' : '#0F172A'} />
          </Animated.View>
          <Text style={[styles.actionText, post.isLiked && { color: '#F43F5E' }]}>{compact(post.likesCount || 0)}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={isPhoto ? () => setPhotoComments(true) : onCommentPress || onPress} style={styles.action}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#0F172A" />
          <Text style={styles.actionText}>{compact(post.commentsCount ?? post.comments?.length ?? 0)}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => pressRepost(post)} style={styles.action}>
          <MaterialCommunityIcons name="repeat-variant" size={24} color={post.isReposted ? '#16A34A' : '#0F172A'} />
          <Text style={[styles.actionText, post.isReposted && { color: '#16A34A' }]}>{compact(post.repostsCount || 0)}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={handleShare} style={styles.action}>
          <Ionicons name="paper-plane-outline" size={21} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity activeOpacity={0.7} onPress={() => toggleSavePost(post.id)} style={styles.action}>
          <Ionicons name={post.isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color={post.isSaved ? '#F59E0B' : '#0F172A'} />
        </TouchableOpacity>
      </View>

      {/* Photo caption: title + text */}
      {isPhoto && !!(post.videoTitle || post.content) && (
        <TouchableOpacity activeOpacity={0.8} onPress={() => setDescExpanded((v) => !v)} style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={descExpanded ? undefined : 3}>
            <Text style={styles.captionAuthor}>{post.authorName} </Text>
            {post.videoTitle && post.content !== post.videoTitle ? `${post.videoTitle} — ${post.content}` : post.content || post.videoTitle}
          </Text>
        </TouchableOpacity>
      )}

      {/* Caption for media posts (video title is on the media; show the body here) */}
      {!isQuote && !isPhoto && !!post.content && (hasVideo ? !!post.videoTitle : true) && (
        <TouchableOpacity activeOpacity={0.8} onPress={() => setDescExpanded((v) => !v)} style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={descExpanded ? undefined : 2}>
            <Text style={styles.captionAuthor}>{post.authorName} </Text>
            {post.content}
          </Text>
          {!descExpanded && post.content.length > 90 && <Text style={styles.moreText}>more</Text>}
        </TouchableOpacity>
      )}
      {isQuote && post.content.length > 300 && (
        <TouchableOpacity activeOpacity={0.7} onPress={() => setDescExpanded((v) => !v)} style={styles.caption}>
          <Text style={styles.moreText}>{descExpanded ? 'Show less' : 'Read full post'}</Text>
        </TouchableOpacity>
      )}

      {/* Mentor critique highlight */}
      {firstMentorCritique && (
        <TouchableOpacity activeOpacity={0.85} onPress={isPhoto ? () => setPhotoComments(true) : onCommentPress || onPress} style={styles.critique}>
          <View style={styles.critiqueBar} />
          <Avatar uri={firstMentorCritique.authorAvatar} name={firstMentorCritique.authorName} size={28} showRing />
          <View style={{ flex: 1 }}>
            <View style={styles.critiqueHead}>
              <Text style={styles.critiqueName} numberOfLines={1}>{firstMentorCritique.authorName}</Text>
              <View style={styles.critiqueBadge}>
                <Ionicons name="star" size={9} color="#7C3AED" />
                <Text style={styles.critiqueBadgeText}>
                  MENTOR{firstMentorCritique.mentorRating ? ` · ${firstMentorCritique.mentorRating}.0` : ''}
                </Text>
              </View>
            </View>
            <Text style={styles.critiqueText} numberOfLines={2}>{firstMentorCritique.text}</Text>
          </View>
        </TouchableOpacity>
      )}
      {isPhoto && <CommentsSheet visible={photoComments} post={post} onClose={() => setPhotoComments(false)} />}
    </View>
  );
};

const PAD = spacing.base;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    marginBottom: 18,
    padding: 8,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 2,
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Repost
  repostBanner: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 10, gap: 4 },
  repostByRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repostByText: { flex: 1, fontSize: 12, color: '#475569' },
  repostByName: { fontWeight: '800', color: '#0F172A' },
  repostJoinBtn: { backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  repostJoinText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  repostCaption: { fontSize: 13, color: '#334155', lineHeight: 18 },

  // Circle chip
  circleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 170,
  },
  circleChipLight: { backgroundColor: '#EEF2FF' },
  circleChipDark: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  circleChipText: { fontSize: 11, fontWeight: '800', flexShrink: 1 },
  moreChip: { borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  moreChipText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },

  // Author row (audio/quote)
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 10 },
  authorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorName: { fontSize: 14, fontWeight: '800', color: '#0F172A', flexShrink: 1 },
  subLine: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  // Video hero
  videoBox: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0F172A' },
  durationPill: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.78)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  durationText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  ytMeta: { flexDirection: 'row', gap: 10, paddingHorizontal: 6, paddingTop: 12 },
  ytTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', lineHeight: 20 },
  ytSub: { fontSize: 12, color: '#64748B' },
  ytChips: { flexDirection: 'row', marginTop: 4 },
  mediaTop: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mediaAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  mediaName: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', flexShrink: 1 },
  mediaSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.5)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  glassText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  centerPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -27,
    marginLeft: -27,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBottom: { position: 'absolute', left: 14, right: 60, bottom: 14, gap: 8 },
  mediaChips: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mediaTitle: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', lineHeight: 25, letterSpacing: -0.3 },
  muteBtn: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Photos
  photoTopShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 90 },
  photoCircle: { position: 'absolute', left: 12, bottom: 30, right: 60 },

  // Audio
  audioWrap: { borderRadius: 22, overflow: 'hidden' },
  audioBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  audioCover: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  audioTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  audioSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  audioPlayBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  // Quote
  quoteWrap: { borderRadius: 22, overflow: 'hidden' },
  quoteBox: { padding: 18, paddingTop: 12, minHeight: 150, justifyContent: 'center' },
  quoteText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', lineHeight: 28, letterSpacing: -0.2 },
  quoteTextSmall: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  quoteTag: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  quoteTagText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  // Actions
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 13, fontWeight: '800', color: '#0F172A' },

  // Caption
  caption: { paddingHorizontal: 10, paddingBottom: 6 },
  captionText: { fontSize: 13, color: '#334155', lineHeight: 19 },
  captionAuthor: { fontWeight: '800', color: '#0F172A' },
  moreText: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginTop: 2 },

  // Mentor critique
  critique: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 6,
    marginTop: 4,
    marginBottom: 6,
    padding: 10,
    paddingLeft: 14,
    borderRadius: 16,
    backgroundColor: '#F5F3FF',
    overflow: 'hidden',
  },
  critiqueBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#7C3AED' },
  critiqueHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  critiqueName: { fontSize: 12, fontWeight: '800', color: '#0F172A', flexShrink: 1 },
  critiqueBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  critiqueBadgeText: { fontSize: 9, fontWeight: '800', color: '#7C3AED' },
  critiqueText: { fontSize: 12, color: '#475569', lineHeight: 17, marginTop: 2 },
});
