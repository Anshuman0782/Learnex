import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  initial?: Date | null;
  /** Latest allowed date (default: 60 days ahead). */
  maxDays?: number;
  onClose: () => void;
  onConfirm: (d: Date) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const pad = (n: number) => String(n).padStart(2, '0');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "In 1 hour" etc. rounded to the next 5 minutes. */
const roundUp5 = (d: Date) => {
  const r = new Date(d);
  r.setSeconds(0, 0);
  r.setMinutes(Math.ceil(r.getMinutes() / 5) * 5);
  return r;
};

/**
 * Professional two-step scheduler: 1) pick a day on a calendar, 2) pick the
 * time (hour grid + AM/PM + 5-minute steps). Past days/times are disabled.
 */
export const ScheduleSheet: React.FC<Props> = ({ visible, initial, maxDays = 60, onClose, onConfirm }) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'date' | 'time'>('date');
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [hour12, setHour12] = useState(9);
  const [pm, setPm] = useState(false);
  const [minute, setMinute] = useState(0);

  const today = startOfDay(new Date());
  const lastDay = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() + maxDays), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return;
    const base = initial && initial.getTime() > Date.now() ? initial : roundUp5(new Date(Date.now() + 60 * 60 * 1000));
    setStep('date');
    setDay(startOfDay(base));
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    const h = base.getHours();
    setPm(h >= 12);
    setHour12(h % 12 === 0 ? 12 : h % 12);
    setMinute(base.getMinutes() - (base.getMinutes() % 5));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const hour24 = (h12: number, isPm: boolean) => (h12 % 12) + (isPm ? 12 : 0);
  const at = (h12 = hour12, isPm = pm, m = minute, d = day) => {
    const r = new Date(d);
    r.setHours(hour24(h12, isPm), m, 0, 0);
    return r;
  };
  const chosen = at();
  const isPast = (d: Date) => d.getTime() <= Date.now() + 60_000;

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    if (d < new Date(today.getFullYear(), today.getMonth(), 1) || d > lastDay) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const presets: Array<{ label: string; date: Date }> = [
    { label: 'In 1 hour', date: roundUp5(new Date(Date.now() + 60 * 60 * 1000)) },
    { label: 'Tonight 8 PM', date: (() => { const d = new Date(); d.setHours(20, 0, 0, 0); return d; })() },
    { label: 'Tomorrow 9 AM', date: (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; })() },
  ].filter((p) => !isPast(p.date));

  const usePreset = (d: Date) => {
    setDay(startOfDay(d));
    setPm(d.getHours() >= 12);
    setHour12(d.getHours() % 12 === 0 ? 12 : d.getHours() % 12);
    setMinute(d.getMinutes() - (d.getMinutes() % 5));
    setStep('time');
  };

  const label = chosen.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]} onPress={() => undefined}>
          <View style={styles.handle} />
          <View style={styles.head}>
            {step === 'time' ? (
              <TouchableOpacity onPress={() => setStep('date')} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={20} color="#334155" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 36 }} />
            )}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.title}>{step === 'date' ? 'Pick a date' : 'Pick a time'}</Text>
              <Text style={styles.stepText}>Step {step === 'date' ? 1 : 2} of 2</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={20} color="#334155" />
            </TouchableOpacity>
          </View>

          <View style={[styles.summary, isPast(chosen) && styles.summaryWarn]}>
            <Ionicons name="time" size={16} color={isPast(chosen) ? '#B45309' : '#4F46E5'} />
            <Text style={[styles.summaryText, isPast(chosen) && { color: '#B45309' }]}>
              {isPast(chosen) ? 'That time has passed — pick a later one' : label}
            </Text>
          </View>

          {step === 'date' ? (
            <>
              {presets.length > 0 && (
                <View style={styles.presetRow}>
                  {presets.map((p) => (
                    <TouchableOpacity key={p.label} onPress={() => usePreset(p.date)} style={styles.preset}>
                      <Text style={styles.presetText}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.monthRow}>
                <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.iconBtnSoft}>
                  <Ionicons name="chevron-back" size={18} color="#4F46E5" />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                  {MONTHS[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.iconBtnSoft}>
                  <Ionicons name="chevron-forward" size={18} color="#4F46E5" />
                </TouchableOpacity>
              </View>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={styles.weekday}>{w}</Text>
                ))}
              </View>
              <View style={styles.grid}>
                {cells.map((d, i) => {
                  if (!d) return <View key={i} style={styles.cell} />;
                  const date = new Date(viewYear, viewMonth, d);
                  const disabled = date < today || date > lastDay;
                  const on = sameDay(date, day);
                  const isToday = sameDay(date, today);
                  return (
                    <TouchableOpacity key={i} disabled={disabled} onPress={() => setDay(date)} style={styles.cell}>
                      <View style={[styles.dayInner, on && styles.dayOn, !on && isToday && styles.dayToday]}>
                        <Text style={[styles.dayText, disabled && styles.dayOff, on && styles.dayOnText]}>{d}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <View style={styles.ampmRow}>
                {[false, true].map((isPm) => (
                  <TouchableOpacity key={String(isPm)} onPress={() => setPm(isPm)} style={[styles.ampm, pm === isPm && styles.ampmOn]}>
                    <Text style={[styles.ampmText, pm === isPm && styles.ampmTextOn]}>{isPm ? 'PM' : 'AM'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Hour</Text>
              <View style={styles.timeGrid}>
                {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => {
                  const past = isPast(at(h, pm, 55));
                  const on = h === hour12;
                  return (
                    <TouchableOpacity key={h} disabled={past} onPress={() => setHour12(h)} style={[styles.timeCell, on && styles.timeOn, past && styles.timeOff]}>
                      <Text style={[styles.timeText, on && styles.timeTextOn, past && styles.dayOff]}>{h}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.label}>Minutes</Text>
              <View style={styles.timeGrid}>
                {MINUTES.map((m) => {
                  const past = isPast(at(hour12, pm, m));
                  const on = m === minute;
                  return (
                    <TouchableOpacity key={m} disabled={past} onPress={() => setMinute(m)} style={[styles.timeCell, on && styles.timeOn, past && styles.timeOff]}>
                      <Text style={[styles.timeText, on && styles.timeTextOn, past && styles.dayOff]}>:{pad(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={step === 'time' && isPast(chosen)}
            onPress={() => (step === 'date' ? setStep('time') : onConfirm(chosen))}
            style={{ marginTop: 16, opacity: step === 'time' && isPast(chosen) ? 0.5 : 1 }}
          >
            <LinearGradient colors={['#4F46E5', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <Ionicons name={step === 'date' ? 'arrow-forward' : 'checkmark-circle'} size={18} color="#FFFFFF" />
              <Text style={styles.ctaText}>{step === 'date' ? 'Next: pick a time' : 'Schedule post'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  iconBtnSoft: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  stepText: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 14, padding: 11, marginTop: 12 },
  summaryWarn: { backgroundColor: '#FEF3C7' },
  summaryText: { fontSize: 14, fontWeight: '800', color: '#3730A3' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  preset: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#C7D2FE', backgroundColor: '#F8FAFF' },
  presetText: { fontSize: 12, fontWeight: '700', color: '#4338CA' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  monthText: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#94A3B8', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: '#4F46E5' },
  dayToday: { borderWidth: 1.5, borderColor: '#A5B4FC' },
  dayText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  dayOnText: { color: '#FFFFFF', fontWeight: '800' },
  dayOff: { color: '#CBD5E1' },
  ampmRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4, marginTop: 14 },
  ampm: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  ampmOn: { backgroundColor: '#FFFFFF' },
  ampmText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  ampmTextOn: { color: '#4F46E5' },
  label: { fontSize: 12, fontWeight: '800', color: '#64748B', marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeCell: { width: '14.5%', paddingVertical: 10, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  timeOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  timeOff: { opacity: 0.5 },
  timeText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  timeTextOn: { color: '#FFFFFF' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 999 },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
