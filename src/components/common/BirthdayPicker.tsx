import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/** Youngest allowed age (standard for social apps) and oldest sensible age. */
export const MIN_AGE = 13;
export const MAX_AGE = 100;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Latest / earliest birthday allowed today. */
export function birthdayBounds() {
  const now = new Date();
  const max = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
  const min = new Date(now.getFullYear() - MAX_AGE, now.getMonth(), now.getDate());
  return { min, max };
}

/** "DD/MM/YYYY" → Date (or null if not a real date). */
export function parseDisplayDate(text: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const y = Number(m[3]);
  const date = new Date(y, mo, d);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

export const toDisplayDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Why a typed birthday is invalid, or '' when it's fine. */
export function birthdayError(text: string): string {
  if (!text.trim()) return 'Date of birth is required';
  const d = parseDisplayDate(text);
  if (!d) return 'Enter a real date as DD/MM/YYYY';
  const { min, max } = birthdayBounds();
  if (d > max) return `You must be at least ${MIN_AGE} years old`;
  if (d < min) return 'Please check the year';
  return '';
}

interface Props {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onSelect: (d: Date) => void;
}

/**
 * Calendar for choosing a birthday: month grid with arrows, and quick jumps by
 * tapping the month or the year (all valid years listed, newest first).
 */
export const BirthdayPicker: React.FC<Props> = ({ visible, value, onClose, onSelect }) => {
  const { min, max } = useMemo(birthdayBounds, [visible]);
  const start = value ?? new Date(max.getFullYear() - 7, 0, 1); // sensible default view
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());
  const [picked, setPicked] = useState<Date | null>(value);
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');

  // Re-sync when reopened.
  React.useEffect(() => {
    if (!visible) return;
    const s = value ?? new Date(max.getFullYear() - 7, 0, 1);
    setYear(s.getFullYear());
    setMonth(s.getMonth());
    setPicked(value);
    setMode('days');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = max.getFullYear(); y >= min.getFullYear(); y--) out.push(y);
    return out;
  }, [min, max]);

  const inRange = (d: Date) => d >= new Date(min.getFullYear(), min.getMonth(), min.getDate()) && d <= max;

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    if (y > max.getFullYear() || y < min.getFullYear()) return;
    setMonth(m);
    setYear(y);
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysIn(year, month) }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const isPicked = (d: number) =>
    !!picked && picked.getFullYear() === year && picked.getMonth() === month && picked.getDate() === d;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headRow}>
            <Text style={styles.title}>Your birthday</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.selected}>
            {picked ? picked.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : 'Pick a date'}
          </Text>

          {/* Month / year header */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.navBtn} disabled={mode !== 'days'}>
              <Ionicons name="chevron-back" size={20} color={mode === 'days' ? '#4F46E5' : '#CBD5E1'} />
            </TouchableOpacity>
            <View style={styles.navCenter}>
              <TouchableOpacity onPress={() => setMode(mode === 'months' ? 'days' : 'months')} style={styles.navPill}>
                <Text style={styles.navPillText}>{MONTHS[month]}</Text>
                <Ionicons name="chevron-down" size={14} color="#4F46E5" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode(mode === 'years' ? 'days' : 'years')} style={styles.navPill}>
                <Text style={styles.navPillText}>{year}</Text>
                <Ionicons name="chevron-down" size={14} color="#4F46E5" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.navBtn} disabled={mode !== 'days'}>
              <Ionicons name="chevron-forward" size={20} color={mode === 'days' ? '#4F46E5' : '#CBD5E1'} />
            </TouchableOpacity>
          </View>

          {mode === 'years' ? (
            <ScrollView style={styles.gridScroll} contentContainerStyle={styles.yearGrid}>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  onPress={() => {
                    setYear(y);
                    setMode('days');
                  }}
                  style={[styles.yearCell, y === year && styles.cellOn]}
                >
                  <Text style={[styles.yearText, y === year && styles.cellOnText]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : mode === 'months' ? (
            <View style={styles.monthGrid}>
              {MONTHS.map((name, i) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => {
                    setMonth(i);
                    setMode('days');
                  }}
                  style={[styles.monthCell, i === month && styles.cellOn]}
                >
                  <Text style={[styles.yearText, i === month && styles.cellOnText]}>{name.slice(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={styles.weekday}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={styles.dayGrid}>
                {cells.map((d, i) => {
                  if (!d) return <View key={i} style={styles.dayCell} />;
                  const date = new Date(year, month, d);
                  const ok = inRange(date);
                  const on = isPicked(d);
                  return (
                    <TouchableOpacity
                      key={i}
                      disabled={!ok}
                      onPress={() => setPicked(date)}
                      style={styles.dayCell}
                    >
                      <View style={[styles.dayInner, on && styles.dayOn]}>
                        <Text style={[styles.dayText, !ok && styles.dayDisabled, on && styles.cellOnText]}>{d}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!picked}
            onPress={() => picked && onSelect(picked)}
            style={{ marginTop: 14, opacity: picked ? 1 : 0.5 }}
          >
            <LinearGradient colors={['#4F46E5', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtn}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.doneText}>Use this date</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  selected: { fontSize: 14, fontWeight: '700', color: '#4F46E5', marginTop: 2, marginBottom: 12 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  navCenter: { flexDirection: 'row', gap: 8 },
  navPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#EEF2FF' },
  navPillText: { fontSize: 14, fontWeight: '800', color: '#312E81' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#94A3B8', paddingVertical: 6 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: '#4F46E5' },
  dayText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  dayDisabled: { color: '#CBD5E1' },
  gridScroll: { maxHeight: 280 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  yearCell: { width: '22%', paddingVertical: 10, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  monthCell: { width: '30%', paddingVertical: 14, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center' },
  yearText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  cellOn: { backgroundColor: '#4F46E5' },
  cellOnText: { color: '#FFFFFF' },
  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 999 },
  doneText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
