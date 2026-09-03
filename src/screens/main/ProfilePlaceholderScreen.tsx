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
import { useApp } from '../../context/AppContext';
import { Avatar, ConfirmModal, CallModal } from '../../components/common';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { CertificateModal, CertificateData } from '../../components/profile/CertificateModal';
import { CritiqueModal } from '../../components/community/CritiqueModal';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { CommunityPost } from '../../types';

type SectionKey =
  | 'hub'
  | 'analytics'
  | 'videos'
  | 'critiques'
  | 'goals'
  | 'mentors'
  | 'certificates'
  | 'badges'
  | 'saved'
  | 'rewards';

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

const INITIAL_GOALS = [
  { id: 'g-1', title: 'Transition smoothly into head mix at C5 note', done: true, tag: 'Vocal Mix' },
  { id: 'g-2', title: 'Log 20 mins of SOVTE straw exercises daily', done: true, tag: 'Breath Health' },
  { id: 'g-3', title: 'Record alternate picking speed drill at 120 BPM', done: false, tag: 'Speed Drill' },
  { id: 'g-4', title: 'Submit chorus take for Mentor review in Circle', done: true, tag: 'Mentorship' },
];

const CERTIFICATES: CertificateData[] = [
  {
    id: 'cert-1',
    title: 'Certified Vocal Technique Level 2',
    category: 'Vocal Performance',
    issuer: 'Lernex Vocal Academy & Berklee Standards',
    mentorName: 'Alex Rivera (Berklee Coach)',
    studentName: 'Anshuman Sarkar',
    issueDate: 'Sept 2026',
    credentialId: 'LRN-VOC-9281',
    skillsVerified: ['Head Voice Phonation', 'Larynx Stabilisation', 'SOVTE Straw Support'],
  },
  {
    id: 'cert-2',
    title: 'Pitch Accuracy & Resonance Certification',
    category: 'Musicianship',
    issuer: 'Lernex Global Audio Guild',
    mentorName: 'Sarah Jenkins (Opera Lead)',
    studentName: 'Anshuman Sarkar',
    issueDate: 'August 2026',
    credentialId: 'LRN-PITCH-4402',
    skillsVerified: ['Forward Resonance', 'Dynamic Vowel Shaping', 'Ear Training'],
  },
];

const ACHIEVEMENTS = [
  {
    id: 'ach-1',
    title: 'Top 5% Consistency',
    desc: 'Practiced 6 consecutive days without breaking streak',
    icon: 'trophy',
    color: '#D97706',
    bgColor: '#FEF3C7',
    unlocked: true,
    date: 'Earned Yesterday',
  },
  {
    id: 'ach-2',
    title: 'Vocal Pitch Pro',
    desc: 'Hit 95%+ pitch accuracy on Adele chorus take',
    icon: 'mic',
    color: '#E11D48',
    bgColor: '#FFE4E6',
    unlocked: true,
    date: 'Earned 3d ago',
  },
  {
    id: 'ach-3',
    title: 'First Mentor Session',
    desc: 'Completed 1-on-1 video critique with Berklee Coach',
    icon: 'star',
    color: '#7C3AED',
    bgColor: '#F3E8FF',
    unlocked: true,
    date: 'Earned 5d ago',
  },
  {
    id: 'ach-4',
    title: 'Rising Creator',
    desc: 'Crossed 1,000+ views across practice reels',
    icon: 'flame',
    color: '#EA580C',
    bgColor: '#FFEDD5',
    unlocked: true,
    date: 'Earned 1w ago',
  },
  {
    id: 'ach-5',
    title: 'Community Supporter',
    desc: 'Posted 20+ encouraging comments on peer clips',
    icon: 'heart',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    unlocked: true,
    date: 'Earned 2w ago',
  },
  {
    id: 'ach-6',
    title: 'Mastery 30-Day Legend',
    desc: 'Log 30 days of deliberate skill practice',
    icon: 'shield-checkmark',
    color: '#64748B',
    bgColor: '#F1F5F9',
    unlocked: false,
    date: '6/30 Days Logged',
  },
];

