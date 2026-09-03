import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { RewardClaimModal } from './RewardClaimModal';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { XPLeaderboardEntry, SeasonRewardItem } from '../../types';

interface RewardsHubModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'leaderboard' | 'quests' | 'rewards' | 'rules';
}

export const RewardsHubModal: React.FC<RewardsHubModalProps> = ({
  visible,
  onClose,
  initialTab = 'leaderboard',
}) => {
  const insets = useSafeAreaInsets();
  const {
    user,
    selectedRole,
    seasonCycle,
    mentorLeaderboard,
    learnerLeaderboard,
    xpTasks,
    seasonRewards,
    claimXPTask,
    activeRewardClaimModal,
    openRewardClaimModal,
    closeRewardClaimModal,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'quests' | 'rewards' | 'rules'>(
    initialTab
  );
  const [leaderboardTrack, setLeaderboardTrack] = useState<'learner' | 'mentor'>(
    selectedRole === 'Mentor' ? 'mentor' : 'learner'
  );
  const [questRoleFilter, setQuestRoleFilter] = useState<'Learner' | 'Mentor'>(
    (selectedRole as 'Learner' | 'Mentor') || 'Learner'
  );

  const activeLeaderboard =
    leaderboardTrack === 'mentor' ? mentorLeaderboard : learnerLeaderboard;

  const top1 = activeLeaderboard.find((e) => e.rank === 1);
  const top2 = activeLeaderboard.find((e) => e.rank === 2);
  const top3 = activeLeaderboard.find((e) => e.rank === 3);
  const restList = activeLeaderboard.filter((e) => e.rank > 3);

  const filteredTasks = xpTasks.filter(
    (t) => t.role === questRoleFilter || t.role === 'Both'
  );

  const handleClaimXP = (taskId: string) => {
    const res = claimXPTask(taskId);
    if (res) {
      Alert.alert(
        'XP Claimed',
        `You gained +${res.earnedXP} XP for "${res.taskTitle}". Your leaderboard position has risen.`
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onClose}
            style={styles.backCircleBtn}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.topBarTitleBox}>
            <View style={styles.topBadgeRow}>
              <Ionicons name="trophy" size={14} color="#D97706" />
              <Text style={styles.topBarSub}>SEASON 3 REWARDS & XP</Text>
            </View>
            <Text style={styles.topBarTitle}>Rewards & Rankings</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                'Seasonal Cycle Info ⏳',
                `Season 3 ends in ${seasonCycle.daysLeft} days (${seasonCycle.endsAtDate}). Top earners receive gift cards, badges, and coaching masterclasses!`
              )
            }
            style={styles.infoCircleBtn}
          >
            <Ionicons name="help-circle-outline" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Hero Season Ticker Card */}
        <View style={styles.heroContainer}>
          <LinearGradient
            colors={['#1E1B4B', '#4338CA', '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.cycleTimerPill}>
                <Ionicons name="time" size={12} color="#FDE047" />
                <Text style={styles.cycleTimerText}>
                  {seasonCycle.daysLeft} DAYS LEFT • ENDS SEPT 15
                </Text>
              </View>

              <View style={styles.poolPill}>
                <Ionicons name="gift" size={11} color="#38BDF8" />
                <Text style={styles.poolPillText}>$5K PRIZE POOL</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>{seasonCycle.title}</Text>
            <Text style={styles.heroSubtitle}>
              Earn XP doing daily & weekly tasks. Top ranked users unlock real rewards!
            </Text>

            {/* Current User Standing Strip */}
            <View style={styles.userStandingStrip}>
              <View style={styles.standingLeft}>
                <Ionicons name="sparkles" size={15} color="#FDE047" />
                <Text style={styles.standingText}>
                  Your Balance:{' '}
                  <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                    {user?.xpPoints || 1240} XP
                  </Text>
                </Text>
              </View>
              <View style={styles.standingRankBadge}>
                <Text style={styles.standingRankText}>
                  Rank #4 in Vocalists
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Tab Navigation Segmented Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('leaderboard')}
            style={[
              styles.tabBtn,
              activeTab === 'leaderboard' && styles.tabBtnActive,
            ]}
          >
            <Ionicons
              name={activeTab === 'leaderboard' ? 'trophy' : 'trophy-outline'}
              size={16}
              color={activeTab === 'leaderboard' ? '#4F46E5' : '#64748B'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'leaderboard' && styles.tabBtnTextActive,
              ]}
            >
              Leaderboards
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('quests')}
            style={[styles.tabBtn, activeTab === 'quests' && styles.tabBtnActive]}
          >
            <Ionicons
              name={activeTab === 'quests' ? 'flash' : 'flash-outline'}
              size={16}
              color={activeTab === 'quests' ? '#4F46E5' : '#64748B'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'quests' && styles.tabBtnTextActive,
              ]}
            >
              XP Quests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('rewards')}
            style={[styles.tabBtn, activeTab === 'rewards' && styles.tabBtnActive]}
          >
            <Ionicons
              name={activeTab === 'rewards' ? 'gift' : 'gift-outline'}
              size={16}
              color={activeTab === 'rewards' ? '#4F46E5' : '#64748B'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'rewards' && styles.tabBtnTextActive,
              ]}
            >
              Rewards
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('rules')}
            style={[styles.tabBtn, activeTab === 'rules' && styles.tabBtnActive]}
          >
            <Ionicons
              name={activeTab === 'rules' ? 'information-circle' : 'information-circle-outline'}
              size={16}
              color={activeTab === 'rules' ? '#4F46E5' : '#64748B'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'rules' && styles.tabBtnTextActive,
              ]}
            >
              Rules
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Tab Views */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 40, 60) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: LEADERBOARDS */}
          {activeTab === 'leaderboard' && (
            <View style={styles.leaderboardTab}>
              {/* Dual Switch: Mentors vs Learners */}
              <View style={styles.dualSwitchRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setLeaderboardTrack('mentor')}
                  style={[
                    styles.switchTrackBtn,
                    leaderboardTrack === 'mentor' && styles.switchTrackBtnActive,
                  ]}
                >
                  <Ionicons
                    name="ribbon"
                    size={15}
                    color={leaderboardTrack === 'mentor' ? '#FFFFFF' : '#4F46E5'}
                  />
                  <Text
                    style={[
                      styles.switchTrackText,
                      leaderboardTrack === 'mentor' && styles.switchTrackTextActive,
                    ]}
                  >
                    Mentor Ranking
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setLeaderboardTrack('learner')}
                  style={[
                    styles.switchTrackBtn,
                    leaderboardTrack === 'learner' && styles.switchTrackBtnActive,
                  ]}
                >
                  <Ionicons
                    name="trending-up"
                    size={15}
                    color={leaderboardTrack === 'learner' ? '#FFFFFF' : '#4F46E5'}
                  />
                  <Text
                    style={[
                      styles.switchTrackText,
                      leaderboardTrack === 'learner' && styles.switchTrackTextActive,
                    ]}
                  >
                    Learner Ranking
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Structured Scoring Criteria Card */}
              <View style={styles.criteriaCard}>
                <View style={styles.criteriaHeader}>
                  <Ionicons name="options-outline" size={13} color="#4F46E5" />
                  <Text style={styles.criteriaHeaderTitle}>SCORING CRITERIA</Text>
                </View>
                <View style={styles.criteriaChipsRow}>
                  {leaderboardTrack === 'mentor' ? (
                    <>
                      <View style={styles.criteriaChip}>
                        <Ionicons name="videocam-outline" size={11} color="#4338CA" />
                        <Text style={styles.criteriaChipText}>Critiques Delivered</Text>
                      </View>
                      <View style={styles.criteriaChip}>
                        <Ionicons name="star-outline" size={11} color="#4338CA" />
                        <Text style={styles.criteriaChipText}>Student Rating (4.8+)</Text>
                      </View>
                      <View style={styles.criteriaChip}>
                        <Ionicons name="speedometer-outline" size={11} color="#4338CA" />
                        <Text style={styles.criteriaChipText}>Fast Turnaround</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.criteriaChip}>
                        <Ionicons name="flame-outline" size={11} color="#4338CA" />
                        <Text style={styles.criteriaChipText}>Daily Streaks</Text>
                      </View>
                      <View style={styles.criteriaChip}>
                        <Ionicons name="trophy-outline" size={11} color="#4338CA" />
                        <Text style={styles.criteriaChipText}>Challenges Completed</Text>
                      </View>
                      <View style={styles.criteriaChip}>
                        <Ionicons name="trending-up-outline" size={11} color="#4338CA" />
                        <Text style={styles.criteriaChipText}>Technique Growth</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Olympic-Style Top 3 Visual Podium */}
              <View style={styles.podiumContainer}>
                {/* 2nd Place (Left) */}
                {top2 && (
                  <View style={styles.podiumColumn}>
                    <View style={styles.avatarWrapperSilver}>
                      <Image source={{ uri: top2.avatarUrl }} style={styles.podiumAvatar} />
                      <View style={[styles.podiumRankBadge, { backgroundColor: '#94A3B8' }]}>
                        <Text style={styles.podiumRankNum}>2</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top2.name.split(' ')[0]}
                    </Text>
                    <View style={styles.podiumXpPill}>
                      <Text style={styles.podiumXpText}>{top2.xpPoints} XP</Text>
                    </View>
                    <View style={[styles.podiumBlock, styles.podiumBlockSilver]}>
                      <Text style={styles.podiumMedal}>🥈</Text>
                    </View>
                  </View>
                )}

                {/* 1st Place (Center - Highest) */}
                {top1 && (
                  <View style={[styles.podiumColumn, styles.podiumCenter]}>
                    <View style={styles.avatarWrapperGold}>
                      <Image source={{ uri: top1.avatarUrl }} style={styles.podiumAvatarGold} />
                      <View style={[styles.podiumRankBadge, { backgroundColor: '#F59E0B' }]}>
                        <Text style={styles.podiumRankNum}>1</Text>
                      </View>
                    </View>
                    <Text style={[styles.podiumName, { fontWeight: 'bold' }]} numberOfLines={1}>
                      {top1.name.split(' ')[0]}
                    </Text>
                    <View style={[styles.podiumXpPill, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.podiumXpText, { color: '#B45309', fontWeight: 'bold' }]}>
                        {top1.xpPoints} XP
                      </Text>
                    </View>
                    <View style={[styles.podiumBlock, styles.podiumBlockGold]}>
                      <Text style={styles.podiumMedal}>🥇</Text>
                    </View>
                  </View>
                )}

                {/* 3rd Place (Right) */}
                {top3 && (
                  <View style={styles.podiumColumn}>
                    <View style={styles.avatarWrapperBronze}>
                      <Image source={{ uri: top3.avatarUrl }} style={styles.podiumAvatar} />
                      <View style={[styles.podiumRankBadge, { backgroundColor: '#D97706' }]}>
                        <Text style={styles.podiumRankNum}>3</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top3.name.split(' ')[0]}
                    </Text>
                    <View style={styles.podiumXpPill}>
                      <Text style={styles.podiumXpText}>{top3.xpPoints} XP</Text>
                    </View>
                    <View style={[styles.podiumBlock, styles.podiumBlockBronze]}>
                      <Text style={styles.podiumMedal}>🥉</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Ranks 4 to 10 List */}
              <View style={styles.rankListContainer}>
                <Text style={styles.rankListTitle}>Ranks #4 - #10</Text>

                {restList.map((entry) => {
                  const isMe = entry.isCurrentUser;
                  return (
                    <View
                      key={entry.id}
                      style={[
                        styles.rankRowCard,
                        isMe && styles.myRankHighlightCard,
                        shadows.soft,
                      ]}
                    >
                      <View style={styles.rankNumberBox}>
                        <Text style={[styles.rankNumberText, isMe && { color: '#4F46E5', fontWeight: 'bold' }]}>
                          #{entry.rank}
                        </Text>
                      </View>

                      <Image source={{ uri: entry.avatarUrl }} style={styles.rowAvatar} />

                      <View style={styles.rowInfoBlock}>
                        <View style={styles.rowNameTitleLine}>
                          <Text style={[styles.rowNameText, isMe && { color: '#4F46E5' }]} numberOfLines={1}>
                            {entry.name}
                          </Text>
                          {isMe && (
                            <View style={styles.youBadge}>
                              <Text style={styles.youBadgeText}>YOU</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.rowMetricSub}>
                          {entry.keyMetricValue}
                        </Text>
                      </View>

                      <View style={styles.rowXpBox}>
                        <Text style={styles.rowXpValue}>{entry.xpPoints}</Text>
                        <Text style={styles.rowXpLabel}>XP</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* TAB 2: XP QUESTS & JOBS */}
          {activeTab === 'quests' && (
            <View style={styles.questsTab}>
              <View style={styles.questRoleToggle}>
                <Text style={styles.questRoleLabel}>Show Tasks For:</Text>
                <View style={styles.questRoleButtons}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setQuestRoleFilter('Learner')}
                    style={[
                      styles.questFilterBtn,
                      questRoleFilter === 'Learner' && styles.questFilterBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.questFilterText,
                        questRoleFilter === 'Learner' && styles.questFilterTextActive,
                      ]}
                    >
                      Learner Tasks
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setQuestRoleFilter('Mentor')}
                    style={[
                      styles.questFilterBtn,
                      questRoleFilter === 'Mentor' && styles.questFilterBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.questFilterText,
                        questRoleFilter === 'Mentor' && styles.questFilterTextActive,
                      ]}
                    >
                      Mentor Tasks
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.questsNotice}>
                Complete these daily practice drills and community contributions to accumulate XP and climb the seasonal rankings.
              </Text>

              {/* Quest Items */}
              <View style={styles.questsList}>
                {filteredTasks.map((task) => (
                  <View key={task.id} style={[styles.taskCard, shadows.soft]}>
                    <View style={styles.taskCardTop}>
                      <View style={[styles.taskIconBox, { backgroundColor: task.iconBg }]}>
                        <Ionicons
                          name={task.icon as keyof typeof Ionicons.glyphMap}
                          size={20}
                          color={task.iconColor}
                        />
                      </View>

                      <View style={styles.taskTitleCol}>
                        <View style={styles.taskHeaderRow}>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>
                              {task.category.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.taskDesc}>{task.description}</Text>
                      </View>

                      <View style={styles.xpRewardPill}>
                        <Text style={styles.xpRewardText}>+{task.xpReward} XP</Text>
                      </View>
                    </View>

                    {/* Bottom Action / Progress Row */}
                    <View style={styles.taskBottomRow}>
                      {task.progress && (
                        <View style={styles.progressCounter}>
                          <Ionicons name="calendar-outline" size={13} color="#64748B" />
                          <Text style={styles.progressCounterText}>
                            {task.progress.current} / {task.progress.total} {task.progress.unit}
                          </Text>
                        </View>
                      )}

                      {task.completed ? (
                        <View style={styles.completedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          <Text style={styles.completedBadgeText}>Completed</Text>
                        </View>
                      ) : task.claimable ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleClaimXP(task.id)}
                          style={styles.claimXpBtn}
                        >
                          <LinearGradient
                            colors={['#4F46E5', '#7C3AED']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.claimXpGradient}
                          >
                            <Ionicons name="flash" size={13} color="#FFFFFF" />
                            <Text style={styles.claimXpBtnText}>Claim +{task.xpReward} XP</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() =>
                            Alert.alert(
                              task.title,
                              `Keep practicing to fulfill: ${task.description}`
                            )
                          }
                          style={styles.inProgressBtn}
                        >
                          <Text style={styles.inProgressBtnText}>In Progress</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 3: 6 SEASONAL REWARDS (From Image) */}
          {activeTab === 'rewards' && (
            <View style={styles.rewardsTab}>
              <View style={styles.rewardsIntroBox}>
                <Text style={styles.rewardsIntroTitle}>
                  Seasonal Rewards Pool
                </Text>
                <Text style={styles.rewardsIntroSub}>
                  At the end of each monthly/seasonal cycle, top-ranked users on both Mentor and Learner leaderboards receive these tiered rewards:
                </Text>
              </View>

              {/* The 6 Reward Cards */}
              <View style={styles.rewardsGrid}>
                {seasonRewards.map((reward) => (
                  <TouchableOpacity
                    key={reward.id}
                    activeOpacity={0.9}
                    onPress={() => openRewardClaimModal(reward)}
                    style={[styles.rewardCard, shadows.soft]}
                  >
                    <LinearGradient
                      colors={reward.gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.rewardCardTopGradient}
                    >
                      <View style={styles.rewardCardHeaderRow}>
                        <View style={styles.rewardIconBadge}>
                          <Ionicons
                            name={reward.icon as keyof typeof Ionicons.glyphMap}
                            size={20}
                            color="#FFFFFF"
                          />
                        </View>
                        <View style={styles.rewardRankTargetPill}>
                          <Text style={styles.rewardRankTargetText}>
                            {reward.tag}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rewardCardTitle}>{reward.title}</Text>
                      <Text style={styles.rewardCardSub}>{reward.subtitle}</Text>
                    </LinearGradient>

                    <View style={styles.rewardCardBody}>
                      <Text style={styles.rewardCardDesc} numberOfLines={2}>
                        {reward.description}
                      </Text>

                      <View style={styles.perksQuickList}>
                        {reward.perks.slice(0, 2).map((p, idx) => (
                          <View key={idx} style={styles.quickPerkRow}>
                            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                            <Text style={styles.quickPerkText} numberOfLines={1}>
                              {p}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.claimPreviewBtnRow}>
                        <Text style={styles.tapToPreviewLabel}>
                          Tap to view details & demo voucher
                        </Text>
                        <Ionicons name="arrow-forward-circle" size={18} color="#4F46E5" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* TAB 4: RULES & CYCLE EXPLANATION */}
          {activeTab === 'rules' && (
            <View style={styles.rulesTab}>
              <View style={[styles.rulesCard, shadows.soft]}>
                <View style={styles.rulesTitleRow}>
                  <Ionicons name="ribbon" size={20} color="#4F46E5" />
                  <Text style={styles.rulesTitle}>How Rankings & Rewards Work</Text>
                </View>

                <Text style={styles.rulesSectionHeader}>🏆 1. Mentor Ranking Logic</Text>
                <Text style={styles.rulesBody}>
                  Mentors earn Mentorship XP by providing thoughtful video critiques, maintaining high student satisfaction (4.8+ rating), and answering requests within 2 hours. Top mentors receive the Wall of Fame Spotlight, paid masterclass deals, and platform tokens.
                </Text>

                <Text style={styles.rulesSectionHeader}>📈 2. Learner Ranking Logic</Text>
                <Text style={styles.rulesBody}>
                  Learners earn Learner XP through consistent daily practice, weekly streak milestones, completing circle challenges, and raising their technique benchmark score. Top learners earn $25 - $100 gift coupons and free 1-on-1 Berklee masterclass passes.
                </Text>

                <Text style={styles.rulesSectionHeader}>⏳ 3. Monthly / Seasonal Cycle Reset</Text>
                <Text style={styles.rulesBody}>
                  Each cycle lasts 30 days. At midnight on the final day, the leaderboard locks, rewards are distributed to top earners’ wallets/emails, and a new season begins with refreshed prizes and fresh quests.
                </Text>

                <Text style={styles.rulesSectionHeader}>⭐ 4. Fair Play & Verification</Text>
                <Text style={styles.rulesBody}>
                  All video submissions and critique ratings are verified by the community to ensure genuine learning and encouragement.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Celebratory Claim Modal */}
        <RewardClaimModal
          visible={!!activeRewardClaimModal}
          reward={activeRewardClaimModal}
          onClose={closeRewardClaimModal}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleBox: {
    alignItems: 'center',
  },
  topBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topBarSub: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  infoCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContainer: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cycleTimerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  cycleTimerText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FDE047',
    letterSpacing: 0.4,
  },
  poolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  poolPillText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 10,
    lineHeight: 16,
  },
  userStandingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  standingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  standingText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  standingRankBadge: {
    backgroundColor: '#FDE047',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  standingRankText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: spacing.sm,
    marginTop: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#4F46E5',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  leaderboardTab: {
    gap: spacing.sm,
  },
  dualSwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderRadius: borderRadius.xl,
    padding: 4,
    gap: 4,
  },
  switchTrackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    gap: 6,
  },
  switchTrackBtnActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  switchTrackText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  switchTrackTextActive: {
    color: '#FFFFFF',
  },
  criteriaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  criteriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 2,
  },
  criteriaHeaderTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  criteriaChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  criteriaChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  criteriaChipText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#3730A3',
    textAlign: 'center',
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.base,
    gap: 12,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
  },
  podiumCenter: {
    marginTop: -16,
  },
  crownEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  avatarWrapperGold: {
    position: 'relative',
    borderWidth: 3,
    borderColor: '#F59E0B',
    borderRadius: 36,
    padding: 2,
  },
  podiumAvatarGold: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarWrapperSilver: {
    position: 'relative',
    borderWidth: 2.5,
    borderColor: '#94A3B8',
    borderRadius: 30,
    padding: 2,
  },
  avatarWrapperBronze: {
    position: 'relative',
    borderWidth: 2.5,
    borderColor: '#D97706',
    borderRadius: 30,
    padding: 2,
  },
  podiumAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  podiumRankBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  podiumRankNum: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 6,
  },
  podiumXpPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: 2,
    marginBottom: 6,
  },
  podiumXpText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  podiumBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  podiumBlockGold: {
    height: 80,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  podiumBlockSilver: {
    height: 60,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  podiumBlockBronze: {
    height: 48,
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  podiumMedal: {
    fontSize: 22,
  },
  rankListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  rankListTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  rankRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },
  myRankHighlightCard: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1.5,
  },
  rankNumberBox: {
    width: 26,
    alignItems: 'center',
  },
  rankNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  rowInfoBlock: {
    flex: 1,
  },
  rowNameTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowNameText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  youBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  rowMetricSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  rowXpBox: {
    alignItems: 'flex-end',
  },
  rowXpValue: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  rowXpLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  questsTab: {
    gap: spacing.sm,
  },
  questRoleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  questRoleLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  questRoleButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  questFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  questFilterBtnActive: {
    backgroundColor: '#4F46E5',
  },
  questFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  questFilterTextActive: {
    color: '#FFFFFF',
  },
  questsNotice: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  questsList: {
    gap: 10,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  taskCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  taskIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitleCol: {
    flex: 1,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748B',
  },
  taskDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  xpRewardPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  xpRewardText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  taskBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  progressCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressCounterText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803D',
  },
  claimXpBtn: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  claimXpGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  claimXpBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  inProgressBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  inProgressBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
  },
  rewardsTab: {
    gap: spacing.sm,
  },
  rewardsIntroBox: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  rewardsIntroTitle: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: 3,
  },
  rewardsIntroSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  rewardsGrid: {
    gap: 12,
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rewardCardTopGradient: {
    padding: spacing.md,
  },
  rewardCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rewardIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardRankTargetPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  rewardRankTargetText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  rewardCardTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  rewardCardSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  rewardCardBody: {
    padding: spacing.md,
    gap: 8,
  },
  rewardCardDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  perksQuickList: {
    gap: 4,
  },
  quickPerkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickPerkText: {
    fontSize: 11,
    color: '#334155',
  },
  claimPreviewBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 2,
  },
  tapToPreviewLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  rulesTab: {
    gap: spacing.sm,
  },
  rulesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  rulesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rulesTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  rulesSectionHeader: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#1E1B4B',
    marginTop: 6,
  },
  rulesBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
