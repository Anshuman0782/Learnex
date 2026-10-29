import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  Share,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GuestUpgradeBanner } from '../../components/common/GuestUpgradeBanner';
import { MySkillsCard } from '../../components/profile/MySkillsCard';
import { AiProgressCard } from '../../components/profile/AiProgressCard';
import { useApp } from '../../context/AppContext';
import { Avatar, ConfirmModal } from '../../components/common';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { UploadAnalyticsModal } from '../../components/profile/UploadAnalyticsModal';
import { FollowListModal } from '../../components/profile/FollowListModal';
import { AdminPanelModal } from '../../components/admin/AdminPanelModal';
import { CritiqueModal } from '../../components/community/CritiqueModal';
import { MusicAnimation } from '../../components/common/NowPlayingBar';
import { getFeedRequest } from '../../api/posts.api';
import { getUserProfileRequest, type PublicProfile } from '../../api/social.api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { CommunityPost } from '../../types';
import { postKind, isMediaPost, postCover, POST_KIND_LABEL, POST_KIND_ICON } from '../../utils/postKind';

type SectionKey = 'hub' | 'analytics' | 'uploads' | 'saved' | 'rewards';

interface HubTileItem {
  id: SectionKey;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  badge: string;
}

const WEEKLY_PRACTICE_DATA = [
  { day: 'Mon', mins: 45, height: 45 },
  { day: 'Tue', mins: 60, height: 60 },
  { day: 'Wed', mins: 35, height: 35 },
  { day: 'Thu', mins: 50, height: 50 },
  { day: 'Fri', mins: 65, height: 65 },
  { day: 'Sat', mins: 90, height: 90 },
  { day: 'Sun', mins: 20, height: 20 },
];

const SKILL_METRICS = [
  { name: 'Pitch Accuracy', score: 94, level: 'Mastered', color: '#10B981', icon: 'mic' },
  { name: 'Tone Warmth & Resonance', score: 92, level: 'Mastered', color: '#4F46E5', icon: 'musical-notes' },
  { name: 'Rhythm & Tempo Lock', score: 90, level: 'Mastered', color: '#7C3AED', icon: 'timer' },
  { name: 'Breath Support & Posture', score: 88, level: 'High', color: '#F59E0B', icon: 'fitness' },
  { name: 'Vibrato Oscillation', score: 78, level: 'Improving', color: '#EC4899', icon: 'pulse' },
];

interface ProfilePlaceholderScreenProps {
  onClose?: () => void;
}

