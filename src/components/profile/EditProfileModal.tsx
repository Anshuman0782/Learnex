import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
];

const SKILL_TRACKS = ['Music', 'Coding', 'Design'];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
}) => {
  const { user, updateUser } = useApp();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [hobby, setHobby] = useState('Music');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setHandle(user.handle || `@${(user.name || 'user').toLowerCase().replace(/\s+/g, '_')}`);
      setBio(
        user.bio ||
          'Vocal student passionate about R&B and pop. Practicing head voice mix and breath control daily!'
      );
      setHobby(user.hobby || 'Music');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || PRESET_AVATARS[0]);
    }
  }, [user, visible]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      updateUser({
        name: name.trim(),
        handle: handle.trim(),
        bio: bio.trim(),
        hobby,
        email: email.trim(),
        phone: phone.trim(),
        avatarUrl,
      });

      setIsSaving(false);
      onClose();
      Alert.alert('Profile Updated! ✨', 'Your changes have been saved.');
    }, 400);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>

            <Text style={styles.sheetTitle}>Edit Profile</Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={isSaving}
              style={styles.saveHeaderBtn}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                style={styles.saveHeaderGradient}
              >
                <Text style={styles.saveHeaderText}>
                  {isSaving ? '...' : 'Save'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar Selector */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Image source={{ uri: avatarUrl }} style={styles.currentAvatarImg} />
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.avatarSectionTitle}>Choose Avatar</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarScroll}
              >
                {PRESET_AVATARS.map((uri, idx) => {
                  const isSelected = avatarUrl === uri;
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.8}
                      onPress={() => setAvatarUrl(uri)}
                      style={[
                        styles.avatarOption,
                        isSelected && styles.avatarOptionSelected,
                      ]}
                    >
                      <Image source={{ uri }} style={styles.avatarOptionImg} />
                      {isSelected && (
                        <View style={styles.avatarSelectedBadge}>
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Input Fields */}
            <View style={styles.fieldsBlock}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={16} color="#4F46E5" style={styles.fieldIcon} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Username / Handle</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="at-outline" size={16} color="#4F46E5" style={styles.fieldIcon} />
                  <TextInput
                    value={handle}
                    onChangeText={setHandle}
                    placeholder="@username"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Bio & Learning Goals</Text>
                <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell mentors and members about your learning journey..."
                    placeholderTextColor="#94A3B8"
                    style={styles.textArea}
                    multiline
                  />
                </View>
              </View>

              {/* Primary Skill Track */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Primary Focus Track</Text>
                <View style={styles.tracksRow}>
                  {SKILL_TRACKS.map((track) => {
                    const isSelected = hobby === track;
                    return (
                      <TouchableOpacity
                        key={track}
                        activeOpacity={0.8}
                        onPress={() => setHobby(track)}
                        style={[styles.trackChip, isSelected && styles.trackChipActive]}
                      >
                        <Text style={[styles.trackChipText, isSelected && styles.trackChipTextActive]}>
                          {track}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={16} color="#4F46E5" style={styles.fieldIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your@email.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={16} color="#4F46E5" style={styles.fieldIcon} />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+91 98765 43210"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    style={styles.textInput}
                  />
                </View>
              </View>
            </View>

            {/* Bottom Save Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleSave}
              disabled={isSaving}
              style={styles.submitBtn}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  {isSaving ? 'Saving Changes...' : 'Save Profile'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '92%',
    paddingTop: spacing.xs + 2,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  saveHeaderBtn: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  saveHeaderGradient: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.base,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    position: 'relative',
  },
  currentAvatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#4F46E5',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  avatarOption: {
    position: 'relative',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  avatarOptionSelected: {
    borderColor: '#4F46E5',
  },
  avatarOptionImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarSelectedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldsBlock: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#334155',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: spacing.sm + 2,
  },
  textAreaWrapper: {
    paddingVertical: 4,
  },
  fieldIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 13,
    color: colors.textPrimary,
  },
  textArea: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
    paddingVertical: 8,
  },
  tracksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trackChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trackChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  trackChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  trackChipTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  submitBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginTop: spacing.xs,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
});
