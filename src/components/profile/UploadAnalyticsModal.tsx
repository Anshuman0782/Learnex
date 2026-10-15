import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MusicAnimation } from '../common/NowPlayingBar';
import { CommunityPost } from '../../types';
import { typography, spacing, borderRadius } from '../../theme';

interface Props {
  post: CommunityPost | null;
  onClose: () => void;
  onDelete?: (post: CommunityPost) => void;
  onTogglePrivacy?: (post: CommunityPost) => void;
  busy?: boolean;
}

/** Per-upload analytics: real engagement numbers for one piece of content. */
export const UploadAnalyticsModal: React.FC<Props> = ({ post, onClose, onDelete, onTogglePrivacy, busy }) => {
  const insets = useSafeAreaInsets();
  if (!post) return null;

  const audio = post.postType === 'audio' || (!!post.audioUrl && !post.videoUrl);
  const kind = post.isShort ? 'Reel' : audio ? 'Audio' : post.postType === 'video' ? 'Video' : 'Post';
  const general = post.generalCommentsCount ?? 0;
  const mentor = post.mentorCritiqueCount ?? 0;

  const stats: { label: string; value: number; icon: any; color: string }[] = [
    { label: 'Views', value: post.viewsCount ?? 0, icon: 'eye', color: '#0EA5E9' },
    { label: 'Likes', value: post.likesCount ?? 0, icon: 'heart', color: '#EF4444' },
    { label: 'Comments', value: general, icon: 'chatbubble', color: '#4F46E5' },
    { label: 'Mentor comments', value: mentor, icon: 'star', color: '#7C3AED' },
    { label: 'Reposts', value: post.repostsCount ?? 0, icon: 'repeat', color: '#16A34A' },
    { label: 'Total Comments', value: post.commentsCount ?? general + mentor, icon: 'chatbubbles', color: '#0891B2' },
  ];

  return (
    <Modal visible={!!post} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
          <View style={styles.pill} />
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.thumb}>
              {post.videoThumbnail ? (
                <Image source={{ uri: post.videoThumbnail }} style={styles.thumbImg} />
              ) : audio ? (
                <View style={[styles.thumbImg, styles.thumbAudio]}>
                  <MusicAnimation active={false} size={38} />
                </View>
              ) : (
                <View style={[styles.thumbImg, styles.thumbFallback]}>
                  <Ionicons name={post.postType === 'video' ? 'videocam' : 'chatbubbles'} size={20} color="#94A3B8" />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kind}>{kind} Analytics</Text>
              <Text style={styles.title} numberOfLines={2}>{post.videoTitle || post.content || 'Untitled'}</Text>
              <Text style={styles.time}>{post.timeAgo}{post.isPrivate ? ' • Private' : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Stat grid */}
          <View style={styles.grid}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statTile}>
                <View style={[styles.statIcon, { backgroundColor: s.color + '1A' }]}>
                  <Ionicons name={s.icon} size={18} color={s.color} />
                </View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.note}>Engagement updates live as people view, like, comment and repost.</Text>

          {/* Manage actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={busy}
              onPress={() => onTogglePrivacy?.(post)}
              style={[styles.actionBtn, styles.privacyBtn]}
            >
              <Ionicons
                name={post.isPrivate ? 'globe-outline' : 'lock-closed-outline'}
                size={16}
                color="#4F46E5"
              />
              <Text style={styles.privacyBtnText}>
                {post.isPrivate ? 'Make Public' : 'Make Private'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={busy}
              onPress={() => onDelete?.(post)}
              style={[styles.actionBtn, styles.deleteBtn]}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.base,
  },
  pill: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.base },
  thumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: 52, height: 52 },
  thumbAudio: { backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  thumbFallback: { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  kind: { fontSize: 11, fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: 14, fontWeight: typography.weights.bold, color: '#0F172A', marginTop: 1 },
  time: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: spacing.md,
    gap: 4,
  },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: typography.weights.bold, color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  note: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: spacing.base },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: spacing.base },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
  },
  privacyBtn: { backgroundColor: '#EEF2FF' },
  privacyBtnText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  deleteBtn: { backgroundColor: '#FEE2E2' },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
});
