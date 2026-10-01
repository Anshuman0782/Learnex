import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Input, Button } from '../../components/common';
import { forgotPasswordRequest, resetPasswordRequest } from '../../api/social.api';
import { spacing, typography, borderRadius, shadows } from '../../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { showDialog } = useApp();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();

  const handleRequest = async () => {
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      const res = await forgotPasswordRequest(identifier.trim());
      setDevCode(res.devCode);
      if (res.devCode) setCode(res.devCode); // dev convenience
      setStep('reset');
    } catch (err: any) {
      showDialog({
        title: 'Something went wrong',
        message: err?.message || 'Please try again.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!code.trim() || password.length < 8) {
      showDialog({
        title: 'Check your details',
        message: 'Enter the code and a new password of at least 8 characters.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
      return;
    }
    setLoading(true);
    try {
      await resetPasswordRequest(identifier.trim(), code.trim(), password);
      showDialog({
        title: 'Password Updated ✅',
        message: 'You can now sign in with your new password.',
        icon: 'checkmark-circle',
        confirmText: 'Sign In',
        onConfirm: () => navigation.navigate('Login'),
      });
    } catch (err: any) {
      showDialog({
        title: 'Reset Failed',
        message: err?.status === 400 ? 'That code is invalid or expired. Request a new one.' : err?.message || 'Please try again.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 6, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Reset Password</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, shadows.soft]}>
          {step === 'request' ? (
            <>
              <Text style={styles.title}>Forgot your password?</Text>
              <Text style={styles.subtitle}>
                Enter your email or phone and we’ll send a reset code.
              </Text>
              <Input
                label="Email or Phone"
                placeholder="e.g. you@example.com"
                value={identifier}
                onChangeText={setIdentifier}
                leftIcon="person-outline"
                autoCapitalize="none"
              />
              <Button title="Send Reset Code" onPress={handleRequest} loading={loading} fullWidth size="lg" style={{ marginTop: spacing.sm }} />
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter the code</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to your account. Enter it with your new password.
              </Text>
              {devCode ? (
                <View style={styles.devBox}>
                  <Ionicons name="construct-outline" size={14} color="#B45309" />
                  <Text style={styles.devText}>Dev code: {devCode}</Text>
                </View>
              ) : null}
              <Input
                label="Reset Code"
                placeholder="6-digit code"
                value={code}
                onChangeText={setCode}
                leftIcon="key-outline"
                keyboardType="number-pad"
                maxLength={6}
              />
              <Input
                label="New Password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={setPassword}
                leftIcon="lock-closed-outline"
                isPassword
              />
              <Button title="Reset Password" onPress={handleReset} loading={loading} fullWidth size="lg" style={{ marginTop: spacing.sm }} />
              <TouchableOpacity onPress={handleRequest} style={styles.resendBtn}>
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { fontSize: 16, fontWeight: typography.weights.bold, color: '#0F172A' },
  scroll: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { fontSize: 22, fontWeight: typography.weights.bold, color: '#0F172A', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: spacing.md },
  devBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: 8,
    marginBottom: spacing.sm,
  },
  devText: { fontSize: 12, color: '#B45309', fontWeight: '700' },
  resendBtn: { alignSelf: 'center', paddingVertical: 10 },
  resendText: { fontSize: 13, color: '#4F46E5', fontWeight: '700' },
});
