import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useComposerBottomPadding } from '../common/KeyboardSafe';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { CodeInput } from '../common/CodeInput';

interface Props {
  visible: boolean;
  field: 'email' | 'phone';
  onClose: () => void;
}

type Step = 'enter' | 'confirm' | 'verifyNew' | 'done';

/**
 * Change email or phone securely:
 *  1) type the new value → a code goes to your CURRENT email
 *  2) enter that code → change applied
 *  3) email changes only: verify the NEW address with the code sent to it
 */
export const ContactChangeSheet: React.FC<Props> = ({ visible, field, onClose }) => {
  const { user, requestContactChange, confirmContactChange, confirmEmailVerification, sendEmailVerification } = useApp();
  const composerPad = useComposerBottomPadding(22);
  const [step, setStep] = useState<Step>('enter');
  const [value, setValue] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setStep('enter');
      setValue('');
      setCode('');
      setError('');
    }
  }, [visible]);

  const isEmail = field === 'email';
  const current = isEmail ? user?.email : user?.phone;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(
        e?.status === 400 && step !== 'enter'
          ? 'That code is wrong or expired. Check your email and try again.'
          : e?.message || 'Something went wrong. Please try again.',
      );
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const submitNew = () =>
    run(async () => {
      const v = value.trim();
      if (isEmail ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : !/^\+?[0-9 ]{7,20}$/.test(v)) {
        throw new Error(isEmail ? 'Enter a valid email address' : 'Enter a valid phone number');
      }
      setSentTo(await requestContactChange(isEmail ? { email: v } : { phone: v }));
      setStep('confirm');
    });

  const submitCode = (c = code) =>
    run(async () => {
      if (c.length !== 6) throw new Error('Enter the 6-digit code');
      await confirmContactChange(c);
      setCode('');
      setStep(isEmail ? 'verifyNew' : 'done');
    });

  const submitVerifyNew = (c = code) =>
    run(async () => {
      if (c.length !== 6) throw new Error('Enter the 6-digit code');
      await confirmEmailVerification(c);
      setStep('done');
    });

  const title =
    step === 'enter'
      ? `Change ${isEmail ? 'email' : 'phone number'}`
      : step === 'confirm'
      ? 'Confirm it’s you'
      : step === 'verifyNew'
      ? 'Verify your new email'
      : 'All set';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding" automaticOffset>
        <View style={[styles.sheet, { paddingBottom: composerPad }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {step === 'enter' && (
            <>
              <Text style={styles.sub}>
                Current: <Text style={styles.strong}>{current || '—'}</Text>
                {'\n'}For your security, we’ll send a code to your current email first.
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name={isEmail ? 'mail-outline' : 'call-outline'} size={17} color="#4F46E5" />
                <TextInput
                  value={value}
                  onChangeText={(t) => {
                    setValue(t);
                    setError('');
                  }}
                  placeholder={isEmail ? 'New email address' : 'New phone number with country code'}
                  placeholderTextColor="#94A3B8"
                  keyboardType={isEmail ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                  autoFocus
                  style={styles.input}
                />
              </View>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Text style={styles.sub}>
                Enter the 6-digit code we sent to <Text style={styles.strong}>{sentTo}</Text>.
              </Text>
              <CodeInput value={code} onChange={(v) => { setCode(v); setError(''); }} onComplete={(v) => void submitCode(v)} error={!!error} />
            </>
          )}

          {step === 'verifyNew' && (
            <>
              <Text style={styles.sub}>
                Your email is now <Text style={styles.strong}>{user?.email}</Text>. Enter the code we just sent there to verify it.
              </Text>
              <CodeInput value={code} onChange={(v) => { setCode(v); setError(''); }} onComplete={(v) => void submitVerifyNew(v)} error={!!error} />
              <TouchableOpacity onPress={() => void run(sendEmailVerification)} style={styles.resend}>
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <View style={styles.done}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={30} color="#FFFFFF" />
              </View>
              <Text style={styles.sub}>
                Your {isEmail ? 'email' : 'phone number'} was updated to{' '}
                <Text style={styles.strong}>{isEmail ? user?.email : user?.phone}</Text>.
              </Text>
            </View>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={busy}
            onPress={() =>
              step === 'enter'
                ? void submitNew()
                : step === 'confirm'
                ? void submitCode()
                : step === 'verifyNew'
                ? void submitVerifyNew()
                : onClose()
            }
            style={{ marginTop: 18 }}
          >
            <LinearGradient colors={['#4F46E5', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.btnText}>
                  {step === 'enter' ? 'Send code' : step === 'done' ? 'Done' : 'Confirm'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 30, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: 14, color: '#475569', lineHeight: 21 },
  strong: { fontWeight: '800', color: '#0F172A' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#0F172A' },
  error: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  btn: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resend: { alignItems: 'center' },
  resendText: { fontSize: 13, fontWeight: '800', color: '#4F46E5' },
  done: { alignItems: 'center', gap: 12 },
  doneIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
});
