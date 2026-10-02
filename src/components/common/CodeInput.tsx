import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Called when all 6 digits are entered. */
  onComplete?: (code: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

/** Six-box one-time-code input (numbers only, Android OTP autofill hint). */
export const CodeInput: React.FC<Props> = ({ value, onChange, onComplete, error, autoFocus = true }) => {
  const ref = useRef<TextInput>(null);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.row} accessibilityLabel="Verification code">
      {digits.map((d, i) => {
        const active = i === Math.min(value.length, 5);
        return (
          <View key={i} style={[styles.box, active && styles.boxActive, error && styles.boxError, d.trim() && styles.boxFilled]}>
            <Text style={styles.digit}>{d.trim()}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => {
          const v = t.replace(/\D/g, '').slice(0, 6);
          onChange(v);
          if (v.length === 6) onComplete?.(v);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        autoFocus={autoFocus}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 9 },
  box: {
    width: 46,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: '#4F46E5', backgroundColor: '#FFFFFF' },
  boxFilled: { backgroundColor: '#FFFFFF' },
  boxError: { borderColor: '#DC2626' },
  digit: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
