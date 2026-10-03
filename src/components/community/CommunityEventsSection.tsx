import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getEventCatalogRequest } from '../../api/competition.api';
import { CommunityEvent, UserRole } from '../../types';
import { borderRadius, spacing, typography } from '../../theme';
import { EventCreateModal } from './EventCreateModal';

interface CommunityEventsSectionProps {
  events: CommunityEvent[];
  communityId?: string;
  communityName?: string;
  selectedRole?: UserRole | null;
  onSelectEvent: (event: CommunityEvent) => void;
}

type Chip = { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap };

/** What the viewer should see for an event, by phase and their status. */
export function eventStatus(e: CommunityEvent): Chip {
  if (e.phase === 'voting') {
    if (e.hasVoted) return { label: 'You’re in · waiting to start', color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle' };
    if (!e.myTrackAvailable) return { label: `No ${e.myRole ?? 'your'} track`, color: '#64748B', bg: '#F1F5F9', icon: 'lock-closed' };
    return { label: 'Vote to join', color: '#FFFFFF', bg: '#7C3AED', icon: 'hand-left' };
  }
  if (!e.hasVoted) return { label: 'Voting closed', color: '#64748B', bg: '#F1F5F9', icon: 'lock-closed' };
  const pct = e.my?.pct ?? 0;
  if (pct >= 100) return { label: 'All tasks done 🎉', color: '#15803D', bg: '#DCFCE7', icon: 'trophy' };
  if ((e.my?.collectable ?? 0) > 0) return { label: `+${e.my?.collectable} XP to collect`, color: '#FFFFFF', bg: '#16A34A', icon: 'gift' };
  return { label: `${pct}% complete`, color: '#4F46E5', bg: '#EEF2FF', icon: 'hourglass' };
}

/** "Voting · 14h left" / "Live · 5d left". */
export function phaseLabel(e: CommunityEvent): { text: string; icon: keyof typeof Ionicons.glyphMap } {
  if (e.phase === 'voting') return { text: `Voting · ${e.votingHoursLeft}h left`, icon: 'hand-left' };
  return { text: `Live · ${e.daysLeft}d left`, icon: 'radio' };
}

export const CommunityEventsSection: React.FC<CommunityEventsSectionProps> = ({
  events,
  communityId,
  communityName,
  onSelectEvent,
}) => {
  const { user, getJoinedCommunityObjects } = useApp();
  // App admins and this circle's own admins can create / end events.
  const canManage =
    !!user?.isAdmin || (!!communityId && getJoinedCommunityObjects().some((c) => c.id === communityId && c.isAdmin));
  const [rules, setRules] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getEventCatalogRequest()
      .then((c) => setRules(c.rules))
      .catch(() => setRules([]));
  }, []);

  const list = events.filter((e) => !communityId || e.communityId === communityId);

  // Personal status across this circle's challenges.
  const joined = list.filter((e) => e.hasVoted);
  const myTasks = joined.flatMap((e) => e.my?.tasks ?? []);
  const tasksDone = myTasks.filter((t) => t.done).length;
  const xpEarned = joined.reduce((s, e) => s + (e.my?.xpEarned ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Events & Challenges</Text>
          <Text style={styles.subtitle}>Vote to join · separate Learner & Mentor tracks</Text>
        </View>
        {canManage && communityId && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setCreating(true)} style={styles.createBtn}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.createText}>Create</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* My status */}
      {joined.length > 0 && (
        <LinearGradient colors={['#1E1B4B', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusCard}>
          <Text style={styles.statusKicker}>YOUR CHALLENGE STATUS</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusCell}>
              <Text style={styles.statusNum}>{joined.length}</Text>
              <Text style={styles.statusLabel}>joined</Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusCell}>
              <Text style={styles.statusNum}>
                {tasksDone}/{myTasks.length}
              </Text>
              <Text style={styles.statusLabel}>tasks done</Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusCell}>
              <Text style={styles.statusNum}>{xpEarned}</Text>
              <Text style={styles.statusLabel}>XP earned</Text>
            </View>
          </View>
        </LinearGradient>
      )}

      {/* Rules */}
      {rules.length > 0 && (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setShowRules((v) => !v)} style={styles.rulesCard}>
          <View style={styles.rulesHeader}>
            <Ionicons name="shield-checkmark" size={16} color="#0F766E" />
            <Text style={styles.rulesTitle}>How events work (fair play)</Text>
            <Ionicons name={showRules ? 'chevron-up' : 'chevron-down'} size={16} color="#0F766E" />
          </View>
          {showRules &&
            rules.map((r, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={styles.ruleDot}>•</Text>
                <Text style={styles.ruleText}>{r}</Text>
              </View>
            ))}
        </TouchableOpacity>
      )}

      {list.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="trophy-outline" size={28} color="#7C3AED" />
          </View>
          <Text style={styles.emptyTitle}>No active events right now</Text>
          <Text style={styles.emptyBody}>
            {canManage
              ? 'Tap Create to launch a challenge. Members vote to join, then it goes live.'
              : 'When this circle’s admins post a challenge here, vote to join it.'}
          </Text>
        </View>
      ) : (
        list.map((e) => <EventCard key={e.id} event={e} onPress={() => onSelectEvent(e)} />)
      )}

      {communityId && (
        <EventCreateModal visible={creating} communityId={communityId} communityName={communityName} onClose={() => setCreating(false)} />
      )}
    </View>
  );
};

