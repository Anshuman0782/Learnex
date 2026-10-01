import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { MusicAnimation } from '../common/NowPlayingBar';
import { borderRadius, shadows, spacing, typography } from '../../theme';
import { CommunityPost } from '../../types';

const POSTER_HEIGHT = 420; // 9:16 poster → width = height * 9/16

/**
 * A reel inside a circle feed: shown in vertical 9:16 format. Tapping it opens
 * the full-screen reels viewer (same experience as the Reels tab).
 */
export const CircleReelCard: React.FC<{ post: CommunityPost; onOpen: () => void }> = ({ post, onOpen }) => {
  const { openUserProfile, toggleLikePost, pressRepost, toggleSavePost } = useApp();
  const isAudio = post.postType === 'audio' || (!!post.audioUrl && !post.videoUrl);

  return (
    <View style={[styles.card, shadows.soft]}>
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
        style={styles.authorRow}
      >
        <Avatar uri={post.authorAvatar} name={post.authorName} size={40} showRing={post.authorRole === 'Mentor'} />
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{post.authorName}</Text>
          <Text style={styles.timeLine}>
            {post.authorSkill} • {post.timeAgo}
          </Text>
        </View>
        <View style={styles.reelBadge}>
          <Ionicons name="play-circle" size={12} color="#DB2777" />
          <Text style={styles.reelBadgeText}>Reel</Text>
        </View>
      </TouchableOpacity>

      {!!post.videoTitle && <Text style={styles.title}>{post.videoTitle}</Text>}
      {!!post.content && (
        <Text style={styles.caption} numberOfLines={2}>
          {post.content}
        </Text>
      )}

      {/* 9:16 poster */}
      <TouchableOpacity activeOpacity={0.92} onPress={onOpen} style={styles.posterWrap}>
        <View style={styles.poster}>
          {post.videoThumbnail ? (
            <Image source={{ uri: post.videoThumbnail }} style={styles.posterFill} resizeMode="cover" />
          ) : isAudio ? (
            <View style={[styles.posterFill, styles.audioBg]}>
              <MusicAnimation active={false} size={90} />
            </View>
          ) : (
            <LinearGradient colors={['#312E81', '#7C3AED', '#DB2777']} style={styles.posterFill} />
          )}
          <LinearGradient colors={['transparent', 'rgba(15,23,42,0.75)']} style={styles.posterShade} />
          <View style={styles.playCircle}>
            <Ionicons name="play" size={30} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
          <View style={styles.posterBottom}>
            <View style={styles.pill}>
              <Ionicons name="eye" size={11} color="#FFFFFF" />
              <Text style={styles.pillText}>{post.viewsCount ?? 0}</Text>
            </View>
            {!!post.videoDuration && (
              <View style={styles.pill}>
                <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                <Text style={styles.pillText}>{post.videoDuration}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Same compact interaction bar as the Home feed */}
      <View style={styles.statsBar}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => toggleLikePost(post.id)} style={styles.statBtn}>
          <Ionicons name={post.isLiked ? 'heart' : 'heart-outline'} size={20} color={post.isLiked ? '#EF4444' : '#334155'} />
          <Text style={[styles.statText, post.isLiked && { color: '#EF4444' }]}>{post.likesCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={onOpen} style={styles.statBtn}>
          <Ionicons name="chatbubble-outline" size={19} color="#334155" />
          <Text style={styles.statText}>{post.commentsCount ?? 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => pressRepost(post)} style={styles.statBtn}>
          <MaterialCommunityIcons name="repeat" size={20} color={post.isReposted ? '#16A34A' : '#334155'} />
          <Text style={[styles.statText, post.isReposted && { color: '#16A34A' }]}>{post.repostsCount || 0}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity activeOpacity={0.7} onPress={() => toggleSavePost(post.id)} style={styles.statBtn}>
          <Ionicons name={post.isSaved ? 'bookmark' : 'bookmark-outline'} size={19} color={post.isSaved ? '#F59E0B' : '#334155'} />
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
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  authorInfo: { marginLeft: 10, flex: 1 },
  authorName: { fontSize: 13, fontWeight: typography.weights.bold, color: '#0F172A' },
  timeLine: { fontSize: 11, color: '#64748B', marginTop: 2 },
  reelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  reelBadgeText: { fontSize: 10, fontWeight: '800', color: '#DB2777' },
  title: { fontSize: 14, fontWeight: typography.weights.bold, color: '#0F172A', marginBottom: 2 },
  caption: { fontSize: 13, color: '#334155', lineHeight: 19, marginBottom: spacing.sm },
  posterWrap: { alignItems: 'center', backgroundColor: '#0F172A', borderRadius: borderRadius.xl, overflow: 'hidden' },
  poster: { height: POSTER_HEIGHT, width: (POSTER_HEIGHT * 9) / 16, maxWidth: '100%', position: 'relative' },
  posterFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  audioBg: { backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center' },
  posterShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 },
  playCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(15,23,42,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterBottom: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  pillText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  statsBar: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: spacing.sm, marginTop: 2 },
  statBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  statText: { fontSize: 13, fontWeight: '600', color: '#334155' },
});
