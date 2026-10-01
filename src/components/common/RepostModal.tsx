import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { borderRadius, spacing, typography } from '../../theme';
import { CommunityPost, Community } from '../../types';
import { postCover } from '../../utils/postKind';

interface RepostModalProps {
  visible: boolean;
  post: CommunityPost | null;
  /** The circles the user has joined — the only ones they can tag. */
  circles: Community[];
  onClose: () => void;
  onSubmit: (opts: { caption?: string; communityId?: string }) => Promise<void> | void;
}

/**
 * Compose a repost: add a caption and optionally tag one of your joined circles
 * so the repost suggests that circle to whoever sees it in the feed.
 *
 * Takes `circles` as a prop (rather than reading the app context) so this module
 * does not import AppContext — that would create a require cycle.
 */
export const RepostModal: React.FC<RepostModalProps> = ({ visible, post, circles, onClose, onSubmit }) => {
  const [caption, setCaption] = useState('');
  const [circleId, setCircleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCaption('');
      setCircleId(null);
      setBusy(false);
    }
  }, [visible]);

  if (!post) return null;

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await onSubmit({ caption: caption.trim() || undefined, communityId: circleId ?? undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.dragHandle} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialRepeatIcon />
              <Text style={styles.headerTitle}>Repost</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Caption */}
            <Text style={styles.label}>Add your thoughts (optional)</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Say something about this post…"
              placeholderTextColor="#94A3B8"
              style={styles.captionInput}
              multiline
              maxLength={500}
            />

            {/* Original post preview */}
            <View style={styles.previewCard}>
              <View style={styles.previewAuthorRow}>
                <Avatar uri={post.authorAvatar} name={post.authorName} size={28} />
                <Text style={styles.previewAuthorName}>{post.authorName}</Text>
                <Text style={styles.previewTime}>• {post.timeAgo}</Text>
              </View>
              {!!post.videoTitle && (
                <Text style={styles.previewTitle} numberOfLines={1}>{post.videoTitle}</Text>
              )}
              <Text style={styles.previewContent} numberOfLines={2}>{post.content}</Text>
              {!!postCover(post) && (
                <Image source={{ uri: postCover(post) }} style={styles.previewThumb} />
              )}
            </View>

            {/* Tag a circle */}
            <Text style={styles.label}>Tag a circle (optional)</Text>
            <Text style={styles.sublabel}>
              Tagging a circle suggests it to everyone who sees your repost.
            </Text>
            {circles.length === 0 ? (
              <Text style={styles.noCircles}>You haven’t joined any circles yet.</Text>
            ) : (
              <View style={styles.circleWrap}>
                <TouchableOpacity
                  onPress={() => setCircleId(null)}
                  style={[styles.circleChip, circleId === null && styles.circleChipActive]}
                >
                  <Ionicons name="close-circle-outline" size={14} color={circleId === null ? '#FFFFFF' : '#64748B'} />
                  <Text style={[styles.circleChipText, circleId === null && styles.circleChipTextActive]}>None</Text>
                </TouchableOpacity>
                {circles.map((c) => {
                  const active = circleId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setCircleId(c.id)}
                      style={[styles.circleChip, active && styles.circleChipActive]}
                    >
                      <Ionicons name="people" size={14} color={active ? '#FFFFFF' : '#7C3AED'} />
                      <Text style={[styles.circleChipText, active && styles.circleChipTextActive]} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity activeOpacity={0.88} onPress={handleSubmit} disabled={busy} style={styles.submitBtn}>
            <LinearGradient
              colors={['#16A34A', '#15803D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              <Ionicons name="repeat" size={18} color="#FFFFFF" />
              <Text style={styles.submitText}>{busy ? 'Reposting…' : 'Repost to feed'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const MaterialRepeatIcon = () => (
  <View style={styles.repeatBadge}>
    <Ionicons name="repeat" size={16} color="#16A34A" />
  </View>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.base,
    maxHeight: '86%',
  },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repeatBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#DCFCE7',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: typography.weights.bold, color: '#0F172A' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 6 },
  sublabel: { fontSize: 11, color: '#94A3B8', marginBottom: 8, marginTop: -2 },
  captionInput: {
    backgroundColor: '#F8FAFC', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A', minHeight: 70, textAlignVertical: 'top',
  },
  previewCard: {
    backgroundColor: '#F8FAFC', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#EEF2F7',
    padding: spacing.sm + 2, marginTop: 12, gap: 4,
  },
  previewAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewAuthorName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  previewTime: { fontSize: 11, color: '#94A3B8' },
  previewTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  previewContent: { fontSize: 12, color: '#475569', lineHeight: 17 },
  previewThumb: { width: '100%', height: 120, borderRadius: borderRadius.md, marginTop: 6 },
  noCircles: { fontSize: 12, color: '#94A3B8', paddingVertical: 8 },
  circleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  circleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '48%',
    backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 7, borderRadius: borderRadius.full,
  },
  circleChipActive: { backgroundColor: '#7C3AED' },
  circleChipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  circleChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  submitBtn: { marginTop: spacing.sm, borderRadius: borderRadius.full, overflow: 'hidden' },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  submitText: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
});
