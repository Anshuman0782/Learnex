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
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { Community } from '../../types';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  community?: Community | null;
}

const SAMPLE_CLIPS = [
  {
    id: 'clip-1',
    title: 'Adele - Easy On Me (Chorus Take)',
    duration: '0:48',
    thumbnail: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&auto=format&fit=crop&q=80',
    category: 'Vocal',
  },
  {
    id: 'clip-2',
    title: 'Guitar Solo Speed Run (120 BPM)',
    duration: '0:35',
    thumbnail: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&auto=format&fit=crop&q=80',
    category: 'Guitar',
  },
  {
    id: 'clip-3',
    title: 'Beat Mixing & Sidechain Compression',
    duration: '1:10',
    thumbnail: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80',
    category: 'Production',
  },
  {
    id: 'clip-4',
    title: 'React Native Micro-Interactions',
    duration: '0:50',
    thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    category: 'Coding',
  },
];

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
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [requestMentorCritique, setRequestMentorCritique] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  const currentClip = SAMPLE_CLIPS[selectedClipIndex];

  const handleToggleTag = (tagItem: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagItem) ? prev.filter((t) => t !== tagItem) : [...prev, tagItem]
    );
  };

  const handleQuickAction = (actionName: string) => {
    showDialog({
      title: actionName,
      message: `Hardware recording simulation: Selected "${currentClip.title}"`,
      icon: 'videocam-outline',
      confirmText: 'OK',
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      showDialog({
        title: 'Title Required',
        message: 'Please enter a title for your post.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
      return;
    }

    if (!content.trim()) {
      showDialog({
        title: 'Description Required',
        message: 'Please describe what you want feedback on.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
      return;
    }

    setIsPublishing(true);

    setTimeout(() => {
      createPost({
        title: title.trim(),
        communityId: community?.id,
        communityIds: community ? [community.id] : [],
        content: content.trim(),
        tag: selectedTags.join(' ') || '#PracticeVideo',
        tags: selectedTags,
        postType,
        videoThumbnail: postType === 'video' ? currentClip.thumbnail : undefined,
        videoDuration: postType === 'video' ? currentClip.duration : undefined,
        isPrivate,
        focusArea: selectedTags.map((t) => t.replace('#', '')).join(', '),
      });

      setIsPublishing(false);
      setTitle('');
      setContent('');
      onClose();

      showDialog({
        title: isPrivate ? 'Shared to Circle Only 🔒' : 'Post Shared to Feed! 🎉',
        message: isPrivate
          ? `Visible strictly inside ${community?.name || 'this circle'}. It will NEVER be shown on the public Reels feed.`
          : `Shared live with ${community?.name || 'the community'} and added to public feeds!`,
        icon: isPrivate ? 'lock-closed-outline' : 'rocket-outline',
        confirmText: 'Awesome',
      });
    }, 400);
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

            {/* Quick Action Dock */}
            {postType === 'video' && (
              <View style={styles.quickActionsDeck}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleQuickAction('Camera Record')}
                  style={styles.quickTile}
                >
                  <LinearGradient colors={['#F43F5E', '#E11D48']} style={styles.quickTileCircle}>
                    <Ionicons name="radio-button-on" size={17} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickTileLabel}>Record</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleQuickAction('Camera Roll Gallery')}
                  style={styles.quickTile}
                >
                  <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.quickTileCircle}>
                    <Ionicons name="images" size={16} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickTileLabel}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleQuickAction('Voice Note')}
                  style={styles.quickTile}
                >
                  <LinearGradient colors={['#10B981', '#059669']} style={styles.quickTileCircle}>
                    <Ionicons name="mic" size={17} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickTileLabel}>Voice</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleQuickAction('Sample Clip')}
                  style={styles.quickTile}
                >
                  <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.quickTileCircle}>
                    <Ionicons name="flash" size={16} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.quickTileLabel}>Sample</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cinema Video Preview Card */}
            {postType === 'video' && (
              <View style={[styles.cinemaCard, shadows.soft]}>
                <View style={styles.cinemaMediaContainer}>
                  <Image source={{ uri: currentClip.thumbnail }} style={styles.cinemaImage} />

                  <LinearGradient
                    colors={['rgba(15, 23, 42, 0.45)', 'transparent', 'rgba(15, 23, 42, 0.9)']}
                    style={styles.cinemaOverlay}
                  >
                    <View style={styles.cinemaTopRow}>
                      <View style={styles.cinemaCategoryBadge}>
                        <Text style={styles.cinemaCategoryText}>{currentClip.category}</Text>
                      </View>
                      <View style={styles.durationPill}>
                        <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                        <Text style={styles.durationText}>{currentClip.duration}</Text>
                      </View>
                    </View>

                    <View style={styles.centerPlayArea}>
                      <View style={styles.playHalo}>
                        <LinearGradient colors={['#6366F1', '#EC4899']} style={styles.playButton}>
                          <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
                        </LinearGradient>
                      </View>
                    </View>

                    <View style={styles.waveformContainer}>
                      <View style={styles.waveformBars}>
                        {WAVEFORM_HEIGHTS.map((h, i) => (
                          <View
                            key={i}
                            style={[styles.waveBar, { height: h, opacity: i < 11 ? 1 : 0.45 }]}
                          />
                        ))}
                      </View>
                      <Text style={styles.clipTitleOverlay} numberOfLines={1}>
                        {currentClip.title}
                      </Text>
                    </View>
                  </LinearGradient>
                </View>

                {/* Horizontal Clip Picker Strip */}
                <View style={styles.stripContainer}>
                  <Text style={styles.stripLabel}>Tap to Switch Practice Take</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stripScroll}
                  >
                    {SAMPLE_CLIPS.map((clip, idx) => {
                      const isSelected = selectedClipIndex === idx;
                      return (
                        <TouchableOpacity
                          key={clip.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedClipIndex(idx);
                            if (!title) setTitle(clip.title);
                          }}
                          style={[styles.stripThumbnailCard, isSelected && styles.stripThumbnailActive]}
                        >
                          <Image source={{ uri: clip.thumbnail }} style={styles.miniStripImg} />
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.7)']}
                            style={styles.miniStripOverlay}
                          >
                            <Text style={styles.miniStripDuration}>{clip.duration}</Text>
                          </LinearGradient>
                          {isSelected && (
                            <View style={styles.selectedCheckOverlay}>
                              <Ionicons name="checkmark-circle" size={15} color="#4F46E5" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
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
  cinemaImage: {
    width: '100%',
    height: '100%',
  },
  cinemaOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
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