export const ProfilePlaceholderScreen: React.FC = () => {
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
    logout,
    showDialog,
  } = useApp();

  const [activeSection, setActiveSection] = useState<SectionKey>('hub');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateData | null>(null);
  const [activePostModal, setActivePostModal] = useState<CommunityPost | null>(null);
  const [goals, setGoals] = useState(INITIAL_GOALS);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTag, setNewGoalTag] = useState('Technique');
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [activeCallMentor, setActiveCallMentor] = useState<{
    name: string;
    avatarUrl?: string;
    role?: string;
    specialty?: string;
    type: 'voice' | 'video';
  } | null>(null);

  // Dynamic Goal percentage calculation (matching Home page Weekly Goal)
  const completedGoalsCount = goals.filter((g) => g.done).length;
  const goalCompletionPercent = goals.length > 0
    ? Math.round((completedGoalsCount / goals.length) * 100)
    : 0;

  // Return to root main profile page whenever profile tab icon is clicked
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setActiveSection('hub');
      setActivePostModal(null);
      setSelectedCertificate(null);
      setIsEditModalOpen(false);
      setIsSignOutModalOpen(false);
      setActiveCallMentor(null);
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

  // Content Filtering
  const userPosts = posts.filter(
    (p) => p.authorName === (user?.name || 'Anshuman Sarkar') || p.id === 'post-video-1'
  );
  const userVideos = userPosts.filter((p) => p.postType === 'video' || !!p.videoThumbnail);
  const userCritiques = posts.filter((p) => (p.mentorCritiqueCount || 0) > 0);
  const savedPosts = posts.filter((p) => p.isSaved);

  const hubTiles: HubTileItem[] = [
    {
      id: 'rewards',
      title: 'Season 3 Rewards & XP',
      subtitle: 'Dual Rankings, Quests & 6 Perks',
      icon: 'trophy',
      color: '#D97706',
      bgColor: '#FEF3C7',
      badge: 'Rank #4 🏆',
    },
    {
      id: 'analytics',
      title: 'Practice Analytics',
      subtitle: 'Weekly chart & 5 skill meters',
      icon: 'analytics',
      color: '#4F46E5',
      bgColor: '#EEF2FF',
      badge: '94% Score',
    },
    {
      id: 'videos',
      title: 'Practice Takes & Videos',
      subtitle: 'Your recorded practice library',
      icon: 'videocam',
      color: '#0284C7',
      bgColor: '#E0F2FE',
      badge: `${userVideos.length || 2} Videos`,
    },
    {
      id: 'critiques',
      title: 'Mentor Critiques',
      subtitle: 'Feedback & video demonstrations',
      icon: 'star',
      color: '#7C3AED',
      bgColor: '#F3E8FF',
      badge: `${userCritiques.length} Reviews`,
    },
    {
      id: 'goals',
      title: 'Roadmap & Goals',
      subtitle: `${goalCompletionPercent}% Milestones Completed`,
      icon: 'checkmark-done-circle',
      color: '#15803D',
      bgColor: '#DCFCE7',
      badge: `${completedGoalsCount}/${goals.length} (${goalCompletionPercent}%)`,
    },
    {
      id: 'mentors',
      title: 'My Mentors',
      subtitle: 'Book 1-on-1, call & message coaches',
      icon: 'people',
      color: '#D97706',
      bgColor: '#FEF3C7',
      badge: '2 Assigned',
    },
    {
      id: 'certificates',
      title: 'Verified Certificates',
      subtitle: 'Berklee standard technical seals',
      icon: 'ribbon',
      color: '#B45309',
      bgColor: '#FFFBEB',
      badge: `${CERTIFICATES.length} Earned`,
    },
    {
      id: 'badges',
      title: 'Achievements & Badges',
      subtitle: 'Consistency & mastery awards',
      icon: 'trophy',
      color: '#EA580C',
      bgColor: '#FFEDD5',
      badge: '5 Unlocked',
    },
    {
      id: 'saved',
      title: 'Saved Library',
      subtitle: 'Bookmarked reels & drills',
      icon: 'bookmark',
      color: '#475569',
      bgColor: '#F1F5F9',
      badge: `${savedPosts.length} Takes`,
    },
  ];

  const handleToggleGoal = (goalId: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, done: !g.done } : g))
    );
  };

  const handleAddGoal = () => {
    if (!newGoalTitle.trim()) {
      showDialog({
        title: 'Milestone Title Required',
        message: 'Please enter a goal or target description.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
      return;
    }
    const newGoal = {
      id: `g-${Date.now()}`,
      title: newGoalTitle.trim(),
      tag: newGoalTag,
      done: false,
    };
    setGoals((prev) => [newGoal, ...prev]);
    setNewGoalTitle('');
    setIsAddingGoal(false);
  };

  const handleDeleteGoal = (goalId: string) => {
    showDialog({
      title: 'Remove Milestone?',
      message: 'Are you sure you want to delete this target from your roadmap?',
      icon: 'trash-outline',
      isDestructive: true,
      confirmText: 'Delete',
      cancelText: 'Keep',
      onConfirm: () => setGoals((prev) => prev.filter((g) => g.id !== goalId)),
    });
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out ${user?.name || 'Anshuman'}'s practice profile on Lernex: lernex.app/@${(user?.name || 'user').toLowerCase().replace(/\s+/g, '_')}`,
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
          <View style={styles.handleBadge}>
            <Text style={styles.handleText}>
              {user?.handle || `@${(user?.name || 'user').toLowerCase().replace(/\s+/g, '_')}`}
            </Text>
          </View>

          <View style={styles.topBarActions}>
            {/* User Static Role Badge */}
            <View style={[styles.roleChip, isMentor && styles.roleChipMentor]}>
              <Text style={[styles.roleChipText, isMentor && styles.roleChipTextMentor]}>
                {isMentor ? '✨ Mentor' : '🎓 Learner'}
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
                  name={user?.name || 'Anshuman'}
                  size={72}
                  showRing={false}
                />
                <View style={styles.levelRingBadge}>
                  <Text style={styles.levelRingBadgeText}>LVL 3</Text>
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
                <Text style={styles.userNameText}>{user?.name || 'Anshuman Sarkar'}</Text>
                {isMentor ? (
                  <View style={styles.verifiedMentorBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#7C3AED" />
                    <Text style={styles.verifiedMentorBadgeText}>Mentor</Text>
                  </View>
                ) : (
                  <View style={styles.learnerVerifiedBadge}>
                    <Text style={styles.learnerVerifiedBadgeText}>Rising Vocalist</Text>
                  </View>
                )}
              </View>

              <Text style={styles.userBioText}>
                {user?.bio ||
                  'Vocal student passionate about R&B and pop. Practicing head voice mix and breath control daily!'}
              </Text>

              {/* Primary Skill & Track Pill */}
              <View style={styles.trackPillsRow}>
                <View style={styles.skillTrackPill}>
                  <Ionicons name="mic" size={11} color="#4F46E5" />
                  <Text style={styles.skillTrackPillText}>
                    {selectedHobby || 'Music'} • Vocal Mastery
                  </Text>
                </View>
                <View style={styles.mentorCountPill}>
                  <Ionicons name="star" size={11} color="#D97706" />
                  <Text style={styles.mentorCountPillText}>2 Mentors Assigned</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Compact 4-Cell Key Stats Summary Strip */}
        <View style={[styles.compactSummaryStrip, shadows.soft]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSection('analytics')}
            style={styles.summaryCell}
          >
            <Text style={styles.summaryCellNum}>{user?.streakDays || 6}d 🔥</Text>
            <Text style={styles.summaryCellLabel}>Streak</Text>
          </TouchableOpacity>

          <View style={styles.summaryDivider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSection('analytics')}
            style={styles.summaryCell}
          >
            <Text style={styles.summaryCellNum}>{user?.xpPoints || 1240} ⚡</Text>
            <Text style={styles.summaryCellLabel}>XP Score</Text>
          </TouchableOpacity>

          <View style={styles.summaryDivider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSection('videos')}
            style={styles.summaryCell}
          >
            <Text style={styles.summaryCellNum}>{userVideos.length || 2} 🎥</Text>
            <Text style={styles.summaryCellLabel}>Takes</Text>
          </TouchableOpacity>

          <View style={styles.summaryDivider} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveSection('critiques')}
            style={styles.summaryCell}
          >
            <Text style={[styles.summaryCellNum, { color: '#7C3AED' }]}>
              {userCritiques.length} ★
            </Text>
            <Text style={styles.summaryCellLabel}>Critiques</Text>
          </TouchableOpacity>
        </View>

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
                  <View style={styles.tileBadgePill}>
                    <Text style={[styles.tileBadgeText, { color: tile.color }]}>
                      {tile.badge}
                    </Text>
                  </View>
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

        {/* ================= 3. DEDICATED SECTION 2: PRACTICE VIDEOS ================= */}
        {activeSection === 'videos' && (
          <View style={styles.sectionContainer}>
            {userVideos.map((post) => (
              <TouchableOpacity
                key={post.id}
                activeOpacity={0.9}
                onPress={() => setActivePostModal(post)}
                style={[styles.videoPostCard, shadows.card]}
              >
                <View style={styles.videoCardMedia}>
                  <Image source={{ uri: post.videoThumbnail }} style={styles.videoCardThumb} />
                  <LinearGradient
                    colors={['transparent', 'rgba(15, 23, 42, 0.8)']}
                    style={styles.videoCardGradient}
                  >
                    <View style={styles.durationStamp}>
                      <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                      <Text style={styles.durationStampText}>{post.videoDuration || '0:48'}</Text>
                    </View>

                    <View style={styles.playCenterBtn}>
                      <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    </View>

                    <View style={styles.videoBottomRow}>
                      <Text style={styles.viewsStamp}>
                        <Ionicons name="eye-outline" size={11} color="#FFFFFF" /> {post.viewsCount || 1420} views
                      </Text>
                      {post.mentorCritiqueCount && (
                        <View style={styles.critiqueStatusBadge}>
                          <Ionicons name="star" size={10} color="#FFFFFF" />
                          <Text style={styles.critiqueStatusText}>Reviewed by Mentor</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </View>

                <View style={styles.videoCardFooter}>
                  <Text style={styles.videoCardTitle} numberOfLines={1}>
                    {post.videoTitle || post.content}
                  </Text>
                  <Text style={styles.videoCardSub}>{post.communityName} • {post.timeAgo}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ================= 4. DEDICATED SECTION 3: MENTOR CRITIQUES ================= */}
        {activeSection === 'critiques' && (
          <View style={styles.sectionContainer}>
            {userCritiques.map((post) => {
              const critique = post.comments?.find((c) => c.isMentorCritique);
              if (!critique) return null;

              return (
                <TouchableOpacity
                  key={post.id}
                  activeOpacity={0.88}
                  onPress={() => setActivePostModal(post)}
                  style={[styles.critiqueCard, shadows.soft]}
                >
                  <View style={styles.critiqueCardHeader}>
                    <View style={styles.critiqueMentorIdentity}>
                      <Avatar uri={critique.authorAvatar} name={critique.authorName} size={36} showRing />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.critiqueMentorName}>{critique.authorName}</Text>
                        <Text style={styles.critiqueMentorBadge}>Verified Vocal & Music Coach</Text>
                      </View>
                    </View>

                    <View style={styles.critiqueRatingPill}>
                      <Ionicons name="star" size={11} color="#D97706" />
                      <Text style={styles.critiqueRatingText}>{critique.mentorRating || 5}.0 ★</Text>
                    </View>
                  </View>

                  <Text style={styles.critiqueFocusTag}>
                    Focus: {critique.critiqueFocus || 'Larynx Drop & Breath Support'}
                  </Text>
                  <Text style={styles.critiqueBodyText} numberOfLines={2}>
                    "{critique.text}"
                  </Text>

                  {critique.videoCritiqueThumbnail && (
                    <View style={styles.critiqueDemoPill}>
                      <Ionicons name="videocam" size={13} color="#7C3AED" />
                      <Text style={styles.critiqueDemoText}>
                        Video Fix Attached ({critique.videoCritiqueDuration || '1:15'}) • Tap to Watch
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ================= 5. DEDICATED SECTION 4: ROADMAP & GOALS ================= */}
        {activeSection === 'goals' && (
          <View style={styles.sectionContainer}>
            {/* Target & Weekly Goal Card with Visual Glow (Matches Home Page Weekly Goal) */}
            <View style={[styles.targetGoalCard, shadows.soft]}>
              <View style={styles.targetCardHeader}>
                <View style={styles.targetTitleRow}>
                  <View style={styles.targetIconBox}>
                    <Ionicons name="flag" size={15} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.targetTitle}>Weekly Goal & Roadmap</Text>
                    <Text style={styles.targetSubTitle}>Target completion reflects real practice</Text>
                  </View>
                </View>
                <View style={styles.targetPercentBadge}>
                  <Text style={styles.targetPercentText}>{goalCompletionPercent}%</Text>
                </View>
              </View>

              {/* Dynamic Gradient Progress Bar Track */}
              <View style={styles.progressBlock}>
                <View style={styles.progressBarTrack}>
                  <LinearGradient
                    colors={['#4F46E5', '#8B5CF6', '#EC4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBarFill, { width: `${Math.min(goalCompletionPercent, 100)}%` }]}
                  />
                </View>
                <View style={styles.progressLabelRow}>
                  <View style={styles.miniStatItem}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.progressLabel}>
                      {completedGoalsCount}/{goals.length} Milestones Done
                    </Text>
                  </View>
                  <View style={styles.miniStatItem}>
                    <Ionicons name="sparkles" size={12} color="#6366F1" />
                    <Text style={styles.progressLabel}>
                      {goalCompletionPercent === 100 ? 'All Complete! 🎉' : `${100 - goalCompletionPercent}% Remaining`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Add Custom Target or Goal Card */}
            <View style={[styles.addGoalCard, shadows.soft]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsAddingGoal(!isAddingGoal)}
                style={styles.addGoalToggleHeader}
              >
                <View style={styles.addGoalHeaderLeft}>
                  <View style={styles.plusIconCircle}>
                    <Ionicons name={isAddingGoal ? 'close' : 'add'} size={18} color="#4F46E5" />
                  </View>
                  <Text style={styles.addGoalHeaderTitle}>
                    {isAddingGoal ? 'Cancel Adding Milestone' : 'Set Your Own Target or Goal'}
                  </Text>
                </View>
                <Ionicons
                  name={isAddingGoal ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#64748B"
                />
              </TouchableOpacity>

              {isAddingGoal && (
                <View style={styles.addGoalForm}>
                  <Text style={styles.addGoalInputLabel}>Milestone Description</Text>
                  <TextInput
                    value={newGoalTitle}
                    onChangeText={setNewGoalTitle}
                    placeholder="e.g. Master C5 mixed voice transition at 120 BPM"
                    placeholderTextColor="#94A3B8"
                    style={styles.addGoalInput}
                  />

                  <Text style={styles.addGoalInputLabel}>Category / Focus Tag</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.goalTagScroll}
                  >
                    {['Vocal Mix', 'Breath Health', 'Speed Drill', 'Mentorship', 'Repertoire', 'Theory'].map(
                      (tag) => {
                        const isSelected = newGoalTag === tag;
                        return (
                          <TouchableOpacity
                            key={tag}
                            activeOpacity={0.8}
                            onPress={() => setNewGoalTag(tag)}
                            style={[styles.goalTagOption, isSelected && styles.goalTagOptionActive]}
                          >
                            <Text
                              style={[
                                styles.goalTagOptionText,
                                isSelected && styles.goalTagOptionTextActive,
                              ]}
                            >
                              {tag}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </ScrollView>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={handleAddGoal}
                    style={styles.addGoalSubmitBtn}
                  >
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.addGoalSubmitGradient}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.addGoalSubmitText}>Add Target & Recalculate %</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Deliberate Practice Milestones List */}
            <View style={[styles.goalsCard, shadows.soft]}>
              <View style={styles.goalsHeaderRow}>
                <View style={styles.goalsTitleGroup}>
                  <Ionicons name="checkmark-done-circle" size={18} color="#15803D" />
                  <Text style={styles.goalsTitle}>Your Roadmap Milestones</Text>
                </View>
                <Text style={styles.goalsRatio}>
                  {completedGoalsCount}/{goals.length} Completed
                </Text>
              </View>

              <View style={styles.goalsList}>
                {goals.map((g) => (
                  <View
                    key={g.id}
                    style={[styles.goalItem, g.done && styles.goalItemDone]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleToggleGoal(g.id)}
                      style={styles.goalItemTouchContent}
                    >
                      <View style={[styles.goalCheckbox, g.done && styles.goalCheckboxDone]}>
                        {g.done && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.goalItemText, g.done && styles.goalItemTextDone]}>
                        {g.title}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.goalItemRightActions}>
                      <View style={styles.goalTagPill}>
                        <Text style={styles.goalTagText}>{g.tag}</Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteGoal(g.id)}
                        style={styles.goalDeleteBtn}
                      >
                        <Ionicons name="trash-outline" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ================= 6. DEDICATED SECTION 5: MY MENTORS ================= */}
        {activeSection === 'mentors' && (
          <View style={styles.sectionContainer}>
            {/* Mentor 1: Alex Rivera */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                openUserProfile({
                  name: 'Alex Rivera',
                  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                  role: 'Mentor',
                  badge: 'Berklee Vocal Coach',
                  specialty: 'Head Voice & Pitch Fix',
                  rating: 4.9,
                  critiquesGiven: 245,
                })
              }
              style={[styles.coachDetailCard, shadows.soft]}
            >
              <Avatar uri="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" name="Alex Rivera" size={50} showRing />
              <View style={styles.coachDetailInfo}>
                <View style={styles.coachDetailHeaderRow}>
                  <Text style={styles.coachName}>Alex Rivera ★</Text>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeText}>4.9 ★</Text>
                  </View>
                </View>
                <Text style={styles.coachTitle}>Berklee Certified Vocal Coach</Text>
                <Text style={styles.coachDetailBio}>
                  "Specialized in head voice oscillation, SOVTE exercises, and healthy belting without vocal strain."
                </Text>
                <View style={styles.coachActionsRow}>
                  {/* Video Call Trigger */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setActiveCallMentor({
                        name: 'Alex Rivera',
                        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                        role: 'Mentor',
                        specialty: 'Berklee Vocal Coach',
                        type: 'video',
                      });
                    }}
                    style={styles.coachCallActionBtn}
                  >
                    <Ionicons name="videocam" size={13} color="#FFFFFF" />
                    <Text style={styles.coachCallActionText}>Video</Text>
                  </TouchableOpacity>

                  {/* Voice Call Trigger */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setActiveCallMentor({
                        name: 'Alex Rivera',
                        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                        role: 'Mentor',
                        specialty: 'Berklee Vocal Coach',
                        type: 'voice',
                      });
                    }}
                    style={styles.coachVoiceActionBtn}
                  >
                    <Ionicons name="call" size={12} color="#4F46E5" />
                    <Text style={styles.coachVoiceActionText}>Voice</Text>
                  </TouchableOpacity>

                  <View style={styles.coachActionBtn}>
                    <Ionicons name="calendar-outline" size={13} color="#4F46E5" />
                    <Text style={styles.coachActionBtnText}>Book</Text>
                  </View>
                  <View style={styles.coachActionBtnOutline}>
                    <Ionicons name="chatbubble-outline" size={13} color="#64748B" />
                    <Text style={styles.coachActionBtnOutlineText}>Chat</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Mentor 2: Sarah Jenkins */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                openUserProfile({
                  name: 'Sarah Jenkins',
                  avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                  role: 'Mentor',
                  badge: 'Opera & Vocal Health Lead',
                  specialty: 'Breath Support & Belting',
                  rating: 4.8,
                  critiquesGiven: 189,
                })
              }
              style={[styles.coachDetailCard, shadows.soft]}
            >
              <Avatar uri="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" name="Sarah Jenkins" size={50} showRing />
              <View style={styles.coachDetailInfo}>
                <View style={styles.coachDetailHeaderRow}>
                  <Text style={styles.coachName}>Sarah Jenkins ★</Text>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeText}>4.8 ★</Text>
                  </View>
                </View>
                <Text style={styles.coachTitle}>Opera & Vocal Health Lead</Text>
                <Text style={styles.coachDetailBio}>
                  "Focused on forward resonance, dynamic vowel shaping, and diaphragmatic breath support."
                </Text>
                <View style={styles.coachActionsRow}>
                  {/* Video Call Trigger */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setActiveCallMentor({
                        name: 'Sarah Jenkins',
                        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                        role: 'Mentor',
                        specialty: 'Opera & Vocal Coach',
                        type: 'video',
                      });
                    }}
                    style={styles.coachCallActionBtn}
                  >
                    <Ionicons name="videocam" size={13} color="#FFFFFF" />
                    <Text style={styles.coachCallActionText}>Video</Text>
                  </TouchableOpacity>

                  {/* Voice Call Trigger */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setActiveCallMentor({
                        name: 'Sarah Jenkins',
                        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                        role: 'Mentor',
                        specialty: 'Opera & Vocal Coach',
                        type: 'voice',
                      });
                    }}
                    style={styles.coachVoiceActionBtn}
                  >
                    <Ionicons name="call" size={12} color="#4F46E5" />
                    <Text style={styles.coachVoiceActionText}>Voice</Text>
                  </TouchableOpacity>

                  <View style={styles.coachActionBtn}>
                    <Ionicons name="calendar-outline" size={13} color="#4F46E5" />
                    <Text style={styles.coachActionBtnText}>Book</Text>
                  </View>
                  <View style={styles.coachActionBtnOutline}>
                    <Ionicons name="chatbubble-outline" size={13} color="#64748B" />
                    <Text style={styles.coachActionBtnOutlineText}>Chat</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ================= 7. DEDICATED SECTION 6: VERIFIED CERTIFICATES ================= */}
        {activeSection === 'certificates' && (
          <View style={styles.sectionContainer}>
            {CERTIFICATES.map((cert) => (
              <TouchableOpacity
                key={cert.id}
                activeOpacity={0.88}
                onPress={() => setSelectedCertificate(cert)}
                style={[styles.certRowCard, shadows.soft]}
              >
                <LinearGradient
                  colors={['#FEF3C7', '#FDE68A']}
                  style={styles.certIconBox}
                >
                  <Ionicons name="ribbon" size={22} color="#B45309" />
                </LinearGradient>

                <View style={styles.certRowInfo}>
                  <Text style={styles.certRowTitle}>{cert.title}</Text>
                  <Text style={styles.certRowIssuer}>{cert.issuer} • {cert.issueDate}</Text>
                  <Text style={styles.certRowId}>Verified ID: {cert.credentialId}</Text>
                </View>

                <View style={styles.certViewBadge}>
                  <Text style={styles.certViewBadgeText}>View Seal</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ================= 8. DEDICATED SECTION 7: ACHIEVEMENTS & BADGES ================= */}
        {activeSection === 'badges' && (
          <View style={styles.sectionContainer}>
            {ACHIEVEMENTS.map((ach) => (
              <View
                key={ach.id}
                style={[
                  styles.achievementCard,
                  shadows.soft,
                  !ach.unlocked && styles.achievementCardLocked,
                ]}
              >
                <View style={[styles.achIconBox, { backgroundColor: ach.bgColor }]}>
                  <Ionicons
                    name={ach.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={ach.color}
                  />
                </View>
                <View style={styles.achInfo}>
                  <Text style={styles.achTitle}>{ach.title}</Text>
                  <Text style={styles.achDesc}>{ach.desc}</Text>
                  <View style={styles.achStatusRow}>
                    <Ionicons
                      name={ach.unlocked ? 'checkmark-circle' : 'lock-closed'}
                      size={11}
                      color={ach.unlocked ? '#15803D' : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.achStatusText,
                        ach.unlocked && { color: '#15803D', fontWeight: 'bold' },
                      ]}
                    >
                      {ach.date}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
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
                  <Image source={{ uri: post.videoThumbnail }} style={styles.savedCardThumb} />
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

      {/* Verified Certificate Viewer Modal */}
      <CertificateModal
        visible={!!selectedCertificate}
        certificate={selectedCertificate}
        onClose={() => setSelectedCertificate(null)}
      />

      {/* Post & Critique Inspection Modal */}
      <CritiqueModal
        visible={!!activePostModal}
        post={activePostModal}
        onClose={() => setActivePostModal(null)}
      />

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

      {/* Direct Mentor Voice & Video Call Modal */}
      <CallModal
        visible={!!activeCallMentor}
        user={activeCallMentor}
        callType={activeCallMentor?.type || 'voice'}
        onClose={() => setActiveCallMentor(null)}
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
    ...StyleSheet.absoluteFillObject,
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
});
