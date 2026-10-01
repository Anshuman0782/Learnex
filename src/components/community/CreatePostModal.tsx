import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { pickVideo, recordVideo, generateVideoThumbnail } from '../../services/imagePicker';
import { uploadFileRequest } from '../../api/media.api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { Community } from '../../types';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  community?: Community | null;
}

const formatDuration = (ms?: number): string => {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const QUICK_TAGS = [
  { label: '#VocalPitch', icon: 'mic' },
  { label: '#GuitarSolo', icon: 'musical-notes' },
  { label: '#MixingCritique', icon: 'options' },
  { label: '#BreathSupport', icon: 'fitness' },
  { label: '#DailyPractice', icon: 'flame' },
  { label: '#SpeedTechnique', icon: 'flash' },
];

const WAVEFORM_HEIGHTS = [8, 16, 24, 18, 30, 14, 26, 32, 20, 15, 28, 34, 22, 12, 26, 18, 10];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  visible,
  onClose,
  community,
}) => {
  const { createPost, showDialog } = useApp();

  const [postType, setPostType] = useState<'video' | 'text'>('video');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['#VocalPitch']);
  const [requestMentorCritique, setRequestMentorCritique] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // Real picked video state.
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>('video/mp4');
  const [videoThumbUri, setVideoThumbUri] = useState<string | null>(null);
  const [videoDurationStr, setVideoDurationStr] = useState<string>('');

  const resetForm = () => {
    setTitle('');
    setContent('');
    setVideoUri(null);
    setVideoThumbUri(null);
    setVideoDurationStr('');
  };

  const handleToggleTag = (tagItem: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagItem) ? prev.filter((t) => t !== tagItem) : [...prev, tagItem]
    );
  };

  const handlePickVideo = async (mode: 'record' | 'library') => {
    const res = mode === 'record' ? await recordVideo() : await pickVideo();
    if (res.status === 'denied') {
      showDialog({
        title: mode === 'record' ? 'Camera Access Needed' : 'Media Access Needed',
        message: 'Please allow access for LERNEX in your device settings and try again.',
        icon: 'videocam-outline',
        confirmText: 'Got it',
      });
      return;
    }
    if (res.status !== 'ok') return;

    setVideoUri(res.uri);
    setVideoMime(res.mimeType);
    setVideoDurationStr(formatDuration(res.durationMs));
    // Best-effort poster frame (copied to persistent storage so it stays readable).
    setVideoThumbUri(await generateVideoThumbnail(res.uri));
  };

  const handleSubmit = async () => {
    if (postType === 'video' && !videoUri) {
      showDialog({
        title: 'Add a Video',
        message: 'Record or upload a practice video before publishing.',
        icon: 'videocam-outline',
        confirmText: 'OK',
      });
      return;
    }
    if (!title.trim()) {
      showDialog({ title: 'Title Required', message: 'Please enter a title for your post.', icon: 'alert-circle-outline', confirmText: 'OK' });
      return;
    }
    if (!content.trim()) {
      showDialog({ title: 'Description Required', message: 'Please describe what you want feedback on.', icon: 'alert-circle-outline', confirmText: 'OK' });
      return;
    }

    setIsPublishing(true);
    try {
      let videoUrl: string | undefined;
      let videoThumbnail: string | undefined;

      if (postType === 'video' && videoUri) {
        const uploadedVideo = await uploadFileRequest(videoUri, videoMime);
        videoUrl = uploadedVideo.url;
        if (videoThumbUri) {
          try {
            const uploadedThumb = await uploadFileRequest(videoThumbUri, 'image/jpeg');
            videoThumbnail = uploadedThumb.url;
          } catch {
            // Thumbnail is optional — the video still posts.
          }
        }
      }

      await createPost({
        title: title.trim(),
        communityId: community?.id,
        communityIds: community ? [community.id] : [],
        content: content.trim(),
        tag: selectedTags.join(' ') || '#PracticeVideo',
        tags: selectedTags,
        postType,
        videoUrl,
        videoThumbnail,
        videoDuration: postType === 'video' ? videoDurationStr || undefined : undefined,
        isPrivate,
        focusArea: selectedTags.map((t) => t.replace('#', '')).join(', '),
      });

      resetForm();
      onClose();
      showDialog({
        title: isPrivate ? 'Shared to Circle Only 🔒' : 'Post Shared to Feed! 🎉',
        message: isPrivate
          ? `Visible strictly inside ${community?.name || 'this circle'}. It will NEVER be shown on the public feed.`
          : `Shared live with ${community?.name || 'the community'}!`,
        icon: isPrivate ? 'lock-closed-outline' : 'rocket-outline',
        confirmText: 'Awesome',
      });
    } catch (err: any) {
      showDialog({
        title: 'Upload Failed',
        message: err?.message || 'Could not publish your video. Please check your connection and try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Try Again',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalSheet}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#1E293B" />
            </TouchableOpacity>

            <View style={styles.headerTitleCenter}>
              <Text style={styles.headerTitle}>Create Post</Text>
              {community && (
                <View style={styles.targetCommPill}>
                  <Ionicons
                    name={community.iconName as keyof typeof Ionicons.glyphMap}
                    size={11}
                    color="#4F46E5"
                  />
                  <Text style={styles.targetCommText} numberOfLines={1}>
                    {community.name.split('&')[0].trim()}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={isPublishing}
              style={styles.publishHeaderBtn}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.publishHeaderGradient}
              >
                <Text style={styles.publishHeaderText}>
                  {isPublishing ? '...' : 'Post'}
                </Text>
                <Ionicons name="arrow-up" size={12} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Format Selector: Video Clip vs Discussion */}
            <View style={styles.formatSelector}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setPostType('video')}
                style={styles.formatTabTouch}
              >
                {postType === 'video' ? (
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.formatTabActiveGradient}
                  >
                    <Ionicons name="videocam" size={16} color="#FFFFFF" />
                    <Text style={styles.formatTabActiveText}>Video Practice</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.formatTabInactive}>
                    <Ionicons name="videocam-outline" size={16} color="#64748B" />
                    <Text style={styles.formatTabInactiveText}>Video Practice</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setPostType('text')}
                style={styles.formatTabTouch}
              >
                {postType === 'text' ? (
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.formatTabActiveGradient}
                  >
                    <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
                    <Text style={styles.formatTabActiveText}>Discussion</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.formatTabInactive}>
                    <Ionicons name="chatbubbles-outline" size={16} color="#64748B" />
                    <Text style={styles.formatTabInactiveText}>Discussion</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Quick Action Dock — real capture */}
            {postType === 'video' && (
              <View style={styles.quickActionsDeck}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handlePickVideo('record')}
                  style={styles.quickTile}
                >
                  <LinearGradient colors={['#F43F5E', '#E11D48']} style={styles.quickTileCircle}>
                    <Ionicons name="radio-button-on" size={17} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickTileLabel}>Record</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handlePickVideo('library')}
                  style={styles.quickTile}
                >
                  <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.quickTileCircle}>
                    <Ionicons name="images" size={16} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickTileLabel}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Real Video Picker / Preview */}
            {postType === 'video' && (
              <View style={[styles.cinemaCard, shadows.soft]}>
                {videoUri ? (
                  <View style={styles.cinemaMediaContainer}>
                    {videoThumbUri ? (
                      <Image source={{ uri: videoThumbUri }} style={styles.cinemaImage} />
                    ) : (
                      <View style={[styles.cinemaImage, styles.thumbFallback]}>
                        <Ionicons name="videocam" size={40} color="#94A3B8" />
                      </View>
                    )}
                    <LinearGradient
                      colors={['rgba(15, 23, 42, 0.4)', 'transparent', 'rgba(15, 23, 42, 0.85)']}
                      style={styles.cinemaOverlay}
                    >
                      <View style={styles.cinemaTopRow}>
                        <View style={styles.cinemaCategoryBadge}>
                          <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" />
                          <Text style={styles.cinemaCategoryText}> Video ready</Text>
                        </View>
                        {videoDurationStr ? (
                          <View style={styles.durationPill}>
                            <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                            <Text style={styles.durationText}>{videoDurationStr}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.centerPlayArea}>
                        <View style={styles.playHalo}>
                          <LinearGradient colors={['#6366F1', '#EC4899']} style={styles.playButton}>
                            <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
                          </LinearGradient>
                        </View>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handlePickVideo('library')}
                        style={styles.changeVideoBtn}
                      >
                        <Ionicons name="swap-horizontal" size={13} color="#FFFFFF" />
                        <Text style={styles.changeVideoText}>Change video</Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                ) : (
                  <View style={styles.pickerEmpty}>
                    <View style={styles.pickerIconCircle}>
                      <Ionicons name="cloud-upload-outline" size={30} color="#4F46E5" />
                    </View>
                    <Text style={styles.pickerTitle}>Add your practice video</Text>
                    <Text style={styles.pickerSub}>Record a new take or upload from your gallery.</Text>
                    <View style={styles.pickerBtnRow}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handlePickVideo('record')}
                        style={styles.pickerBtn}
                      >
                        <Ionicons name="videocam" size={17} color="#4F46E5" />
                        <Text style={styles.pickerBtnText}>Record</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handlePickVideo('library')}
                        style={styles.pickerBtn}
                      >
                        <Ionicons name="folder-open" size={17} color="#4F46E5" />
                        <Text style={styles.pickerBtnText}>Upload</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Sleek Minimal Inputs */}
            <View style={styles.inputsBlock}>
              <View style={styles.inputWrapper}>
                <Ionicons name="sparkles-outline" size={17} color="#4F46E5" style={styles.inputIcon} />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={postType === 'video' ? 'Title (e.g. Chorus High Notes)' : 'Discussion Topic...'}
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
              </View>

              <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={17}
                  color="#4F46E5"
                  style={[styles.inputIcon, { marginTop: 10 }]}
                />
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  placeholder={
                    postType === 'video'
                      ? 'What should mentors look for? (e.g. breath, pitch, wrist angle)'
                      : 'Ask a question or share your learning insights...'
                  }
                  placeholderTextColor="#94A3B8"
                  style={styles.textArea}
                  multiline
                />
              </View>
            </View>

            {/* Visual Privacy Selector (Public vs Private Vault) */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeader}>Visibility</Text>
              <View style={styles.privacyDeck}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsPrivate(false)}
                  style={[styles.privacyCard, !isPrivate && styles.privacyCardActive]}
                >
                  <LinearGradient
                    colors={!isPrivate ? ['#EEF2FF', '#E0E7FF'] : ['#F8FAFC', '#F1F5F9']}
                    style={styles.privacyCardGradient}
                  >
                    <View style={styles.privacyTopRow}>
                      <View style={[styles.privacyIconCircle, !isPrivate && { backgroundColor: '#4F46E5' }]}>
                        <Ionicons name="earth" size={15} color={!isPrivate ? '#FFFFFF' : '#64748B'} />
                      </View>
                      <Ionicons
                        name={!isPrivate ? 'checkmark-circle' : 'ellipse-outline'}
                        size={17}
                        color={!isPrivate ? '#4F46E5' : '#CBD5E1'}
                      />
                    </View>
                    <Text style={[styles.privacyTitle, !isPrivate && styles.privacyTitleActive]}>
                      Public
                    </Text>
                    <Text style={styles.privacySubtitle}>Circle + Reels Feed</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsPrivate(true)}
                  style={[styles.privacyCard, isPrivate && styles.privacyCardVaultActive]}
                >
                  <LinearGradient
                    colors={isPrivate ? ['#FFFBEB', '#FEF3C7'] : ['#F8FAFC', '#F1F5F9']}
                    style={styles.privacyCardGradient}
                  >
                    <View style={styles.privacyTopRow}>
                      <View style={[styles.privacyIconCircle, isPrivate && { backgroundColor: '#D97706' }]}>
                        <Ionicons name="lock-closed" size={14} color={isPrivate ? '#FFFFFF' : '#64748B'} />
                      </View>
                      <Ionicons
                        name={isPrivate ? 'checkmark-circle' : 'ellipse-outline'}
                        size={17}
                        color={isPrivate ? '#D97706' : '#CBD5E1'}
                      />
                    </View>
                    <Text style={[styles.privacyTitle, isPrivate && { color: '#92400E' }]}>
                      Circle Only 🔒
                    </Text>
                    <Text style={styles.privacySubtitle}>Private (Never in Feed)</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Focus Skill Tags */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeader}>Skill Focus</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {QUICK_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.label);
                  return (
                    <TouchableOpacity
                      key={tag.label}
                      activeOpacity={0.8}
                      onPress={() => handleToggleTag(tag.label)}
                      style={[styles.tagPill, isSelected && styles.tagPillSelected]}
                    >
                      <Ionicons
                        name={tag.icon as keyof typeof Ionicons.glyphMap}
                        size={12}
                        color={isSelected ? '#4F46E5' : '#64748B'}
                      />
                      <Text style={[styles.tagPillText, isSelected && styles.tagPillTextSelected]}>
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Mentor Critique Request Switch */}
            {!isPrivate && postType === 'video' && (
              <View style={[styles.mentorVipCard, shadows.soft]}>
                <LinearGradient colors={['#FAF5FF', '#F3E8FF']} style={styles.mentorVipGradient}>
                  <View style={styles.mentorVipLeft}>
                    <View style={styles.mentorStarBadge}>
                      <Ionicons name="star" size={15} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={styles.mentorVipTitle}>Request Mentor Critique</Text>
                      <Text style={styles.mentorVipSub}>Certified mentors give video corrections</Text>
                    </View>
                  </View>
                  <Switch
                    value={requestMentorCritique}
                    onValueChange={setRequestMentorCritique}
                    trackColor={{ false: '#E2E8F0', true: '#C4B5FD' }}
                    thumbColor={requestMentorCritique ? '#7C3AED' : '#FFFFFF'}
                  />
                </LinearGradient>
              </View>
            )}

            {/* Radiant Bottom Post Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleSubmit}
              disabled={isPublishing}
              style={styles.submitBtn}
            >
              <LinearGradient
                colors={
                  isPrivate
                    ? ['#D97706', '#B45309']
                    : ['#4F46E5', '#7C3AED', '#EC4899']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Ionicons name={isPrivate ? 'lock-closed' : 'paper-plane'} size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>
                  {isPublishing
                    ? 'Publishing...'
                    : isPrivate
                    ? 'Share to Circle Only (Private 🔒)'
                    : `Post to ${community ? community.name.split('&')[0].trim() : 'Feed'} & Reels 🚀`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '90%',
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCenter: {
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  targetCommPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 4,
    maxWidth: 200,
  },
  targetCommText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  publishHeaderBtn: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  publishHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  publishHeaderText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 20,
    gap: spacing.base,
  },
  formatSelector: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 4,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formatTabTouch: {
    flex: 1,
  },
  formatTabActiveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    gap: 6,
  },
  formatTabActiveText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  formatTabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    gap: 6,
  },
  formatTabInactiveText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.medium,
    color: '#64748B',
  },
  quickActionsDeck: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickTile: {
    alignItems: 'center',
    gap: 4,
  },
  quickTileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTileLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  cinemaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cinemaMediaContainer: {
    height: 165,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  changeVideoBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  changeVideoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pickerEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  pickerIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pickerTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  pickerSub: {
    fontSize: typography.sizes.xs,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: spacing.md,
  },
  pickerBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: borderRadius.full,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  pickerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cinemaImage: {
    width: '100%',
    height: '100%',
  },
  cinemaOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  cinemaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cinemaCategoryBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cinemaCategoryText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  durationText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  centerPlayArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHalo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    gap: 3,
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 30,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
  },
  clipTitleOverlay: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stripContainer: {
    padding: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  stripLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stripScroll: {
    gap: 8,
  },
  stripThumbnailCard: {
    width: 68,
    height: 48,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stripThumbnailActive: {
    borderColor: '#4F46E5',
  },
  miniStripImg: {
    width: '100%',
    height: '100%',
  },
  miniStripOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: 3,
  },
  miniStripDuration: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  selectedCheckOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  inputsBlock: {
    gap: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: spacing.md,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  textArea: {
    flex: 1,
    paddingVertical: 10,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  sectionContainer: {
    gap: 6,
  },
  sectionHeader: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: '#334155',
  },
  privacyDeck: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  privacyCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  privacyCardActive: {
    borderColor: '#4F46E5',
  },
  privacyCardVaultActive: {
    borderColor: '#D97706',
  },
  privacyCardGradient: {
    padding: 12,
    gap: 4,
  },
  privacyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  privacyIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyTitle: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: '#1E293B',
  },
  privacyTitleActive: {
    color: '#4F46E5',
  },
  privacySubtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  chipsScroll: {
    gap: 8,
    paddingRight: spacing.sm,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  tagPillSelected: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tagPillTextSelected: {
    color: '#7C3AED',
    fontWeight: 'bold',
  },
  mentorVipCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  mentorVipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  mentorVipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  mentorStarBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorVipTitle: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: '#581C87',
  },
  mentorVipSub: {
    fontSize: 10,
    color: '#7E22CE',
    marginTop: 1,
  },
  submitBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginTop: spacing.xs,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  submitText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
});
