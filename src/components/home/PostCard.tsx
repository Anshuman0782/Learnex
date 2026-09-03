import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CommunityPost } from '../../types';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface PostCardProps {
  post: CommunityPost;
  onPress?: () => void;
  onLikePress?: () => void;
  onCommentPress?: () => void;
  onCritiquePress?: () => void;
  isLast?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onPress,
  onLikePress,
  onCommentPress,
  onCritiquePress,
}) => {
  const { openUserProfile } = useApp();
  const mentorCritiques = post.comments?.filter((c) => c.isMentorCritique || c.commentType === 'mentor') || [];
  const generalComments = post.comments?.filter((c) => !c.isMentorCritique && c.commentType !== 'mentor') || [];
  const firstMentorCritique = mentorCritiques[0];

  const handlePlayVideo = (title: string) => {
    Alert.alert('Playing Video ▶', `Streaming video playback for: "${title}"`);
  };

  return (
    <View style={[styles.card, shadows.soft]}>
      {/* Top Origin Tag & Community Header */}
      <View style={styles.communityHeader}>
        <View style={styles.communityBadge}>
          <Ionicons name="people" size={13} color="#4F46E5" />
          <Text style={styles.communityNameText} numberOfLines={1}>
            {post.communityName}
          </Text>
        </View>

        <View style={styles.headerRightTags}>
          {post.isPrivate ? (
            <View style={styles.privateCircleBadge}>
              <Ionicons name="lock-closed" size={10} color="#B45309" />
              <Text style={styles.privateCircleText}>Circle Only</Text>
            </View>
          ) : (
            <View style={styles.publicBadge}>
              <Ionicons name="globe-outline" size={10} color="#15803D" />
              <Text style={styles.publicBadgeText}>Public</Text>
            </View>
          )}

          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{post.tag || '#Practice'}</Text>
          </View>
        </View>
      </View>

      {/* Author Details (Clickable to show Profile, Stats & Actions) */}
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
        style={styles.authorRow}
      >
        <Avatar
          uri={post.authorAvatar}
          name={post.authorName}
          size={40}
          showRing={post.authorRole === 'Mentor'}
        />

        <View style={styles.authorInfo}>
          <View style={styles.nameLine}>
            <Text style={styles.authorName}>{post.authorName}</Text>
            {post.authorRole === 'Mentor' ? (
              <View style={styles.mentorBadge}>
                <Ionicons name="star" size={9} color="#7C3AED" />
                <Text style={styles.mentorBadgeText}>Mentor</Text>
              </View>
            ) : (
              <View style={styles.learnerBadge}>
                <Text style={styles.learnerBadgeText}>Learner</Text>
              </View>
            )}
          </View>
          <Text style={styles.timeLine}>
            {post.authorSkill} • {post.timeAgo}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Post Title & Content */}
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {post.videoTitle && (
          <Text style={styles.postTitleText} numberOfLines={1}>
            {post.videoTitle}
          </Text>
        )}
        <Text style={styles.content}>{post.content}</Text>
      </TouchableOpacity>

      {/* Video Player Box */}
      {post.videoThumbnail && (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => handlePlayVideo(post.videoTitle || post.content)}
          style={styles.videoBox}
        >
          <Image source={{ uri: post.videoThumbnail }} style={styles.videoThumbnail} />
          <LinearGradient
            colors={['transparent', 'rgba(15, 23, 42, 0.75)']}
            style={styles.videoGradient}
          >
            <View style={styles.playButton}>
              <Ionicons name="play" size={24} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </View>

            <View style={styles.videoBottomLine}>
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={12} color="#FFFFFF" />
                <Text style={styles.videoBadgeText}>
                  Practice Clip ({post.videoDuration || '0:45'})
                </Text>
              </View>
              <Text style={styles.tapToWatchText}>Watch Take ▶</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Inline Verified Mentor Critique Highlight (If Mentor Responded) */}
      {firstMentorCritique && (
        <View style={styles.inlineCritiqueContainer}>
          <View style={styles.inlineCritiqueHeader}>
            <View style={styles.mentorCritiqueTag}>
              <Ionicons name="star" size={11} color="#7C3AED" />
              <Text style={styles.mentorCritiqueTagText}>MENTOR CRITIQUE</Text>
            </View>
            {firstMentorCritique.mentorRating && (
              <View style={styles.starRatingPill}>
                <Ionicons name="star" size={10} color="#D97706" />
                <Text style={styles.starRatingText}>{firstMentorCritique.mentorRating}.0</Text>
              </View>
            )}
            <Text style={styles.critiqueTime}>{firstMentorCritique.timeAgo}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              openUserProfile({
                name: firstMentorCritique.authorName,
                avatarUrl: firstMentorCritique.authorAvatar,
                role: 'Mentor',
                rating: firstMentorCritique.mentorRating || 5.0,
                specialty: firstMentorCritique.critiqueFocus || 'Technique Coach',
                badge: 'Verified Mentor',
              })
            }
            style={styles.mentorInfoRow}
          >
            <Avatar uri={firstMentorCritique.authorAvatar} name={firstMentorCritique.authorName} size={28} showRing />
            <Text style={styles.mentorName}>{firstMentorCritique.authorName}</Text>
          </TouchableOpacity>

          <Text style={styles.critiqueText} numberOfLines={2}>
            {firstMentorCritique.text}
          </Text>

          {/* Mentor Video Demo (if any) */}
          {firstMentorCritique.videoCritiqueThumbnail && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handlePlayVideo(firstMentorCritique.videoCritiqueTitle || 'Mentor Technique Fix')}
              style={styles.mentorVideoThumbnailBox}
            >
              <Image
                source={{ uri: firstMentorCritique.videoCritiqueThumbnail }}
                style={styles.mentorVideoImg}
              />
              <View style={styles.mentorVideoOverlay}>
                <View style={styles.mentorPlayBtn}>
                  <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginLeft: 1 }} />
                </View>
                <View style={styles.mentorVideoMeta}>
                  <Text style={styles.mentorVideoTitle} numberOfLines={1}>
                    {firstMentorCritique.videoCritiqueTitle || 'Mentor Technique Demonstration'}
                  </Text>
                  <Text style={styles.mentorVideoDuration}>
                    {firstMentorCritique.videoCritiqueDuration || '1:15'} • Watch Mentor Fix
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Two Types of Comment Counts Summary */}
      <View style={styles.commentCountsBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onCommentPress || onPress}
          style={styles.countItem}
        >
          <Ionicons name="chatbubbles-outline" size={14} color="#64748B" />
          <Text style={styles.countItemText}>
            {generalComments.length} General {generalComments.length === 1 ? 'Comment' : 'Comments'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onCritiquePress || onPress}
          style={[styles.countItem, styles.critiqueCountItem]}
        >
          <Ionicons name="star" size={13} color="#7C3AED" />
          <Text style={styles.critiqueCountText}>
            {mentorCritiques.length} Mentor {mentorCritiques.length === 1 ? 'Critique' : 'Critiques'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Interaction Footer Actions Bar */}
      <View style={styles.actionsBar}>
        {/* Like Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onLikePress}
          style={[styles.actionBtn, post.isLiked && styles.actionBtnLiked]}
        >
          <Ionicons
            name={post.isLiked ? 'heart' : 'heart-outline'}
            size={16}
            color={post.isLiked ? '#EF4444' : '#64748B'}
          />
          <Text
            style={[
              styles.actionText,
              post.isLiked && { color: '#EF4444', fontWeight: typography.weights.bold },
            ]}
          >
            {post.likesCount}
          </Text>
        </TouchableOpacity>

        <View style={styles.actionSpacer} />

        {/* Comment Action */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onCommentPress || onPress}
          style={styles.commentBtn}
        >
          <Ionicons name="chatbubble-outline" size={14} color="#4F46E5" />
          <Text style={styles.commentBtnText}>Comment</Text>
        </TouchableOpacity>

        {/* Mentor Critique Action */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onCritiquePress || onPress}
          style={styles.critiqueBtn}
        >
          <Ionicons name="star" size={13} color="#FFFFFF" />
          <Text style={styles.critiqueBtnText}>Critique</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
    maxWidth: '70%',
  },
  communityNameText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  tagBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  headerRightTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privateCircleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 3,
  },
  privateCircleText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#92400E',
  },
  publicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  publicBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#15803D',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  authorInfo: {
    marginLeft: 10,
    flex: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  mentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  mentorBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  learnerBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  learnerBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  timeLine: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  postTitleText: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  content: {
    fontSize: typography.sizes.sm,
    color: '#334155',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  videoBox: {
    height: 165,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    marginBottom: spacing.sm,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(79, 70, 229, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 40,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  videoBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  videoBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tapToWatchText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FDE047',
  },
  inlineCritiqueContainer: {
    backgroundColor: '#FAF5FF',
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: spacing.sm,
  },
  inlineCritiqueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mentorCritiqueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mentorCritiqueTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  starRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  starRatingText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  critiqueTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  mentorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  mentorName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  critiqueText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  mentorVideoThumbnailBox: {
    height: 70,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: 6,
    position: 'relative',
    backgroundColor: '#000000',
  },
  mentorVideoImg: {
    width: '100%',
    height: '100%',
  },
  mentorVideoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  mentorPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorVideoMeta: {
    flex: 1,
  },
  mentorVideoTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mentorVideoDuration: {
    fontSize: 9,
    color: '#E9D5FF',
  },
  commentCountsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  countItemText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  critiqueCountItem: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  critiqueCountText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: 'bold',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  actionBtnLiked: {
    backgroundColor: '#FEE2E2',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  actionSpacer: {
    flex: 1,
  },
  commentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  commentBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  critiqueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  critiqueBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
