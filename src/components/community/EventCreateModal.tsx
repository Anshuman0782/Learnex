import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getEventCatalogRequest, type EventCatalog, type EventTaskInput } from '../../api/competition.api';
import { EventTaskType } from '../../types';
import { borderRadius } from '../../theme';

type Track = 'Learner' | 'Mentor';
type Kind = NonNullable<EventTaskInput['kind']>;

interface TrackDraft {
  on: boolean;
  name: string;
  xp: string;
  tasks: EventTaskInput[];
}

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'any', label: 'Any' },
  { id: 'video', label: 'Video' },
  { id: 'reel', label: 'Reel' },
  { id: 'audio', label: 'Audio' },
  { id: 'photo', label: 'Photo' },
  { id: 'discussion', label: 'Discussion' },
];

const TRACK_STYLE: Record<Track, { color: string; light: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Learner: { color: '#7C3AED', light: '#F5F3FF', icon: 'school' },
  Mentor: { color: '#0F766E', light: '#F0FDFA', icon: 'ribbon' },
};

const ACCENT = '#0F766E';

const emptyTrack = (on: boolean): TrackDraft => ({ on, name: '', xp: '100', tasks: [] });

export const EventCreateModal: React.FC<{
  visible: boolean;
  communityId: string;
  communityName?: string;
  onClose: () => void;
}> = ({ visible, communityId, communityName, onClose }) => {
  const { createCommunityEvent } = useApp();
  const [catalog, setCatalog] = useState<EventCatalog | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [votingHours, setVotingHours] = useState(24);
  const [tracks, setTracks] = useState<Record<Track, TrackDraft>>({ Learner: emptyTrack(true), Mentor: emptyTrack(true) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDescription('');
    setVotingHours(24);
    getEventCatalogRequest()
      .then((c) => {
        setCatalog(c);
        // Start with the first preset of each track so it's ready to launch.
        const pick = (t: Track): TrackDraft => {
          const p = c.presets.find((x) => x.track === t);
          return p ? { on: true, name: p.name, xp: String(p.suggestedXp), tasks: p.tasks.map((x) => ({ ...x })) } : emptyTrack(true);
        };
        setTracks({ Learner: pick('Learner'), Mentor: pick('Mentor') });
      })
      .catch(() => setCatalog(null));
  }, [visible]);

  const limits = catalog?.limits;
  const liveDays = Math.floor((7 * 24 - votingHours) / 24);

  const update = (t: Track, patch: Partial<TrackDraft>) => setTracks((prev) => ({ ...prev, [t]: { ...prev[t], ...patch } }));
  const taskDef = (type: EventTaskType) => catalog?.tasks.find((x) => x.type === type);
  const maxFor = (type: EventTaskType) => {
    const d = taskDef(type);
    return type === 'ACTIVE_DAYS' ? Math.min(d?.max ?? 6, liveDays) : d?.max ?? 10;
  };

  const submit = async () => {
    if (title.trim().length < 3) return Alert.alert('Check the event', 'Give it a title (3+ characters).');
    const active = (['Learner', 'Mentor'] as Track[]).filter((t) => tracks[t].on);
    if (active.length === 0) return Alert.alert('Check the event', 'Turn on at least one track.');
    for (const t of active) {
      const xp = Number.parseInt(tracks[t].xp, 10);
      if (!Number.isFinite(xp) || xp < (limits?.minXp ?? 10) || xp > (limits?.maxXp ?? 300)) {
        return Alert.alert('Check the event', `${t} XP must be between ${limits?.minXp ?? 10} and ${limits?.maxXp ?? 300}.`);
      }
      if (tracks[t].tasks.length === 0) return Alert.alert('Check the event', `Add at least one ${t} task.`);
    }
    const toInput = (t: Track) =>
      tracks[t].on
        ? { name: tracks[t].name.trim() || `${t} challenge`, xp: Number.parseInt(tracks[t].xp, 10), tasks: tracks[t].tasks }
        : undefined;

    setSaving(true);
    try {
      await createCommunityEvent({
        communityId,
        title: title.trim(),
        description: description.trim(),
        votingHours,
        learner: toInput('Learner'),
        mentor: toInput('Mentor'),
      });
      onClose();
      Alert.alert('Challenge posted 🎉', `Members can vote to join for the next ${votingHours}h. It goes live once at least ${limits?.minVoters ?? 3} people join.`);
    } catch (e) {
      Alert.alert('Could not create event', (e as Error)?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderTrack = (t: Track) => {
    const d = tracks[t];
    const st = TRACK_STYLE[t];
    const presets = catalog?.presets.filter((p) => p.track === t) ?? [];
    const types = catalog?.tasks.filter((x) => x.tracks.includes(t)) ?? [];
    return (
      <View key={t} style={[styles.trackCard, { borderColor: d.on ? st.color : '#E2E8F0', backgroundColor: d.on ? st.light : '#FFFFFF' }]}>
        <View style={styles.trackHeader}>
          <View style={[styles.trackIcon, { backgroundColor: st.color }]}>
            <Ionicons name={st.icon} size={16} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.trackTitle}>{t} track</Text>
            <Text style={styles.help}>{t === 'Learner' ? 'Practice & sharing challenges' : 'Coaching & feedback challenges'}</Text>
          </View>
          <Switch value={d.on} onValueChange={(on) => update(t, { on })} trackColor={{ true: st.color, false: '#CBD5E1' }} thumbColor="#FFFFFF" />
        </View>

        {d.on && (
          <>
            <Text style={styles.label}>Pick a challenge</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
              {presets.map((p) => {
                const active = d.name === p.name;
                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.85}
                    onPress={() => update(t, { name: p.name, xp: String(p.suggestedXp), tasks: p.tasks.map((x) => ({ ...x })) })}
                    style={[styles.preset, active && { borderColor: st.color, backgroundColor: '#FFFFFF' }]}
                  >
                    <Ionicons name={p.icon as keyof typeof Ionicons.glyphMap} size={18} color={st.color} />
                    <Text style={styles.presetName}>{p.name}</Text>
                    <Text style={styles.presetTag} numberOfLines={2}>{p.tagline}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.twoCol}>
              <View style={{ flex: 1.4 }}>
                <Text style={styles.label}>Challenge name</Text>
                <TextInput value={d.name} onChangeText={(name) => update(t, { name })} maxLength={40} style={styles.input} placeholder="e.g. Reel Rush" placeholderTextColor="#94A3B8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Full XP</Text>
                <TextInput value={d.xp} onChangeText={(v) => update(t, { xp: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={3} style={styles.input} />
              </View>
            </View>

            <Text style={styles.label}>Tasks ({d.tasks.length}/{limits?.maxTasks ?? 4}) — XP is paid by % completed</Text>
            {d.tasks.map((task, i) => {
              const def = taskDef(task.type);
              const max = maxFor(task.type);
              const setTask = (patch: Partial<EventTaskInput>) =>
                update(t, { tasks: d.tasks.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <View key={i} style={styles.taskBox}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {types.map((ty) => (
                      <TouchableOpacity
                        key={ty.type}
                        onPress={() => setTask({ type: ty.type, target: Math.min(Math.max(task.target, ty.min), ty.type === 'ACTIVE_DAYS' ? Math.min(ty.max, liveDays) : ty.max), kind: ty.type === 'PUBLISH' ? task.kind ?? 'any' : undefined })}
                        style={[styles.chip, task.type === ty.type && { backgroundColor: st.color }]}
                      >
                        <Text style={[styles.chipText, task.type === ty.type && styles.chipTextActive]}>{ty.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {task.type === 'PUBLISH' && (
                    <View style={[styles.chips, { marginTop: 6 }]}>
                      {KINDS.map((k) => (
                        <TouchableOpacity key={k.id} onPress={() => setTask({ kind: k.id })} style={[styles.chipSm, (task.kind ?? 'any') === k.id && { backgroundColor: '#0F172A' }]}>
                          <Text style={[styles.chipSmText, (task.kind ?? 'any') === k.id && styles.chipTextActive]}>{k.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <View style={styles.taskFoot}>
                    <TouchableOpacity onPress={() => setTask({ target: Math.max(def?.min ?? 1, task.target - 1) })} style={styles.stepBtn}>
                      <Ionicons name="remove" size={16} color={st.color} />
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{task.target}</Text>
                    <TouchableOpacity onPress={() => setTask({ target: Math.min(max, task.target + 1) })} style={styles.stepBtn}>
                      <Ionicons name="add" size={16} color={st.color} />
                    </TouchableOpacity>
                    <Text style={styles.taskHint} numberOfLines={2}>{def?.howMeasured}</Text>
                    <TouchableOpacity onPress={() => update(t, { tasks: d.tasks.filter((_, j) => j !== i) })} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {d.tasks.length < (limits?.maxTasks ?? 4) && types.length > 0 && (
              <TouchableOpacity
                onPress={() => update(t, { tasks: [...d.tasks, { type: types[0].type, target: types[0].min, kind: types[0].type === 'PUBLISH' ? 'any' : undefined }] })}
                style={[styles.addTask, { borderColor: st.color }]}
              >
                <Ionicons name="add-circle-outline" size={16} color={st.color} />
                <Text style={[styles.addTaskText, { color: st.color }]}>Add task</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Post a challenge</Text>
              {!!communityName && <Text style={styles.headerSub}>in {communityName} · {limits?.days ?? 7} days total</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Title</Text>
            <TextInput value={title} onChangeText={setTitle} maxLength={60} placeholder="e.g. October Sprint" placeholderTextColor="#94A3B8" style={styles.input} />
            <Text style={styles.label}>Message to the circle</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={300}
              multiline
              placeholder="Why join? What should people focus on?"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.inputMulti]}
            />

            <Text style={styles.label}>Voting window (then the challenge goes live)</Text>
            <View style={styles.chips}>
              {(limits?.votingHours ?? [6, 12, 24, 48]).map((h) => (
                <TouchableOpacity key={h} onPress={() => setVotingHours(h)} style={[styles.chip, votingHours === h && { backgroundColor: ACCENT }]}>
                  <Text style={[styles.chipText, votingHours === h && styles.chipTextActive]}>{h}h</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.help}>Live for about {liveDays} days after voting closes.</Text>

            {renderTrack('Learner')}
            {renderTrack('Mentor')}

            <View style={styles.fairBox}>
              <Ionicons name="shield-checkmark" size={16} color={ACCENT} />
              <Text style={styles.fairText}>
                Fair play: the circle needs {limits?.minOtherMembers ?? 3}+ members besides you; the event only starts if{' '}
                {limits?.minVoters ?? 3}+ people (not you) vote; only voters play; you can play your own event but earn no XP.
              </Text>
            </View>

            <TouchableOpacity activeOpacity={0.88} disabled={saving || !catalog} onPress={submit} style={[styles.submit, (saving || !catalog) && { opacity: 0.6 }]}>
              <Ionicons name="megaphone" size={17} color="#FFFFFF" />
              <Text style={styles.submitText}>{saving ? 'Posting…' : 'Post & open voting'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '95%' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 8, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '800', color: '#334155', marginTop: 8 },
  help: { fontSize: 11, color: '#64748B' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#FFFFFF' },
  chipSm: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipSmText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  trackCard: { borderWidth: 1.5, borderRadius: 18, padding: 12, marginTop: 12, gap: 4 },
  trackHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  trackTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  presetRow: { gap: 8, paddingVertical: 4 },
  preset: { width: 140, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 10, gap: 3 },
  presetName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  presetTag: { fontSize: 11, color: '#64748B', lineHeight: 15 },
  twoCol: { flexDirection: 'row', gap: 10 },
  taskBox: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 10 },
  taskFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 16, fontWeight: '800', color: '#0F172A', minWidth: 24, textAlign: 'center' },
  taskHint: { flex: 1, fontSize: 10, color: '#64748B' },
  addTask: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 9, marginTop: 4 },
  addTaskText: { fontSize: 13, fontWeight: '800' },

  fairBox: { flexDirection: 'row', gap: 8, backgroundColor: '#F0FDFA', borderRadius: 12, padding: 10, marginTop: 12 },
  fairText: { flex: 1, fontSize: 11, color: '#115E59', lineHeight: 16 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 999, marginTop: 12 },
  submitText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
