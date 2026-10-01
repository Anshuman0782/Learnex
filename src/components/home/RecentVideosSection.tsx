import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CommunityPost } from '../../types';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecentVideosSectionProps {
  posts: CommunityPost[];
  onVideoPress?: (post: CommunityPost) => void;
  onLikePress?: (postId: string) => void;
  onExploreMorePress?: () => void;
}

const parseDurationSeconds = (durationStr?: string): number => {
  if (!durationStr) return 45;
  const parts = durationStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return 45;
};

export const RecentVideosSection: React.FC<RecentVideosSectionProps> = ({
  posts,
  onVideoPress,
  onLikePress,
  onExploreMorePress,
}) => {
  const { openUserProfile, toggleSavePost } = useApp();

  const [activeIndex, setActiveIndex] = useState(0); // 0 = Long Videos, 1 = Shorts & Reels
  const horizontalScrollRef = useRef<ScrollView>(null);

  const [followedAuthors, setFollowedAuthors] = useState<Record<string, boolean>>({});

  const allVideoPosts = posts.filter((p) => !p.repostedByName && p.postType === 'video' && !!p.videoUrl);

  const longVideos = allVideoPosts.filter(
    (p) => parseDurationSeconds(p.videoDuration) >= 60
  );

  const shortVideos = allVideoPosts.filter(
    (p) => parseDurationSeconds(p.videoDuration) < 60
  );

  const handleTabPress = (index: number) => {
    setActiveIndex(index);
    horizontalScrollRef.current?.scrollTo({ x: index * (SCREEN_WIDTH - spacing.base * 2), animated: true });
  };

  const handleScroll = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / (SCREEN_WIDTH - spacing.base * 2));
    if (page !== activeIndex && (page === 0 || page === 1)) {
      setActiveIndex(page);
    }
  };

  const handleToggleFollow = (authorName: string) => {
    setFollowedAuthors((prev) => {
      const next = !prev[authorName];
      Alert.alert(
        next ? 'Following' : 'Unfollowed',
        next ? `You are now following ${authorName}.` : `Removed ${authorName} from followed peers.`
      );
      return { ...prev, [authorName]: next };
    });
  };

  const handleShare = async (post: CommunityPost) => {
    try {
      await Share.share({
        message: `Check out this clip by ${post.authorName} on Lernex: "${post.videoTitle || post.content}"`,
      });
    } catch {
      Alert.alert('Share', 'Share link copied! 🔗');
    }
  };

  const handlePlayVideo = (post: CommunityPost) => {
    if (onVideoPress) {
      onVideoPress(post);
    } else {
      Alert.alert('Play Video', `Streaming "${post.videoTitle || post.content.substring(0, 30)}..."`);
    }
  };

  const cardWidth = SCREEN_WIDTH - spacing.base * 2;

  return (
    <View style={styles.container}>
      <View style={styles.videosList}>
        {longVideos.length > 0 ? (
          longVideos.map((post) => {
            const title = post.videoTitle || post.content.split('.')[0];
            const viewsText =
              post.viewsCount && post.viewsCount >= 1000
                ? `${(post.viewsCount / 1000).toFixed(1)}k views`
                : `${post.viewsCount ?? 0} views`;

                  return (
                    <View key={post.id} style={styles.ytCard}>
                      {/* 16:9 Thumbnail Container */}
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => handlePlayVideo(post)}
                        style={styles.ytThumbnailWrapper}
                      >
                        {post.videoThumbnail ? (
                          <Image
                            source={{ uri: post.videoThumbnail }}
                            style={styles.ytThumbnailImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.ytThumbnailImage, { backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="videocam" size={40} color="#334155" />
                          </View>
                        )}

                        {/* YouTube Center Play Icon */}
                        <View style={styles.ytCenterPlayBtn}>
                          <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
                        </View>

                        {/* YouTube Duration Badge at Bottom Right */}
                        <View style={styles.ytDurationBadge}>
                          <Text style={styles.ytDurationBadgeText}>
                            {post.videoDuration || '0:00'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* YouTube Card Metadata Row */}
                      <View style={styles.ytMetaRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            openUserProfile({
                              name: post.authorName,
                              avatarUrl: post.authorAvatar,
                              role: post.authorRole,
                              specialty: post.authorSkill,
                              badge: post.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                            })
                          }
                          style={styles.ytAvatarBox}
                        >
                          <Avatar
                            uri={post.authorAvatar}
                            name={post.authorName}
                            size={38}
                            showRing={post.authorRole === 'Mentor'}
                          />
                        </TouchableOpacity>

                        <View style={styles.ytMetaContent}>
                          <Text style={styles.ytTitleText} numberOfLines={2}>
                            {title}
                          </Text>

                          <View style={styles.ytSubInfoRow}>
                            <Text style={styles.ytAuthorName} numberOfLines={1}>
                              {post.authorName}
                            </Text>
                            {post.authorRole === 'Mentor' && (
                              <Ionicons name="checkmark-circle" size={13} color="#6366F1" />
                            )}
                            <Text style={styles.ytDot}>•</Text>
                            <Text style={styles.ytSubText}>{viewsText}</Text>
                            <Text style={styles.ytDot}>•</Text>
                            <Text style={styles.ytSubText}>{post.timeAgo}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Actions Row */}
                      <View style={styles.ytActionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => onLikePress?.(post.id)}
                          style={[styles.ytActionBtn, post.isLiked && styles.ytActionBtnLiked]}
                        >
                          <Ionicons
                            name={post.isLiked ? 'heart' : 'heart-outline'}
                            size={15}
                            color={post.isLiked ? '#EF4444' : '#64748B'}
                          />
                          <Text style={[styles.ytActionText, post.isLiked && { color: '#EF4444', fontWeight: 'bold' }]}>
                            {post.likesCount}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => onVideoPress?.(post)}
                          style={styles.ytActionBtn}
                        >
                          <Ionicons name="chatbubble-outline" size={14} color="#64748B" />
                          <Text style={styles.ytActionText}>{post.commentsCount}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handlePlayVideo(post)}
                          style={styles.ytWatchBtn}
                        >
                          <Text style={styles.ytWatchBtnText}>Watch Video</Text>
                          <Ionicons name="play-circle-outline" size={15} color="#4F46E5" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="videocam-outline" size={32} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Videos available</Text>
                </View>
              )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  topTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: spacing.base,
  },
  topTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  topTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  topTabTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  activeLine: {
    position: 'absolute',
    bottom: -1,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#4F46E5',
    borderRadius: 1.5,
  },
  videosList: {
    gap: spacing.base,
  },
  // YouTube Cards
  ytCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ytThumbnailWrapper: {
    width: '100%',
    height: 195,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  ytThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  ytCenterPlayBtn: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  ytDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ytDurationBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  ytMetaRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: 12,
  },
  ytAvatarBox: {
    marginTop: 2,
  },
  ytMetaContent: {
    flex: 1,
  },
  ytTitleText: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    lineHeight: 19,
    marginBottom: 4,
  },
  ytSubInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  ytAuthorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  ytDot: {
    fontSize: 11,
    color: '#94A3B8',
  },
  ytSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  ytActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  ytActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  ytActionBtnLiked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  ytActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  ytWatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  ytWatchBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  // Instagram Reels Cards
  reelsList: {
    gap: spacing.base,
  },
  instaReelContainer: {
    height: 480,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  instaReelMedia: {
    width: '100%',
    height: '100%',
  },
  instaVignette: {
    ...StyleSheet.absoluteFill,
  },
  instaCenterPlayTouch: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instaPlayCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  instaRightDock: {
    position: 'absolute',
    right: 12,
    bottom: 24,
    alignItems: 'center',
    gap: 14,
    zIndex: 10,
  },
  dockAvatarBox: {
    position: 'relative',
    marginBottom: 4,
  },
  followPlusBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: '#EC4899',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  followPlusBadgeActive: {
    backgroundColor: '#10B981',
  },
  dockBtn: {
    alignItems: 'center',
    gap: 2,
  },
  dockIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockIconLikedCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  dockIconSavedCircle: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  dockText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  vinylContainer: {
    marginTop: 4,
  },
  vinylRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  instaBottomContent: {
    position: 'absolute',
    left: 14,
    right: 75,
    bottom: 20,
    gap: 4,
    zIndex: 10,
  },
  commTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  commPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  tagPillText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  authorHandle: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    marginTop: 2,
  },
  reelTitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reelCaptionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 15,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  audioText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 6,
  },
});
