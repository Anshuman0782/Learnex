import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { UserRole, CommunityPost } from '../../types';
import { postKind, isMediaPost, postCover, POST_KIND_ICON } from '../../utils/postKind';
import { Avatar } from './Avatar';
import { FollowListModal } from '../profile/FollowListModal';
import { MusicAnimation } from './NowPlayingBar';
import { CritiqueModal } from '../community/CritiqueModal';
import { ReelViewerModal } from './ReelViewerModal';
import { getFeedRequest } from '../../api/posts.api';
import { useApp } from '../../context/AppContext';
import {
  getUserProfileRequest,
  followUserRequest,
  unfollowUserRequest,
  reportRequest,
  type PublicProfile,
} from '../../api/social.api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

export interface UserProfileData {
  id?: string;
  name: string;
  avatarUrl?: string;
  role?: UserRole;
  badge?: string;
  specialty?: string;
  rating?: number;
  critiquesGiven?: number;
  studentsMentored?: number;
  responseTime?: string;
  streakDays?: number;
  xpPoints?: number;
  completedSessions?: number;
  bio?: string;
  track?: string;
  hobby?: string;
}

interface UserProfileModalProps {
  visible: boolean;
  user: UserProfileData | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  user,
  onClose,
}) => {
  const { showDialog, openChatWith } = useApp();
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);

  // Content tabs (About / Videos / Reels / Discuss) + filter + viewer.
  const [tab, setTab] = useState<'about' | 'video' | 'reel' | 'discuss'>('about');
  const [contentFilter, setContentFilter] = useState<'latest' | 'popular' | 'oldest'>('latest');
  const [content, setContent] = useState<CommunityPost[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [viewPost, setViewPost] = useState<CommunityPost | null>(null);
  const [reelViewer, setReelViewer] = useState<{ reels: CommunityPost[]; index: number } | null>(null);

  // Load this user's public content once we know their id.
  useEffect(() => {
    if (!visible || !user?.id) {
      setContent([]);
      setTab('about');
      return;
    }
    let active = true;
    setContentLoading(true);
    Promise.all([
      getFeedRequest({ authorId: user.id }),
      getFeedRequest({ authorId: user.id, shorts: true }),
    ])
      .then(([regular, shorts]) => {
        if (!active) return;
        const map = new Map<string, CommunityPost>();
        [...regular, ...shorts].forEach((p) => map.set(p.id, p));
        setContent(Array.from(map.values()));
      })
      .catch(() => active && setContent([]))
      .finally(() => active && setContentLoading(false));
    return () => {
      active = false;
    };
  }, [visible, user?.id]);

  // Fetch the real profile (follow status + counts + bio) when opened.
  useEffect(() => {
    let active = true;
    if (visible && user?.id) {
      getUserProfileRequest(user.id)
        .then((p) => active && setProfile(p))
        .catch(() => active && setProfile(null));
    } else {
      setProfile(null);
    }
    return () => {
      active = false;
    };
  }, [visible, user?.id]);

  // Actually perform the follow/unfollow with an instant optimistic count update.
  const doToggleFollow = async () => {
    if (!user?.id || !profile || profile.isSelf) return;
    setFollowBusy(true);
    const wasFollowing = profile.isFollowing;
    const prevCount = profile.followersCount;
    // Optimistic: update the button + follower count immediately.
    setProfile((p) =>
      p
        ? {
            ...p,
            isFollowing: !wasFollowing,
            followersCount: Math.max(0, p.followersCount + (wasFollowing ? -1 : 1)),
          }
        : p,
    );
    try {
      const res = wasFollowing
        ? await unfollowUserRequest(user.id)
        : await followUserRequest(user.id);
      setProfile((p) =>
        p ? { ...p, isFollowing: res.isFollowing, followersCount: res.followersCount } : p,
      );
    } catch {
      // revert on failure
      setProfile((p) => (p ? { ...p, isFollowing: wasFollowing, followersCount: prevCount } : p));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleToggleFollow = () => {
    if (!user?.id || !profile || profile.isSelf) return;
    // Unfollowing asks for confirmation first; following is instant.
    if (profile.isFollowing) {
      showDialog({
        title: `Unfollow ${user.name}?`,
        message: `You'll stop seeing ${user.name}'s new posts in your follow updates. You can follow again anytime.`,
        icon: 'person-remove-outline',
        confirmText: 'Unfollow',
        cancelText: 'Cancel',
        isDestructive: true,
        onConfirm: () => {
          void doToggleFollow();
        },
      });
      return;
    }
    void doToggleFollow();
  };

  const handleReport = () => {
    if (!user?.id) return;
    showDialog({
      title: 'Report User',
      message: `Report ${user.name} for inappropriate behavior? Our team will review it.`,
      icon: 'flag-outline',
      confirmText: 'Report',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: () => {
        reportRequest({ targetType: 'USER', reportedUserId: user.id, reason: 'Reported from profile' })
          .then(() => showDialog({ title: 'Report Submitted', message: 'Thanks — our team will review it.', icon: 'checkmark-circle', confirmText: 'Done' }))
          .catch(() => {});
      },
    });
  };


  const [selectedSessionType, setSelectedSessionType] = useState('30m Technique Check');
  const [selectedSlot, setSelectedSlot] = useState('Tomorrow, 4:00 PM');

  if (!user) return null;

  const isMentor = Boolean(
    user.role === 'Mentor' || (user.name && user.name.toLowerCase().includes('mentor'))
  );

  // Categorize + filter this user's content for the tabs.
  const isReelPost = (p: CommunityPost) => !!p.isShort;
  // Mirrors the composer: Posts (photo / video / audio) · Reels · Discuss (text).
  const isVideoPost = (p: CommunityPost) => isMediaPost(p);
  const isDiscussPost = (p: CommunityPost) => postKind(p) === 'discussion';

  const contentForTab = content
    .filter((p) => (tab === 'video' ? isVideoPost(p) : tab === 'reel' ? isReelPost(p) : tab === 'discuss' ? isDiscussPost(p) : false))
    .sort((a, b) => {
      if (contentFilter === 'popular') return (b.likesCount || 0) - (a.likesCount || 0);
      // latest = as returned (newest first); oldest = reverse
      return 0;
    });
  const displayContent = contentFilter === 'oldest' ? [...contentForTab].reverse() : contentForTab;

  const handleConfirmBooking = () => {
    setIsBookingOpen(false);
    showDialog({
      title: 'Session Confirmed! 📅🎉',
      message: `Your 1-on-1 mentorship session with ${user.name} is booked for ${selectedSlot}.\n\nSession: ${selectedSessionType}\nMeeting link has been sent to your calendar!`,
      icon: 'calendar',
      confirmText: 'Great!',
    });
  };

  /** Open the real 1:1 chat with this person (closes the profile sheet first). */
  const handleMessage = () => {
    if (!user.id) {
      Alert.alert('Message unavailable', 'This profile can’t be messaged right now.');
      return;
    }
    onClose();
    openChatWith({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, role: user.role });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalSheet}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.roleTagTop}>
              <Ionicons
                name={isMentor ? 'star' : 'school'}
                size={12}
                color={isMentor ? '#7C3AED' : '#4F46E5'}
              />
              <Text style={[styles.roleTagTopText, isMentor && { color: '#7C3AED' }]}>
                {isMentor ? 'Verified Mentor' : 'Community Member'}
              </Text>
            </View>

            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Identity Card */}
            <View style={styles.identityCard}>
              <View style={styles.avatarRingContainer}>
                <LinearGradient
                  colors={isMentor ? ['#7C3AED', '#EC4899'] : ['#4F46E5', '#38BDF8']}
                  style={styles.avatarGradientRing}
                >
                  <Avatar
                    uri={user.avatarUrl}
                    name={user.name}
                    size={68}
                    showRing={false}
                  />
                </LinearGradient>
                {isMentor && (
                  <View style={styles.mentorVerifiedBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
              </View>

              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userBadge}>
                {user.badge || (isMentor ? 'Certified Master Coach' : 'Vocal Explorer')}
              </Text>

              {user.specialty && (
                <View style={styles.specialtyPill}>
                  <Ionicons name="sparkles" size={11} color="#4F46E5" />
                  <Text style={styles.specialtyText}>{user.specialty}</Text>
                </View>
              )}

              {(profile?.bio || user.bio) ? (
                <Text style={styles.bioText}>{profile?.bio || user.bio}</Text>
              ) : null}

              {profile && (
                <>
                  <View style={styles.followCountsRow}>
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setFollowList('followers')} style={styles.followCountItem}>
                      <Text style={styles.followCountNum}>{profile.followersCount}</Text>
                      <Text style={styles.followCountLabel}>Followers</Text>
                    </TouchableOpacity>
                    <View style={styles.followCountDivider} />
                    <TouchableOpacity activeOpacity={0.7} onPress={() => setFollowList('following')} style={styles.followCountItem}>
                      <Text style={styles.followCountNum}>{profile.followingCount}</Text>
                      <Text style={styles.followCountLabel}>Following</Text>
                    </TouchableOpacity>
                    <View style={styles.followCountDivider} />
                    <View style={styles.followCountItem}>
                      <Text style={styles.followCountNum}>{profile.postsCount}</Text>
                      <Text style={styles.followCountLabel}>Posts</Text>
                    </View>
                  </View>

                  {!profile.isSelf && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleToggleFollow}
                      disabled={followBusy}
                      style={[styles.followBtn, profile.isFollowing && styles.followingBtn]}
                    >
                      <Ionicons
                        name={profile.isFollowing ? 'checkmark' : 'person-add'}
                        size={15}
                        color={profile.isFollowing ? '#4F46E5' : '#FFFFFF'}
                      />
                      <Text style={[styles.followBtnText, profile.isFollowing && styles.followingBtnText]}>
                        {profile.isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>


            {/* Content tabs: About / Videos / Reels / Discuss */}
            <View style={styles.profileTabs}>
              {([
                { key: 'about', label: 'About', icon: 'information-circle-outline' },
                { key: 'video', label: 'Posts', icon: 'grid-outline' },
                { key: 'reel', label: 'Reels', icon: 'play-circle-outline' },
                { key: 'discuss', label: 'Discuss', icon: 'chatbubbles-outline' },
              ] as const).map((t) => {
                const active = tab === t.key;
                return (
                  <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.profileTab, active && styles.profileTabActive]}>
                    <Ionicons name={t.icon} size={15} color={active ? '#4F46E5' : '#94A3B8'} />
                    <Text style={[styles.profileTabText, active && styles.profileTabTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {tab === 'about' ? (
              <View style={styles.aboutBox}>
                <Text style={styles.aboutRowLabel}>Bio</Text>
                <Text style={styles.aboutRowValue}>{profile?.bio || user.bio || 'No bio yet.'}</Text>
                <View style={styles.aboutMetaRow}>
                  {!!(profile?.hobby || user.hobby) && (
                    <View style={styles.aboutChip}>
                      <Ionicons name="sparkles" size={12} color="#4F46E5" />
                      <Text style={styles.aboutChipText}>{profile?.hobby || user.hobby}</Text>
                    </View>
                  )}
                  <View style={styles.aboutChip}>
                    <Ionicons name={isMentor ? 'star' : 'school'} size={12} color="#4F46E5" />
                    <Text style={styles.aboutChipText}>{isMentor ? 'Mentor' : 'Learner'}</Text>
                  </View>
                  {!!profile && (
                    <View style={styles.aboutChip}>
                      <Ionicons name="albums-outline" size={12} color="#4F46E5" />
                      <Text style={styles.aboutChipText}>{profile.postsCount} posts</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.contentSection}>
                {/* Filter row */}
                <View style={styles.contentFilterRow}>
                  {([
                    { key: 'latest', label: 'Latest' },
                    { key: 'popular', label: 'Popular' },
                    { key: 'oldest', label: 'Oldest' },
                  ] as const).map((f) => {
                    const active = contentFilter === f.key;
                    return (
                      <TouchableOpacity key={f.key} onPress={() => setContentFilter(f.key)} style={[styles.contentFilterChip, active && styles.contentFilterChipActive]}>
                        <Text style={[styles.contentFilterText, active && styles.contentFilterTextActive]}>{f.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {contentLoading ? (
                  <Text style={styles.contentEmpty}>Loading…</Text>
                ) : displayContent.length === 0 ? (
                  <Text style={styles.contentEmpty}>
                    No {tab === 'video' ? 'posts' : tab === 'reel' ? 'reels' : 'discussions'} yet.
                  </Text>
                ) : tab === 'reel' ? (
                  /* Reels: 2-column grid of tall covers (Instagram-style). */
                  <View style={styles.reelGrid}>
                    {displayContent.map((p, i) => (
                      <TouchableOpacity
                        key={p.id}
                        activeOpacity={0.85}
                        onPress={() => setReelViewer({ reels: displayContent, index: i })}
                        style={styles.reelCard}
                      >
                        {p.videoThumbnail ? (
                          <Image source={{ uri: p.videoThumbnail }} style={styles.reelCover} />
                        ) : (
                          <LinearGradient colors={['#312E81', '#7C3AED', '#DB2777']} style={styles.reelCover}>
                            <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.9)" />
                          </LinearGradient>
                        )}
                        <LinearGradient
                          colors={['transparent', 'rgba(15,23,42,0.85)']}
                          style={styles.reelCoverOverlay}
                        >
                          <Text style={styles.reelCoverTitle} numberOfLines={1}>
                            {p.videoTitle || p.content || 'Reel'}
                          </Text>
                          <View style={styles.reelCoverStats}>
                            <Ionicons name="eye" size={11} color="#FFFFFF" />
                            <Text style={styles.reelCoverStatText}>{p.viewsCount ?? 0}</Text>
                            <Ionicons name="heart" size={11} color="#FFFFFF" style={{ marginLeft: 8 }} />
                            <Text style={styles.reelCoverStatText}>{p.likesCount ?? 0}</Text>
                          </View>
                        </LinearGradient>
                        <View style={styles.reelPlayBadge}>
                          <Ionicons name="play" size={12} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  /* Videos & Discuss: list rows — left thumbnail, right title/date/stats. */
                  <View style={styles.contentList}>
                    {displayContent.map((p) => {
                      const audio = p.postType === 'audio' || (!!p.audioUrl && !p.videoUrl);
                      return (
                        <TouchableOpacity key={p.id} activeOpacity={0.85} onPress={() => setViewPost(p)} style={styles.contentRow}>
                          <View style={styles.rowThumb}>
                            {postCover(p) ? (
                              <Image source={{ uri: postCover(p) }} style={styles.rowThumbImg} />
                            ) : audio ? (
                              <View style={[styles.rowThumbImg, styles.rowThumbAudio]}>
                                <MusicAnimation active={false} size={30} />
                              </View>
                            ) : (
                              <View style={[styles.rowThumbImg, styles.rowThumbFallback]}>
                                <Ionicons name={POST_KIND_ICON[postKind(p)] as any} size={22} color="#94A3B8" />
                              </View>
                            )}
                            {tab === 'video' && (
                              <View style={styles.rowPlayDot}>
                                <Ionicons name={postKind(p) === 'photo' ? 'images' : postKind(p) === 'audio' ? 'musical-notes' : 'play'} size={12} color="#FFFFFF" />
                              </View>
                            )}
                          </View>

                          <View style={styles.rowInfo}>
                            <Text style={styles.rowTitle} numberOfLines={2}>
                              {p.videoTitle || p.content || 'Untitled'}
                            </Text>
                            <Text style={styles.rowDate}>{p.timeAgo}</Text>
                            <View style={styles.rowStats}>
                              <Ionicons name="eye-outline" size={12} color="#94A3B8" />
                              <Text style={styles.rowStatText}>{p.viewsCount ?? 0}</Text>
                              <Ionicons name="heart-outline" size={12} color="#94A3B8" style={{ marginLeft: 10 }} />
                              <Text style={styles.rowStatText}>{p.likesCount ?? 0}</Text>
                              <Ionicons name="chatbubble-outline" size={12} color="#94A3B8" style={{ marginLeft: 10 }} />
                              <Text style={styles.rowStatText}>{p.commentsCount ?? p.comments?.length ?? 0}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Action Buttons: 4 Equal Balanced Actions for Mentor; Message + Calls for Learner */}
            {!profile?.isSelf && (
            <View style={styles.actionButtonsContainer}>
              {isMentor ? (
                /* Mentor 2x2 Balanced Action Grid */
                <View style={styles.actionGridContainer}>
                  {/* Row 1: Book Session & Message */}
                  <View style={styles.actionGridRow}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setIsBookingOpen(true)}
                      style={styles.gridBtn}
                    >
                      <LinearGradient
                        colors={['#7C3AED', '#6D28D9']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gridBtnGradient}
                      >
                        <Ionicons name="calendar" size={16} color="#FFFFFF" />
                        <Text style={styles.gridBtnText}>Book Session</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={handleMessage}
                      style={styles.gridBtn}
                    >
                      <LinearGradient
                        colors={['#4F46E5', '#4338CA']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gridBtnGradient}
                      >
                        <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
                        <Text style={styles.gridBtnText}>Message</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                </View>
              ) : (
                /* Learner Actions */
                <View style={styles.actionGridContainer}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={handleMessage}
                    style={styles.memberMessageBtn}
                  >
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.memberMessageGradient}
                    >
                      <Ionicons name="chatbubbles" size={17} color="#FFFFFF" />
                      <Text style={styles.memberMessageText}>Send Message</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                </View>
              )}
            </View>
            )}
          </ScrollView>

          {/* ================= MODAL 1: BOOK SESSION SHEET ================= */}
          <Modal visible={isBookingOpen} animationType="slide" transparent onRequestClose={() => setIsBookingOpen(false)}>
            <View style={styles.innerBackdrop}>
              <View style={styles.innerSheet}>
                <View style={styles.dragHandle} />
                <View style={styles.innerHeaderRow}>
                  <Text style={styles.innerTitle}>Book Mentorship Session</Text>
                  <TouchableOpacity onPress={() => setIsBookingOpen(false)}>
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.innerSub}>With {user.name} ({user.specialty || 'Coach'})</Text>

                {/* Session Type */}
                <Text style={styles.innerFieldLabel}>Select Session Format</Text>
                <View style={styles.sessionTypeOptions}>
                  {[
                    { id: '30m Technique Check', duration: '30 mins', desc: 'Live pitch, posture & fault check' },
                    { id: '45m Deep Dive', duration: '45 mins', desc: 'Repertoire critique & customized drills' },
                  ].map((item) => {
                    const isSelected = selectedSessionType === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.8}
                        onPress={() => setSelectedSessionType(item.id)}
                        style={[styles.sessionTypeCard, isSelected && styles.sessionTypeCardActive]}
                      >
                        <View style={styles.sessionTypeLeft}>
                          <Text style={[styles.sessionTypeTitle, isSelected && styles.sessionTypeTitleActive]}>
                            {item.id}
                          </Text>
                          <Text style={styles.sessionTypeDesc}>{item.desc}</Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={isSelected ? '#7C3AED' : '#CBD5E1'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Date & Time Slot */}
                <Text style={styles.innerFieldLabel}>Available Time Slots</Text>
                <View style={styles.slotsRow}>
                  {['Tomorrow, 4:00 PM', 'Friday, 6:30 PM', 'Saturday, 11:00 AM'].map((slot) => {
                    const isSelected = selectedSlot === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        activeOpacity={0.8}
                        onPress={() => setSelectedSlot(slot)}
                        style={[styles.slotChip, isSelected && styles.slotChipActive]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={12}
                          color={isSelected ? '#FFFFFF' : '#475569'}
                        />
                        <Text style={[styles.slotText, isSelected && styles.slotTextActive]}>
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={handleConfirmBooking}
                  style={styles.confirmBookingBtn}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#4F46E5']}
                    style={styles.confirmBookingGradient}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmBookingText}>Confirm & Reserve Session</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>


          {/* Followers / Following list for this profile */}
          <FollowListModal
            visible={!!followList}
            userId={user?.id ?? null}
            mode={followList ?? 'followers'}
            onClose={() => setFollowList(null)}
          />

          {/* Video / Discuss viewer (video plays inline, comments, etc.) */}
          <CritiqueModal
            visible={!!viewPost}
            post={viewPost}
            onClose={() => setViewPost(null)}
          />

          {/* Reels open in full reel format (Instagram-style vertical viewer) */}
          <ReelViewerModal
            visible={!!reelViewer}
            reels={reelViewer?.reels ?? []}
            startIndex={reelViewer?.index ?? 0}
            onClose={() => setReelViewer(null)}
          />

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '88%',
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xl,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: spacing.xs,
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
  roleTagTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  roleTagTopText: {
    fontSize: 10,
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
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.base,
  },
  identityCard: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  avatarRingContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatarGradientRing: {
    padding: 3,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorVerifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  userBadge: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  specialtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 5,
    marginTop: 6,
  },
  specialtyText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  bioText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: spacing.base,
  },
  profileTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.lg,
    padding: 3,
    gap: 2,
    marginBottom: spacing.sm,
  },
  profileTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  profileTabActive: { backgroundColor: '#FFFFFF' },
  profileTabText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  profileTabTextActive: { color: '#4F46E5', fontWeight: 'bold' },
  aboutBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    marginBottom: spacing.sm,
  },
  aboutRowLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4 },
  aboutRowValue: { fontSize: 14, color: '#334155', lineHeight: 20, marginTop: 6 },
  aboutMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  aboutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  aboutChipText: { fontSize: 12, fontWeight: '600', color: '#4338CA' },
  contentSection: { marginBottom: spacing.sm },
  contentFilterRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  contentFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  contentFilterChipActive: { backgroundColor: '#4F46E5' },
  contentFilterText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  contentFilterTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  contentEmpty: { fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 24 },
  // Videos & Discuss — list rows (left thumbnail + right details)
  contentList: { gap: 12 },
  contentRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 8,
  },
  rowThumb: {
    width: 120,
    height: 74,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  rowThumbImg: { width: 120, height: 74 },
  rowThumbAudio: { backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  rowThumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  rowPlayDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -14,
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1, justifyContent: 'center', gap: 3 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 18 },
  rowDate: { fontSize: 11, color: '#94A3B8' },
  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  rowStatText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  // Reels — 2-column grid of tall covers
  reelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reelCard: {
    width: '47%',
    flexGrow: 1,
    aspectRatio: 0.62,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E1B4B',
  },
  reelCover: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  reelCoverOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    gap: 3,
  },
  reelCoverTitle: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  reelCoverStats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reelCoverStatText: { fontSize: 10, color: '#FFFFFF', fontWeight: '600' },
  reelPlayBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 4,
  },
  followCountItem: { alignItems: 'center', paddingHorizontal: 16 },
  followCountNum: { fontSize: 16, fontWeight: typography.weights.bold, color: '#0F172A' },
  followCountLabel: { fontSize: 11, color: '#64748B', marginTop: 1 },
  followCountDivider: { width: 1, height: 24, backgroundColor: '#E2E8F0' },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 28,
    borderRadius: borderRadius.full,
    backgroundColor: '#4F46E5',
  },
  followingBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  followBtnText: { fontSize: 13, fontWeight: typography.weights.bold, color: '#FFFFFF' },
  followingBtnText: { color: '#4F46E5' },
  statsSection: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 3,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statBigValue: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  actionButtonsContainer: {
    marginTop: spacing.xs,
  },
  actionGridContainer: {
    gap: 8,
  },
  actionGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridBtn: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gridBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  gridBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberMessageBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  memberMessageGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 6,
  },
  memberMessageText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  innerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  innerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.base,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    gap: spacing.sm,
  },
  innerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  innerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  innerSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  innerFieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 4,
  },
  sessionTypeOptions: {
    gap: 8,
  },
  sessionTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  sessionTypeCardActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#7C3AED',
  },
  sessionTypeLeft: {
    flex: 1,
  },
  sessionTypeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  sessionTypeTitleActive: {
    color: '#7C3AED',
  },
  sessionTypeDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  slotChipActive: {
    backgroundColor: '#7C3AED',
  },
  slotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  slotTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  confirmBookingBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  confirmBookingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 6,
  },
  confirmBookingText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  chatSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    height: '80%',
    paddingTop: spacing.xs + 2,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  chatUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatUserMeta: {
    gap: 1,
  },
  chatUserName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  chatUserRole: {
    fontSize: 10,
    color: '#64748B',
  },
  chatMessagesScroll: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: 10,
  },
  chatBubble: {
    maxWidth: '80%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  myBubble: {
    backgroundColor: '#4F46E5',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  chatBubbleText: {
    fontSize: 12,
    lineHeight: 17,
  },
  myBubbleText: {
    color: '#FFFFFF',
  },
  theirBubbleText: {
    color: '#1E293B',
  },
  chatBubbleTime: {
    fontSize: 9,
    alignSelf: 'flex-end',
  },
  myBubbleTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirBubbleTime: {
    color: '#94A3B8',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  videoCallBtn: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  videoCallGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  videoCallText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  voiceCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: borderRadius.xl,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 6,
  },
  voiceCallText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
});
