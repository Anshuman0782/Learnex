import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useComposerBottomPadding } from '../common/KeyboardSafe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CommunityPost } from '../../types';
import { useApp } from '../../context/AppContext';
import { getSocket } from '../../realtime/socket';
import { Avatar } from '../common/Avatar';
import { MusicAnimation } from '../common/NowPlayingBar';
import { PhotoCarousel } from '../common/PhotoCarousel';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface CritiqueModalProps {
  visible: boolean;
  post: CommunityPost | null;
  onClose: () => void;
  initialTab?: 'general' | 'mentor';
}

export const CritiqueModal: React.FC<CritiqueModalProps> = ({
  visible,
  post: postProp,
  onClose,
  initialTab = 'mentor',
}) => {
  const composerPad = useComposerBottomPadding(10);
  const topInset = useSafeAreaInsets().top;
  const {
    selectedRole,
    roleInSkill,
    posts,
    reels,
    addCommentToPost,
    toggleLikeComment,
    toggleLikePost,
    toggleSavePost,
    pressRepost,
    openUserProfile,
    playAudioPost,
    audioPost,
    isAudioPlaying,
    recordPostView,
    user,
    deleteComment,
    showDialog,
  } = useApp();

  // Always render the freshest copy of this post from the feeds, so new comments,
  // likes and deletes appear instantly (the prop is only a point-in-time snapshot).
  const post = React.useMemo(() => {
    if (!postProp) return null;
    return (
      posts.find((p) => p.id === postProp.id) ??
      reels.find((p) => p.id === postProp.id) ??
      postProp
    );
  }, [postProp, posts, reels]);

  const videoUrl = post?.videoUrl ?? null;

  const [commentTypeTab, setCommentTypeTab] = useState<'all' | 'mentor' | 'general'>('all');
  const [composeType, setComposeType] = useState<'general' | 'mentor'>('general');
  const [commentText, setCommentText] = useState('');
  const [mentorRating, setMentorRating] = useState(5);
  const [critiqueFocus, setCritiqueFocus] = useState('Technique Fix');
  const [isVideoCritiqueMode, setIsVideoCritiqueMode] = useState(false);
  const [videoTitle, setVideoTitle] = useState('Mentor Video Review & Technique Fix');
  const [started, setStarted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const viewCountedRef = useRef(false);

  // Inline video player (YouTube-style: plays in the frame, with native controls
  // including fullscreen). Created unconditionally to satisfy the rules of hooks.
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
  });

  // Load + AUTOPLAY the video as soon as the detail opens; pause when it closes.
  // We start playback the instant the player reports it is ready (statusChange),
  // so opening a video is consistently immediate instead of occasionally stalling.
  useEffect(() => {
    setDescExpanded(false);
    viewCountedRef.current = false;
    setVideoReady(false);

    if (!visible || !videoUrl) {
      setStarted(false);
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }

    setStarted(true);
    let cancelled = false;

    const sub = player.addListener('statusChange', ({ status }) => {
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

    // replaceAsync avoids the main-thread asset load that replace() warns about.
    (async () => {
      try {
        await player.replaceAsync(videoUrl);
        if (!cancelled) player.play();
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [videoUrl, visible]);

  // Count a unique view after ~4s of playback (once per open).
  useEffect(() => {
    if (!started || !post || viewCountedRef.current) return;
    const t = setTimeout(() => {
      if (!viewCountedRef.current) {
        viewCountedRef.current = true;
        void recordPostView(post.id);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [started, post?.id]);

  // Join this post's room so new comments/critiques appear live while viewing.
  useEffect(() => {
    if (!visible || !post) return;
    const sock = getSocket();
    sock?.emit('post:subscribe', { postId: post.id });
    return () => {
      sock?.emit('post:unsubscribe', { postId: post.id });
    };
  }, [visible, post?.id]);

  if (!post) return null;

  // Mentor critiques need a Mentor IN THIS POST'S SKILL (a Coding mentor is a
  // regular member on a Music post).
  const isMentor = roleInSkill(post.authorSkill) === 'Mentor';
  const isSaved = !!post.isSaved;

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
      Alert.alert('Empty Comment', 'Please enter your feedback or critique notes.');
      return;
    }

    const isSubmittingMentorCritique = composeType === 'mentor' || isVideoCritiqueMode;

    if (isSubmittingMentorCritique && !isMentor) {
      Alert.alert(
        'Mentor Feature',
        `Only ${post.authorSkill || 'verified'} Mentors can submit critiques on this post.`
      );
      return;
    }

    addCommentToPost(post.id, {
      text: commentText.trim() || 'Good technique demonstration.',
      commentType: isSubmittingMentorCritique ? 'mentor' : 'general',
      isMentorCritique: isSubmittingMentorCritique,
      mentorRating: isSubmittingMentorCritique ? mentorRating : undefined,
      critiqueFocus: isSubmittingMentorCritique ? critiqueFocus : undefined,
      videoCritiqueTitle: isVideoCritiqueMode ? videoTitle : undefined,
    });

    setCommentText('');
    setIsVideoCritiqueMode(false);
  };

  const handleStartPlay = () => {
    if (videoUrl) {
      setStarted(true);
      try {
        player.play();
      } catch {
        /* ignore */
      }
      return;
    }
    if (post.audioUrl) {
      playAudioPost(post);
      return;
    }
    Alert.alert('Media Unavailable', 'This clip is still processing or was not uploaded.');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this practice video by ${post.authorName} on Lernex: "${post.videoTitle || post.content.substring(0, 40)}"`,
      });
    } catch {
      Alert.alert('Share', 'Share link copied! 🔗');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior="padding" automaticOffset
        >
          {/* Top Bar Drag Handle & Close */}
          <View style={[styles.topBar, { paddingTop: topInset + 4 }]}>
            <View style={styles.dragPill} />
            <View style={styles.headerRow}>
              <View style={styles.communityTag}>
                <Ionicons name="people-outline" size={13} color="#4F46E5" />
                <Text style={styles.communityTagText}>{post.communityName}</Text>
              </View>

              <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* ================= YOUTUBE LAYOUT ORDER ================= */}
            
            {/* 1. VERY TOP: Inline Video Player (YouTube-style) */}
            {post.postType === 'image' && (post.imageUrls?.length ?? 0) > 0 ? (
              <PhotoCarousel urls={post.imageUrls!} radius={20} dotsBelow />
            ) : (
            <View style={styles.ytVideoPlayerWrapper}>
              {started && videoUrl ? (
                <>
                  <VideoView
                    player={player}
                    style={styles.ytVideoThumbnail}
                    nativeControls
                    fullscreenOptions={{ enable: true }}
                    allowsPictureInPicture
                    contentFit="contain"
                  />
                  {/* Instant poster while the player warms up — avoids a black
                      flash so the video feels like it opens immediately. */}
                  {!videoReady && (
                    <View style={styles.ytLoadingOverlay} pointerEvents="none">
                      {post.videoThumbnail ? (
                        <Image
                          source={{ uri: post.videoThumbnail }}
                          style={styles.ytVideoThumbnail}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.ytVideoThumbnail, styles.ytVideoPlaceholder]} />
                      )}
                      <View style={styles.ytLoadingSpinner}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <TouchableOpacity activeOpacity={0.9} onPress={handleStartPlay} style={styles.ytVideoTapArea}>
                  {post.videoThumbnail ? (
                    <Image
                      source={{ uri: post.videoThumbnail }}
                      style={styles.ytVideoThumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.ytVideoThumbnail, styles.ytVideoPlaceholder]}>
                      {post.postType === 'audio' ? (
                        <MusicAnimation active={audioPost?.id === post.id ? isAudioPlaying : true} live={audioPost?.id === post.id} size={90} />
                      ) : (
                        <Ionicons name="videocam" size={48} color="#334155" />
                      )}
                    </View>
                  )}

                  <LinearGradient
                    colors={['transparent', 'rgba(15, 23, 42, 0.75)']}
                    style={styles.ytVideoOverlay}
                  >
                    <View style={styles.ytPlayCircle}>
                      <Ionicons
                        name={post.postType === 'audio' && audioPost?.id === post.id && isAudioPlaying ? 'pause' : 'play'}
                        size={28}
                        color="#FFFFFF"
                        style={{ marginLeft: post.postType === 'audio' && audioPost?.id === post.id && isAudioPlaying ? 0 : 3 }}
                      />
                    </View>

                    {!!post.videoDuration && (
                      <View style={styles.ytDurationBadge}>
                        <Ionicons name="videocam-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.ytDurationBadgeText}>{post.videoDuration}</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
            )}

            {/* 2. Video Title & Sub-Info */}
            <View style={styles.titleBlock}>
              <Text style={styles.ytVideoTitle}>
                {post.videoTitle || post.content.split('.')[0]}
              </Text>
              <View style={styles.ytSubInfoRow}>
                <Text style={styles.ytSubInfoText}>
                  {post.viewsCount && post.viewsCount >= 1000
                    ? `${(post.viewsCount / 1000).toFixed(1)}k views`
                    : `${post.viewsCount ?? 0} views`}
                </Text>
                <Text style={styles.ytDot}>•</Text>
                <Text style={styles.ytSubInfoText}>{post.timeAgo}</Text>
                <Text style={styles.ytDot}>•</Text>
                <Text style={styles.ytTagText}>{post.tag || '#Practice'}</Text>
              </View>
            </View>

            {/* 3. Creator / Channel Info Row */}
            <View style={styles.creatorRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  openUserProfile({
                    id: post.authorId,
                    name: post.authorName,
                    avatarUrl: post.authorAvatar,
                    role: post.authorRole,
                    specialty: post.authorSkill,
                    badge: post.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                  })
                }
                style={styles.creatorLeft}
              >
                <Avatar
                  uri={post.authorAvatar}
                  name={post.authorName}
                  size={42}
                  showRing={post.authorRole === 'Mentor'}
                />
                <View style={styles.creatorMeta}>
                  <View style={styles.creatorNameLine}>
                    <Text style={styles.creatorName}>{post.authorName}</Text>
                    {post.authorRole === 'Mentor' && (
                      <Ionicons name="checkmark-circle" size={14} color="#6366F1" />
                    )}
                  </View>
                  <Text style={styles.creatorSubText}>
                    {post.authorRole === 'Mentor' ? 'Verified Mentor' : post.authorRole === 'Guest' ? 'Guest' : 'Learner'} • {post.authorSkill || 'Member'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* 4. Action Buttons Bar (Like, Save, Share) */}
            <View style={styles.actionsBar}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleLikePost(post.id)}
                style={[styles.actionBtn, post.isLiked && styles.actionBtnLiked]}
              >
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={16}
                  color={post.isLiked ? '#EF4444' : '#475569'}
                />
                <Text style={[styles.actionBtnText, post.isLiked && { color: '#EF4444', fontWeight: 'bold' }]}>
                  {post.likesCount} Likes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  toggleSavePost(post.id);
                  Alert.alert(
                    !isSaved ? 'Saved to Vault 🔖' : 'Removed',
                    !isSaved ? 'Video saved to your library.' : 'Removed from library.'
                  );
                }}
                style={[styles.actionBtn, isSaved && styles.actionBtnSaved]}
              >
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color={isSaved ? '#F59E0B' : '#475569'}
                />
                <Text style={[styles.actionBtnText, isSaved && { color: '#F59E0B', fontWeight: 'bold' }]}>
                  {isSaved ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => pressRepost(post)}
                style={[styles.actionBtn, post.isReposted && { backgroundColor: '#DCFCE7' }]}
              >
                <MaterialCommunityIcons name="repeat" size={18} color={post.isReposted ? '#16A34A' : '#475569'} />
                <Text style={[styles.actionBtnText, post.isReposted && { color: '#16A34A', fontWeight: 'bold' }]}>
                  {post.repostsCount ?? 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} onPress={handleShare} style={styles.actionBtn}>
                <Ionicons name="paper-plane-outline" size={16} color="#475569" />
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* 5. Video Description Box (collapsed with a "more" toggle) */}
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text
                style={styles.descriptionBody}
                numberOfLines={descExpanded ? undefined : 2}
              >
                {post.content}
              </Text>
              {post.content.length > 90 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setDescExpanded((v) => !v)}
                  style={styles.descMoreBtn}
                >
                  <Text style={styles.descMoreText}>{descExpanded ? 'Show less' : '…more'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 6. Comments & Critiques Section */}
            <View style={styles.commentsSectionHeader}>
              <Text style={styles.commentsTitle}>
                Comments & Critiques ({post.comments?.length || 0})
              </Text>
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
                  name="ribbon-outline"
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
                  name="chatbubbles-outline"
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
                            <Ionicons name="checkmark-circle" size={13} color="#7C3AED" />
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
                            id: comment.authorId,
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
                                <Text style={styles.learnerBadgeSmallText}>
                                  {comment.authorRole === 'Guest' ? 'Guest' : 'Learner'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.commentTime}>{comment.timeAgo}</Text>
                        </View>
                      </TouchableOpacity>

                      <Text style={styles.commentText}>{comment.text}</Text>

                      {/* Mentor Video Critique Thumbnail */}
                      {comment.videoCritiqueThumbnail && (
                        <TouchableOpacity
                          activeOpacity={0.88}
                          onPress={() =>
                            Alert.alert('Mentor Video Critique', 'Mentor video critiques are coming soon.')
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
                                {comment.videoCritiqueDuration || '1:15'} • Tap to Watch
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

                        {comment.authorId && user?.id === comment.authorId && (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() =>
                              showDialog({
                                title: 'Delete Comment',
                                message: 'This will remove your comment. This cannot be undone.',
                                icon: 'trash-outline',
                                confirmText: 'Delete',
                                cancelText: 'Cancel',
                                isDestructive: true,
                                onConfirm: () => deleteComment(comment.id),
                              })
                            }
                            style={styles.commentLikeBtn}
                          >
                            <Ionicons name="trash-outline" size={13} color="#94A3B8" />
                            <Text style={styles.commentLikeCount}>Delete</Text>
                          </TouchableOpacity>
                        )}
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

          {/* Bottom Comment Composer Input Bar */}
          <View style={[styles.bottomInputBar, { paddingBottom: composerPad }]}>
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
                    name="ribbon-outline"
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

            <View style={styles.inputBoxRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={
                  composeType === 'mentor'
                    ? 'Write actionable mentor critique advice...'
                    : 'Add a comment...'
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    height: '100%',
  },
  topBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 6,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  // 1. YouTube Video Player Box
  ytVideoPlayerWrapper: {
    width: '100%',
    height: 210,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    position: 'relative',
  },
  ytVideoTapArea: {
    width: '100%',
    height: '100%',
  },
  ytVideoThumbnail: {
    width: '100%',
    height: '100%',
  },
  ytVideoPlaceholder: {
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ytLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  ytLoadingSpinner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -10,
    marginLeft: -10,
  },
  ytVideoOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ytPlayCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  ytDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  ytDurationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // 2. Video Title Block
  titleBlock: {
    marginBottom: spacing.xs,
  },
  ytVideoTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 4,
  },
  ytSubInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ytSubInfoText: {
    fontSize: 12,
    color: '#64748B',
  },
  ytDot: {
    fontSize: 11,
    color: '#94A3B8',
  },
  ytTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  // 3. Creator Info Row
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: spacing.xs,
  },
  creatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  creatorMeta: {
    marginLeft: 10,
    flex: 1,
  },
  creatorNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  creatorSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  followBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  followBtnActive: {
    backgroundColor: '#F1F5F9',
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  followBtnTextActive: {
    color: '#475569',
  },
  // 4. Action Buttons Bar
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.base,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  actionBtnLiked: {
    backgroundColor: '#FEE2E2',
  },
  actionBtnSaved: {
    backgroundColor: '#FEF3C7',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  // 5. Video Description Box
  descriptionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  descriptionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 4,
  },
  descriptionBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  descMoreBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  descMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  // 6. Comments Section
  commentsSectionHeader: {
    marginBottom: 8,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
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
    paddingBottom: spacing.xl,
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
    fontWeight: 'bold',
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
    borderRadius: 4,
  },
  mentorBadgeSmallText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  learnerBadgeSmall: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  learnerBadgeSmallText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748B',
  },
  commentTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  commentText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  critiqueVideoBox: {
    height: 90,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 8,
    backgroundColor: '#0F172A',
  },
  critiqueVideoImg: {
    width: '100%',
    height: '100%',
  },
  critiqueVideoOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    gap: 10,
  },
  critiquePlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 8,
  },
  commentLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  commentLikeCount: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  bottomInputBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs + 2,
  },
  composeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  replyingAsLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  composeTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    fontWeight: '600',
    color: '#64748B',
  },
  composeTypeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  inputBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
