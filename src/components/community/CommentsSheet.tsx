import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommunityPost } from '../../types';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { typography, spacing, borderRadius } from '../../theme';

interface CommentsSheetProps {
  visible: boolean;
  post: CommunityPost | null;
  onClose: () => void;
}

/**
 * A lightweight, comments-only bottom sheet (no video player). Used for reels and
 * anywhere the full video-detail layout would be overkill. Same add/like/delete
 * logic as the detail modal, reading the live post from context so changes are
 * instant.
 */
export const CommentsSheet: React.FC<CommentsSheetProps> = ({ visible, post: postProp, onClose }) => {
  const {
    posts,
    reels,
    addCommentToPost,
    toggleLikeComment,
    deleteComment,
    openUserProfile,
    showDialog,
    user,
  } = useApp();

  const post = useMemo(() => {
    if (!postProp) return null;
    return (
      posts.find((p) => p.id === postProp.id) ??
      reels.find((p) => p.id === postProp.id) ??
      postProp
    );
  }, [postProp, posts, reels]);

  const [tab, setTab] = useState<'all' | 'mentor' | 'general'>('all');
  const [text, setText] = useState('');

  if (!post) return null;

  const all = post.comments || [];
  const mentor = all.filter((c) => c.isMentorCritique || c.commentType === 'mentor');
  const general = all.filter((c) => !c.isMentorCritique && c.commentType !== 'mentor');
  const displayed = tab === 'mentor' ? mentor : tab === 'general' ? general : all;

  const send = () => {
    if (!text.trim()) {
      Alert.alert('Empty Comment', 'Please write something first.');
      return;
    }
    addCommentToPost(post.id, {
      text: text.trim(),
      commentType: 'general',
      isMentorCritique: false,
    });
    setText('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.dragPill} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Comments ({all.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Filter tabs */}
          <View style={styles.tabs}>
            {([
              { key: 'all', label: `All (${all.length})` },
              { key: 'mentor', label: `Mentor (${mentor.length})` },
              { key: 'general', label: `General (${general.length})` },
            ] as const).map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, tab === t.key && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {displayed.length > 0 ? (
              displayed.map((c) => {
                const isCritique = c.isMentorCritique || c.commentType === 'mentor';
                return (
                  <View key={c.id} style={[styles.commentCard, isCritique && styles.critiqueCard]}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() =>
                        openUserProfile({
                          id: c.authorId,
                          name: c.authorName,
                          avatarUrl: c.authorAvatar,
                          role: c.authorRole,
                          badge: c.authorRole === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                        })
                      }
                      style={styles.authorRow}
                    >
                      <Avatar uri={c.authorAvatar} name={c.authorName} size={32} showRing={c.authorRole === 'Mentor'} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameLine}>
                          <Text style={styles.authorName}>{c.authorName}</Text>
                          {isCritique && (
                            <View style={styles.mentorTag}>
                              <Ionicons name="star" size={9} color="#7C3AED" />
                              <Text style={styles.mentorTagText}>Mentor</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.time}>{c.timeAgo}</Text>
                      </View>
                    </TouchableOpacity>

                    <Text style={styles.commentText}>{c.text}</Text>

                    <View style={styles.actions}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => toggleLikeComment(post.id, c.id)}
                        style={styles.actionBtn}
                      >
                        <Ionicons
                          name={c.isLiked ? 'heart' : 'heart-outline'}
                          size={15}
                          color={c.isLiked ? '#EF4444' : '#64748B'}
                        />
                        <Text style={[styles.actionCount, c.isLiked && { color: '#EF4444', fontWeight: 'bold' }]}>
                          {c.likesCount}
                        </Text>
                      </TouchableOpacity>

                      {c.authorId && user?.id === c.authorId && (
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
                              onConfirm: () => deleteComment(c.id),
                            })
                          }
                          style={styles.actionBtn}
                        >
                          <Ionicons name="trash-outline" size={13} color="#94A3B8" />
                          <Text style={styles.actionCount}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={30} color="#CBD5E1" />
                <Text style={styles.emptyText}>No {tab === 'all' ? '' : tab + ' '}comments yet.</Text>
              </View>
            )}
          </ScrollView>

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              multiline
            />
            <TouchableOpacity onPress={send} style={styles.sendBtn} activeOpacity={0.85}>
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '80%',
    minHeight: '55%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  dragPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  title: { fontSize: 16, fontWeight: typography.weights.bold, color: '#0F172A' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.base, marginBottom: 4 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  tabActive: { backgroundColor: '#EEF2FF' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#4F46E5', fontWeight: 'bold' },
  list: { flex: 1, paddingHorizontal: spacing.base },
  commentCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  critiqueCard: { backgroundColor: '#FAF5FF', borderRadius: borderRadius.lg, paddingHorizontal: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  mentorTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  mentorTagText: { fontSize: 9, fontWeight: 'bold', color: '#7C3AED' },
  time: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  commentText: { fontSize: 13, color: '#334155', lineHeight: 19, marginTop: 6, marginLeft: 42 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8, marginLeft: 42 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 4 },
  actionCount: { fontSize: 11, color: '#64748B' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 12, color: '#94A3B8' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.base,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
