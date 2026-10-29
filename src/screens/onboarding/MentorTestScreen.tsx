import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Header, Button } from '../../components/common';
import { uploadFileRequest } from '../../api/media.api';
import {
  getMentorEligibilityRequest,
  startMentorTestRequest,
  submitMentorTestRequest,
  type MentorApplication,
} from '../../api/ai.api';
import { getSocket } from '../../realtime/socket';
import { colors, spacing } from '../../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'MentorTest'>;
type Phase = 'loading' | 'intro' | 'task' | 'critique' | 'sending' | 'status';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const PASS = 75;
const FAIL = 55;

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;

/**
 * AI mentor test: a random live task (timed code editor, or an in-app audio
 * recording that starts with a spoken check phrase) + feedback on a sample
 * learner's work. Judged in the background; result arrives as a notification.
 */
export const MentorTestScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AuthStackParamList, 'MentorTest'>>();
  const { user, applyMentorSession, refreshSkills, showDialog } = useApp();
  const skill = route.params?.skill || user?.hobby || '';
  const fromProfile = !!route.params?.addSkill;

  const [phase, setPhase] = useState<Phase>('loading');
  const [label, setLabel] = useState(skill);
  const [app, setApp] = useState<MentorApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  // answers
  const [code, setCode] = useState('');
  const [critique, setCritique] = useState('');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [recUri, setRecUri] = useState<string | null>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const task = app?.task;
  const remaining = app ? Math.round((new Date(app.expiresAt).getTime() - now) / 1000) : 0;

  const showStatus = (a: MentorApplication) => {
    setApp(a);
    setPhase('status');
  };

  const load = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const el = await getMentorEligibilityRequest(skill);
      if (el.mode === 'quiz') {
        navigation.replace('MentorQuiz', { skill, addSkill: fromProfile, forceQuiz: true });
        return;
      }
      setLabel(el.label ?? skill);
      const a = el.application;
      if (a?.status === 'STARTED' && a.task) {
        setApp(a);
        setPhase('task');
      } else if (a && (['SUBMITTED', 'REVIEW', 'PASSED'].includes(a.status) || (a.status === 'FAILED' && a.retryAfter && new Date(a.retryAfter).getTime() > Date.now()))) {
        showStatus(a);
      } else {
        setApp(a);
        setPhase('intro');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load the mentor test.');
      setPhase('intro');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill]);

  useEffect(() => {
    void load();
  }, [load]);

  // Countdown while the test is running.
  useEffect(() => {
    if (phase !== 'task' && phase !== 'critique') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Live result while waiting.
  useEffect(() => {
    if (phase !== 'status' || !app || !['SUBMITTED', 'REVIEW'].includes(app.status)) return;
    const sock = getSocket();
    const onUpdate = (p: { id: string }) => {
      if (p.id === app.id) {
        void load();
        void refreshSkills();
      }
    };
    sock?.on('mentor-test:updated', onUpdate);
    return () => {
      sock?.off('mentor-test:updated', onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, app?.id, app?.status]);

  // Never leave a recording running.
  useEffect(
    () => () => {
      if (recTimer.current) clearInterval(recTimer.current);
      try {
        void recorder.stop();
      } catch {
        /* ignore */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const leave = () => {
    if (fromProfile && navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] });
  };

  const confirmLeave = () => {
    if (phase === 'task' || phase === 'critique') {
      showDialog({
        title: 'Leave the test?',
        message: 'Your test keeps running. You can come back and finish it until the time runs out.',
        icon: 'time-outline',
        confirmText: 'Leave',
        cancelText: 'Stay',
        onConfirm: () => (navigation.canGoBack() ? navigation.goBack() : leave()),
      });
      return true;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else leave();
    return true;
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', confirmLeave);
    return () => sub.remove();
  });

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const a = await startMentorTestRequest(skill);
      setApp(a);
      setNow(Date.now());
      setPhase('task');
    } catch (e: any) {
      setError(e?.message || 'Could not start the test.');
    } finally {
      setBusy(false);
    }
  };

  // ---------------- recording ----------------
  const stopRecording = async () => {
    if (recTimer.current) clearInterval(recTimer.current);
    recTimer.current = null;
    try {
      await recorder.stop();
    } catch {
      /* ignore */
    }
    setRecording(false);
    if (recorder.uri) setRecUri(recorder.uri);
  };

  const toggleRecording = async () => {
    if (recording) {
      await stopRecording();
      return;
    }
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      showDialog({ title: 'Microphone needed', message: 'Allow microphone access to record your performance.', icon: 'mic-off-outline', confirmText: 'OK' });
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecUri(null);
    setRecSec(0);
    setRecording(true);
    const max = task?.maxSec ?? 180;
    recTimer.current = setInterval(() => {
      setRecSec((s) => {
        const next = s + 1;
        if (next >= max) void stopRecording();
        return next;
      });
    }, 1000);
  };

  const taskReady =
    task?.mode === 'code' ? code.trim().length >= 20 : !!recUri && !recording && recSec >= Math.round((task?.minSec ?? 0) * 0.8);

  // ---------------- hand in ----------------
  const submit = async () => {
    if (!app || !task) return;
    if (critique.trim().length < 40) {
      showDialog({ title: 'A bit more feedback', message: 'Write at least a few sentences for the learner (40+ characters).', icon: 'create-outline', confirmText: 'OK' });
      return;
    }
    setPhase('sending');
    try {
      let recordingUrl: string | undefined;
      if (task.mode === 'audio' && recUri) {
        const up = await uploadFileRequest(recUri, 'audio/m4a', `mentor-test-${Date.now()}.m4a`);
        recordingUrl = up.url;
      }
      const res = await submitMentorTestRequest(app.id, {
        critiqueText: critique.trim(),
        ...(task.mode === 'code'
          ? { codeAnswer: code }
          : { recordingUrl, recordingMime: 'audio/m4a', durationMs: recSec * 1000 }),
      });
      if (res.session) await applyMentorSession(res.session);
      showStatus(res.application);
    } catch (e: any) {
      setPhase('critique');
      showDialog({ title: 'Not sent', message: e?.message || 'Please check your connection and try again.', icon: 'alert-circle-outline', confirmText: 'OK' });
    }
  };

  // ---------------- render ----------------
  const timer = (phase === 'task' || phase === 'critique') && app && (
    <View style={[styles.timer, remaining < 120 && styles.timerLow]}>
      <Ionicons name="time-outline" size={14} color={remaining < 120 ? '#B91C1C' : '#4338CA'} />
      <Text style={[styles.timerText, remaining < 120 && { color: '#B91C1C' }]}>
        {remaining > 0 ? `${fmt(remaining)} left` : 'Time is up — hand in now'}
      </Text>
    </View>
  );

  let body: React.ReactNode = null;

  if (phase === 'loading' || phase === 'sending') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.muted}>{phase === 'sending' ? 'Handing in your test…' : 'Loading…'}</Text>
      </View>
    );
  } else if (phase === 'intro') {
    const audio = /music|english|sing|vocal|guitar|piano/i.test(label);
    body = (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="ribbon" size={28} color="#7C3AED" />
          </View>
          <Text style={styles.heroTitle}>{label} Mentor Test</Text>
          <Text style={styles.heroSub}>Show what you can do — an AI judge scores it against the {label} checklist.</Text>
        </View>

        <Text style={styles.h}>What you’ll do</Text>
        <Step n={1} text={audio ? 'A live task appears when you start. Record it right here in the app — first say the 3 check words shown, then perform.' : 'A coding task appears when you start. Solve it in the app’s editor and explain your approach.'} />
        <Step n={2} text="Write feedback for a learner’s work, the way a mentor would." />

        <Text style={styles.h}>How it’s judged</Text>
        <Rule icon="checkmark-circle" color="#16A34A" text={`${PASS}+ → you become a ${label} Mentor`} />
        <Rule icon="person-circle" color="#D97706" text={`${FAIL}–${PASS - 1}, or if the AI is unsure → an admin reviews it`} />
        <Rule icon="refresh-circle" color="#DC2626" text={`Below ${FAIL} → feedback, and you can retry after 7 days`} />
        <Text style={styles.note}>
          The task is random and timed{audio ? ', and recordings are made only in the app' : ''}. Your other skills keep their roles.
        </Text>
        {app?.status === 'EXPIRED' && <Text style={styles.warn}>Your last attempt ran out of time — you can start a new one.</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    );
  } else if (phase === 'task' && task) {
    body = (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {timer}
        <Text style={styles.h}>Step 1 · Your task</Text>
        <View style={styles.card}>
          <Text style={styles.taskText}>{task.prompt}</Text>
        </View>

        {task.mode === 'code' ? (
          <>
            <Text style={styles.label}>Your solution (any language) + a short explanation</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder={'function solve(...) {\n  ...\n}\n\n// How it works: ...'}
              placeholderTextColor="#94A3B8"
              style={[styles.editor, { fontFamily: MONO }]}
              textAlignVertical="top"
              maxLength={20000}
            />
          </>
        ) : (
          <>
            {!!task.checkPhrase && (
              <View style={styles.phrase}>
                <Text style={styles.phraseLabel}>Start by saying these words clearly:</Text>
                <Text style={styles.phraseWords}>“{task.checkPhrase}”</Text>
              </View>
            )}
            <View style={styles.recBox}>
              <TouchableOpacity onPress={toggleRecording} style={[styles.recBtn, recording && styles.recBtnOn]} accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}>
                <Ionicons name={recording ? 'stop' : 'mic'} size={30} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.recTime}>{fmt(recSec)}</Text>
              <Text style={styles.muted}>
                {recording
                  ? `Recording… (max ${fmt(task.maxSec ?? 180)})`
                  : recUri
                  ? 'Recorded. Tap the mic to record again.'
                  : `Tap to record — aim for ${task.minSec ?? 30}s or more`}
              </Text>
              {!!recUri && !recording && recSec < Math.round((task.minSec ?? 0) * 0.8) && (
                <Text style={styles.warn}>Too short — record at least {task.minSec}s.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    );
  } else if (phase === 'critique' && task) {
    body = (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {timer}
        <Text style={styles.h}>Step 2 · Mentor a learner</Text>
        <View style={styles.card}>
          <Text style={styles.caseTitle}>{task.critique.title}</Text>
          <Text style={[styles.caseText, task.mode === 'code' && { fontFamily: MONO, fontSize: 12 }]}>{task.critique.content}</Text>
        </View>
        <Text style={styles.label}>Your feedback for this learner</Text>
        <TextInput
          value={critique}
          onChangeText={setCritique}
          multiline
          placeholder="What’s wrong, why, and exactly what should they do next?"
          placeholderTextColor="#94A3B8"
          style={styles.critiqueInput}
          textAlignVertical="top"
          maxLength={6000}
        />
        <Text style={styles.count}>{critique.trim().length} / 40+ characters</Text>
      </ScrollView>
    );
  } else if (phase === 'status' && app) {
    body = <StatusView app={app} label={label} />;
  }

  const footer =
    phase === 'intro' ? (
      <Button title="Start the test →" onPress={start} loading={busy} fullWidth size="lg" />
    ) : phase === 'task' ? (
      <Button title="Next: mentor a learner →" onPress={() => setPhase('critique')} disabled={!taskReady} fullWidth size="lg" />
    ) : phase === 'critique' ? (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity onPress={() => setPhase('task')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#334155" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Button title="Hand in" onPress={submit} disabled={critique.trim().length < 40} fullWidth size="lg" />
        </View>
      </View>
    ) : phase === 'status' ? (
      <Button title={fromProfile ? 'Done' : 'Continue to LERNEX →'} onPress={leave} fullWidth size="lg" />
    ) : null;

  return (
    <View style={styles.container}>
      <Header onBack={confirmLeave} title="" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{body}</View>
        {!!footer && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>{footer}</View>}
      </KeyboardAvoidingView>
    </View>
  );
};

const Step: React.FC<{ n: number; text: string }> = ({ n, text }) => (
  <View style={styles.step}>
    <View style={styles.stepN}>
      <Text style={styles.stepNText}>{n}</Text>
    </View>
    <Text style={styles.stepText}>{text}</Text>
  </View>
);

const Rule: React.FC<{ icon: keyof typeof Ionicons.glyphMap; color: string; text: string }> = ({ icon, color, text }) => (
  <View style={styles.rule}>
    <Ionicons name={icon} size={18} color={color} />
    <Text style={styles.ruleText}>{text}</Text>
  </View>
);

const StatusView: React.FC<{ app: MentorApplication; label: string }> = ({ app, label }) => {
  const meta: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; text: string }> = {
    SUBMITTED: { icon: 'hourglass-outline', color: '#4F46E5', title: 'Your test is being judged', text: 'This usually takes a few minutes. We’ll notify you — meanwhile, keep learning as a Learner.' },
    REVIEW: { icon: 'person-circle-outline', color: '#D97706', title: 'An admin is reviewing your test', text: 'Your result was close to the pass mark (or the AI wasn’t sure), so a person will decide. We’ll notify you.' },
    PASSED: { icon: 'ribbon', color: '#16A34A', title: `You’re a ${label} Mentor!`, text: 'You can now give mentor feedback on posts in this skill.' },
    FAILED: { icon: 'refresh-circle-outline', color: '#DC2626', title: 'Not this time', text: app.retryAfter ? `You can try again after ${new Date(app.retryAfter).toDateString()}.` : 'You can try again later.' },
  };
  const m = meta[app.status] ?? meta.SUBMITTED;
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: `${m.color}1A` }]}>
          <Ionicons name={m.icon} size={30} color={m.color} />
        </View>
        <Text style={styles.heroTitle}>{m.title}</Text>
        <Text style={styles.heroSub}>{m.text}</Text>
        {app.score != null && (app.status === 'PASSED' || app.status === 'FAILED') && (
          <Text style={[styles.score, { color: m.color }]}>{app.score}/100</Text>
        )}
      </View>
      {!!app.feedback && (
        <>
          {!!app.feedback.summary && <Text style={styles.summary}>{app.feedback.summary}</Text>}
          {app.feedback.strengths.length > 0 && <Text style={styles.h}>Strengths</Text>}
          {app.feedback.strengths.map((s, i) => (
            <Rule key={`s${i}`} icon="checkmark-circle" color="#16A34A" text={s} />
          ))}
          {app.feedback.improvements.length > 0 && <Text style={styles.h}>To improve</Text>}
          {app.feedback.improvements.map((s, i) => (
            <Rule key={`i${i}`} icon="arrow-up-circle" color="#D97706" text={s} />
          ))}
          {!!app.feedback.critiqueSummary && (
            <>
              <Text style={styles.h}>Your mentoring</Text>
              <Text style={styles.summary}>{app.feedback.critiqueSummary}</Text>
            </>
          )}
        </>
      )}
      {!!app.decisionNote && <Text style={styles.note}>Admin note: {app.decisionNote}</Text>}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  hero: { alignItems: 'center', paddingVertical: spacing.md, gap: 6 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  heroSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  score: { fontSize: 28, fontWeight: '900', marginTop: 6 },
  h: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: spacing.lg, marginBottom: 8 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  stepN: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  stepText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },
  rule: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  ruleText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },
  note: { fontSize: 12, color: '#64748B', marginTop: spacing.md, lineHeight: 17 },
  warn: { fontSize: 12, color: '#B45309', marginTop: 8 },
  error: { fontSize: 13, color: '#DC2626', marginTop: 12 },
  summary: { fontSize: 14, color: '#334155', lineHeight: 20, marginTop: 4 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 4 },
  timerLow: { backgroundColor: '#FEE2E2' },
  timerText: { fontSize: 13, fontWeight: '800', color: '#4338CA' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 },
  taskText: { fontSize: 15, color: '#0F172A', lineHeight: 22 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: spacing.md, marginBottom: 6 },
  editor: {
    minHeight: 260,
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
  },
  phrase: { marginTop: spacing.md, backgroundColor: '#FEF3C7', borderRadius: 14, padding: 14, alignItems: 'center' },
  phraseLabel: { fontSize: 12, color: '#92400E', fontWeight: '700' },
  phraseWords: { fontSize: 22, fontWeight: '900', color: '#78350F', marginTop: 4 },
  recBox: { alignItems: 'center', gap: 8, marginTop: spacing.lg },
  recBtn: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  recBtnOn: { backgroundColor: '#DC2626' },
  recTime: { fontSize: 26, fontWeight: '900', color: '#0F172A', fontVariant: ['tabular-nums'] },
  caseTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  caseText: { fontSize: 13, color: '#334155', lineHeight: 19 },
  critiqueInput: { minHeight: 180, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#0F172A', lineHeight: 20 },
  count: { fontSize: 11, color: '#94A3B8', marginTop: 4, textAlign: 'right' },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  backBtn: { width: 52, borderRadius: 14, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
});
