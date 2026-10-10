import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Input, Button } from '../../components/common';
import { takePhoto, pickPhoto } from '../../services/imagePicker';
import { POPULAR_HOBBIES } from '../../data/mockData';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';
import { BirthdayPicker, birthdayError, parseDisplayDate, toDisplayDate, toIsoDate } from '../../components/common/BirthdayPicker';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { signup, showDialog } = useApp();

  const [avatarUrl, setAvatarUrl] = useState('');

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [selectedHobby, setSelectedHobby] = useState('Music');
  const [customHobby, setCustomHobby] = useState('');
  const [isCustomHobby, setIsCustomHobby] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  /** Typing a birthday: digits only, auto-formatted as DD/MM/YYYY. */
  const handleDobChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    const deleting = text.length < dob.length;
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    // Add the slash as soon as a part is complete (not while deleting).
    if (!deleting && (digits.length === 2 || digits.length === 4)) formatted += '/';
    setDob(formatted);
    if (errors.dob) setErrors({ ...errors, dob: '' });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full Name is required';
    if (!phoneNumber.trim()) errs.phoneNumber = 'Phone Number is required';
    if (!email.trim() || !email.includes('@')) errs.email = 'Valid Email is required';
    if (!password.trim() || password.length < 8) errs.password = 'Password must be at least 8 characters';
    const dobErr = birthdayError(dob.trim());
    if (dobErr) errs.dob = dobErr;
    const finalHobby = isCustomHobby ? customHobby.trim() : selectedHobby;
    if (!finalHobby) errs.hobby = 'Please choose your primary interest';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setLoading(true);
    const finalHobby = isCustomHobby ? customHobby.trim() : selectedHobby;

    try {
      await signup({
        name: fullName.trim(),
        phone: phoneNumber.trim(),
        email: email.trim(),
        password: password.trim(),
        dob: toIsoDate(parseDisplayDate(dob.trim())!), // server stores YYYY-MM-DD
        hobby: finalHobby,
        avatarUrl,
      });
      navigation.reset({ index: 0, routes: [{ name: 'VerifyEmail' }] }); // code already emailed
    } catch (err: any) {
      const status = err?.status;
      const message =
        status === 409
          ? 'An account with this email or phone already exists. Try signing in instead.'
          : status === 400
          ? err?.message || 'Please check your details and try again.'
          : err?.message ||
            'Unable to create your account right now. Check your connection and try again.';
      showDialog({
        title: 'Sign Up Failed',
        message,
        icon: 'alert-circle-outline',
        confirmText: 'Try Again',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    const res = await takePhoto();
    if (res.status === 'ok') {
      setAvatarUrl(res.uri);
    } else if (res.status === 'denied') {
      showDialog({
        title: 'Camera Access Needed',
        message:
          'To take a profile photo, allow camera access for LERNEX in your device settings, then try again.',
        icon: 'camera-outline',
        confirmText: 'Got it',
      });
    }
  };

  const handlePickPhoto = async () => {
    const res = await pickPhoto();
    if (res.status === 'ok') {
      setAvatarUrl(res.uri);
    } else if (res.status === 'denied') {
      showDialog({
        title: 'Photo Access Needed',
        message:
          'To choose a profile photo, allow photo access for LERNEX in your device settings, then try again.',
        icon: 'images-outline',
        confirmText: 'Got it',
      });
    }
  };

  const handleRemovePhoto = () => setAvatarUrl('');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding" automaticOffset
    >
      {/* Top Bar with Back Button */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 6, 16) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Create Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 30, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section — take a live photo or upload from gallery */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handlePickPhoto}
            style={styles.avatarWrapper}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.mainAvatar} />
            ) : (
              <View style={[styles.mainAvatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color="#94A3B8" />
              </View>
            )}
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              style={styles.avatarEditBadge}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.avatarHint}>
            {avatarUrl ? 'Looking good!' : 'Add a profile photo'}
          </Text>

          {/* Take Photo / Upload actions */}
          <View style={styles.photoActionRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleTakePhoto}
              style={styles.photoActionBtn}
            >
              <Ionicons name="camera-outline" size={17} color="#4F46E5" />
              <Text style={styles.photoActionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePickPhoto}
              style={styles.photoActionBtn}
            >
              <Ionicons name="image-outline" size={17} color="#4F46E5" />
              <Text style={styles.photoActionText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {avatarUrl ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleRemovePhoto}
              style={styles.removePhotoBtn}
            >
              <Ionicons name="close-circle" size={14} color="#EF4444" />
              <Text style={styles.removePhotoText}>Remove photo</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Registration Form Card */}
        <View style={[styles.formCard, shadows.soft]}>
          <Text style={styles.cardHeaderTitle}>Account Information</Text>

          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (errors.fullName) setErrors({ ...errors, fullName: '' });
            }}
            leftIcon="person-outline"
            error={errors.fullName}
          />

          <Input
            label="Email Address"
            placeholder="Enter your email address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            leftIcon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            label="Phone Number"
            placeholder="Enter number with country code"
            value={phoneNumber}
            onChangeText={(text) => {
              setPhoneNumber(text);
              if (errors.phoneNumber) setErrors({ ...errors, phoneNumber: '' });
            }}
            leftIcon="call-outline"
            keyboardType="phone-pad"
            error={errors.phoneNumber}
          />

          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors({ ...errors, password: '' });
            }}
            leftIcon="lock-closed-outline"
            isPassword
            error={errors.password}
          />

          <Input
            label="Date of Birth"
            placeholder="DD/MM/YYYY"
            value={dob}
            onChangeText={handleDobChange}
            keyboardType="numeric"
            maxLength={10}
            leftIcon="calendar-outline"
            onLeftIconPress={() => setShowDatePickerModal(true)}
            rightIcon="calendar"
            onRightIconPress={() => setShowDatePickerModal(true)}
            error={errors.dob}
          />

          {/* Primary Hobby Selection */}
          <View style={styles.hobbyBlock}>
            <View style={styles.hobbyHeaderRow}>
              <Text style={styles.hobbyLabel}>Primary Craft or Interest</Text>
              <Text style={styles.hobbySub}>Used to find matching circles</Text>
            </View>

            <View style={styles.hobbyChipsRow}>
              {POPULAR_HOBBIES.map((h) => {
                const isSelected = !isCustomHobby && selectedHobby === h;
                return (
                  <TouchableOpacity
                    key={h}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedHobby(h);
                      setIsCustomHobby(false);
                      if (errors.hobby) setErrors({ ...errors, hobby: '' });
                    }}
                    style={[
                      styles.hobbyChip,
                      isSelected && styles.hobbyChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.hobbyChipText,
                        isSelected && styles.hobbyChipTextSelected,
                      ]}
                    >
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsCustomHobby(true)}
                style={[
                  styles.hobbyChip,
                  isCustomHobby && styles.hobbyChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.hobbyChipText,
                    isCustomHobby && styles.hobbyChipTextSelected,
                  ]}
                >
                  + Custom
                </Text>
              </TouchableOpacity>
            </View>

            {isCustomHobby && (
              <Input
                placeholder="Enter craft (e.g. Beatboxing, Chess)"
                value={customHobby}
                onChangeText={(text) => {
                  setCustomHobby(text);
                  if (errors.hobby) setErrors({ ...errors, hobby: '' });
                }}
                leftIcon="create-outline"
                containerStyle={{ marginTop: 8 }}
                error={errors.hobby}
              />
            )}
            {errors.hobby && !isCustomHobby && (
              <Text style={styles.fieldErrorText}>{errors.hobby}</Text>
            )}
          </View>

          {/* Submit Button */}
          <Button
            title="Create Account & Continue"
            onPress={handleSignUp}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </View>

        {/* Footer Link to Login */}
        <View style={styles.footerSection}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Birthday calendar (typing in the field works too) */}
      <BirthdayPicker
        visible={showDatePickerModal}
        value={parseDisplayDate(dob)}
        onClose={() => setShowDatePickerModal(false)}
        onSelect={(d) => {
          setDob(toDisplayDate(d));
          if (errors.dob) setErrors({ ...errors, dob: '' });
          setShowDatePickerModal(false);
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
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
  topBarTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  mainAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#4F46E5',
  },
  avatarPlaceholder: {
    backgroundColor: '#EEF2FF',
    borderStyle: 'dashed',
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
    marginBottom: 10,
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: borderRadius.full,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  removePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  changePhotoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  presetTray: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginTop: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  presetTrayTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  presetThumbBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  presetThumbBoxActive: {
    borderColor: '#4F46E5',
  },
  presetImage: {
    width: '100%',
    height: '100%',
  },
  presetCheckOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  customUrlLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 4,
  },
  customUrlLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: 8,
  },
  hobbyBlock: {
    marginTop: 6,
    marginBottom: 4,
  },
  hobbyHeaderRow: {
    marginBottom: 8,
  },
  hobbyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  hobbySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  hobbyChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hobbyChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
  },
  hobbyChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  hobbyChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  hobbyChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  fieldErrorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  footerText: {
    fontSize: 13,
    color: '#64748B',
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  modalApplyBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  modalApplyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  datePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.base,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 12,
    maxHeight: '75%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  datePickerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closePickerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: borderRadius.lg,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4F46E5',
    letterSpacing: 1.5,
  },
  presetSection: {
    gap: 6,
  },
  presetSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  presetScroll: {
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dateColumnsWrapper: {
    flexDirection: 'row',
    gap: 8,
    height: 180,
  },
  dateColumn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 6,
  },
  columnScroll: {
    flex: 1,
  },
  dateOptionBtn: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  dateOptionBtnActive: {
    backgroundColor: '#4F46E5',
  },
  dateOptionText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  dateOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  applyDateBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginTop: 4,
  },
  applyDateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  applyDateText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
});
