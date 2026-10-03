import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getEventDetailRequest } from '../../api/competition.api';
import { Avatar } from '../common/Avatar';
import { CommunityEvent, CommunityEventDetail, EventTaskView, EventTrackView } from '../../types';
import { spacing } from '../../theme';
import { phaseLabel } from './CommunityEventsSection';

interface CommunityEventModalProps {
  visible: boolean;
  event: CommunityEvent | null;
  onClose: () => void;
}

const TRACK_COLOR = { Learner: '#7C3AED', Mentor: '#0F766E' } as const;

/**
 * Event detail. Voting phase: vote / withdraw. Live phase: your verified task
 * checklist, % and XP (collect anytime). Board: everyone's status.
 */
export const CommunityEventModal: React.FC<CommunityEventModalProps> = ({ visible, event: eventProp, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user, communityEvents, voteCommunityEvent, collectEventXp, endCommunityEvent, showDialog, getJoinedCommunityObjects } = useApp();
  const [detail, setDetail] = useState<CommunityEventDetail | null>(null);
  const [tab, setTab] = useState<'challenge' | 'board'>('challenge');
  const [busy, setBusy] = useState<'vote' | 'collect' | 'end' | null>(null);

  const load = useCallback(async () => {
    if (!eventProp) return;
    try {
      setDetail(await getEventDetailRequest(eventProp.id));
    } catch {
      /* keep what we have */
    }
  }, [eventProp?.id]);

  useEffect(() => {
    if (visible) {
      setTab('challenge');
      setDetail(null);
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, eventProp?.id]);

  // Live refresh when events change anywhere (votes, admin ends it, etc.).
  useEffect(() => {
    if (visible) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityEvents]);

  if (!eventProp) return null;
  const e: CommunityEvent = detail ?? communityEvents.find((x) => x.id === eventProp.id) ?? eventProp;
  const phase = phaseLabel(e);
  const my = e.my;
  const myTrack = my ? e.tracks[my.role] : e.myRole ? e.tracks[e.myRole] : null;

  const vote = async (join: boolean) => {
    setBusy('vote');
    const okd = await voteCommunityEvent(e.id, join);
    if (okd) await load();
    setBusy(null);
  };

  const collect = async () => {
    setBusy('collect');
    const res = await collectEventXp(e.id);
    await load();
    setBusy(null);
    if (!res.ok) return Alert.alert('Could not collect', res.message);
    if (res.result.creatorNoXp) {
      Alert.alert('Progress saved', 'You created this event, so it pays you no XP — that keeps it fair.');
    } else if (res.result.earnedXP > 0) {
      Alert.alert('XP collected ⚡', `+${res.result.earnedXP} XP (${res.result.pct}% complete). Keep going for the rest!`);
    } else {
      Alert.alert('Nothing new yet', `You’re at ${res.result.pct}%. Complete more tasks to unlock more XP.`);
    }
  };

  const end = () =>
    showDialog({
      title: 'End this event?',
      message: 'Everyone is paid XP for their progress so far, then the event is removed.',
      icon: 'stop-circle-outline',
      confirmText: 'End event',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        setBusy('end');
        try {
          await endCommunityEvent(e.id);
          onClose();
        } catch (err) {
          Alert.alert('Could not end event', (err as Error)?.message || 'Please try again.');
        } finally {
          setBusy(null);
        }
      },
    });

  const renderTask = (t: EventTaskView, color: string, showProgress: boolean) => {
    const cur = t.current ?? 0;
    const pct = Math.min(100, Math.round((cur / t.target) * 100));
    return (
      <View key={t.id} style={styles.taskRow}>
        <View style={[styles.taskIcon, { backgroundColor: t.done ? '#DCFCE7' : '#F1F5F9' }]}>
          <Ionicons
            name={(t.done ? 'checkmark' : t.icon) as keyof typeof Ionicons.glyphMap}
            size={16}
            color={t.done ? '#16A34A' : color}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.taskLabel, t.done && styles.taskDone]}>{t.label}</Text>
          {showProgress ? (
            <View style={styles.taskBarRow}>
              <View style={styles.taskTrack}>
                <View style={[styles.taskFill, { width: `${pct}%`, backgroundColor: t.done ? '#16A34A' : color }]} />
              </View>
              <Text style={styles.taskCount}>
                {cur}/{t.target}
              </Text>
            </View>
          ) : (
            <Text style={styles.taskHow}>{t.howMeasured}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderTrackPreview = (role: 'Learner' | 'Mentor', track: EventTrackView | null) =>
    track ? (
      <View key={role} style={[styles.trackCard, { borderColor: role === 'Learner' ? '#DDD6FE' : '#99F6E4' }]}>
        <View style={styles.trackHead}>
          <Text style={[styles.trackRole, { color: TRACK_COLOR[role] }]}>{role === 'Learner' ? '🎓 Learners' : '✨ Mentors'}</Text>
          <Text style={styles.trackName}>{track.name}</Text>
          <View style={[styles.xpPill, { backgroundColor: TRACK_COLOR[role] }]}>
            <Text style={styles.xpPillText}>{track.xp} XP</Text>
          </View>
        </View>
        {track.tasks.map((t) => renderTask(t, TRACK_COLOR[role], false))}
      </View>
    ) : null;

  const votedPct = Math.min(100, Math.round((e.votes.countedForStart / e.minVoters) * 100));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 4) + 8 }]}>
          <LinearGradient colors={e.bannerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.pill}>
                <Ionicons name={phase.icon} size={12} color="#FFFFFF" />
                <Text style={styles.pillText}>{phase.text}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.heroTitle}>{e.title}</Text>
            {!!e.description && <Text style={styles.heroDesc} numberOfLines={3}>{e.description}</Text>}
            <Text style={styles.heroMeta}>by {e.createdByName} · {e.communityName}</Text>
          </LinearGradient>

          <View style={styles.tabs}>
            {(['challenge', 'board'] as const).map((t) => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                <Ionicons name={t === 'challenge' ? 'flag' : 'podium'} size={14} color={tab === t ? '#4F46E5' : '#64748B'} />
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'challenge' ? 'Challenge' : `Board (${e.votes.total})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {tab === 'challenge' ? (
              <>
                {e.phase === 'voting' ? (
                  <View style={styles.voteCard}>
                    <Text style={styles.sectionTitle}>Who’s joining?</Text>
                    <View style={styles.voteCounts}>
                      <View style={styles.voteCell}>
                        <Text style={styles.voteNum}>{e.votes.Learner}</Text>
                        <Text style={styles.voteLabel}>Learners</Text>
                      </View>
                      <View style={styles.voteCell}>
                        <Text style={styles.voteNum}>{e.votes.Mentor}</Text>
                        <Text style={styles.voteLabel}>Mentors</Text>
                      </View>
                    </View>
                    <View style={styles.taskTrack}>
                      <View style={[styles.taskFill, { width: `${votedPct}%`, backgroundColor: votedPct >= 100 ? '#16A34A' : '#F59E0B' }]} />
                    </View>
                    <Text style={styles.voteHint}>
                      {e.votes.countedForStart >= e.minVoters
                        ? 'Enough members joined — it goes live when voting closes.'
                        : `Needs ${e.minVoters - e.votes.countedForStart} more vote${e.minVoters - e.votes.countedForStart === 1 ? '' : 's'} to start. Only voters can play.`}
                    </Text>
                  </View>
                ) : my ? (
                  <View style={styles.myCard}>
                    <View style={styles.myTop}>
                      <View>
                        <Text style={styles.myPct}>{my.pct}%</Text>
                        <Text style={styles.myPctLabel}>
                          {my.tasksDone}/{my.tasks.length} tasks done
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.myXp}>
                          {my.xpEarned}
                          <Text style={styles.myXpMax}> / {my.maxXp} XP</Text>
                        </Text>
                        <Text style={styles.myPctLabel}>collected {my.xpAwarded}</Text>
                      </View>
                    </View>
                    <View style={styles.bigTrack}>
                      <View style={[styles.bigFill, { width: `${my.pct}%` }]} />
                    </View>
                    {e.isCreator && <Text style={styles.creatorNote}>You created this event — progress counts, but it pays you no XP.</Text>}
                  </View>
                ) : (
                  <View style={styles.noteBox}>
                    <Ionicons name="lock-closed" size={15} color="#64748B" />
                    <Text style={styles.noteText}>Voting is closed — only members who voted are playing. Watch the Board!</Text>
                  </View>
                )}

                {my && e.phase === 'live' && myTrack ? (
                  <>
                    <Text style={styles.sectionTitle}>Your {my.role} challenge · {myTrack.name}</Text>
                    {my.tasks.map((t) => renderTask(t, TRACK_COLOR[my.role], true))}
                  </>
                ) : (
                  <>
                    <Text style={styles.sectionTitle}>Challenges</Text>
                    {renderTrackPreview('Learner', e.tracks.Learner)}
                    {renderTrackPreview('Mentor', e.tracks.Mentor)}
                  </>
                )}

                <View style={styles.xpRule}>
                  <Ionicons name="pie-chart" size={14} color="#4F46E5" />
                  <Text style={styles.xpRuleText}>
                    XP is proportional: finish 10% of your tasks for 10% of the XP, 100% for the full reward. Anything you
                    don’t collect is paid automatically when the event ends.
                  </Text>
                </View>
              </>
            ) : (
              <>
                {(detail?.board ?? []).length === 0 ? (
                  <Text style={styles.emptyBoard}>{detail ? 'No one has joined yet.' : 'Loading…'}</Text>
                ) : (
                  detail!.board.map((r, i) => (
                    <View key={r.userId} style={[styles.boardRow, r.isMe && styles.boardRowMe]}>
                      <Text style={styles.boardRank}>{i + 1}</Text>
                      <Avatar uri={r.avatarUrl} name={r.name} size={36} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.boardNameRow}>
                          <Text style={styles.boardName} numberOfLines={1}>
                            {r.name}
                            {r.isMe ? ' (you)' : ''}
                          </Text>
                          <Text style={[styles.boardRole, { color: TRACK_COLOR[r.role] }]}>{r.role}</Text>
                        </View>
                        <View style={styles.taskBarRow}>
                          <View style={styles.taskTrack}>
                            <View style={[styles.taskFill, { width: `${r.pct}%`, backgroundColor: r.pct >= 100 ? '#16A34A' : TRACK_COLOR[r.role] }]} />
                          </View>
                          <Text style={styles.taskCount}>{r.pct}%</Text>
                        </View>
                        <Text style={styles.boardMeta}>
                          {r.tasksDone}/{r.tasksTotal} tasks{r.isCreator ? ' · creator (no XP)' : ` · ${r.xpAwarded} XP collected`}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            {e.phase === 'voting' ? (
              e.hasVoted ? (
                <TouchableOpacity disabled={!!busy} onPress={() => vote(false)} style={[styles.primary, styles.secondary]}>
                  {busy === 'vote' ? <ActivityIndicator color="#7C3AED" /> : <Ionicons name="checkmark-circle" size={18} color="#7C3AED" />}
                  <Text style={[styles.primaryText, { color: '#7C3AED' }]}>You’re in · tap to withdraw</Text>
                </TouchableOpacity>
              ) : e.myTrackAvailable ? (
                <TouchableOpacity disabled={!!busy} onPress={() => vote(true)} style={[styles.primary, { backgroundColor: '#7C3AED' }]}>
                  {busy === 'vote' ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="hand-left" size={18} color="#FFFFFF" />}
                  <Text style={styles.primaryText}>Vote to join as {e.myRole}</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.primary, styles.disabled]}>
                  <Text style={[styles.primaryText, { color: '#64748B' }]}>No challenge for {e.myRole ?? 'your role'}s</Text>
                </View>
              )
            ) : my && e.phase === 'live' ? (
              <TouchableOpacity
                disabled={!!busy || my.collectable <= 0}
                onPress={collect}
                style={[styles.primary, { backgroundColor: my.collectable > 0 ? '#16A34A' : '#CBD5E1' }]}
              >
                {busy === 'collect' ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="gift" size={18} color="#FFFFFF" />}
                <Text style={styles.primaryText}>
                  {my.collectable > 0 ? `Collect +${my.collectable} XP` : my.pct >= 100 ? 'All XP collected 🎉' : `Keep going · ${my.pct}%`}
                </Text>
              </TouchableOpacity>
            ) : null}
            {(user?.isAdmin || getJoinedCommunityObjects().some((c) => c.id === e.communityId && c.isAdmin)) && (
              <TouchableOpacity disabled={!!busy} onPress={end} style={styles.endBtn}>
                <Ionicons name="stop-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.endText}>End event (admin)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '94%', overflow: 'hidden' },
  hero: { padding: spacing.base, gap: 6 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(15,23,42,0.3)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,23,42,0.3)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  heroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.92)', lineHeight: 18 },
  heroMeta: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },

  tabs: { flexDirection: 'row', margin: 12, backgroundColor: '#F1F5F9', borderRadius: 14, padding: 3 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 11 },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#4F46E5', fontWeight: '800' },

  body: { paddingHorizontal: spacing.base, paddingBottom: 16, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 4 },

  voteCard: { backgroundColor: '#FFFBEB', borderRadius: 16, borderWidth: 1, borderColor: '#FDE68A', padding: 12, gap: 8 },
  voteCounts: { flexDirection: 'row', gap: 10 },
  voteCell: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  voteNum: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  voteLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  voteHint: { fontSize: 12, color: '#92400E', lineHeight: 17 },

  myCard: { backgroundColor: '#EEF2FF', borderRadius: 16, padding: 14, gap: 10 },
  myTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  myPct: { fontSize: 34, fontWeight: '800', color: '#312E81' },
  myPctLabel: { fontSize: 12, color: '#4338CA', fontWeight: '600' },
  myXp: { fontSize: 22, fontWeight: '800', color: '#16A34A' },
  myXpMax: { fontSize: 13, color: '#4338CA', fontWeight: '700' },
  bigTrack: { height: 12, borderRadius: 6, backgroundColor: 'rgba(79,70,229,0.15)', overflow: 'hidden' },
  bigFill: { height: '100%', borderRadius: 6, backgroundColor: '#4F46E5' },
  creatorNote: { fontSize: 11, color: '#B45309', fontWeight: '600' },

  noteBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 10 },
  noteText: { flex: 1, fontSize: 12, color: '#475569' },

  trackCard: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 6 },
  trackHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  trackRole: { fontSize: 12, fontWeight: '800' },
  trackName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  xpPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  xpPillText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  taskRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 },
  taskIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  taskLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  taskDone: { color: '#16A34A' },
  taskHow: { fontSize: 11, color: '#64748B' },
  taskBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  taskFill: { height: '100%', borderRadius: 4 },
  taskCount: { fontSize: 11, fontWeight: '800', color: '#334155', minWidth: 34, textAlign: 'right' },

  xpRule: { flexDirection: 'row', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, marginTop: 4 },
  xpRuleText: { flex: 1, fontSize: 11, color: '#475569', lineHeight: 16 },

  emptyBoard: { textAlign: 'center', color: '#94A3B8', paddingVertical: 24 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F7' },
  boardRowMe: { borderColor: '#A5B4FC', backgroundColor: '#EEF2FF' },
  boardRank: { width: 18, fontSize: 13, fontWeight: '800', color: '#94A3B8', textAlign: 'center' },
  boardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boardName: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  boardRole: { fontSize: 10, fontWeight: '800' },
  boardMeta: { fontSize: 10, color: '#64748B' },

  actions: { paddingHorizontal: spacing.base, paddingTop: 8, gap: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 999 },
  secondary: { backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#C4B5FD' },
  disabled: { backgroundColor: '#F1F5F9' },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  endBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  endText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
});
