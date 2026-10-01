import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, typography } from '../../theme';

export const ADMIN_ACCENT = '#0F766E';
export const ADMIN_ACCENT_LIGHT = '#CCFBF1';

type IconName = keyof typeof Ionicons.glyphMap;

/** Compact formatting: 1234 → "1.2k". */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Pull a readable message out of an API error. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const msg = (e as { message?: string })?.message;
  return msg && typeof msg === 'string' ? msg : fallback;
}

/** True when the server says the user is no longer an admin. */
export function isForbidden(e: unknown): boolean {
  return (e as { status?: number })?.status === 403;
}

export const Section: React.FC<{
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ title, subtitle, icon, right, children, style }) => (
  <View style={[ui.section, style]}>
    <View style={ui.sectionHeader}>
      {icon && (
        <View style={ui.sectionIcon}>
          <Ionicons name={icon} size={15} color={ADMIN_ACCENT} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={ui.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={ui.sectionSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
    {children}
  </View>
);

export const StatTile: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  icon?: IconName;
  color?: string;
}> = ({ label, value, hint, icon, color = ADMIN_ACCENT }) => (
  <View style={ui.tile}>
    <View style={ui.tileTop}>
      {icon && <Ionicons name={icon} size={14} color={color} />}
      <Text style={ui.tileLabel} numberOfLines={1}>{label}</Text>
    </View>
    <Text style={[ui.tileValue, { color }]}>{typeof value === 'number' ? compact(value) : value}</Text>
    {!!hint && <Text style={ui.tileHint} numberOfLines={1}>{hint}</Text>}
  </View>
);

export const TileGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={ui.tileGrid}>{children}</View>
);

/**
 * Minimal vertical bar chart (no chart library needed). Shows every value as a
 * bar, the peak value, and first/middle/last x-axis labels.
 */
export const BarChart: React.FC<{
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
  unit?: string;
}> = ({ data, color = ADMIN_ACCENT, height = 110, unit = '' }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const mid = Math.floor(data.length / 2);
  return (
    <View>
      <View style={ui.chartMeta}>
        <Text style={ui.chartMetaText}>Peak {compact(max)}{unit}</Text>
        <Text style={ui.chartMetaText}>Total {compact(total)}{unit}</Text>
      </View>
      <View style={[ui.chart, { height }]}>
        {data.map((d, i) => (
          <View key={`${d.label}-${i}`} style={ui.barSlot}>
            <View
              style={[
                ui.bar,
                { height: d.value > 0 ? Math.max(3, (d.value / max) * (height - 6)) : 2, backgroundColor: d.value > 0 ? color : '#E2E8F0' },
              ]}
            />
          </View>
        ))}
      </View>
      {data.length > 0 && (
        <View style={ui.axis}>
          <Text style={ui.axisText}>{data[0].label}</Text>
          <Text style={ui.axisText}>{data[mid].label}</Text>
          <Text style={ui.axisText}>{data[data.length - 1].label}</Text>
        </View>
      )}
    </View>
  );
};

/** A key/value row used in detail tables. */
export const Row: React.FC<{ label: string; value: string | number; strong?: boolean }> = ({ label, value, strong }) => (
  <View style={ui.row}>
    <Text style={ui.rowLabel}>{label}</Text>
    <Text style={[ui.rowValue, strong && { color: '#0F172A', fontWeight: '800' }]}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </Text>
  </View>
);

export const Field: React.FC<TextInputProps & { label: string; help?: string }> = ({ label, help, style, ...rest }) => (
  <View style={ui.field}>
    <Text style={ui.fieldLabel}>{label}</Text>
    <TextInput placeholderTextColor="#94A3B8" style={[ui.input, rest.multiline && ui.inputMulti, style]} {...rest} />
    {!!help && <Text style={ui.fieldHelp}>{help}</Text>}
  </View>
);

export const ChipPicker = <T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) => (
  <View style={ui.field}>
    <Text style={ui.fieldLabel}>{label}</Text>
    <View style={ui.chips}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <TouchableOpacity
            key={o.id}
            disabled={disabled}
            activeOpacity={0.8}
            onPress={() => onChange(o.id)}
            style={[ui.chip, active && ui.chipActive, disabled && !active && { opacity: 0.45 }]}
          >
            <Text style={[ui.chipText, active && ui.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  icon?: IconName;
  busy?: boolean;
  danger?: boolean;
  outline?: boolean;
  disabled?: boolean;
}> = ({ label, onPress, icon, busy, danger, outline, disabled }) => {
  const bg = outline ? 'transparent' : danger ? '#DC2626' : ADMIN_ACCENT;
  const fg = outline ? (danger ? '#DC2626' : ADMIN_ACCENT) : '#FFFFFF';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={busy || disabled}
      style={[
        ui.btn,
        { backgroundColor: bg, borderColor: danger ? '#DC2626' : ADMIN_ACCENT, opacity: busy || disabled ? 0.6 : 1 },
      ]}
    >
      {icon && <Ionicons name={icon} size={15} color={fg} />}
      <Text style={[ui.btnText, { color: fg }]}>{busy ? 'Please wait…' : label}</Text>
    </TouchableOpacity>
  );
};

export const Badge: React.FC<{ text: string; color?: string; bg?: string; icon?: IconName }> = ({
  text,
  color = '#475569',
  bg = '#F1F5F9',
  icon,
}) => (
  <View style={[ui.badge, { backgroundColor: bg }]}>
    {icon && <Ionicons name={icon} size={10} color={color} />}
    <Text style={[ui.badgeText, { color }]}>{text}</Text>
  </View>
);

export const EmptyState: React.FC<{ icon: IconName; title: string; body?: string }> = ({ icon, title, body }) => (
  <View style={ui.empty}>
    <Ionicons name={icon} size={32} color="#CBD5E1" />
    <Text style={ui.emptyTitle}>{title}</Text>
    {!!body && <Text style={ui.emptyBody}>{body}</Text>}
  </View>
);

export const ui = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
    gap: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ADMIN_ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: typography.weights.bold, color: '#0F172A' },
  sectionSub: { fontSize: 11, color: '#64748B', marginTop: 1 },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 10,
    gap: 2,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', flex: 1 },
  tileValue: { fontSize: 20, fontWeight: '800' },
  tileHint: { fontSize: 10, color: '#94A3B8' },

  chartMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chartMetaText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { fontSize: 9, color: '#94A3B8' },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowLabel: { fontSize: 12, color: '#475569' },
  rowValue: { fontSize: 12, fontWeight: '700', color: '#334155' },

  field: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  fieldHelp: { fontSize: 10, color: '#94A3B8' },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: borderRadius.full, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: ADMIN_ACCENT },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '800' },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  btnText: { fontSize: 13, fontWeight: '800' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: borderRadius.full },
  badgeText: { fontSize: 10, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  emptyBody: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 17, paddingHorizontal: 16 },
});
