import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Switch, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Avatar } from '../common/Avatar';
import {
  decideMentorTestRequest,
  getAdminMentorTestRequest,
  getAdminMentorTestsRequest,
  getAiAdminStatusRequest,
  rerunMentorTestRequest,
  setAiSkillRequest,
  testAiProvidersRequest,
  type AdminMentorTestDetail,
  type AdminMentorTestRow,
  type AiAdminStatus,
} from '../../api/ai.api';
import { ADMIN_ACCENT, Badge, ChipPicker, EmptyState, Field, PrimaryButton, Row, Section, errorMessage, isForbidden } from './adminUi';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  REVIEW: { color: '#B45309', bg: '#FEF3C7' },
  SUBMITTED: { color: '#4338CA', bg: '#EEF2FF' },
  PASSED: { color: '#15803D', bg: '#DCFCE7' },
  FAILED: { color: '#B91C1C', bg: '#FEE2E2' },
  EXPIRED: { color: '#475569', bg: '#F1F5F9' },
};
const PROVIDER_NAME: Record<string, string> = { gemini: 'Google Gemini (main judge)', groq: 'Groq (backup)' };

/** Admin → AI: provider health, per-skill switches, and mentor tests to decide. */
export const AdminAiTab: React.FC<{ onForbidden: () => void }> = ({ onForbidden }) => {
  const [status, setStatus] = useState<AiAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ name: string; ok: boolean; ms: number; error?: string }[] | null>(null);
  const [filter, setFilter] = useState<'REVIEW' | 'ALL'>('REVIEW');
  const [rows, setRows] = useState<AdminMentorTestRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const fail = useCallback(
    (e: unknown, what: string) => {
      if (isForbidden(e)) onForbidden();
      else Alert.alert(what, errorMessage(e));
    },
    [onForbidden],
  );

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([getAiAdminStatusRequest(), getAdminMentorTestsRequest(filter === 'REVIEW' ? 'REVIEW' : undefined)]);
      setStatus(s);
      setRows(list);
    } catch (e) {
      fail(e, 'AI');
    } finally {
      setLoading(false);
    }
  }, [filter, fail]);

  useEffect(() => {
    void load();
  }, [load]);

  const runTest = async () => {
    setTesting(true);
    try {
      setTestResult(await testAiProvidersRequest());
      setStatus(await getAiAdminStatusRequest());
    } catch (e) {
      fail(e, 'Connection test');
    } finally {
      setTesting(false);
    }
  };

  const toggle = async (skill: AiAdminStatus['skills'][number]['skill'], key: 'progressEnabled' | 'mentorTestEnabled', value: boolean) => {
    if (!status) return;
    setStatus({ ...status, skills: status.skills.map((s) => (s.skill === skill ? { ...s, [key]: value } : s)) });
    try {
      const skills = await setAiSkillRequest(skill, { [key]: value });
      setStatus((prev) => (prev ? { ...prev, skills } : prev));
    } catch (e) {
      fail(e, 'AI settings');
      void load();
    }
  };

  if (loading && !status) return <ActivityIndicator color={ADMIN_ACCENT} style={{ marginTop: 40 }} />;
  if (!status) return <EmptyState icon="cloud-offline-outline" title="Could not load AI status" />;

  const queued = (kind: string, st: string) => status.queue.find((q) => q.kind === kind && q.status === st)?.count ?? 0;

  return (
    <View style={{ gap: 14 }}>
      <Section title="AI providers" subtitle="Free tiers · keys are set on the server" icon="hardware-chip">
        {status.providers.map((p) => (
          <View key={p.name} style={styles.provider}>
            <View style={styles.providerHead}>
              <Text style={styles.providerName}>{PROVIDER_NAME[p.name] ?? p.name}</Text>
              {p.configured ? (
                p.coolingUntil ? (
                  <Badge text="Resting" color="#B45309" bg="#FEF3C7" icon="pause" />
                ) : (
                  <Badge text="Ready" color="#15803D" bg="#DCFCE7" icon="checkmark" />
                )
              ) : (
                <Badge text="No key" color="#B91C1C" bg="#FEE2E2" icon="key" />
              )}
            </View>
            <Text style={styles.small}>
              Model {p.model} · {p.requestsToday}/{p.dailyLimit ?? '∞'} requests today{p.failuresToday ? ` · ${p.failuresToday} failed` : ''}
            </Text>
            {!!p.coolingUntil && <Text style={styles.small}>Back at {new Date(p.coolingUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>}
            {!!p.lastError && <Text style={styles.err} numberOfLines={2}>{p.lastError}</Text>}
          </View>
        ))}
        <Row label="Audio tool (pitch / speech analysis)" value={status.audioTool ? 'Available' : 'Missing'} />
        <PrimaryButton label="Test connection" icon="pulse" onPress={runTest} busy={testing} outline />
        {testResult?.map((r) => (
          <Text key={r.name} style={[styles.small, { color: r.ok ? '#15803D' : '#B91C1C' }]}>
            {r.ok ? '✓' : '✗'} {PROVIDER_NAME[r.name] ?? r.name}: {r.ok ? `OK (${r.ms} ms)` : r.error}
          </Text>
        ))}
      </Section>

      <Section title="Skills" subtitle="Turn AI on or off per skill" icon="toggle">
        {status.skills.map((s) => (
          <View key={s.skill} style={styles.skillRow}>
            <Text style={styles.skillName}>{s.label}</Text>
            <View style={styles.switchCol}>
              <Text style={styles.small}>Progress</Text>
              <Switch value={s.progressEnabled} onValueChange={(v) => toggle(s.skill, 'progressEnabled', v)} trackColor={{ true: ADMIN_ACCENT }} />
            </View>
            <View style={styles.switchCol}>
              <Text style={styles.small}>Mentor test</Text>
              <Switch value={s.mentorTestEnabled} onValueChange={(v) => toggle(s.skill, 'mentorTestEnabled', v)} trackColor={{ true: ADMIN_ACCENT }} />
            </View>
          </View>
        ))}
        <Text style={styles.small}>With the mentor test off, that skill uses the written quiz again.</Text>
      </Section>

      <Section title="Work queue" icon="time">
        <Row label="Post reviews waiting" value={queued('POST_REVIEW', 'PENDING') + queued('POST_REVIEW', 'RUNNING')} />
        <Row label="Post reviews done" value={queued('POST_REVIEW', 'DONE')} />
        <Row label="Mentor tests being judged" value={queued('MENTOR_TEST', 'PENDING') + queued('MENTOR_TEST', 'RUNNING')} />
      </Section>

      <Section
        title={`Mentor tests${status.mentorTestsWaiting ? ` · ${status.mentorTestsWaiting} waiting` : ''}`}
        subtitle="Borderline or uncertain results need your decision"
        icon="ribbon"
      >
        <ChipPicker label="" options={[{ id: 'REVIEW', label: 'Needs review' }, { id: 'ALL', label: 'All' }] as const} value={filter} onChange={setFilter} />
        {rows.length === 0 ? (
          <EmptyState icon="checkmark-done" title={filter === 'REVIEW' ? 'Nothing to review' : 'No mentor tests yet'} />
        ) : (
          rows.map((r) => {
            const c = STATUS_COLORS[r.status] ?? STATUS_COLORS.EXPIRED;
            return (
              <TouchableOpacity key={r.id} activeOpacity={0.8} onPress={() => setOpenId(r.id)} style={styles.testRow}>
                <Avatar uri={r.user.avatarUrl} name={r.user.name} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{r.user.name}</Text>
                  <Text style={styles.small} numberOfLines={1}>
                    {r.skillLabel}
                    {r.score != null ? ` · ${r.score}/100` : ''}
                    {r.aiNote ? ` · ${r.aiNote}` : ''}
                  </Text>
                </View>
                <Badge text={r.status} color={c.color} bg={c.bg} />
              </TouchableOpacity>
            );
          })
        )}
      </Section>

      <MentorTestDetail
        id={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => void load()}
        onError={fail}
      />
    </View>
  );
};

const MentorTestDetail: React.FC<{
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
  onError: (e: unknown, what: string) => void;
}> = ({ id, onClose, onChanged, onError }) => {
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<AdminMentorTestDetail | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const player = useRef<AudioPlayer | null>(null);

  const stopAudio = () => {
    const p = player.current;
    player.current = null;
    if (p) {
      try {
        p.pause();
        p.remove();
      } catch {
        /* ignore */
      }
    }
    setPlaying(false);
  };

  useEffect(() => {
    setD(null);
    setNote('');
    stopAudio();
    if (!id) return;
    getAdminMentorTestRequest(id).then(setD).catch((e) => onError(e, 'Mentor test'));
    return stopAudio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const togglePlay = () => {
    if (!d?.recordingUrl) return;
    if (player.current) {
      if (player.current.playing) {
        player.current.pause();
        setPlaying(false);
      } else {
        player.current.play();
        setPlaying(true);
      }
      return;
    }
    void setAudioModeAsync({ playsInSilentMode: true });
    const p = createAudioPlayer({ uri: d.recordingUrl });
    player.current = p;
    p.addListener('playbackStatusUpdate', (st) => {
      if (st.didJustFinish) setPlaying(false);
    });
    p.play();
    setPlaying(true);
  };

  const act = async (what: 'approve' | 'reject' | 'rerun') => {
    if (!d) return;
    setBusy(what);
    try {
      if (what === 'rerun') {
        await rerunMentorTestRequest(d.id);
        Alert.alert('Re-run queued', 'The AI will judge this test again.');
        onChanged();
        onClose();
      } else {
        setD(await decideMentorTestRequest(d.id, what, note.trim() || undefined));
        onChanged();
      }
    } catch (e) {
      onError(e, 'Mentor test');
    } finally {
      setBusy(null);
    }
  };

  const perf = d?.aiResult?.performance;
  const crit = d?.aiResult?.critique;
  const open = d && (d.status === 'REVIEW' || d.status === 'SUBMITTED');

  return (
    <Modal visible={!!id} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.sheetHead}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#334155" />
          </TouchableOpacity>
          <Text style={styles.sheetTitle}>Mentor test</Text>
        </View>
        {!d ? (
          <ActivityIndicator color={ADMIN_ACCENT} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.testRow}>
              <Avatar uri={d.user.avatarUrl} name={d.user.name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{d.user.name}</Text>
                <Text style={styles.small}>{d.user.email}</Text>
              </View>
              <Badge text={d.status} color={(STATUS_COLORS[d.status] ?? STATUS_COLORS.EXPIRED).color} bg={(STATUS_COLORS[d.status] ?? STATUS_COLORS.EXPIRED).bg} />
            </View>

            <Section title={`${d.skillLabel} · ${d.score ?? '—'}/100`} subtitle={`Performance ${d.performanceScore ?? '—'} · Mentoring ${d.critiqueScore ?? '—'} · pass 75`} icon="analytics">
              {!!d.aiNote && <Text style={styles.warn}>⚠ {d.aiNote}</Text>}
              {!!perf?.scores &&
                Object.entries(perf.scores as Record<string, number | null>).map(([k, v]) => <Row key={k} label={k} value={v ?? '—'} />)}
              {!!perf?.summary && <Text style={styles.body}>{perf.summary}</Text>}
              {perf?.metrics?.pitch?.pitchScore != null && (
                <Text style={styles.small}>
                  Measured pitch {perf.metrics.pitch.pitchScore}/100 ({Math.round((perf.metrics.pitch.inTuneRatio ?? 0) * 100)}% in tune)
                </Text>
              )}
              {perf?.metrics?.speech?.wordsPerMinute != null && (
                <Text style={styles.small}>
                  Measured {perf.metrics.speech.wordsPerMinute} words/min · {perf.metrics.speech.fillers} fillers
                </Text>
              )}
              {perf?.checkPhraseHeard != null && <Text style={styles.small}>Check phrase heard: {perf.checkPhraseHeard ? 'yes' : 'NO'}</Text>}
              {!!perf && <Text style={styles.small}>AI confidence {Math.round((d.aiResult?.confidence ?? 0) * 100)}% · {perf.provider}</Text>}
            </Section>

            <Section title="Task" icon="document-text">
              <Text style={styles.body}>{d.task?.prompt}</Text>
              {!!d.task?.checkPhrase && <Text style={styles.small}>Check phrase: “{d.task.checkPhrase}”</Text>}
              {Array.isArray(d.task?.judgeNotes) && <Text style={styles.small}>Judge notes: {d.task.judgeNotes.join(' · ')}</Text>}
            </Section>

            <Section title="Their answer" icon="create">
              {d.codeAnswer ? (
                <Text style={[styles.code, { fontFamily: MONO }]}>{d.codeAnswer}</Text>
              ) : d.recordingUrl ? (
                <PrimaryButton label={playing ? 'Pause recording' : 'Play recording'} icon={playing ? 'pause' : 'play'} onPress={togglePlay} outline />
              ) : (
                <Text style={styles.small}>No answer</Text>
              )}
            </Section>

            <Section title="Their mentoring" subtitle={d.task?.critique?.title} icon="chatbubbles">
              <Text style={styles.body}>{d.critiqueText}</Text>
              {!!crit?.summary && <Text style={styles.small}>AI: {crit.summary}</Text>}
              {Array.isArray(crit?.missedIssues) && crit.missedIssues.length > 0 && (
                <Text style={styles.small}>Missed: {crit.missedIssues.join(' · ')}</Text>
              )}
            </Section>

            {open ? (
              <Section title="Your decision" icon="hammer">
                <Field label="Note to the applicant (optional)" value={note} onChangeText={setNote} maxLength={500} multiline />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton label="Approve → Mentor" icon="checkmark" onPress={() => act('approve')} busy={busy === 'approve'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton label="Reject" icon="close" danger onPress={() => act('reject')} busy={busy === 'reject'} />
                  </View>
                </View>
                <PrimaryButton label="Ask the AI again" icon="refresh" outline onPress={() => act('rerun')} busy={busy === 'rerun'} />
              </Section>
            ) : (
              !!d.decisionNote && <Text style={styles.small}>Decision note: {d.decisionNote}</Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  provider: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 3 },
  providerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  providerName: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1 },
  small: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  err: { fontSize: 11, color: '#B91C1C' },
  warn: { fontSize: 12, color: '#B45309', fontWeight: '700' },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  skillName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  switchCol: { alignItems: 'center' },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  name: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sheet: { flex: 1, backgroundColor: '#F8FAFC' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  body: { fontSize: 14, color: '#334155', lineHeight: 20 },
  code: { fontSize: 12, color: '#E2E8F0', backgroundColor: '#0F172A', borderRadius: 10, padding: 10, lineHeight: 18 },
});