/** Event card — also used pinned at the top of a circle's feed. */
export const EventCard: React.FC<{ event: CommunityEvent; onPress: () => void; compact?: boolean }> = ({ event: e, onPress, compact }) => {
  const status = eventStatus(e);
  const phase = phaseLabel(e);
  const pct = e.my?.pct ?? 0;
  const trackNames = [e.tracks.Learner && `🎓 ${e.tracks.Learner.name}`, e.tracks.Mentor && `✨ ${e.tracks.Mentor.name}`].filter(Boolean);

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.card}>
      <LinearGradient colors={e.bannerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <View style={styles.bannerTop}>
          <View style={styles.phasePill}>
            <Ionicons name={phase.icon} size={11} color="#FFFFFF" />
            <Text style={styles.phaseText}>{phase.text}</Text>
          </View>
          <View style={[styles.phasePill, { backgroundColor: 'rgba(253,224,71,0.95)' }]}>
            <Ionicons name="flash" size={11} color="#713F12" />
            <Text style={[styles.phaseText, { color: '#713F12' }]}>up to {e.xpReward} XP</Text>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{e.title}</Text>
        {!compact && trackNames.length > 0 && (
          <View style={styles.trackRow}>
            {trackNames.map((t) => (
              <View key={t as string} style={styles.trackChip}>
                <Text style={styles.trackChipText} numberOfLines={1}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>

      <View style={styles.body}>
        {e.phase === 'live' && e.hasVoted ? (
          <View style={styles.progressRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>{pct}%</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.metaText}>
            🗳 {e.votes.total} {e.phase === 'voting' ? `voted · needs ${e.minVoters}` : 'playing'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: typography.weights.bold, color: '#0F172A' },
  subtitle: { fontSize: 11, color: '#64748B', marginTop: 1 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  createText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  statusCard: { borderRadius: borderRadius.xl, padding: 14, gap: 10 },
  statusKicker: { fontSize: 10, fontWeight: '800', color: '#A5B4FC', letterSpacing: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusCell: { flex: 1, alignItems: 'center' },
  statusNum: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  statusLabel: { fontSize: 11, color: '#C7D2FE' },
  statusDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  rulesCard: { backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4', borderRadius: borderRadius.lg, padding: 12, gap: 6 },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rulesTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#115E59' },
  ruleRow: { flexDirection: 'row', gap: 6 },
  ruleDot: { color: '#0F766E', fontWeight: '800' },
  ruleText: { flex: 1, fontSize: 12, color: '#134E4A', lineHeight: 17 },

  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  emptyBody: { fontSize: 12, color: '#64748B', textAlign: 'center', paddingHorizontal: 30, lineHeight: 17 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 2,
  },
  banner: { padding: spacing.md, gap: 8 },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  phaseText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  trackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trackChip: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: borderRadius.full, maxWidth: '100%' },
  trackChipText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  body: { padding: spacing.md, gap: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#7C3AED' },
  progressText: { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: borderRadius.full, flexShrink: 1 },
  statusText: { fontSize: 11, fontWeight: '800' },
  metaText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
});
