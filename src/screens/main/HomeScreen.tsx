import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { HomeHeader } from '../../components/home/HomeHeader';
import { BannerCard } from '../../components/home/BannerCard';
import { SearchBar } from '../../components/home/SearchBar';
import { PersonalStatsDashboard } from '../../components/home/PersonalStatsDashboard';
import { RecentVideosSection } from '../../components/home/RecentVideosSection';
import { CritiqueModal } from '../../components/community/CritiqueModal';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { CommunityPost } from '../../types';

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    user,
    selectedRole,
    selectedHobby,
    posts,
    toggleLikePost,
    getJoinedCommunityObjects,
    openRewardsModal,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeCritiquePost, setActiveCritiquePost] = useState<CommunityPost | null>(null);

  const joinedCommunityObjects = getJoinedCommunityObjects();

  const handleNotificationPress = () => {
    Alert.alert(
      'Notifications 🔔',
      `You have 2 new mentor critiques in ${selectedHobby || 'Music'} and 1 live feedback session available.`
    );
  };

  const handleProfilePress = () => {
    navigation.navigate('ProfileTab');
  };

  const handleVideoPress = (post: CommunityPost) => {
    setActiveCritiquePost(post);
  };

  const publicPosts = posts.filter((p) => !p.isPrivate);

  const filteredPosts = publicPosts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.content.toLowerCase().includes(q) ||
      p.authorName.toLowerCase().includes(q) ||
      p.communityName.toLowerCase().includes(q) ||
      (p.videoTitle && p.videoTitle.toLowerCase().includes(q)) ||
      (p.tag && p.tag.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      {/* Fixed Top Header */}
      <View style={{ paddingTop: Math.max(insets.top, 12), backgroundColor: '#FFFFFF' }}>
        <HomeHeader
          onNotificationPress={handleNotificationPress}
          onProfilePress={handleProfilePress}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 95, 120) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Floating Clean Search Bar */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Season 3 Rewards & XP Sprint Spotlight Banner */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openRewardsModal}
          style={[styles.seasonBannerCard, shadows.glow]}
        >
          <LinearGradient
            colors={['#1E1B4B', '#4338CA', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.seasonGradient}
          >
            <View style={styles.seasonContentLeft}>
              <View style={styles.seasonBadgeRow}>
                <View style={styles.seasonPulseDot} />
                <Text style={styles.seasonBadgeText}>SEASON 3 • 12D LEFT</Text>
                <View style={styles.seasonPoolBadge}>
                  <Text style={styles.seasonPoolText}>$5K Pool</Text>
                </View>
              </View>

              <Text style={styles.seasonBannerTitle}>
                Dual Rankings &{'\n'}Rewards Sprint 🏆
              </Text>

              <Text style={styles.seasonBannerDesc}>
                {selectedRole === 'Mentor'
                  ? 'Help learners & provide video critiques to win Top Mentor perks & tokens.'
                  : 'Maintain your streak & earn XP to unlock gift vouchers & Berklee masterclasses.'}
              </Text>

              <View style={styles.seasonActionRow}>
                <View style={styles.seasonActionBtn}>
                  <Text style={styles.seasonActionBtnText}>View Rankings & Quests</Text>
                  <Ionicons name="arrow-forward" size={12} color="#4F46E5" />
                </View>
                <Text style={styles.seasonStandingTag}>
                  Rank #4 • {user?.xpPoints || 1240} XP
                </Text>
              </View>
            </View>

            <View style={styles.seasonTrophyCol}>
              <View style={styles.seasonTrophyRing}>
                <Ionicons name="trophy" size={26} color="#FDE047" />
              </View>
              <View style={styles.seasonRankPill}>
                <Text style={styles.seasonRankPillText}>#4</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Hero Banner Spotlight */}
        <BannerCard
          onExplorePress={() =>
            Alert.alert(
              'Explore Tracks 🚀',
              `Personalized ${selectedHobby} masterclass roadmap ready!`
            )
          }
        />

        {/* My Joined Communities Strip */}
        {joinedCommunityObjects.length > 0 && (
          <View style={styles.joinedSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.titleWithIcon}>
                <Text style={styles.sectionTitle}>My Circles</Text>
                <View style={styles.communityCountBadge}>
                  <Text style={styles.communityCountText}>
                    {joinedCommunityObjects.length}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('CommunityTab')}
              >
                <Text style={styles.manageLink}>Explore</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.joinedScroll}
            >
              {joinedCommunityObjects.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('CommunityTab')}
                  style={[styles.communityCardMini, shadows.soft]}
                >
                  <View style={[styles.miniIconBox, { backgroundColor: c.iconBgColor }]}>
                    <Ionicons
                      name={c.iconName as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={c.iconColor}
                    />
                  </View>
                  <View style={styles.miniInfo}>
                    <Text style={styles.miniName} numberOfLines={1}>
                      {c.name.split('&')[0].trim()}
                    </Text>
                    <View style={styles.memberRow}>
                      <Ionicons name="people" size={11} color="#64748B" />
                      <Text style={styles.miniMembers}>{c.memberCount}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Visual Progress & Growth Dashboard (Linked to Profile Analytics) */}
        <PersonalStatsDashboard
          onAnalyticsPress={() => navigation.navigate('ProfileTab', { section: 'analytics' })}
          onExploreMorePress={() => navigation.navigate('CommunityTab')}
        />

        {/* Recent Practice Videos Section */}
        <RecentVideosSection
          posts={filteredPosts.length > 0 ? filteredPosts : publicPosts}
          onVideoPress={handleVideoPress}
          onLikePress={(postId) => toggleLikePost(postId)}
          onExploreMorePress={() => navigation.navigate('CommunityTab')}
        />
      </ScrollView>

      {/* Interactive Critique & Comments Sheet */}
      <CritiqueModal
        visible={!!activeCritiquePost}
        post={activeCritiquePost}
        onClose={() => setActiveCritiquePost(null)}
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
    paddingTop: spacing.xs,
  },
  joinedSection: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  communityCountBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  communityCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  manageLink: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  joinedScroll: {
    gap: spacing.sm,
    paddingRight: spacing.base,
  },
  communityCardMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 180,
    maxWidth: 220,
    gap: 8,
  },
  miniIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInfo: {
    flex: 1,
  },
  miniName: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  miniMembers: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  seasonBannerCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  seasonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xxl,
    gap: 10,
  },
  seasonContentLeft: {
    flex: 1,
  },
  seasonBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  seasonPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FDE047',
  },
  seasonBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FDE047',
    letterSpacing: 0.5,
  },
  seasonPoolBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  seasonPoolText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  seasonBannerTitle: {
    fontSize: 17,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 4,
  },
  seasonBannerDesc: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 15,
    marginBottom: 10,
  },
  seasonActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  seasonActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  seasonActionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  seasonStandingTag: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  seasonTrophyCol: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  seasonTrophyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  seasonRankPill: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#FDE047',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  seasonRankPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
});
