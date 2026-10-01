import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import {
  cancelBroadcastRequest,
  createBroadcastRequest,
  getBroadcastsRequest,
  previewBroadcastRequest,
  searchAdminUsersRequest,
  type AdminBroadcast,
  type AdminUserResult,
  type BroadcastAudience,
} from '../../api/admin.api';
import { getCommunitiesRequest, type ApiCommunity } from '../../api/communities.api';
import {
  ADMIN_ACCENT,
  ADMIN_ACCENT_LIGHT,
  Badge,
  ChipPicker,
  EmptyState,
  Field,
  PrimaryButton,
  Section,
  errorMessage,
  isForbidden,
} from './adminUi';

const AUDIENCES: Array<{ id: BroadcastAudience; label: string }> = [
  { id: 'ALL', label: 'Everyone' },
  { id: 'LEARNERS', label: 'Learners' },
  { id: 'MENTORS', label: 'Mentors' },
  { id: 'CIRCLE', label: 'A circle' },
  { id: 'USERS', label: 'Specific people' },
];

const STATUS_STYLE: Record<AdminBroadcast['status'], { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Scheduled', color: '#B45309', bg: '#FEF3C7' },
  SENDING: { label: 'Sending', color: '#1D4ED8', bg: '#DBEAFE' },
  SENT: { label: 'Sent', color: '#15803D', bg: '#DCFCE7' },
  CANCELLED: { label: 'Cancelled', color: '#64748B', bg: '#F1F5F9' },
  FAILED: { label: 'Failed', color: '#B91C1C', bg: '#FEE2E2' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtWhen = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '—';

/** Next 7 calendar days for the schedule picker. */
const nextDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const label =
      i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
    return { id: String(i), label, date: d };
  });

/**
 * Admin → Notify: compose a custom notification, choose exactly who gets it
 * (with a live recipient count), send now or schedule it, and manage history.
 */
