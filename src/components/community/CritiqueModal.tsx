import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CommunityPost } from '../../types';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface CritiqueModalProps {
  visible: boolean;
  post: CommunityPost | null;
  onClose: () => void;
  initialTab?: 'general' | 'mentor';
}

export const CritiqueModal: React.FC<CritiqueModalProps> = ({
  visible,
  post,
  onClose,
  initialTab = 'mentor',
}) => {
  const { selectedRole, setRole, addCommentToPost, toggleLikeComment, openUserProfile } = useApp();
  const [commentTypeTab, setCommentTypeTab] = useState<'all' | 'mentor' | 'general'>('all');
  const [composeType, setComposeType] = useState<'general' | 'mentor'>('general');
  const [commentText, setCommentText] = useState('');
  const [mentorRating, setMentorRating] = useState(5);
  const [critiqueFocus, setCritiqueFocus] = useState('Technique Fix');
  const [isVideoCritiqueMode, setIsVideoCritiqueMode] = useState(false);
  const [videoTitle, setVideoTitle] = useState('Mentor Video Review & Technique Fix');

  if (!post) return null;

  const isMentor = selectedRole === 'Mentor';

  const mentorCritiques = post.comments?.filter((c) => c.isMentorCritique || c.commentType === 'mentor') || [];
  const generalComments = post.comments?.filter((c) => !c.isMentorCritique && c.commentType !== 'mentor') || [];

  const displayedComments =
    commentTypeTab === 'mentor'
      ? mentorCritiques
      : commentTypeTab === 'general'
      ? generalComments
      : post.comments || [];

  const handleSendComment = () => {
    if (!commentText.trim() && !isVideoCritiqueMode) {
      Alert.alert('Empty Comment', 'Please enter your thoughts or critique feedback.');
      return;
    }

    const isSubmittingMentorCritique = composeType === 'mentor' || isVideoCritiqueMode;

    if (isSubmittingMentorCritique && !isMentor) {
      Alert.alert(
        'Mentor Feature',
        'You are currently in Learner persona. Switch to "Mentor Pro" to submit verified critiques, ratings, and video breakdowns.'
      );
      return;
    }

    addCommentToPost(post.id, {
      text: commentText.trim() || 'Good technique demonstration.',
      commentType: isSubmittingMentorCritique ? 'mentor' : 'general',
      isMentorCritique: isSubmittingMentorCritique,
      mentorRating: isSubmittingMentorCritique ? mentorRating : undefined,
      critiqueFocus: isSubmittingMentorCritique ? critiqueFocus : undefined,
      videoCritiqueThumbnail: isVideoCritiqueMode
        ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'
        : undefined,
      videoCritiqueDuration: isVideoCritiqueMode ? '1:15' : undefined,
      videoCritiqueTitle: isVideoCritiqueMode ? videoTitle : undefined,
    });

    setCommentText('');
    setIsVideoCritiqueMode(false);
  };

  const handlePlayVideo = (title: string) => {
    Alert.alert('Playing Video ▶', `Streaming video playback for: "${title}"`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top Bar & Header */}
          <View style={styles.topBar}>
            <View style={styles.dragPill} />
            <View style={styles.headerRow}>
              <View style={styles.communityTag}>
                <Ionicons name="people" size={14} color="#4F46E5" />
                <Text style={styles.communityTagText}>{post.communityName}</Text>
              </View>

              <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Original Post Card Preview */}
            <View style={styles.originalPostCard}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  openUserProfile({
                    name: post.authorName,
                    avatarUrl: post.authorAvatar,
                    role: post.authorRole,
                    badge: post.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                  })
                }
                style={styles.authorRow}
              >
                <Avatar
                  uri={post.authorAvatar}
                  name={post.authorName}
                  size={42}
                  showRing={post.authorRole === 'Mentor'}
                />
                <View style={styles.authorMeta}>
                  <Text style={styles.authorName}>{post.authorName}</Text>
                  <Text style={styles.authorRoleTag}>{post.authorRole} • {post.timeAgo}</Text>
                </View>
                <View style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{post.tag}</Text>
                </View>
              </TouchableOpacity>

              {post.videoTitle && (
                <Text style={styles.postTitle}>{post.videoTitle}</Text>
              )}
              <Text style={styles.postBody}>{post.content}</Text>

              {/* Video Player Box */}
              {post.videoThumbnail && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handlePlayVideo(post.videoTitle || post.content)}
                  style={styles.videoPlayerBox}
                >
                  <Image source={{ uri: post.videoThumbnail }} style={styles.videoThumbnail} />
                  <View style={styles.videoOverlay}>
                    <LinearGradient
                      colors={['transparent', 'rgba(15, 23, 42, 0.8)']}
                      style={styles.videoGradient}
                    >
                      <View style={styles.playCircle}>
                        <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 2 }} />
                      </View>
                      <View style={styles.videoDurationBadge}>
                        <Ionicons name="videocam" size={12} color="#FFFFFF" />
                        <Text style={styles.videoDurationText}>{post.videoDuration || '0:45'}</Text>
                      </View>
                    </LinearGradient>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Segmented Comments Filter Tabs */}
            <View style={styles.commentsFilterTabs}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCommentTypeTab('all')}
                style={[styles.filterTab, commentTypeTab === 'all' && styles.filterTabActive]}
              >
                <Text style={[styles.filterTabText, commentTypeTab === 'all' && styles.filterTabTextActive]}>
                  All ({post.comments?.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCommentTypeTab('mentor')}
                style={[styles.filterTab, commentTypeTab === 'mentor' && styles.filterTabActiveMentor]}
              >
                <Ionicons
                  name="star"
                  size={12}
                  color={commentTypeTab === 'mentor' ? '#7C3AED' : '#64748B'}
                />
                <Text style={[styles.filterTabText, commentTypeTab === 'mentor' && styles.filterTabTextActiveMentor]}>
                  Mentor Critiques ({mentorCritiques.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCommentTypeTab('general')}
                style={[styles.filterTab, commentTypeTab === 'general' && styles.filterTabActiveGeneral]}
              >
                <Ionicons
                  name="chatbubbles"
                  size={12}
                  color={commentTypeTab === 'general' ? '#4F46E5' : '#64748B'}
                />
                <Text style={[styles.filterTabText, commentTypeTab === 'general' && styles.filterTabTextActiveGeneral]}>
                  General ({generalComments.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            <View style={styles.commentsList}>
              {displayedComments.length > 0 ? (
                displayedComments.map((comment) => {
                  const isCritique = comment.isMentorCritique || comment.commentType === 'mentor';

                  return (
                    <View
                      key={comment.id}
                      style={[
                        styles.commentCard,
                        isCritique ? styles.mentorCritiqueCard : styles.generalCommentCard,
                      ]}
                    >
                      {/* Critique Banner if mentor */}
                      {isCritique && (
                        <View style={styles.mentorCritiqueBanner}>
                          <View style={styles.mentorCritiqueBannerLeft}>
                            <Ionicons name="star" size={13} color="#7C3AED" />
                            <Text style={styles.mentorCritiqueBannerText}>
                              VERIFIED MENTOR CRITIQUE
                            </Text>
                          </View>
                          {comment.mentorRating && (
                            <View style={styles.ratingBadgePill}>
                              <Ionicons name="star" size={10} color="#D97706" />
                              <Text style={styles.ratingBadgeText}>{comment.mentorRating}.0</Text>
                            </View>
                          )}
                        </View>
                      )}

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          openUserProfile({
                            name: comment.authorName,
                            avatarUrl: comment.authorAvatar,
                            role: comment.authorRole,
                            rating: comment.mentorRating,
                            specialty: comment.critiqueFocus,
                            badge: comment.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                          })
                        }
                        style={styles.commentAuthorRow}
                      >
                        <Avatar
                          uri={comment.authorAvatar}
                          name={comment.authorName}
                          size={34}
                          showRing={comment.authorRole === 'Mentor'}
                        />
                        <View style={styles.commentAuthorMeta}>
                          <View style={styles.nameBadgeLine}>
                            <Text style={styles.commentAuthorName}>{comment.authorName}</Text>
                            {comment.authorRole === 'Mentor' ? (
                              <View style={styles.mentorBadgeSmall}>
                                <Text style={styles.mentorBadgeSmallText}>Mentor</Text>
                              </View>
                            ) : (
                              <View style={styles.learnerBadgeSmall}>
                                <Text style={styles.learnerBadgeSmallText}>Learner</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.commentTime}>{comment.timeAgo}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Text content */}
                      <Text style={styles.commentText}>{comment.text}</Text>

                      {/* Mentor Video Critique Thumbnail */}
                      {comment.videoCritiqueThumbnail && (
                        <TouchableOpacity
                          activeOpacity={0.88}
                          onPress={() =>
                            handlePlayVideo(comment.videoCritiqueTitle || 'Mentor Technique Fix')
                          }
                          style={styles.critiqueVideoBox}
                        >
                          <Image
                            source={{ uri: comment.videoCritiqueThumbnail }}
                            style={styles.critiqueVideoImg}
                          />
                          <View style={styles.critiqueVideoOverlay}>
                            <View style={styles.critiquePlayBtn}>
                              <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
                            </View>
                            <View style={styles.critiqueVideoInfo}>
                              <Text style={styles.critiqueVideoTitle} numberOfLines={1}>
                                {comment.videoCritiqueTitle || 'Mentor Technique Demonstration'}
                              </Text>
                              <Text style={styles.critiqueVideoDuration}>
                                {comment.videoCritiqueDuration || '1:15'} • Tap to Watch Breakdown
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      )}

                      {/* Like Action */}
                      <View style={styles.commentActions}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => toggleLikeComment(post.id, comment.id)}
                          style={styles.commentLikeBtn}
                        >
                          <Ionicons
                            name={comment.isLiked ? 'heart' : 'heart-outline'}
                            size={14}
                            color={comment.isLiked ? '#EF4444' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.commentLikeCount,
                              comment.isLiked && { color: '#EF4444', fontWeight: 'bold' },
                            ]}
                          >
                            {comment.likesCount}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="chatbubbles-outline" size={32} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No {commentTypeTab} comments yet.</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Action & Input Bar */}
          <View style={styles.bottomInputBar}>
            {/* If user is Mentor, allow toggling between General Comment and Mentor Critique */}
            {isMentor && (
              <View style={styles.composeTypeRow}>
                <Text style={styles.replyingAsLabel}>Posting as:</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setComposeType('general')}
                  style={[styles.composeTypeBtn, composeType === 'general' && styles.composeTypeBtnGeneralActive]}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={12}
                    color={composeType === 'general' ? '#FFFFFF' : '#4F46E5'}
                  />
                  <Text
                    style={[
                      styles.composeTypeBtnText,
                      composeType === 'general' && styles.composeTypeBtnTextActive,
                    ]}
                  >
                    General Comment
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setComposeType('mentor')}
                  style={[styles.composeTypeBtn, composeType === 'mentor' && styles.composeTypeBtnMentorActive]}
                >
                  <Ionicons
                    name="star"
                    size={12}
                    color={composeType === 'mentor' ? '#FFFFFF' : '#7C3AED'}
                  />
                  <Text
                    style={[
                      styles.composeTypeBtnText,
                      composeType === 'mentor' && styles.composeTypeBtnTextActive,
                    ]}
                  >
                    Mentor Critique
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Optional Mentor Tools Row (If Critique mode) */}
            {composeType === 'mentor' && (
              <View style={styles.mentorToolsRow}>
                {/* Rating Picker */}
                <View style={styles.ratingPickerRow}>
                  <Text style={styles.toolLabel}>Rating:</Text>
                  {[3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setMentorRating(star)}
                      style={[styles.starPickBtn, mentorRating === star && styles.starPickBtnActive]}
                    >
                      <Text style={[styles.starPickText, mentorRating === star && styles.starPickTextActive]}>
                        {star}★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Video Demo Toggle */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsVideoCritiqueMode(!isVideoCritiqueMode)}
                  style={[
                    styles.videoCritiqueToggle,
                    isVideoCritiqueMode && styles.videoCritiqueToggleActive,
                  ]}
                >
                  <Ionicons
                    name={isVideoCritiqueMode ? 'videocam' : 'videocam-outline'}
                    size={13}
                    color={isVideoCritiqueMode ? '#FFFFFF' : '#7C3AED'}
                  />
                  <Text
                    style={[
                      styles.videoCritiqueToggleText,
                      isVideoCritiqueMode && styles.videoCritiqueToggleTextActive,
                    ]}
                  >
                    {isVideoCritiqueMode ? 'Video Fix Attached' : '+ Add Video Demo'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Input Row */}
            <View style={styles.inputBoxRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={
                  composeType === 'mentor'
                    ? 'Write actionable mentor critique & technique advice...'
                    : 'Share encouragement or feedback...'
                }
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                multiline
              />

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSendComment}
                style={[
                  styles.sendBtn,
                  composeType === 'mentor' ? { backgroundColor: '#7C3AED' } : { backgroundColor: '#4F46E5' },
                ]}
              >
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    height: '92%',
  },
  topBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  communityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  communityTagText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    gap: 6,
  },
  personaLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: 'bold',
  },
  personaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  personaChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  personaChipActiveMentor: {
    backgroundColor: '#FAF5FF',
    borderColor: '#7C3AED',
  },
  personaChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  personaChipTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  personaChipTextActiveMentor: {
    color: '#7C3AED',
    fontWeight: 'bold',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  originalPostCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  authorMeta: {
    marginLeft: 8,
    flex: 1,
  },
  authorName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  authorRoleTag: {
    fontSize: 10,
    color: '#64748B',
  },
  tagPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4F46E5',
  },
  postTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  postBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8,
  },
  videoPlayerBox: {
    height: 140,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  videoGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  videoDurationText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  commentsFilterTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
  },
  filterTabActiveMentor: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  filterTabActiveGeneral: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
  filterTabTextActiveMentor: {
    color: '#7C3AED',
    fontWeight: 'bold',
  },
  filterTabTextActiveGeneral: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  commentsList: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  commentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mentorCritiqueCard: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  generalCommentCard: {
    backgroundColor: '#FFFFFF',
  },
  mentorCritiqueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.md,
    marginBottom: 6,
  },
  mentorCritiqueBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mentorCritiqueBannerText: {
    fontSize: 9,
    fontWeight: 'heavy',
    color: '#6B21A8',
  },
  ratingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  ratingBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#D97706',
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthorMeta: {
    marginLeft: 8,
    flex: 1,
  },
  nameBadgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthorName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  mentorBadgeSmall: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  mentorBadgeSmallText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  learnerBadgeSmall: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  learnerBadgeSmallText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  commentTime: {
    fontSize: 9,
    color: '#94A3B8',
  },
  commentText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  critiqueVideoBox: {
    height: 70,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: 6,
    position: 'relative',
    backgroundColor: '#000000',
  },
  critiqueVideoImg: {
    width: '100%',
    height: '100%',
  },
  critiqueVideoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  critiquePlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  critiqueVideoInfo: {
    flex: 1,
  },
  critiqueVideoTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  critiqueVideoDuration: {
    fontSize: 9,
    color: '#E9D5FF',
  },
  commentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  commentLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  commentLikeCount: {
    fontSize: 10,
    color: '#64748B',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  bottomInputBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs + 2,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm + 4,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  composeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyingAsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
  },
  composeTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  composeTypeBtnGeneralActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  composeTypeBtnMentorActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  composeTypeBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
  },
  composeTypeBtnTextActive: {
    color: '#FFFFFF',
  },
  mentorToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  ratingPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B21A8',
  },
  starPickBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  starPickBtnActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  starPickText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  starPickTextActive: {
    color: '#FFFFFF',
  },
  videoCritiqueToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#C084FC',
    gap: 4,
  },
  videoCritiqueToggleActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  videoCritiqueToggleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  videoCritiqueToggleTextActive: {
    color: '#FFFFFF',
  },
  inputBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    gap: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    maxHeight: 70,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
