import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { RewardClaimModal } from './RewardClaimModal';
import {
  getXpRulesRequest,
  getXpHistoryRequest,
  type ApiUserStats,
  type XpHistoryRow,
  type XpRulebook,
  type XpRuleView,
} from '../../api/gamification.api';
import { borderRadius, shadows, spacing, typography } from '../../theme';
import { XPTask } from '../../types';

type HubTab = 'quests' | 'activity' | 'rewards' | 'rules';
type Board = 'Learner' | 'Mentor';

interface RewardsHubModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: HubTab;
}

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Consistency: 'flame-outline',
  Practice: 'musical-notes-outline',
  Community: 'people-outline',
  Mentoring: 'ribbon-outline',
  Milestones: 'flag-outline',
};

/** "Oct 1, 5:30 AM" in the viewer's local time. */
function formatLocal(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

export const RewardsHubModal: React.FC<RewardsHubModalProps> = ({
  visible,
  onClose,
  initialTab = 'quests',
}) => {
  const insets = useSafeAreaInsets();
  const {
    user,
    selectedRole,
    seasonCycle,
    xpTasks,
    seasonRewards,
    claimXPTask,
    userStats,
    xpRulesVersion,
    mySkills,
    activeRewardClaimModal,
    openRewardClaimModal,
    closeRewardClaimModal,
  } = useApp();

  const myBoard: Board = selectedRole === 'Mentor' ? 'Mentor' : 'Learner';
  const stats = userStats as ApiUserStats | null;

  const [tab, setTab] = useState<HubTab>(initialTab);
  const [rulesFor, setRulesFor] = useState<Board>(myBoard);
  const [rulebook, setRulebook] = useState<XpRulebook | null>(null);
  const [history, setHistory] = useState<XpHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  // Activity filter: everything, or only the XP earned as a Learner / Mentor.
  const [activityRole, setActivityRole] = useState<'All' | 'Learner' | 'Mentor'>('All');

  const load = useCallback(async () => {
    const [rb, hist] = await Promise.allSettled([getXpRulesRequest(), getXpHistoryRequest(100)]);
    if (rb.status === 'fulfilled') setRulebook(rb.value);
    if (hist.status === 'fulfilled') setHistory(hist.value);
  }, []);

  // Load when opened, and again whenever an admin changes the rules.
  useEffect(() => {
    if (!visible) return;
    setTab(initialTab);
    setRulesFor(myBoard);
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible && xpRulesVersion > 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xpRulesVersion]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleClaim = async (task: XPTask) => {
    setClaimingId(task.id);
    const res = await claimXPTask(task.id);
    setClaimingId(null);
    if (res) {
      Alert.alert('XP claimed', `+${res.earnedXP} XP for “${res.taskTitle}”.`);
      getXpHistoryRequest(100).then(setHistory).catch(() => {});
    } else {
      Alert.alert('Could not claim', 'This quest isn’t complete yet, or it was already claimed.');
    }
  };

  // ----- derived -----
  const seasonXp = user?.seasonXp ?? stats?.seasonXp ?? 0;
  const seasonRank = user?.seasonRank ?? stats?.seasonRank ?? 0;
  const rankTotal = stats?.seasonRankTotal ?? 0;
  const level = stats?.level ?? user?.level ?? 1;
  const levelTitle = stats?.levelBadge ?? user?.levelBadge ?? 'Newcomer';
  const into = stats?.xpIntoLevel ?? 0;
  const need = stats?.xpForNextLevel ?? 0;
  const levelPct = need > 0 ? Math.min(100, Math.round((into / need) * 100)) : 0;
  const resetAt = rulebook?.season.endsAt ?? seasonCycle.endsAt;
  const daysLeft = rulebook?.season.daysLeft ?? seasonCycle.daysLeft;

  const dailyQuests = xpTasks.filter((t) => t.category === 'daily');
  const weeklyQuests = xpTasks.filter((t) => t.category === 'weekly');

  const rulesForBoard = useMemo(() => {
    const rules = (rulebook?.rules ?? []).filter((r) => r.role === 'Both' || r.role === rulesFor);
    const groups = new Map<string, XpRuleView[]>();
    for (const r of rules) {
      const list = groups.get(r.category) ?? [];
      list.push(r);
      groups.set(r.category, list);
    }
    return [...groups.entries()];
  }, [rulebook, rulesFor]);

  const questsForBoard = (rulebook?.quests ?? []).filter((q) => q.role === rulesFor);
  // A member who is a Learner in one skill and a Mentor in another sees both
  // kinds of XP — tagged per row, with a filter and a per-role season total.
  const hasBothRoles =
    mySkills.some((s) => s.role === 'Learner') && mySkills.some((s) => s.role === 'Mentor');
  const roleTotals = {
    Learner: mySkills.filter((s) => s.role === 'Learner').reduce((n, s) => n + s.seasonXp, 0),
    Mentor: mySkills.filter((s) => s.role === 'Mentor').reduce((n, s) => n + s.seasonXp, 0),
  };
  const shownHistory = activityRole === 'All' ? history : history.filter((h) => h.role === activityRole);
  const historyThisSeason = shownHistory.filter((h) => h.thisSeason);
  const historyEarlier = shownHistory.filter((h) => !h.thisSeason);

  // ----- render helpers -----
  const renderQuest = (task: XPTask) => {
    const pct = task.progress?.total
      ? Math.min(100, Math.round((task.progress.current / task.progress.total) * 100))
      : 0;
    return (
      <View key={task.id} style={[styles.card, shadows.soft]}>
        <View style={styles.questTop}>
          <View style={[styles.questIcon, { backgroundColor: task.iconBg }]}>
            <Ionicons name={task.icon as keyof typeof Ionicons.glyphMap} size={19} color={task.iconColor} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.questTitle}>{task.title}</Text>
            <Text style={styles.questDesc}>{task.description}</Text>
          </View>
          <View style={styles.xpPill}>
            <Text style={styles.xpPillText}>+{task.xpReward} XP</Text>
          </View>
        </View>

        {task.progress && (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {task.progress.current}/{task.progress.total} {task.progress.unit}
            </Text>
          </View>
        )}

        <View style={styles.questBottom}>
          {task.completed ? (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text style={styles.doneText}>Claimed</Text>
            </View>
          ) : task.claimable ? (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={claimingId === task.id}
              onPress={() => handleClaim(task)}
              style={styles.claimBtn}
            >
              <LinearGradient colors={['#4F46E5', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.claimGradient}>
                {claimingId === task.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={13} color="#FFFFFF" />
                    <Text style={styles.claimText}>Claim +{task.xpReward} XP</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <Text style={styles.inProgress}>In progress</Text>
          )}
        </View>
      </View>
    );
  };

  const renderHistoryRow = (h: XpHistoryRow) => (
    <View key={h.id} style={styles.historyRow}>
      <View style={styles.historyIcon}>
        <Ionicons name={h.icon as keyof typeof Ionicons.glyphMap} size={16} color="#4F46E5" />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.historyLabel} numberOfLines={1}>{h.label}</Text>
        <View style={styles.historyMetaRow}>
          {!!h.skill && (
            <View style={[styles.historyTag, h.role === 'Mentor' ? styles.historyTagMentor : styles.historyTagLearner]}>
              <Text style={[styles.historyTagText, h.role === 'Mentor' ? styles.historyTagTextMentor : styles.historyTagTextLearner]}>
                {h.skill}{h.role ? ` · ${h.role}` : ''}
              </Text>
            </View>
          )}
          <Text style={styles.historyTime}>{timeAgo(h.createdAt)}</Text>
        </View>
      </View>
      <Text style={[styles.historyAmount, h.amount < 0 && { color: '#DC2626' }]}>
        {h.amount > 0 ? '+' : ''}{h.amount} XP
      </Text>
    </View>
  );

  const renderRule = (r: XpRuleView) => (
    <View key={r.key} style={styles.ruleRow}>
      <View style={styles.flex1}>
        <View style={styles.ruleTitleRow}>
          <Text style={styles.ruleTitle}>{r.title}</Text>
          {r.isCore && (
            <View style={styles.coreChip}>
              <Ionicons name="lock-closed" size={9} color="#475569" />
              <Text style={styles.coreChipText}>Fixed</Text>
            </View>
          )}
        </View>
        <Text style={styles.ruleDesc}>{r.description}</Text>
        <Text style={styles.ruleCap}>
          {r.dailyCap ? `Up to ${r.dailyCap}× per day` : 'No daily limit'}
          {r.role !== 'Both' ? ` · ${r.role}s only` : ''}
        </Text>
      </View>
      <Text style={styles.ruleXp}>+{r.xp}</Text>
    </View>
  );

  const Bullets = ({ items, color }: { items: string[]; color: string }) => (
    <View style={styles.bullets}>
      {items.map((t, i) => (
        <View key={i} style={styles.bulletRow}>
          <Ionicons name="checkmark-circle" size={14} color={color} style={{ marginTop: 1 }} />
          <Text style={styles.bulletText}>{t}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.topTitleBox}>
            <Text style={styles.topKicker}>SEASON {seasonCycle.seasonNumber}</Text>
            <Text style={styles.topTitle}>XP & Rankings</Text>
          </View>
          <View style={styles.iconBtnGhost} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          stickyHeaderIndices={[1]}
        >
          {/* Hero */}
          <View style={styles.heroWrap}>
            <LinearGradient colors={['#1E1B4B', '#4338CA', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroTopRow}>
                <View style={styles.timerPill}>
                  <Ionicons name="time" size={12} color="#FDE047" />
                  <Text style={styles.timerText}>
                    {daysLeft} {daysLeft === 1 ? 'DAY' : 'DAYS'} LEFT
                  </Text>
                </View>
                {!!resetAt && <Text style={styles.resetText}>Resets {formatLocal(resetAt)}</Text>}
              </View>

              <Text style={styles.heroTitle}>{seasonCycle.title}</Text>
              <Text style={styles.heroSub}>{seasonCycle.subtitle}</Text>

              <View style={styles.standingRow}>
                <View style={styles.standingCell}>
                  <Text style={styles.standingNum}>{seasonXp}</Text>
                  <Text style={styles.standingLabel}>XP this month</Text>
                </View>
                <View style={styles.standingDivider} />
                <View style={styles.standingCell}>
                  <Text style={styles.standingNum}>{seasonRank > 0 ? `#${seasonRank}` : '—'}</Text>
                  <Text style={styles.standingLabel}>
                    {seasonRank > 0 ? `of ${rankTotal} ${myBoard}s` : 'Not ranked yet'}
                  </Text>
                </View>
                <View style={styles.standingDivider} />
                <View style={styles.standingCell}>
                  <Text style={styles.standingNum}>{user?.streakDays ?? 0}🔥</Text>
                  <Text style={styles.standingLabel}>Day streak</Text>
                </View>
              </View>

              <View style={styles.levelBox}>
                <View style={styles.levelHeader}>
                  <Text style={styles.levelTitle}>Level {level} · {levelTitle}</Text>
                  <Text style={styles.levelXp}>{need > 0 ? `${into}/${need} XP` : ''}</Text>
                </View>
                <View style={styles.levelTrack}>
                  <View style={[styles.levelFill, { width: `${levelPct}%` }]} />
                </View>
                <Text style={styles.levelNote}>
                  Lifetime {user?.xpPoints ?? 0} XP · Level never resets
                </Text>
              </View>

              {!!stats?.lastSeason && (
                <View style={styles.lastSeason}>
                  <Ionicons name="ribbon" size={13} color="#FDE047" />
                  <Text style={styles.lastSeasonText}>
                    Season {stats.lastSeason.seasonNumber}: finished #{stats.lastSeason.rank} ({stats.lastSeason.board}) with {stats.lastSeason.xp} XP
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>

          {/* Tabs (sticky) */}
          <View style={styles.tabBarWrap}>
            <View style={styles.tabBar}>
              {([
                { key: 'quests', label: 'Quests', icon: 'flash' },
                { key: 'activity', label: 'Activity', icon: 'pulse' },
                { key: 'rewards', label: 'Rewards', icon: 'gift' },
                { key: 'rules', label: 'Rules', icon: 'book' },
              ] as const).map((t) => {
                const active = tab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    activeOpacity={0.8}
                    onPress={() => setTab(t.key)}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                  >
                    <Ionicons
                      name={(active ? t.icon : `${t.icon}-outline`) as keyof typeof Ionicons.glyphMap}
                      size={15}
                      color={active ? '#4F46E5' : '#64748B'}
                    />
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.body}>
            {loading && !rulebook ? (
              <ActivityIndicator style={{ marginTop: 30 }} color="#4F46E5" />
            ) : null}

            {/* ---------------- QUESTS ---------------- */}
            {tab === 'quests' && (
              <>
                <Text style={styles.sectionNote}>
                  Your {myBoard.toLowerCase()} quests. Progress updates from your real activity; claim the XP once a
                  quest is complete. Daily quests reset every day, weekly quests every Monday.
                </Text>
                {xpTasks.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="flash-outline" size={34} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No quests right now</Text>
                  </View>
                ) : (
                  <>
                    {dailyQuests.length > 0 && <Text style={styles.groupTitle}>Daily</Text>}
                    {dailyQuests.map(renderQuest)}
                    {weeklyQuests.length > 0 && <Text style={styles.groupTitle}>Weekly</Text>}
                    {weeklyQuests.map(renderQuest)}
                  </>
                )}
              </>
            )}

            {/* ---------------- ACTIVITY ---------------- */}
            {tab === 'activity' && (
              <>
                {hasBothRoles && history.length > 0 && (
                  <View style={styles.activityHead}>
                    <View style={styles.roleTotals}>
                      <View style={[styles.roleTotal, { backgroundColor: '#EEF2FF' }]}>
                        <Text style={[styles.roleTotalValue, { color: '#4338CA' }]}>{roleTotals.Learner.toLocaleString()}</Text>
                        <Text style={styles.roleTotalLabel}>XP as Learner · this season</Text>
                      </View>
                      <View style={[styles.roleTotal, { backgroundColor: '#F5F3FF' }]}>
                        <Text style={[styles.roleTotalValue, { color: '#7C3AED' }]}>{roleTotals.Mentor.toLocaleString()}</Text>
                        <Text style={styles.roleTotalLabel}>XP as Mentor · this season</Text>
                      </View>
                    </View>
                    <View style={styles.activityFilter}>
                      {(['All', 'Learner', 'Mentor'] as const).map((r) => (
                        <TouchableOpacity
                          key={r}
                          activeOpacity={0.8}
                          onPress={() => setActivityRole(r)}
                          style={[styles.activityChip, activityRole === r && styles.activityChipActive]}
                        >
                          <Text style={[styles.activityChipText, activityRole === r && styles.activityChipTextActive]}>
                            {r === 'All' ? 'All' : `As ${r}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {shownHistory.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="pulse-outline" size={34} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No XP yet</Text>
                    <Text style={styles.emptySub}>
                      Post, practice, comment and check in daily — every XP you earn shows up here.
                    </Text>
                  </View>
                ) : (
                  <>
                    {historyThisSeason.length > 0 && (
                      <>
                        <Text style={styles.groupTitle}>This season</Text>
                        <View style={[styles.card, styles.listCard, shadows.soft]}>
                          {historyThisSeason.map(renderHistoryRow)}
                        </View>
                      </>
                    )}
                    {historyEarlier.length > 0 && (
                      <>
                        <Text style={styles.groupTitle}>Earlier (counts toward your level)</Text>
                        <View style={[styles.card, styles.listCard, shadows.soft]}>
                          {historyEarlier.map(renderHistoryRow)}
                        </View>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* ---------------- REWARDS ---------------- */}
            {tab === 'rewards' && (
              <>
                {seasonRewards.length === 0 ? (
                  <View style={styles.empty}>
                    <View style={styles.emptyIconCircle}>
                      <Ionicons name="gift-outline" size={30} color="#7C3AED" />
                    </View>
                    <Text style={styles.emptyTitle}>No rewards announced yet</Text>
                    <Text style={styles.emptySub}>
                      Rewards for this season will appear here as soon as they’re announced. Keep earning XP —
                      final ranks lock when the season resets{resetAt ? ` on ${formatLocal(resetAt)}` : ''}.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.sectionNote}>
                      Rewards are earned from your final rank when a season ends, and can be claimed once per
                      season.
                    </Text>
                    {seasonRewards.map((reward) => {
                      const status = reward.claimed
                        ? { text: 'Claimed', color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle' as const }
                        : reward.eligible
                        ? { text: 'Ready to claim', color: '#FFFFFF', bg: '#16A34A', icon: 'gift' as const }
                        : reward.onTrack
                        ? { text: 'On track this season', color: '#4F46E5', bg: '#EEF2FF', icon: 'trending-up' as const }
                        : { text: `Finish in ${reward.minRankRequired}`, color: '#64748B', bg: '#F1F5F9', icon: 'lock-closed' as const };
                      return (
                        <TouchableOpacity
                          key={reward.id}
                          activeOpacity={0.9}
                          onPress={() => openRewardClaimModal(reward)}
                          style={[styles.rewardCard, shadows.soft]}
                        >
                          <LinearGradient colors={reward.gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rewardHead}>
                            <View style={styles.rewardIcon}>
                              <Ionicons name={reward.icon as keyof typeof Ionicons.glyphMap} size={20} color="#FFFFFF" />
                            </View>
                            <View style={styles.flex1}>
                              <Text style={styles.rewardTitle}>{reward.title}</Text>
                              <Text style={styles.rewardSub}>{reward.subtitle}</Text>
                            </View>
                            <View style={styles.rewardTag}>
                              <Text style={styles.rewardTagText}>{reward.tag}</Text>
                            </View>
                          </LinearGradient>
                          <View style={styles.rewardBody}>
                            <Text style={styles.rewardDesc} numberOfLines={2}>{reward.description}</Text>
                            <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
                              <Ionicons name={status.icon} size={12} color={status.color} />
                              <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {/* ---------------- RULES ---------------- */}
            {tab === 'rules' && rulebook && (
              <>
                <View style={[styles.card, shadows.soft]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardHeaderIcon, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="calendar-outline" size={17} color="#D97706" />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.cardTitle}>How seasons work</Text>
                      <Text style={styles.cardSub}>
                        This season resets {formatLocal(rulebook.season.endsAt)} (your time)
                      </Text>
                    </View>
                  </View>
                  <Bullets items={rulebook.seasonRules} color="#D97706" />
                </View>

                {/* Role switcher */}
                <View style={styles.roleSwitch}>
                  {(['Learner', 'Mentor'] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      activeOpacity={0.85}
                      onPress={() => setRulesFor(r)}
                      style={[styles.roleBtn, rulesFor === r && styles.roleBtnActive]}
                    >
                      <Ionicons
                        name={r === 'Mentor' ? 'ribbon' : 'school'}
                        size={14}
                        color={rulesFor === r ? '#FFFFFF' : '#475569'}
                      />
                      <Text style={[styles.roleBtnText, rulesFor === r && styles.roleBtnTextActive]}>
                        {r} rules{r === myBoard ? ' (you)' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={[styles.card, shadows.soft]}>
                  <Text style={styles.cardTitle}>How {rulesFor}s earn XP</Text>
                  <Text style={styles.cardSub}>
                    {rulesFor}s are ranked only against other {rulesFor.toLowerCase()}s.
                  </Text>
                  {rulesForBoard.map(([category, rules]) => (
                    <View key={category} style={styles.ruleGroup}>
                      <View style={styles.ruleGroupHeader}>
                        <Ionicons name={CATEGORY_ICON[category] ?? 'sparkles-outline'} size={14} color="#4F46E5" />
                        <Text style={styles.ruleGroupTitle}>{category}</Text>
                      </View>
                      {rules.map(renderRule)}
                    </View>
                  ))}
                </View>

                {questsForBoard.length > 0 && (
                  <View style={[styles.card, shadows.soft]}>
                    <Text style={styles.cardTitle}>{rulesFor} quests (bonus XP)</Text>
                    {questsForBoard.map((q) => (
                      <View key={q.id} style={styles.ruleRow}>
                        <View style={styles.flex1}>
                          <Text style={styles.ruleTitle}>{q.title}</Text>
                          <Text style={styles.ruleDesc}>{q.description}</Text>
                          <Text style={styles.ruleCap}>{q.category === 'daily' ? 'Resets daily' : 'Resets weekly'}</Text>
                        </View>
                        <Text style={styles.ruleXp}>+{q.xpReward}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={[styles.card, shadows.soft]}>
                  <Text style={styles.cardTitle}>Levels</Text>
                  <Text style={styles.cardSub}>Based on lifetime XP — your level never goes down.</Text>
                  {rulebook.levels.map((l) => (
                    <View key={l.title} style={styles.levelRow}>
                      <Text style={[styles.levelRowTitle, levelTitle === l.title && { color: '#4F46E5' }]}>
                        {l.title}
                        {levelTitle === l.title ? '  • you' : ''}
                      </Text>
                      <Text style={styles.levelRowMeta}>
                        Lv {l.minLevel}+ · {l.minXp.toLocaleString()} XP
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.card, shadows.soft]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardHeaderIcon, { backgroundColor: '#E0F2FE' }]}>
                      <Ionicons name="shield-checkmark-outline" size={17} color="#0284C7" />
                    </View>
                    <Text style={[styles.cardTitle, styles.flex1]}>Fair play</Text>
                  </View>
                  <Bullets items={rulebook.fairPlay} color="#0284C7" />
                </View>
              </>
            )}
          </View>
        </ScrollView>

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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnGhost: { width: 38 },
  topTitleBox: { alignItems: 'center' },
  topKicker: { fontSize: 10, fontWeight: '800', color: '#D97706', letterSpacing: 1 },
  topTitle: { fontSize: 17, fontWeight: typography.weights.bold, color: '#0F172A' },

  heroWrap: { paddingHorizontal: spacing.base },
  hero: { borderRadius: borderRadius.xxl, padding: spacing.base, gap: 8 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  timerText: { fontSize: 10, fontWeight: '800', color: '#FDE047', letterSpacing: 0.5 },
  resetText: { fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  heroTitle: { fontSize: 19, fontWeight: typography.weights.bold, color: '#FFFFFF', marginTop: 4 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 17 },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.lg,
    paddingVertical: 10,
    marginTop: 4,
  },
  standingCell: { flex: 1, alignItems: 'center' },
  standingNum: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  standingLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  standingDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' },
  levelBox: { backgroundColor: 'rgba(15,23,42,0.25)', borderRadius: borderRadius.lg, padding: 10, gap: 6 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelTitle: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  levelXp: { fontSize: 11, fontWeight: '700', color: '#C7D2FE' },
  levelTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  levelFill: { height: '100%', borderRadius: 4, backgroundColor: '#FDE047' },
  levelNote: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  lastSeason: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lastSeasonText: { fontSize: 11, color: '#FEF9C3', fontWeight: '600', flex: 1 },

  tabBarWrap: { backgroundColor: '#F8FAFC', paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  tabBar: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: borderRadius.lg, padding: 3 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  tabBtnActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#4F46E5', fontWeight: '800' },

  body: { paddingHorizontal: spacing.base, gap: 10 },
  sectionNote: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  groupTitle: { fontSize: 12, fontWeight: '800', color: '#334155', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
    gap: 8,
  },
  listCard: { paddingVertical: 4, gap: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: typography.weights.bold, color: '#0F172A' },
  cardSub: { fontSize: 11, color: '#64748B', marginTop: 1 },

  questTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  questIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  questTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  questDesc: { fontSize: 11, color: '#64748B', lineHeight: 16, marginTop: 1 },
  xpPill: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  xpPillText: { fontSize: 11, fontWeight: '800', color: '#4F46E5' },
  progressBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#7C3AED' },
  progressText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  questBottom: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  claimBtn: { borderRadius: borderRadius.full, overflow: 'hidden' },
  claimGradient: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, minWidth: 110, justifyContent: 'center' },
  claimText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  inProgress: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  historyLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  historyTime: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  historyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  historyTag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999 },
  historyTagLearner: { backgroundColor: '#EEF2FF' },
  historyTagMentor: { backgroundColor: '#F5F3FF' },
  historyTagText: { fontSize: 10, fontWeight: '800' },
  historyTagTextLearner: { color: '#4338CA' },
  historyTagTextMentor: { color: '#7C3AED' },
  activityHead: { gap: 10, marginBottom: 4 },
  roleTotals: { flexDirection: 'row', gap: 10 },
  roleTotal: { flex: 1, borderRadius: 14, padding: 12 },
  roleTotalValue: { fontSize: 20, fontWeight: '900' },
  roleTotalLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
  activityFilter: { flexDirection: 'row', gap: 8 },
  activityChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F1F5F9' },
  activityChipActive: { backgroundColor: '#4F46E5' },
  activityChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  activityChipTextActive: { color: '#FFFFFF' },
  historyAmount: { fontSize: 13, fontWeight: '800', color: '#16A34A' },

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 8 },
  emptyIconCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: typography.weights.bold, color: '#334155' },
  emptySub: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  rewardCard: { backgroundColor: '#FFFFFF', borderRadius: borderRadius.xl, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  rewardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md },
  rewardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  rewardTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  rewardSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  rewardTag: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  rewardTagText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  rewardBody: { padding: spacing.md, gap: 8 },
  rewardDesc: { fontSize: 12, color: '#475569', lineHeight: 17 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: borderRadius.full },
  statusText: { fontSize: 11, fontWeight: '800' },

  roleSwitch: { flexDirection: 'row', gap: 8 },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  roleBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  roleBtnTextActive: { color: '#FFFFFF' },
  ruleGroup: { marginTop: 4 },
  ruleGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  ruleGroupTitle: { fontSize: 11, fontWeight: '800', color: '#4F46E5', textTransform: 'uppercase', letterSpacing: 0.5 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ruleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  ruleDesc: { fontSize: 11, color: '#64748B', lineHeight: 16, marginTop: 1 },
  ruleCap: { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  ruleXp: { fontSize: 15, fontWeight: '800', color: '#16A34A' },
  coreChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  coreChipText: { fontSize: 9, fontWeight: '800', color: '#475569' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  levelRowTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  levelRowMeta: { fontSize: 12, color: '#64748B' },
  bullets: { gap: 7 },
  bulletRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  bulletText: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 17 },
});