export const AdminNotifyTab: React.FC<{ onForbidden: () => void }> = ({ onForbidden }) => {
  const { showDialog } = useApp();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('ALL');
  const [circles, setCircles] = useState<ApiCommunity[]>([]);
  const [circleId, setCircleId] = useState<string>('');
  const [picked, setPicked] = useState<AdminUserResult[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserResult[]>([]);
  const [count, setCount] = useState<{ count: number; withPush: number } | null>(null);
  const [counting, setCounting] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const days = useMemo(nextDays, []);
  const [dayId, setDayId] = useState('1');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AdminBroadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const handleError = (e: unknown, label = 'Notifications') => {
    if (isForbidden(e)) onForbidden();
    else Alert.alert(label, errorMessage(e));
  };

  const loadHistory = () =>
    getBroadcastsRequest()
      .then(setHistory)
      .catch(handleError)
      .finally(() => setLoadingHistory(false));

  useEffect(() => {
    void loadHistory();
    getCommunitiesRequest()
      .then((c) => {
        setCircles(c);
        if (c[0]) setCircleId(c[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const target = useMemo(
    () => ({
      audience,
      communityId: audience === 'CIRCLE' ? circleId : undefined,
      userIds: audience === 'USERS' ? picked.map((p) => p.id) : undefined,
    }),
    [audience, circleId, picked],
  );

  // Live recipient count for the chosen audience.
  useEffect(() => {
    if ((audience === 'CIRCLE' && !circleId) || (audience === 'USERS' && picked.length === 0)) {
      setCount({ count: 0, withPush: 0 });
      return;
    }
    setCounting(true);
    let active = true;
    const t = setTimeout(() => {
      previewBroadcastRequest(target)
        .then((c) => active && setCount(c))
        .catch((e) => active && handleError(e))
        .finally(() => active && setCounting(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // People search for "Specific people".
  useEffect(() => {
    const q = query.trim();
    if (audience !== 'USERS' || q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      searchAdminUsersRequest(q)
        .then((r) => active && setResults(r))
        .catch(() => {});
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, audience]);

  const scheduledDate = useMemo(() => {
    const d = new Date(days.find((x) => x.id === dayId)!.date);
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [days, dayId, hour, minute]);
  const scheduleInPast = schedule && scheduledDate.getTime() <= Date.now() + 60_000;

  const canSend =
    title.trim().length >= 2 && body.trim().length >= 2 && (count?.count ?? 0) > 0 && !scheduleInPast && !sending;

  const send = () => {
    const n = count?.count ?? 0;
    showDialog({
      title: schedule ? 'Schedule notification?' : 'Send notification?',
      message: schedule
        ? `It will be sent to ${n} ${n === 1 ? 'person' : 'people'} on ${fmtWhen(scheduledDate.toISOString())}.`
        : `This goes out now to ${n} ${n === 1 ? 'person' : 'people'}. It can’t be unsent.`,
      icon: schedule ? 'time-outline' : 'megaphone-outline',
      confirmText: schedule ? 'Schedule' : 'Send now',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setSending(true);
        try {
          await createBroadcastRequest({
            ...target,
            title: title.trim(),
            body: body.trim(),
            scheduledAt: schedule ? scheduledDate.toISOString() : undefined,
          });
          setTitle('');
          setBody('');
          setSchedule(false);
          await loadHistory();
          Alert.alert(schedule ? 'Scheduled ⏰' : 'Sent 🎉', schedule ? 'It will go out automatically.' : 'Delivered to the selected people.');
        } catch (e) {
          handleError(e, 'Could not send');
        } finally {
          setSending(false);
        }
      },
    });
  };

  const cancel = (b: AdminBroadcast) =>
    showDialog({
      title: 'Cancel this scheduled notification?',
      message: b.title,
      icon: 'close-circle-outline',
      confirmText: 'Cancel it',
      cancelText: 'Keep',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await cancelBroadcastRequest(b.id);
          await loadHistory();
        } catch (e) {
          handleError(e);
        }
      },
    });

  const audienceLabel = (b: AdminBroadcast) =>
    b.audience === 'CIRCLE'
      ? `Circle · ${b.communityName ?? 'deleted'}`
      : b.audience === 'USERS'
      ? `${b.userCount ?? 0} selected`
      : AUDIENCES.find((a) => a.id === b.audience)?.label ?? b.audience;

  return (
    <View style={{ gap: 14 }}>
      <Section title="Compose" subtitle="Shows in the notification bell and on members’ phones" icon="create">
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={65} placeholder="e.g. New season starts today 🎉" />
        <Field
          label="Message"
          value={body}
          onChangeText={setBody}
          maxLength={240}
          multiline
          placeholder="What do you want to tell them?"
          help={`${body.length}/240`}
        />

        {/* Live phone-notification preview */}
        {(title || body) && (
          <View style={styles.preview}>
            <View style={styles.previewIcon}>
              <Ionicons name="school" size={14} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewApp}>LERNEX · now</Text>
              <Text style={styles.previewTitle} numberOfLines={1}>{title || 'Title'}</Text>
              <Text style={styles.previewBody} numberOfLines={3}>{body || 'Message'}</Text>
            </View>
          </View>
        )}
      </Section>

      <Section title="Who gets it" icon="people">
        <ChipPicker label="Audience" options={AUDIENCES} value={audience} onChange={setAudience} />

        {audience === 'CIRCLE' && (
          <ChipPicker
            label="Circle"
            options={circles.map((c) => ({ id: c.id, label: `${c.name} (${c.memberCount})` }))}
            value={circleId}
            onChange={setCircleId}
          />
        )}

        {audience === 'USERS' && (
          <View style={{ gap: 8 }}>
            {picked.length > 0 && (
              <View style={styles.pickedWrap}>
                {picked.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                    style={styles.pickedChip}
                  >
                    <Text style={styles.pickedText} numberOfLines={1}>{p.name}</Text>
                    <Ionicons name="close" size={12} color={ADMIN_ACCENT} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Field label="Add people" value={query} onChangeText={setQuery} placeholder="Search by name or email" />
            {results
              .filter((r) => !picked.some((p) => p.id === r.id))
              .slice(0, 6)
              .map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => {
                    setPicked((prev) => [...prev, r]);
                    setQuery('');
                  }}
                  style={styles.resultRow}
                >
                  <Avatar uri={r.avatarUrl} name={r.name} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.resultSub} numberOfLines={1}>{r.email}</Text>
                  </View>
                  <Ionicons name="add-circle" size={20} color={ADMIN_ACCENT} />
                </TouchableOpacity>
              ))}
          </View>
        )}

        <View style={styles.countBox}>
          {counting ? (
            <ActivityIndicator size="small" color={ADMIN_ACCENT} />
          ) : (
            <Ionicons name="people-circle" size={22} color={ADMIN_ACCENT} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.countMain}>
              {count?.count ?? 0} {count?.count === 1 ? 'person' : 'people'} will receive this
            </Text>
            <Text style={styles.countSub}>
              {count?.withPush ?? 0} with phone notifications on · everyone sees it in the bell
            </Text>
          </View>
        </View>
      </Section>

      <Section
        title="When"
        icon="time"
        right={<Switch value={schedule} onValueChange={setSchedule} trackColor={{ true: ADMIN_ACCENT }} />}
      >
        {!schedule ? (
          <Text style={styles.whenNow}>Sends immediately. Turn on to schedule for later.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            <ChipPicker label="Day" options={days} value={dayId} onChange={setDayId} />
            <Text style={styles.timeLabel}>Time</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity onPress={() => setHour((h) => (h + 23) % 24)} style={styles.stepBtn}>
                <Ionicons name="remove" size={18} color={ADMIN_ACCENT} />
              </TouchableOpacity>
              <Text style={styles.timeValue}>
                {pad(hour % 12 === 0 ? 12 : hour % 12)}:{pad(minute)} {hour < 12 ? 'AM' : 'PM'}
              </Text>
              <TouchableOpacity onPress={() => setHour((h) => (h + 1) % 24)} style={styles.stepBtn}>
                <Ionicons name="add" size={18} color={ADMIN_ACCENT} />
              </TouchableOpacity>
            </View>
            <ChipPicker
              label="Minutes"
              options={[0, 15, 30, 45].map((m) => ({ id: String(m), label: `:${pad(m)}` }))}
              value={String(minute)}
              onChange={(v) => setMinute(Number(v))}
            />
            <Text style={[styles.whenNow, scheduleInPast && { color: '#DC2626' }]}>
              {scheduleInPast
                ? 'That time has already passed — pick a later time.'
                : `Goes out ${fmtWhen(scheduledDate.toISOString())}`}
            </Text>
          </View>
        )}
      </Section>

      <PrimaryButton
        label={schedule ? 'Schedule notification' : 'Send now'}
        icon={schedule ? 'time-outline' : 'paper-plane'}
        onPress={send}
        busy={sending}
        disabled={!canSend}
      />

      <Section title="History" subtitle="Last 50 notifications you or other admins sent" icon="list">
        {loadingHistory ? (
          <ActivityIndicator color={ADMIN_ACCENT} />
        ) : history.length === 0 ? (
          <EmptyState icon="megaphone-outline" title="Nothing sent yet" />
        ) : (
          history.map((b) => {
            const st = STATUS_STYLE[b.status];
            return (
              <View key={b.id} style={styles.histRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.histTitle} numberOfLines={1}>{b.title}</Text>
                  <Text style={styles.histBody} numberOfLines={2}>{b.body}</Text>
                  <Text style={styles.histMeta}>
                    {audienceLabel(b)} ·{' '}
                    {b.status === 'SENT'
                      ? `${b.recipients} reached · ${b.pushed} phones · ${fmtWhen(b.sentAt)}`
                      : b.status === 'PENDING'
                      ? `for ${fmtWhen(b.scheduledAt)}`
                      : fmtWhen(b.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge text={st.label} color={st.color} bg={st.bg} />
                  {b.status === 'PENDING' && (
                    <TouchableOpacity onPress={() => cancel(b)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  previewApp: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  previewTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  previewBody: { fontSize: 12, color: '#334155', lineHeight: 17 },
  pickedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ADMIN_ACCENT_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 170,
  },
  pickedText: { fontSize: 12, fontWeight: '700', color: ADMIN_ACCENT, flexShrink: 1 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  resultName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  resultSub: { fontSize: 11, color: '#64748B' },
  countBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: ADMIN_ACCENT_LIGHT,
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
  },
  countMain: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  countSub: { fontSize: 11, color: '#334155', marginTop: 2 },
  whenNow: { fontSize: 12, color: '#475569', fontWeight: '600' },
  timeLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: ADMIN_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeValue: { fontSize: 22, fontWeight: '800', color: '#0F172A', minWidth: 110, textAlign: 'center' },
  histRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  histTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  histBody: { fontSize: 12, color: '#475569', lineHeight: 17 },
  histMeta: { fontSize: 10, color: '#64748B' },
  cancelText: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
});
