import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GuestUpgradeBanner } from '../../components/common/GuestUpgradeBanner';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../../components/common/Avatar';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { XPLeaderboardEntry, UserRole } from '../../types';
import { getLeaderboardCategoriesRequest } from '../../api/competition.api';


export const RankScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, openUserProfile, fetchLeaderboard, mySkills } = useApp();
  // A member competes on every board they hold a skill for (Learner and/or Mentor).
  const onBoard = (tab: UserRole) =>
    mySkills.length > 0 ? mySkills.some((sk) => sk.role === tab) : tab === (user?.role ?? 'Learner');

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>('Learner');
  const [activeEntries, setActiveEntries] = useState<XPLeaderboardEntry[]>([]);
  // Only categories real members have (e.g. no "Coding" chip if nobody codes).
  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    getLeaderboardCategoriesRequest()
      .then((list) => {
        setCategories(['All', ...list]);
        setSelectedCategory((cur) => (cur === 'All' || list.includes(cur) ? cur : 'All'));
      })
      .catch(() => setCategories(['All']));
  }, []);

  // Real leaderboard for the selected role + category.
  useEffect(() => {
    let active = true;
    fetchLeaderboard(selectedRoleTab, selectedCategory)
      .then((entries) => {
        if (active) setActiveEntries(entries);
      })
      .catch(() => {
        if (active) setActiveEntries([]);
      });
    return () => {
      active = false;
    };
  }, [selectedRoleTab, selectedCategory, fetchLeaderboard]);

  const top3 = activeEntries.slice(0, 3);
  const remainingList = activeEntries.slice(3);

  // The user's own row (if they've earned season XP in this board).
  const userEntry = activeEntries.find((e) => e.isCurrentUser);

  const handleUserPress = (entry: XPLeaderboardEntry) => {
    openUserProfile({
      id: entry.id,
      name: entry.name.replace(' (You)', ''),
      avatarUrl: entry.avatarUrl,
      role: entry.role,
      specialty: entry.specialtyOrHobby,
      badge: entry.badge,
    });
  };

  return (
    <View style={styles.container}>
      {/* Professional Fixed Header */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.trophyIconBg}>
              <Ionicons name="trophy-outline" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.headerMainTitle}>Leaderboard & Rankings</Text>
          </View>
        </View>

        {/* Category Selector Horizontal Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContainer}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              >
                <Ionicons
                  name={
                    cat === 'All'
                      ? 'layers-outline'
                      : cat === 'Music'
                      ? 'musical-notes-outline'
                      : cat === 'Coding'
                      ? 'code-slash-outline'
                      : cat === 'Design'
                      ? 'color-palette-outline'
                      : cat === 'Fitness'
                      ? 'fitness-outline'
                      : 'camera-outline'
                  }
                  size={13}
                  color={isActive ? '#FFFFFF' : '#64748B'}
                />
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Role Switcher Tabs */}
        <View style={styles.roleToggleRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedRoleTab('Learner')}
            style={[styles.roleTab, selectedRoleTab === 'Learner' && styles.roleTabActive]}
          >
            <Ionicons
              name="school-outline"
              size={15}
              color={selectedRoleTab === 'Learner' ? '#4F46E5' : '#64748B'}
            />
            <Text
              style={[
                styles.roleTabText,
                selectedRoleTab === 'Learner' && styles.roleTabTextActive,
              ]}
            >
              Learners
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedRoleTab('Mentor')}
            style={[styles.roleTab, selectedRoleTab === 'Mentor' && styles.roleTabActive]}
          >
            <Ionicons
              name="ribbon-outline"
              size={15}
              color={selectedRoleTab === 'Mentor' ? '#7C3AED' : '#64748B'}
            />
            <Text
              style={[
                styles.roleTabText,
                selectedRoleTab === 'Mentor' && styles.roleTabTextActive,
              ]}
            >
              Top Mentors
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 85, 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Guests can watch the boards, but aren't ranked */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <GuestUpgradeBanner message="You can watch the leaderboards, but Guests aren’t ranked and don’t earn XP. Become a Learner or Mentor to compete." />
        </View>

        {/* TOP 3 PODIUM SECTION */}
        {top3.length >= 3 && (
          <View style={styles.podiumWrapper}>
            <View style={styles.podiumCard}>
              <View style={styles.podiumRanksRow}>
                {/* RANK #2 (SILVER - LEFT) */}
                {top3[1] && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleUserPress(top3[1])}
                    style={[styles.podiumCol, styles.podiumRank2Col]}
                  >
                    <View style={styles.silverCrownBadge}>
                      <Ionicons name="medal-outline" size={14} color="#64748B" />
                      <Text style={styles.podiumRankLabel}>#2</Text>
                    </View>
                    <Avatar
                      uri={top3[1].avatarUrl}
                      name={top3[1].name}
                      size={52}
                      showRing
                    />
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top3[1].name.split(' ')[0]}
                    </Text>
                    <View style={styles.xpPillSilver}>
                      <Text style={styles.xpPillSilverText}>{top3[1].xpPoints} XP</Text>
                    </View>
                    <Text style={styles.podiumBadgeTag} numberOfLines={1}>
                      {top3[1].badge}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* RANK #1 (GOLD - CENTER HIGHER) */}
                {top3[0] && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleUserPress(top3[0])}
                    style={[styles.podiumCol, styles.podiumRank1Col]}
                  >
                    <View style={styles.goldCrownBadge}>
                      <Ionicons name="ribbon" size={16} color="#D97706" />
                      <Text style={styles.goldRankLabel}>#1 Leader</Text>
                    </View>
                    <View style={styles.goldGlowBorder}>
                      <Avatar
                        uri={top3[0].avatarUrl}
                        name={top3[0].name}
                        size={64}
                        showRing
                      />
                    </View>
                    <Text style={styles.podiumGoldName} numberOfLines={1}>
                      {top3[0].name.split(' ')[0]}
                    </Text>
                    <View style={styles.xpPillGold}>
                      <Text style={styles.xpPillGoldText}>{top3[0].xpPoints} XP</Text>
                    </View>
                    <Text style={styles.podiumGoldBadgeTag} numberOfLines={1}>
                      {top3[0].badge}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* RANK #3 (BRONZE - RIGHT) */}
                {top3[2] && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleUserPress(top3[2])}
                    style={[styles.podiumCol, styles.podiumRank3Col]}
                  >
                    <View style={styles.bronzeCrownBadge}>
                      <Ionicons name="medal-outline" size={14} color="#B45309" />
                      <Text style={styles.podiumRankLabel}>#3</Text>
                    </View>
                    <Avatar
                      uri={top3[2].avatarUrl}
                      name={top3[2].name}
                      size={50}
                      showRing
                    />
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top3[2].name.split(' ')[0]}
                    </Text>
                    <View style={styles.xpPillBronze}>
                      <Text style={styles.xpPillBronzeText}>{top3[2].xpPoints} XP</Text>
                    </View>
                    <Text style={styles.podiumBadgeTag} numberOfLines={1}>
                      {top3[2].badge}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* FULL LEADERBOARD LIST (RANK 4+) */}
        <View style={styles.listSection}>
          <View style={styles.listSectionHeader}>
            <Text style={styles.listSectionTitle}>
              {selectedCategory} Leaderboard Standings
            </Text>
          </View>

          {activeEntries.map((item, index) => {
            const isUser = item.isCurrentUser;
            const rank = item.rank || index + 1;

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => handleUserPress(item)}
                style={[
                  styles.leaderCard,
                  shadows.soft,
                  isUser && styles.leaderCardCurrentUser,
                ]}
              >
                {/* Rank Number */}
                <View
                  style={[
                    styles.rankNumberCircle,
                    rank === 1 && styles.rank1Circle,
                    rank === 2 && styles.rank2Circle,
                    rank === 3 && styles.rank3Circle,
                  ]}
                >
                  <Text
                    style={[
                      styles.rankNumberText,
                      rank <= 3 && styles.rankNumberTopText,
                    ]}
                  >
                    #{rank}
                  </Text>
                </View>

                {/* Avatar */}
                <Avatar
                  uri={item.avatarUrl}
                  name={item.name}
                  size={42}
                  showRing={item.role === 'Mentor'}
                />

                {/* Info */}
                <View style={styles.cardInfoCol}>
                  <View style={styles.cardNameRow}>
                    <Text
                      style={[styles.cardNameText, isUser && styles.cardNameCurrentUser]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.role === 'Mentor' ? (
                      <View style={styles.mentorRoleTag}>
                        <Ionicons name="checkmark-circle" size={10} color="#7C3AED" />
                        <Text style={styles.mentorRoleTagText}>Mentor</Text>
                      </View>
                    ) : (
                      <View style={styles.learnerRoleTag}>
                        <Text style={styles.learnerRoleTagText}>Learner</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardBadgeText} numberOfLines={1}>
                    {item.badge} • {item.specialtyOrHobby}
                  </Text>

                  <Text style={styles.cardMetricText} numberOfLines={1}>
                    {item.keyMetricValue}
                  </Text>
                </View>

                {/* XP Badge */}
                <View style={[styles.xpPillRight, isUser && styles.xpPillRightUser]}>
                  <Ionicons
                    name="flash-outline"
                    size={12}
                    color={isUser ? '#FFFFFF' : '#4F46E5'}
                  />
                  <Text style={[styles.xpPillRightText, isUser && styles.xpPillRightUserText]}>
                    {item.xpPoints} XP
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* FIXED USER STANDING FOOTER CARD */}
      <View style={[styles.userStickyBar, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
        <View style={styles.userStickyContent}>
          <View style={styles.userStickyLeft}>
            <View style={styles.userStickyRankCircle}>
              <Text style={styles.userStickyRankText}>
                {userEntry ? `#${userEntry.rank}` : '—'}
              </Text>
            </View>
            <View>
              <Text style={styles.userStickyTitle}>Your Rank in {selectedCategory}</Text>
              <Text style={styles.userStickySub}>
                {userEntry
                  ? `${userEntry.xpPoints} season XP`
                  : 'Earn XP this season to get ranked'}
              </Text>
            </View>
          </View>

          <View style={styles.userActiveBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.userActiveBadgeText}>
              {onBoard(selectedRoleTab)
                ? 'Active Standing'
                : 'Viewing'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: spacing.xs + 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: 10,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trophyIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMainTitle: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  categoryScrollContainer: {
    paddingHorizontal: spacing.base,
    gap: 8,
    paddingBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  roleToggleRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.lg,
    padding: 3,
    marginTop: 2,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  roleTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingTop: spacing.base,
  },
  podiumWrapper: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  podiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  podiumRanksRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  podiumCol: {
    alignItems: 'center',
    flex: 1,
  },
  podiumRank1Col: {
    marginTop: -12,
  },
  podiumRank2Col: {
    marginTop: 8,
  },
  podiumRank3Col: {
    marginTop: 12,
  },
  goldCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  goldRankLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#B45309',
  },
  goldGlowBorder: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 36,
    padding: 2,
  },
  silverCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
    marginBottom: 6,
  },
  bronzeCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
    marginBottom: 6,
  },
  podiumRankLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
  },
  podiumGoldName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 6,
  },
  podiumName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 4,
  },
  xpPillGold: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: 4,
  },
  xpPillGoldText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  xpPillSilver: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: 4,
  },
  xpPillSilverText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  xpPillBronze: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: 4,
  },
  xpPillBronzeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#B45309',
  },
  podiumGoldBadgeTag: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 3,
  },
  podiumBadgeTag: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 3,
  },
  listSection: {
    paddingHorizontal: spacing.base,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  leaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  leaderCardCurrentUser: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
  },
  rankNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank1Circle: {
    backgroundColor: '#FEF08A',
  },
  rank2Circle: {
    backgroundColor: '#E2E8F0',
  },
  rank3Circle: {
    backgroundColor: '#FEF3C7',
  },
  rankNumberText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
  },
  rankNumberTopText: {
    color: '#0F172A',
  },
  cardInfoCol: {
    flex: 1,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardNameText: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  cardNameCurrentUser: {
    color: '#4F46E5',
  },
  mentorRoleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  mentorRoleTagText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  learnerRoleTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  learnerRoleTagText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
  },
  cardBadgeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cardMetricText: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  xpPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  xpPillRightUser: {
    backgroundColor: '#4F46E5',
  },
  xpPillRightText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  xpPillRightUserText: {
    color: '#FFFFFF',
  },
  userStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: spacing.base,
    paddingTop: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  userStickyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userStickyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userStickyRankCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userStickyRankText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userStickyTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  userStickySub: {
    fontSize: 11,
    color: '#64748B',
  },
  userActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  userActiveBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803D',
  },
});
