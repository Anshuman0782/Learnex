import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CommunityPost } from '../../types';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface RecentVideosSectionProps {
  posts: CommunityPost[];
  onVideoPress?: (post: CommunityPost) => void;
  onLikePress?: (postId: string) => void;
  onExploreMorePress?: () => void;
}

export const RecentVideosSection: React.FC<RecentVideosSectionProps> = ({
  posts,
  onVideoPress,
  onLikePress,
  onExploreMorePress,
}) => {
  const { openUserProfile } = useApp();
  const videoPosts = posts
    .filter((p) => p.postType === 'video' || !!p.videoThumbnail)
    .slice(0, 2);

  const handlePlayVideo = (post: CommunityPost) => {
    if (onVideoPress) {
      onVideoPress(post);
    } else {
      Alert.alert(
        'Practice Video ▶',
        `Playing "${post.videoTitle || post.content.substring(0, 40)}..."`
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>Recent Clips</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>2 New</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onExploreMorePress}
          style={styles.exploreAllBtn}
        >
          <Text style={styles.exploreAllText}>See All</Text>
          <Ionicons name="chevron-forward" size={13} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* List of Recent Videos */}
      <View style={styles.videosList}>
        {videoPosts.map((post) => {
          const title = post.videoTitle || post.content.split('.')[0];
          const hasMentorCritique = (post.mentorCritiqueCount || 0) > 0;

          return (
            <View key={post.id} style={[styles.videoCard, shadows.card]}>
              {/* Video Thumbnail */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handlePlayVideo(post)}
                style={styles.thumbnailContainer}
              >
                <Image
                  source={{
                    uri:
                      post.videoThumbnail ||
                      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600',
                  }}
                  style={styles.thumbnailImage}
                />

                <LinearGradient
                  colors={['rgba(15, 23, 42, 0.45)', 'transparent', 'rgba(15, 23, 42, 0.92)']}
                  style={styles.thumbnailOverlay}
                >
                  {/* Top Floating Row */}
                  <View style={styles.topRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openUserProfile({
                          name: post.authorName,
                          avatarUrl: post.authorAvatar,
                          role: post.authorRole,
                          specialty: post.authorSkill,
                          badge: post.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                        });
                      }}
                      style={styles.authorFloatingChip}
                    >
                      <Avatar
                        uri={post.authorAvatar}
                        name={post.authorName}
                        size={22}
                        showRing={false}
                      />
                      <Text style={styles.authorChipName} numberOfLines={1}>
                        {post.authorName.split(' ')[0]}
                      </Text>
                      {post.authorRole === 'Mentor' && (
                        <View style={styles.mentorCheckPill}>
                          <Ionicons name="checkmark-circle" size={12} color="#7C3AED" />
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.durationPill}>
                      <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                      <Text style={styles.durationPillText}>
                        {post.videoDuration || '0:45'}
                      </Text>
                    </View>
                  </View>

                  {/* Center Play Button */}
                  <View style={styles.centerPlayHalo}>
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      style={styles.playButtonCircle}
                    >
                      <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    </LinearGradient>
                  </View>

                  {/* Bottom Overlay Info */}
                  <View style={styles.bottomInfoRow}>
                    <View style={styles.bottomLeftCol}>
                      <Text style={styles.videoTitleText} numberOfLines={1}>
                        {title}
                      </Text>
                      <View style={styles.bottomBadgesRow}>
                        <Text style={styles.tagBadgeText}>{post.tag?.split(' ')[0] || '#Clip'}</Text>
                        {hasMentorCritique && (
                          <View style={styles.critiqueStatusPill}>
                            <Ionicons name="sparkles" size={10} color="#FDE047" />
                            <Text style={styles.critiqueStatusText}>Mentor Reviewed</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Bottom Interactive Bar */}
              <View style={styles.actionStatsBar}>
                <View style={styles.statsLeft}>
                  {/* Views */}
                  <View style={styles.statPill}>
                    <Ionicons name="eye-outline" size={13} color="#64748B" />
                    <Text style={styles.statValue}>
                      {post.viewsCount ? (post.viewsCount >= 1000 ? `${(post.viewsCount / 1000).toFixed(1)}k` : post.viewsCount) : '1.2k'}
                    </Text>
                  </View>

                  {/* Comments */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onVideoPress?.(post)}
                    style={styles.statPill}
                  >
                    <Ionicons name="chatbubble-outline" size={13} color="#4F46E5" />
                    <Text style={[styles.statValue, { color: '#4F46E5' }]}>
                      {post.commentsCount}
                    </Text>
                  </TouchableOpacity>

                  {/* Like Button */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onLikePress?.(post.id)}
                    style={[styles.statPill, post.isLiked && styles.statPillLiked]}
                  >
                    <Ionicons
                      name={post.isLiked ? 'heart' : 'heart-outline'}
                      size={14}
                      color={post.isLiked ? '#EF4444' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.statValue,
                        post.isLiked && { color: '#EF4444', fontWeight: 'bold' },
                      ]}
                    >
                      {post.likesCount}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Watch Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handlePlayVideo(post)}
                  style={styles.watchPill}
                >
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.watchGradient}
                  >
                    <Text style={styles.watchText}>Watch</Text>
                    <Ionicons name="play" size={10} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.heavy,
    color: '#15803D',
  },
  exploreAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  exploreAllText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  videosList: {
    gap: spacing.base,
  },
  videoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  thumbnailContainer: {
    height: 165,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: spacing.sm + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorFloatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: borderRadius.full,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  authorChipName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mentorCheckPill: {
    marginLeft: -2,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  durationPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  centerPlayHalo: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomInfoRow: {
    gap: 3,
  },
  bottomLeftCol: {
    gap: 4,
  },
  videoTitleText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  critiqueStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.9)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  critiqueStatusText: {
    fontSize: 9,
    fontWeight: typography.weights.heavy,
    color: '#FFFFFF',
  },
  actionStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statPillLiked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  statValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  watchPill: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  watchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  watchText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