export const ProfilePlaceholderScreen: React.FC<ProfilePlaceholderScreenProps> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    user,
    selectedRole,
    selectedHobby,
    posts,
    toggleSavePost,
    openUserProfile,
    openRewardsModal,
    deletePost,
    setPostPrivacy,
    logout,
    showDialog,
    closeMyProfile,
  } = useApp();

  const [activeSection, setActiveSection] = useState<SectionKey>('hub');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activePostModal, setActivePostModal] = useState<CommunityPost | null>(null);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // --- My Uploads: the user's own content (video / reels / audio / discussion) ---
  const [uploads, setUploads] = useState<CommunityPost[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadFilter, setUploadFilter] = useState<'all' | 'video' | 'reel' | 'post' | 'reposts'>('all');
  const [analyticsPost, setAnalyticsPost] = useState<CommunityPost | null>(null);
  // Posts the user has reposted — shown in their own account under "Reposts".
  const [reposts, setReposts] = useState<CommunityPost[]>([]);

  // Real followers/following counts for the current user.
  const [myProfile, setMyProfile] = useState<PublicProfile | null>(null);
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    getUserProfileRequest(user.id).then(setMyProfile).catch(() => {});
  }, [user?.id]);

  // Refresh follower/following counts whenever this screen regains focus, so a
  // follow/unfollow done elsewhere is reflected here without a restart.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (user?.id) getUserProfileRequest(user.id).then(setMyProfile).catch(() => {});
    });
    return unsub;
  }, [navigation, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    setUploadsLoading(true);
    Promise.all([
      getFeedRequest({ authorId: user.id }),
      getFeedRequest({ authorId: user.id, shorts: true }),
    ])
      .then(([regular, shorts]) => {
        const map = new Map<string, CommunityPost>();
        [...regular, ...shorts].forEach((p) => map.set(p.id, p));
        setUploads(Array.from(map.values()));
      })
      .catch(() => setUploads([]))
      .finally(() => setUploadsLoading(false));

    // Load everything this user has reposted (videos, reels and posts).
    Promise.all([
      getFeedRequest({ reposted: true }),
      getFeedRequest({ reposted: true, shorts: true }),
    ])
      .then(([regular, shorts]) => {
        const map = new Map<string, CommunityPost>();
        [...regular, ...shorts].forEach((p) => map.set(p.id, p));
        setReposts(Array.from(map.values()));
      })
      .catch(() => setReposts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, posts.length, activeSection]);

  // Return to root main profile page whenever profile tab icon is clicked
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setActiveSection('hub');
      setActivePostModal(null);
      setAnalyticsPost(null);
      setIsEditModalOpen(false);
      setIsSignOutModalOpen(false);
    });
    return unsubscribe;
  }, [navigation]);

  // Link from Home Page (e.g. Analytics button)
  useEffect(() => {
    if (route?.params?.section) {
      setActiveSection(route.params.section as SectionKey);
    }
  }, [route?.params?.section]);

  const isMentor = selectedRole === 'Mentor';

  const isReel = (p: CommunityPost) => !!p.isShort;
  // Mirrors the composer: Posts (photo / video / audio) · Reels · Discuss (text).
  const isVideoUpload = (p: CommunityPost) => isMediaPost(p);
  const isPostUpload = (p: CommunityPost) => postKind(p) === 'discussion';

  const filteredUploads = uploads.filter((p) => {
    if (uploadFilter === 'all') return true;
    if (uploadFilter === 'reel') return isReel(p);
    if (uploadFilter === 'video') return isVideoUpload(p);
    return isPostUpload(p);
  });

  const savedPosts = posts.filter((p) => p.isSaved && !p.repostedByName);

  const [uploadBusy, setUploadBusy] = useState(false);

  const handleDeleteUpload = (post: CommunityPost) => {
    showDialog({
      title: 'Delete Content',
      message: 'This permanently removes this content and its stats. This cannot be undone.',
      icon: 'trash-outline',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        setUploadBusy(true);
        try {
          await deletePost(post.id);
          setUploads((prev) => prev.filter((p) => p.id !== post.id));
          setAnalyticsPost(null);
        } catch (e: any) {
          Alert.alert('Delete failed', e?.message || 'Please try again.');
        } finally {
          setUploadBusy(false);
        }
      },
    });
  };

  const handleTogglePrivacy = async (post: CommunityPost) => {
    setUploadBusy(true);
    try {
      const updated = await setPostPrivacy(post.id, !post.isPrivate);
      setUploads((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setAnalyticsPost(updated);
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Please try again.');
    } finally {
      setUploadBusy(false);
    }
  };

  const hubTiles: HubTileItem[] = [
    {
      id: 'rewards',
      title: 'Season Rewards & XP',
      subtitle: 'Rankings, quests & perks',
      icon: 'trophy',
      color: '#D97706',
      bgColor: '#FEF3C7',
      badge: '',
    },
    {
      id: 'analytics',
      title: 'Practice Analytics',
      subtitle: 'Weekly chart & skill meters',
      icon: 'analytics',
      color: '#4F46E5',
      bgColor: '#EEF2FF',
      badge: '',
    },
    {
      id: 'uploads',
      title: 'My Uploads',
      subtitle: 'Videos, reels & posts + analytics',
      icon: 'cloud-upload',
      color: '#0284C7',
      bgColor: '#E0F2FE',
      badge: `${uploads.length}`,
    },
    {
      id: 'saved',
      title: 'Saved Library',
      subtitle: 'Your bookmarked content',
      icon: 'bookmark',
      color: '#475569',
      bgColor: '#F1F5F9',
      badge: `${savedPosts.length}`,
    },
  ];

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out ${user?.name || 'my'} practice profile on Lernex!`,
      });
    } catch {
      showDialog({
        title: 'Profile Link Copied! 🔗',
        message: 'Your personal portfolio link is copied to your clipboard.',
        icon: 'share-social-outline',
        confirmText: 'Awesome',
      });
    }
  };

  const handleLogout = () => {
    setIsSignOutModalOpen(true);
  };

  const handleConfirmSignOut = () => {
    setIsSignOutModalOpen(false);
    logout();
    const parentNav = navigation.getParent();
    if (parentNav) {
      parentNav.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as any }],
      });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + spacing.xs, 30),
            paddingBottom: Math.max(insets.bottom + 95, 120),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Floating App Bar */}
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {onClose && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onClose}
                style={styles.closeHeaderBtn}
              >
                <Ionicons name="arrow-back" size={20} color="#0F172A" />
              </TouchableOpacity>
            )}
            <View style={styles.handleBadge}>
              <Text style={styles.handleText}>{user?.name || 'My Profile'}</Text>
            </View>
          </View>

          <View style={styles.topBarActions}>
            {/* User Static Role Badge */}
            <View style={[styles.roleChip, isMentor && styles.roleChipMentor]}>
              <Text style={[styles.roleChipText, isMentor && styles.roleChipTextMentor]}>
                {isMentor ? '✨ Mentor' : selectedRole === 'Guest' ? '👤 Guest' : '🎓 Learner'}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleShareProfile}
              style={styles.iconCircleBtn}
            >
              <Ionicons name="share-outline" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Identity Card */}
        <View style={[styles.heroCard, shadows.card]}>
          <LinearGradient
            colors={isMentor ? ['#7C3AED', '#EC4899'] : ['#4F46E5', '#38BDF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroGradientCover}
          />

          <View style={styles.heroContentBlock}>
            <View style={styles.avatarRowContainer}>
              <View style={styles.avatarRingWrapper}>
                <Avatar
                  uri={user?.avatarUrl}
                  name={user?.name || 'LERNEX'}
                  size={72}
                  showRing={false}
                />
                <View style={styles.levelRingBadge}>
                  <Text style={styles.levelRingBadgeText}>LVL {user?.level ?? 1}</Text>
                </View>
              </View>

              {/* Action Buttons: Edit Profile & Share */}
              <View style={styles.profileActionButtons}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsEditModalOpen(true)}
                  style={styles.editProfileBtn}
                >
                  <Ionicons name="pencil" size={12} color="#FFFFFF" />
                  <Text style={styles.editProfileBtnText}>Edit Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleShareProfile}
                  style={styles.shareProfileSmallBtn}
                >
                  <Ionicons name="share-social-outline" size={14} color="#4F46E5" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Name & Bio */}
            <View style={styles.nameBlock}>
              <View style={styles.nameWithBadgeRow}>
                <Text style={styles.userNameText}>{user?.name || 'Lernex User'}</Text>
                {isMentor ? (
                  <View style={styles.verifiedMentorBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#7C3AED" />
                    <Text style={styles.verifiedMentorBadgeText}>Mentor</Text>
                  </View>
                ) : (
                  <View style={styles.learnerVerifiedBadge}>
                    <Text style={styles.learnerVerifiedBadgeText}>{selectedRole === 'Guest' ? 'Guest' : 'Learner'}</Text>
                  </View>
                )}
              </View>

              {!!user?.bio && <Text style={styles.userBioText}>{user.bio}</Text>}

              {/* Guests: how to join XP / leaderboards */}
              <View style={{ marginTop: 10 }}>
                <GuestUpgradeBanner onBeforeUpgrade={closeMyProfile} />
              </View>

              {/* Every skill + role, and "Add skill" (members only) */}
              <MySkillsCard onBeforeNavigate={closeMyProfile} />

              {/* AI Progress per AI-judged skill (only the owner sees it) */}
              {(selectedRole === 'Learner' || selectedRole === 'Mentor') && <AiProgressCard />}

              {/* Focus pill — guests only (members see their skills card above) */}
              {selectedRole === 'Guest' && !!selectedHobby && (
              <View style={styles.trackPillsRow}>
                <View style={styles.skillTrackPill}>
                  <Ionicons name="sparkles" size={11} color="#4F46E5" />
                  <Text style={styles.skillTrackPillText}>{selectedHobby}</Text>
                </View>
              </View>
              )}
            </View>
          </View>
        </View>

        {/* Followers / Following */}
        <View style={styles.followRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFollowList('followers')}
            style={styles.followCell}
          >
            <Text style={styles.followNum}>{myProfile?.followersCount ?? 0}</Text>
            <Text style={styles.followLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.followDivider} />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFollowList('following')}
            style={styles.followCell}
          >
            <Text style={styles.followNum}>{myProfile?.followingCount ?? 0}</Text>
            <Text style={styles.followLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Compact 4-Cell Key Stats Summary Strip */}
        <View style={[styles.compactSummaryStrip, shadows.soft]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSection('analytics')}
            style={styles.summaryCell}
          >
            <Text style={styles.summaryCellNum}>{user?.streakDays ?? 0}d 🔥</Text>
            <Text style={styles.summaryCellLabel}>Streak</Text>
          </TouchableOpacity>

          <View style={styles.summaryDivider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSection('analytics')}
            style={styles.summaryCell}
          >
            <Text style={styles.summaryCellNum}>{user?.seasonXp ?? 0} ⚡</Text>
            <Text style={styles.summaryCellLabel}>XP this month</Text>
          </TouchableOpacity>

          <View style={styles.summaryDivider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSection('uploads')}
            style={styles.summaryCell}
          >
            <Text style={styles.summaryCellNum}>{uploads.length} 🎬</Text>
            <Text style={styles.summaryCellLabel}>Uploads</Text>
          </TouchableOpacity>

          <View style={styles.summaryDivider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSection('saved')}
            style={styles.summaryCell}
          >
            <Text style={[styles.summaryCellNum, { color: '#7C3AED' }]}>
              {savedPosts.length} 🔖
            </Text>
            <Text style={styles.summaryCellLabel}>Saved</Text>
          </TouchableOpacity>
        </View>

        {/* Admin Management — only for users with Admin Panel access */}
        {user?.isAdmin && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setIsAdminPanelOpen(true)}
            style={[styles.adminCard, shadows.soft]}
          >
            <LinearGradient
              colors={['#134E4A', '#0F766E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adminCardInner}
            >
              <View style={styles.adminIcon}>
                <Ionicons name="shield-checkmark" size={20} color="#0F766E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminTitle}>Admin Management</Text>
                <Text style={styles.adminSub}>Stats, admins, XP rules & rewards</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCFBF1" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ================= SECTION NAVIGATION CONTROLLER ================= */}
        {activeSection !== 'hub' ? (
          /* When in a specific section: show clean breadcrumb + back button + horizontal switcher */
          <View style={styles.sectionHeaderControl}>
            <View style={styles.breadcrumbRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveSection('hub')}
                style={styles.backToHubBtn}
              >
                <Ionicons name="arrow-back" size={14} color="#4F46E5" />
                <Text style={styles.backToHubText}>All Sections</Text>
              </TouchableOpacity>

              <View style={styles.activeSectionTitleBadge}>
                <Text style={styles.activeSectionTitleText}>
                  {hubTiles.find((t) => t.id === activeSection)?.title || 'Section'}
                </Text>
              </View>
            </View>

            {/* Horizontal Section Switcher Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sectionChipsScroll}
            >
              {hubTiles.map((tile) => {
                const isSelected = activeSection === tile.id;
                return (
                  <TouchableOpacity
                    key={tile.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (tile.id === 'rewards') {
                        openRewardsModal();
                      } else {
                        setActiveSection(tile.id);
                      }
                    }}
                    style={[styles.sectionChip, isSelected && styles.sectionChipActive]}
                  >
                    <Ionicons
                      name={tile.icon}
                      size={12}
                      color={isSelected ? '#FFFFFF' : tile.color}
                    />
                    <Text
                      style={[
                        styles.sectionChipText,
                        isSelected && styles.sectionChipTextActive,
                      ]}
                    >
                      {tile.title.split('&')[0].trim()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          /* Hub View Header */
          <View style={styles.hubHeaderRow}>
            <View>
              <Text style={styles.hubMainTitle}>Explore Profile Sections</Text>
              <Text style={styles.hubMainSubtitle}>Tap any category to inspect dedicated data</Text>
            </View>
          </View>
        )}

        {/* ================= 1. THE ORGANIZED MODULAR HUB (WHEN IN 'HUB' MODE) ================= */}
        {activeSection === 'hub' && (
          <View style={styles.hubTilesGrid}>
            {hubTiles.map((tile) => (
              <TouchableOpacity
                key={tile.id}
                activeOpacity={0.88}
                onPress={() => {
                  if (tile.id === 'rewards') {
                    openRewardsModal();
                  } else {
                    setActiveSection(tile.id);
                  }
                }}
                style={[styles.hubTileCard, shadows.soft]}
              >
                <View style={styles.tileTopRow}>
                  <View style={[styles.tileIconBox, { backgroundColor: tile.bgColor }]}>
                    <Ionicons name={tile.icon} size={20} color={tile.color} />
                  </View>
                  {!!tile.badge && (
                    <View style={styles.tileBadgePill}>
                      <Text style={[styles.tileBadgeText, { color: tile.color }]}>
                        {tile.badge}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.tileInfo}>
                  <Text style={styles.tileTitle}>{tile.title}</Text>
                  <Text style={styles.tileSubtitle}>{tile.subtitle}</Text>
                </View>

                <View style={styles.tileActionRow}>
                  <Text style={[styles.tileActionText, { color: tile.color }]}>Open Section</Text>
                  <Ionicons name="chevron-forward" size={13} color={tile.color} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ================= 2. DEDICATED SECTION 1: PRACTICE ANALYTICS ================= */}
        {activeSection === 'analytics' && (
          <View style={styles.sectionContainer}>
            {/* Weekly Practice Distribution Bar Chart */}
            <View style={[styles.chartCard, shadows.soft]}>
              <View style={styles.chartHeaderRow}>
                <View>
                  <Text style={styles.chartTitle}>Weekly Practice Distribution</Text>
                  <Text style={styles.chartSub}>365 mins logged this week (+22% vs last week)</Text>
                </View>
                <View style={styles.trendPill}>
                  <Ionicons name="trending-up" size={12} color="#15803D" />
                  <Text style={styles.trendText}>+22%</Text>
                </View>
              </View>

              {/* Bar Chart Visualization */}
              <View style={styles.barChartRow}>
                {WEEKLY_PRACTICE_DATA.map((item, idx) => (
                  <View key={idx} style={styles.barCol}>
                    <Text style={styles.barMinsText}>{item.mins}m</Text>
                    <View style={styles.barTrack}>
                      <LinearGradient
                        colors={['#4F46E5', '#7C3AED']}
                        style={[styles.barFill, { height: item.height }]}
                      />
                    </View>
                    <Text style={styles.barDayLabel}>{item.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Skill Mastery Progress Meters */}
            <View style={[styles.masteryCard, shadows.soft]}>
              <Text style={styles.masteryTitle}>Vocal & Technique Competencies</Text>
              <Text style={styles.masterySub}>Evaluated across mentor video reviews</Text>

              <View style={styles.metersList}>
                {SKILL_METRICS.map((metric, idx) => (
                  <View key={idx} style={styles.meterItem}>
                    <View style={styles.meterTopRow}>
                      <View style={styles.meterNameRow}>
                        <Ionicons
                          name={metric.icon as keyof typeof Ionicons.glyphMap}
                          size={13}
                          color={metric.color}
                        />
                        <Text style={styles.meterNameText}>{metric.name}</Text>
                      </View>
                      <Text style={[styles.meterScoreText, { color: metric.color }]}>
                        {metric.score}% • {metric.level}
                      </Text>
                    </View>

                    <View style={styles.meterBarTrack}>
                      <View
                        style={[
                          styles.meterBarFill,
                          { width: `${metric.score}%`, backgroundColor: metric.color },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Performance KPIs */}
            <View style={[styles.analyticsKpiRow, shadows.soft]}>
              <View style={styles.kpiCell}>
                <Text style={styles.kpiValue}>1.8 hrs</Text>
                <Text style={styles.kpiLabel}>Mentor Turnaround</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.kpiCell}>
                <Text style={[styles.kpiValue, { color: '#15803D' }]}>+18%</Text>
                <Text style={styles.kpiLabel}>Technique Gain</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.kpiCell}>
                <Text style={styles.kpiValue}>94%</Text>
                <Text style={styles.kpiLabel}>Consistency</Text>
              </View>
            </View>
          </View>
        )}


        {/* ================= MY UPLOADS: content history + analytics ================= */}
        {activeSection === 'uploads' && (
          <View style={styles.sectionContainer}>
            {/* Category filter */}
            <View style={styles.uploadFilterRow}>
              {([
                { key: 'all', label: 'All' },
                { key: 'video', label: 'Posts' },
                { key: 'reel', label: 'Reels' },
                { key: 'post', label: 'Discuss' },
                { key: 'reposts', label: `Reposts${reposts.length ? ` (${reposts.length})` : ''}` },
              ] as const).map((f) => {
                const active = uploadFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setUploadFilter(f.key)}
                    style={[styles.uploadFilterChip, active && styles.uploadFilterChipActive]}
                  >
                    <Text style={[styles.uploadFilterText, active && styles.uploadFilterTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {uploadFilter === 'reposts' ? (
              reposts.length === 0 ? (
                <View style={styles.uploadsEmpty}>
                  <Ionicons name="repeat" size={40} color="#CBD5E1" />
                  <Text style={styles.uploadsEmptyText}>No reposts yet</Text>
                  <Text style={styles.uploadsEmptySub}>
                    Tap the repost icon on any post or reel to share it to your profile.
                  </Text>
                </View>
              ) : (
                reposts.map((post) => {
                  const reel = isReel(post);
                  const audio = post.postType === 'audio' || (!!post.audioUrl && !post.videoUrl);
                  const kindLabel = POST_KIND_LABEL[postKind(post)];
                  return (
                    <TouchableOpacity
                      key={post.id}
                      activeOpacity={0.85}
                      onPress={() => setActivePostModal(post)}
                      style={[styles.uploadCard, shadows.soft]}
                    >
                      <View style={styles.uploadThumb}>
                        {postCover(post) ? (
                          <Image source={{ uri: postCover(post) }} style={styles.uploadThumbImg} />
                        ) : audio ? (
                          <View style={[styles.uploadThumbImg, styles.uploadThumbAudio]}>
                            <MusicAnimation active={false} size={44} />
                          </View>
                        ) : (
                          <View style={[styles.uploadThumbImg, styles.uploadThumbFallback]}>
                            <Ionicons
                              name={POST_KIND_ICON[postKind(post)] as any}
                              size={22}
                              color="#94A3B8"
                            />
                          </View>
                        )}
                        <View style={[styles.uploadKindBadge, { backgroundColor: 'rgba(22,163,74,0.85)' }]}>
                          <Ionicons name="repeat" size={9} color="#FFFFFF" />
                          <Text style={styles.uploadKindText}> {kindLabel}</Text>
                        </View>
                      </View>

                      <View style={styles.uploadInfo}>
                        <Text style={styles.uploadTitle} numberOfLines={1}>
                          {post.videoTitle || post.content || 'Untitled'}
                        </Text>
                        <Text style={styles.uploadTime}>Reposted • by {post.authorName}</Text>
                        <View style={styles.uploadStatsRow}>
                          <View style={styles.uploadStat}>
                            <Ionicons name="eye-outline" size={13} color="#64748B" />
                            <Text style={styles.uploadStatText}>{post.viewsCount ?? 0}</Text>
                          </View>
                          <View style={styles.uploadStat}>
                            <Ionicons name="heart-outline" size={13} color="#64748B" />
                            <Text style={styles.uploadStatText}>{post.likesCount ?? 0}</Text>
                          </View>
                          <View style={styles.uploadStat}>
                            <Ionicons name="chatbubble-outline" size={13} color="#64748B" />
                            <Text style={styles.uploadStatText}>{post.commentsCount ?? 0}</Text>
                          </View>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  );
                })
              )
            ) : uploadsLoading ? (
              <View style={styles.uploadsEmpty}>
                <Text style={styles.uploadsEmptyText}>Loading your uploads…</Text>
              </View>
            ) : filteredUploads.length === 0 ? (
              <View style={styles.uploadsEmpty}>
                <Ionicons name="cloud-upload-outline" size={40} color="#CBD5E1" />
                <Text style={styles.uploadsEmptyText}>Nothing here yet</Text>
                <Text style={styles.uploadsEmptySub}>Content you publish from the + tab shows up here with its analytics.</Text>
              </View>
            ) : (
              filteredUploads.map((post) => {
                const reel = isReel(post);
                const audio = post.postType === 'audio' || (!!post.audioUrl && !post.videoUrl);
                const kindLabel = POST_KIND_LABEL[postKind(post)];
                return (
                  <TouchableOpacity
                    key={post.id}
                    activeOpacity={0.85}
                    onPress={() => setAnalyticsPost(post)}
                    style={[styles.uploadCard, shadows.soft]}
                  >
                    <View style={styles.uploadThumb}>
                      {postCover(post) ? (
                        <Image source={{ uri: postCover(post) }} style={styles.uploadThumbImg} />
                      ) : audio ? (
                        <View style={[styles.uploadThumbImg, styles.uploadThumbAudio]}>
                          <MusicAnimation active={false} size={44} />
                        </View>
                      ) : (
                        <View style={[styles.uploadThumbImg, styles.uploadThumbFallback]}>
                          <Ionicons
                            name={POST_KIND_ICON[postKind(post)] as any}
                            size={22}
                            color="#94A3B8"
                          />
                        </View>
                      )}
                      <View style={styles.uploadKindBadge}>
                        <Text style={styles.uploadKindText}>{kindLabel}</Text>
                      </View>
                    </View>

                    <View style={styles.uploadInfo}>
                      <Text style={styles.uploadTitle} numberOfLines={1}>
                        {post.videoTitle || post.content || 'Untitled'}
                      </Text>
                      <Text style={styles.uploadTime}>{post.timeAgo}{post.isPrivate ? ' • Private' : ''}</Text>
                      <View style={styles.uploadStatsRow}>
                        <View style={styles.uploadStat}>
                          <Ionicons name="eye-outline" size={13} color="#64748B" />
                          <Text style={styles.uploadStatText}>{post.viewsCount ?? 0}</Text>
                        </View>
                        <View style={styles.uploadStat}>
                          <Ionicons name="heart-outline" size={13} color="#64748B" />
                          <Text style={styles.uploadStatText}>{post.likesCount ?? 0}</Text>
                        </View>
                        <View style={styles.uploadStat}>
                          <Ionicons name="chatbubble-outline" size={13} color="#64748B" />
                          <Text style={styles.uploadStatText}>{post.commentsCount ?? 0}</Text>
                        </View>
                        <View style={styles.uploadStat}>
                          <Ionicons name="repeat" size={13} color="#64748B" />
                          <Text style={styles.uploadStatText}>{post.repostsCount ?? 0}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ================= 9. DEDICATED SECTION 8: SAVED LIBRARY ================= */}
        {activeSection === 'saved' && (
          <View style={styles.sectionContainer}>
            {savedPosts.length > 0 ? (
              savedPosts.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  activeOpacity={0.88}
                  onPress={() => setActivePostModal(post)}
                  style={[styles.savedCard, shadows.soft]}
                >
                  <Image source={{ uri: postCover(post) }} style={styles.savedCardThumb} />
                  <View style={styles.savedCardInfo}>
                    <Text style={styles.savedCardTitle} numberOfLines={1}>
                      {post.videoTitle || post.content}
                    </Text>
                    <Text style={styles.savedCardAuthor}>By {post.authorName} • {post.communityName}</Text>
                    <View style={styles.savedCardMeta}>
                      <View style={styles.savedBadgePill}>
                        <Ionicons name="bookmark" size={11} color="#F59E0B" />
                        <Text style={styles.savedBadgeText}>Saved Take</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          toggleSavePost(post.id);
                          Alert.alert('Unsaved', 'Removed from your saved library.');
                        }}
                      >
                        <Text style={styles.unsaveText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyTabCard}>
                <Ionicons name="bookmark-outline" size={38} color="#94A3B8" />
                <Text style={styles.emptyTabTitle}>No saved takes yet</Text>
                <Text style={styles.emptyTabSub}>
                  Tap the bookmark ribbon icon on any practice reel to save it for later.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Preferences & Sign Out Section */}
        <View style={styles.accountFooter}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogout}
            style={styles.signOutBtn}
          >
            <Ionicons name="log-out-outline" size={17} color="#EF4444" />
            <Text style={styles.signOutBtnText}>Sign Out of Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Interactive Edit Profile Modal */}
      <EditProfileModal
        visible={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />

      {/* Single-upload analytics sheet */}
      <UploadAnalyticsModal
        post={analyticsPost}
        onClose={() => setAnalyticsPost(null)}
        onDelete={handleDeleteUpload}
        onTogglePrivacy={handleTogglePrivacy}
        busy={uploadBusy}
      />

      {/* Followers / Following list */}
      <FollowListModal
        visible={!!followList}
        userId={user?.id ?? null}
        mode={followList ?? 'followers'}
        onClose={() => setFollowList(null)}
      />

      {/* Post & Critique Inspection Modal */}
      <CritiqueModal
        visible={!!activePostModal}
        post={activePostModal}
        onClose={() => setActivePostModal(null)}
      />

      {/* Admin Panel (admins only; the server re-checks access on every call) */}
      {user?.isAdmin && (
        <AdminPanelModal visible={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} />
      )}

      {/* Improved Sign Out Custom Popup Modal */}
      <ConfirmModal
        visible={isSignOutModalOpen}
        title="Sign Out"
        message="Are you sure you want to sign out of your Lernex account? Your daily practice streak and stats are safely saved."
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        icon="log-out-outline"
        isDestructive
        onCancel={() => setIsSignOutModalOpen(false)}
        onConfirm={handleConfirmSignOut}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    gap: spacing.base,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  handleBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  handleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  roleChipMentor: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  roleChipTextMentor: {
    color: '#7C3AED',
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroGradientCover: {
    height: 70,
  },
  heroContentBlock: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  avatarRowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -36,
    marginBottom: spacing.xs + 2,
  },
  avatarRingWrapper: {
    position: 'relative',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    borderRadius: 44,
  },
  levelRingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  levelRingBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  editProfileBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  shareProfileSmallBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  nameBlock: {
    gap: 4,
  },
  nameWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userNameText: {
    fontSize: 17,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  verifiedMentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  verifiedMentorBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  learnerVerifiedBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  learnerVerifiedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  userBioText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginTop: 2,
  },
  trackPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  skillTrackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  skillTrackPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  mentorCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  mentorCountPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  followCell: {
    flex: 1,
    alignItems: 'center',
  },
  followNum: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  followLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  followDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  adminCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  adminCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
  },
  adminIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  adminSub: {
    fontSize: 11,
    color: '#99F6E4',
    marginTop: 1,
  },
  compactSummaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryCellNum: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  summaryCellLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  hubHeaderRow: {
    marginTop: 2,
  },
  hubMainTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  hubMainSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  hubTilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hubTileCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  tileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBadgePill: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tileBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  tileInfo: {
    gap: 2,
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  tileSubtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  tileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  tileActionText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  sectionHeaderControl: {
    gap: 8,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backToHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  backToHubText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  activeSectionTitleBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeSectionTitleText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionChipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  sectionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  sectionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sectionContainer: {
    gap: spacing.sm + 2,
  },
  // My Uploads
  uploadFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  uploadFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  uploadFilterChipActive: {
    backgroundColor: '#0284C7',
  },
  uploadFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  uploadFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  uploadsEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    gap: 8,
  },
  uploadsEmptyText: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#334155',
  },
  uploadsEmptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 17,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  uploadThumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  uploadThumbImg: {
    width: 68,
    height: 68,
  },
  uploadThumbAudio: {
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadThumbFallback: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadKindBadge: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  uploadKindText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  uploadInfo: {
    flex: 1,
    gap: 2,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  uploadTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  uploadStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  uploadStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  uploadStatText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  chartSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  trendText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#15803D',
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  barCol: {
    alignItems: 'center',
    gap: 4,
  },
  barMinsText: {
    fontSize: 8,
    color: '#94A3B8',
    fontWeight: '600',
  },
  barTrack: {
    width: 14,
    height: 90,
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barDayLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: 'bold',
  },
  masteryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  masteryTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  masterySub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: -6,
  },
  metersList: {
    gap: 10,
  },
  meterItem: {
    gap: 4,
  },
  meterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meterNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  meterScoreText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  meterBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  analyticsKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  videosListContainer: {
    gap: spacing.sm,
  },
  videoPostCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  videoCardMedia: {
    height: 150,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  videoCardThumb: {
    width: '100%',
    height: '100%',
  },
  videoCardGradient: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  durationStamp: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  durationStampText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  playCenterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  videoBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewsStamp: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  critiqueStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  critiqueStatusText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  videoCardFooter: {
    padding: spacing.sm + 2,
    gap: 2,
  },
  videoCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  videoCardSub: {
    fontSize: 10,
    color: '#64748B',
  },
  critiquesListContainer: {
    gap: 10,
  },
  critiqueCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    gap: 6,
  },
  critiqueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  critiqueMentorIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  critiqueMentorName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  critiqueMentorBadge: {
    fontSize: 9,
    color: '#7C3AED',
  },
  critiqueRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  critiqueRatingText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  critiqueFocusTag: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6B21A8',
  },
  critiqueBodyText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  critiqueDemoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    gap: 5,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  critiqueDemoText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  goalsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  targetGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.sm,
  },
  targetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  targetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  targetSubTitle: {
    fontSize: 10,
    color: '#64748B',
  },
  targetPercentBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  targetPercentText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  progressBlock: {
    gap: 6,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  miniStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  addGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.sm,
  },
  addGoalToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addGoalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plusIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGoalHeaderTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  addGoalForm: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  addGoalInputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  addGoalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  goalTagScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  goalTagOption: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  goalTagOptionActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  goalTagOptionText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  goalTagOptionTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  addGoalSubmitBtn: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: 4,
  },
  addGoalSubmitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    gap: 6,
  },
  addGoalSubmitText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  goalItemTouchContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalItemRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalDeleteBtn: {
    padding: 4,
  },
  coachCallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  coachCallActionText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  coachVoiceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 3,
  },
  coachVoiceActionText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  goalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalsTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  goalsRatio: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803D',
  },
  goalsList: {
    gap: 6,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  goalItemDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  goalCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCheckboxDone: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  goalItemText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
    flex: 1,
  },
  goalItemTextDone: {
    color: '#15803D',
    textDecorationLine: 'line-through',
  },
  goalTagPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  goalTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyMentorsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyMentorsTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#334155',
  },
  emptyMentorsSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  coachDetailCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  coachDetailInfo: {
    flex: 1,
    gap: 3,
  },
  coachDetailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coachName: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  coachTitle: {
    fontSize: 10,
    color: '#64748B',
  },
  coachDetailBio: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
    marginVertical: 3,
  },
  coachActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  coachActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  coachActionBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  coachActionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  coachActionBtnOutlineText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
  },
  certRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  certIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certRowInfo: {
    flex: 1,
    gap: 2,
  },
  certRowTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  certRowIssuer: {
    fontSize: 10,
    color: '#64748B',
  },
  certRowId: {
    fontSize: 9,
    color: '#94A3B8',
  },
  certViewBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  certViewBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  achievementCardLocked: {
    opacity: 0.6,
  },
  achIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achInfo: {
    flex: 1,
    gap: 2,
  },
  achTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  achDesc: {
    fontSize: 10,
    color: '#64748B',
  },
  achStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  achStatusText: {
    fontSize: 9,
    color: '#94A3B8',
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  savedCardThumb: {
    width: 68,
    height: 68,
    borderRadius: borderRadius.lg,
  },
  savedCardInfo: {
    flex: 1,
    gap: 3,
  },
  savedCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  savedCardAuthor: {
    fontSize: 10,
    color: '#64748B',
  },
  savedCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  savedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  savedBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#D97706',
  },
  unsaveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  emptyTabCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyTabTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  emptyTabSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  accountFooter: {
    marginTop: spacing.xs,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  closeHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
