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
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { Input, Button } from '../../components/common';
import { POPULAR_HOBBIES } from '../../data/mockData';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;

// Curated avatar choices for new learners & mentors
const PRESET_AVATARS = [
  {
    id: 'av-1',
    label: 'Vocalist',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'av-2',
    label: 'Musician',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'av-3',
    label: 'Producer',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'av-4',
    label: 'Developer',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'av-5',
    label: 'Creator',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
  },
  {
    id: 'av-6',
    label: 'Artist',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&auto=format&fit=crop&q=80',
  },
];

const YEARS = Array.from({ length: 45 }, (_, i) => String(2015 - i));
const MONTHS = [
  { val: '01', name: 'Jan' },
  { val: '02', name: 'Feb' },
  { val: '03', name: 'Mar' },
  { val: '04', name: 'Apr' },
  { val: '05', name: 'May' },
  { val: '06', name: 'Jun' },
  { val: '07', name: 'Jul' },
  { val: '08', name: 'Aug' },
  { val: '09', name: 'Sep' },
  { val: '10', name: 'Oct' },
  { val: '11', name: 'Nov' },
  { val: '12', name: 'Dec' },
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const PRESET_DOBS = [
  { label: '2000-05-17', year: '2000', month: '05', day: '17' },
  { label: '1999-08-12', year: '1999', month: '08', day: '12' },
  { label: '2001-03-24', year: '2001', month: '03', day: '24' },
  { label: '2002-11-05', year: '2002', month: '11', day: '05' },
  { label: '2004-07-19', year: '2004', month: '07', day: '19' },
];

export const SignUpScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { signup } = useApp();

  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0].url);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2000');
  const [selectedMonth, setSelectedMonth] = useState('05');
  const [selectedDay, setSelectedDay] = useState('17');
  const [selectedHobby, setSelectedHobby] = useState('Music');
  const [customHobby, setCustomHobby] = useState('');
  const [isCustomHobby, setIsCustomHobby] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleDobChange = (text: string) => {
    // Only numbers
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = '';

    if (digits.length <= 4) {
      formatted = digits;
      if (digits.length === 4 && text.length >= dob.length) {
        formatted = `${digits}-`;
      }
    } else if (digits.length <= 6) {
      const y = digits.slice(0, 4);
      const m = digits.slice(4);
      formatted = `${y}-${m}`;
      if (digits.length === 6 && text.length >= dob.length) {
        formatted = `${y}-${m}-`;
      }
    } else {
      const y = digits.slice(0, 4);
      const m = digits.slice(4, 6);
      const d = digits.slice(6, 8);
      formatted = `${y}-${m}-${d}`;
    }

    setDob(formatted);
    if (errors.dob) setErrors({ ...errors, dob: '' });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full Name is required';
    if (!phoneNumber.trim()) errs.phoneNumber = 'Phone Number is required';
    if (!email.trim() || !email.includes('@')) errs.email = 'Valid Email is required';
    if (!password.trim() || password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (!dob.trim()) errs.dob = 'Date of birth is required (YYYY-MM-DD)';
    const finalHobby = isCustomHobby ? customHobby.trim() : selectedHobby;
    if (!finalHobby) errs.hobby = 'Please choose your primary interest';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignUp = () => {
    if (!validate()) return;
    setLoading(true);
    const finalHobby = isCustomHobby ? customHobby.trim() : selectedHobby;

    setTimeout(() => {
      setLoading(false);
      signup({
        name: fullName.trim(),
        phone: phoneNumber.trim(),
        email: email.trim(),
        password: password.trim(),
        dob: dob.trim(),
        hobby: finalHobby,
        avatarUrl,
      });
      navigation.navigate('CommunityRecommendation');
    }, 400);
  };

  const handleApplyCustomAvatar = () => {
    if (customAvatarInput.trim()) {
      setAvatarUrl(customAvatarInput.trim());
      setShowCustomModal(false);
      setCustomAvatarInput('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
        {/* Profile Picture Option Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setShowAvatarPicker(!showAvatarPicker)}
            style={styles.avatarWrapper}
          >
            <Image source={{ uri: avatarUrl }} style={styles.mainAvatar} />
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              style={styles.avatarEditBadge}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowAvatarPicker(!showAvatarPicker)}
            style={styles.changePhotoTextBtn}
          >
            <Text style={styles.changePhotoText}>
              {showAvatarPicker ? 'Hide Photo Options' : 'Choose Profile Picture'}
            </Text>
            <Ionicons
              name={showAvatarPicker ? 'chevron-up' : 'chevron-down'}
              size={13}
              color="#4F46E5"
            />
          </TouchableOpacity>

          {/* Collapsible Avatar Picker Tray */}
          {showAvatarPicker && (
            <View style={[styles.presetTray, shadows.soft]}>
              <Text style={styles.presetTrayTitle}>SELECT A PROFILE AVATAR</Text>
              <View style={styles.presetGrid}>
                {PRESET_AVATARS.map((item) => {
                  const isSelected = avatarUrl === item.url;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => setAvatarUrl(item.url)}
                      style={[
                        styles.presetThumbBox,
                        isSelected && styles.presetThumbBoxActive,
                      ]}
                    >
                      <Image source={{ uri: item.url }} style={styles.presetImage} />
                      {isSelected && (
                        <View style={styles.presetCheckOverlay}>
                          <Ionicons name="checkmark-circle" size={16} color="#4F46E5" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowCustomModal(true)}
                style={styles.customUrlLink}
              >
                <Ionicons name="link-outline" size={14} color="#4F46E5" />
                <Text style={styles.customUrlLinkText}>Paste custom image URL</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Registration Form Card */}
        <View style={[styles.formCard, shadows.soft]}>
          <Text style={styles.cardHeaderTitle}>Account Information</Text>

          <Input
            label="Full Name"
            placeholder="e.g. Anshuman Sarkar"
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
            placeholder="e.g. anshuman@gmail.com"
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
            placeholder="e.g. +91 98765 43210"
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
            placeholder="At least 6 characters"
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
            placeholder="YYYY-MM-DD (e.g. 2000-05-17)"
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

      {/* Custom Avatar Modal */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadows.card]}>
            <Text style={styles.modalTitle}>Custom Profile Picture</Text>
            <Text style={styles.modalSubtitle}>
              Paste a public image URL to use as your avatar.
            </Text>

            <TextInput
              placeholder="https://images.unsplash.com/..."
              value={customAvatarInput}
              onChangeText={setCustomAvatarInput}
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowCustomModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleApplyCustomAvatar}
                style={styles.modalApplyBtn}
              >
                <Text style={styles.modalApplyText}>Apply Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Interactive Date of Birth Picker Modal */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.datePickerBackdrop}>
          <View style={styles.datePickerSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.datePickerHeader}>
              <View>
                <Text style={styles.datePickerTitle}>Select Date of Birth</Text>
                <Text style={styles.datePickerSub}>Tap to select Year, Month, and Day</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDatePickerModal(false)}
                style={styles.closePickerBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Selected Date Preview Banner */}
            <View style={styles.selectedDateBanner}>
              <Ionicons name="calendar" size={18} color="#4F46E5" />
              <Text style={styles.selectedDateText}>
                {selectedYear}-{selectedMonth}-{selectedDay}
              </Text>
            </View>

            {/* Quick Pick Presets */}
            <View style={styles.presetSection}>
              <Text style={styles.presetSectionLabel}>Quick Presets:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
                {PRESET_DOBS.map((p) => {
                  const isActive = selectedYear === p.year && selectedMonth === p.month && selectedDay === p.day;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedYear(p.year);
                        setSelectedMonth(p.month);
                        setSelectedDay(p.day);
                      }}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                    >
                      <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 3 Column Selector: Year, Month, Day */}
            <View style={styles.dateColumnsWrapper}>
              {/* Year Column */}
              <View style={styles.dateColumn}>
                <Text style={styles.columnLabel}>Year</Text>
                <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                  {YEARS.map((y) => {
                    const isActive = selectedYear === y;
                    return (
                      <TouchableOpacity
                        key={y}
                        onPress={() => setSelectedYear(y)}
                        style={[styles.dateOptionBtn, isActive && styles.dateOptionBtnActive]}
                      >
                        <Text style={[styles.dateOptionText, isActive && styles.dateOptionTextActive]}>
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Month Column */}
              <View style={styles.dateColumn}>
                <Text style={styles.columnLabel}>Month</Text>
                <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                  {MONTHS.map((m) => {
                    const isActive = selectedMonth === m.val;
                    return (
                      <TouchableOpacity
                        key={m.val}
                        onPress={() => setSelectedMonth(m.val)}
                        style={[styles.dateOptionBtn, isActive && styles.dateOptionBtnActive]}
                      >
                        <Text style={[styles.dateOptionText, isActive && styles.dateOptionTextActive]}>
                          {m.val} ({m.name})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Day Column */}
              <View style={styles.dateColumn}>
                <Text style={styles.columnLabel}>Day</Text>
                <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                  {DAYS.map((d) => {
                    const isActive = selectedDay === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setSelectedDay(d)}
                        style={[styles.dateOptionBtn, isActive && styles.dateOptionBtnActive]}
                      >
                        <Text style={[styles.dateOptionText, isActive && styles.dateOptionTextActive]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                setDob(`${selectedYear}-${selectedMonth}-${selectedDay}`);
                if (errors.dob) setErrors({ ...errors, dob: '' });
                setShowDatePickerModal(false);
              }}
              style={styles.applyDateBtn}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyDateGradient}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.applyDateText}>Apply Date ({selectedYear}-{selectedMonth}-{selectedDay})</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
