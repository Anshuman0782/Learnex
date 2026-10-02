import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Input, Button } from '../../components/common';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { login, showDialog } = useApp();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  const validate = () => {
    const errs: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      errs.identifier = 'Please enter your email, phone, or username';
    }
    if (!password.trim()) {
      errs.password = 'Please enter your password';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const me = await login(identifier, password);
      // Unverified email → verify first (a fresh code is sent automatically).
      navigation.reset({
        index: 0,
        routes: me.emailVerified
          ? [{ name: 'Main', params: { screen: 'HomeTab' } }]
          : [{ name: 'VerifyEmail', params: { autoSend: true } }],
      });
    } catch (err: any) {
      const status = err?.status;
      const message =
        status === 401
          ? 'The email/phone or password is incorrect. Please try again.'
          : status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : err?.message ||
            'Unable to sign in right now. Check your connection and try again.';
      showDialog({
        title: 'Login Failed',
        message,
        icon: status === 401 ? 'lock-closed-outline' : 'alert-circle-outline',
        confirmText: 'Try Again',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 20, 48),
            paddingBottom: Math.max(insets.bottom + 24, 36),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Official Brand Logo & Header */}
        <View style={styles.headerSection}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.brandLogoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTagline}>CONNECT • PRACTICE • MASTER</Text>
        </View>

        {/* Welcome Card */}
        <View style={[styles.card, shadows.soft]}>
          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeTitle}>Sign In</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <Input
              label="Email, Phone, or Username"
              placeholder="e.g. anshuman@gmail.com"
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                if (errors.identifier) setErrors({ ...errors, identifier: undefined });
              }}
              leftIcon="person-outline"
              autoCapitalize="none"
              error={errors.identifier}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              leftIcon="lock-closed-outline"
              isPassword
              error={errors.password}
            />

            {/* Remember Me & Forgot Password Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setRememberMe(!rememberMe)}
                style={styles.rememberMeBtn}
              >
                <Ionicons
                  name={rememberMe ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={rememberMe ? '#4F46E5' : '#94A3B8'}
                />
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Primary Sign In Button */}
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.signInButton}
            />
          </View>
        </View>

        {/* Footer: Create Account Link */}
        <View style={styles.footerSection}>
          <Text style={styles.footerText}>New to LERNEX? </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SignUp')}
            style={styles.signUpTouch}
          >
            <Text style={styles.signUpLink}>Create an Account</Text>
            <Ionicons name="arrow-forward" size={14} color="#4F46E5" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  brandLogoImage: {
    width: 220,
    height: 155,
    marginBottom: 2,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 1.6,
    marginTop: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  welcomeBox: {
    marginBottom: spacing.lg,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  formSection: {
    gap: spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
    paddingHorizontal: 2,
  },
  rememberMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rememberMeText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  signInButton: {
    marginTop: spacing.sm,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
  signUpTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signUpLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
});
