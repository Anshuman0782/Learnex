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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getLeaderboardCategoriesRequest } from '../../api/competition.api';
import { ContactChangeSheet } from './ContactChangeSheet';
import { Avatar } from '../common/Avatar';
import { takePhoto, pickPhoto } from '../../services/imagePicker';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Starter suggestions; real categories people already use are merged in. */
const BASE_SUGGESTIONS = ['Music', 'Coding', 'Design', 'Dance', 'Photography', 'Fitness', 'Art', 'Writing', 'Cooking', 'Languages', 'Marketing', 'Business'];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
}) => {
  const { user, updateUser, updateAvatar, mySkills, setPrimarySkill } = useApp();
  // Members choose their main skill from the skills they've joined; guests
  // (no skills yet) keep a free-text focus.
  const isMember = mySkills.length > 0;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [hobby, setHobby] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customHobby, setCustomHobby] = useState('');
  const [liveCategories, setLiveCategories] = useState<string[]>([]);
  const [contactField, setContactField] = useState<'email' | 'phone' | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setHobby(user.hobby || '');
      setCustomMode(false);
      setCustomHobby('');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user, visible]);

  // Real categories members already use (merged into the suggestions).
  useEffect(() => {
    if (!visible) return;
    getLeaderboardCategoriesRequest()
      .then((cats: any) =>
        setLiveCategories(
          (Array.isArray(cats) ? cats : [])
            .map((c: any) => (typeof c === 'string' ? c : c?.name ?? c?.category))
            .filter(Boolean),
        ),
      )
      .catch(() => {});
  }, [visible]);

  const currentHobby = user?.hobby || '';
  const suggestions = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    [...liveCategories, ...BASE_SUGGESTIONS].forEach((h) => {
      const k = h.trim().toLowerCase();
      if (!k || seen.has(k) || k === currentHobby.toLowerCase()) return;
      seen.add(k);
      out.push(h.trim());
    });
    return out.slice(0, 14);
  })();
  const trackOptions = isMember
    ? mySkills.map((s) => s.skill)
    : [currentHobby, ...suggestions].filter(Boolean);
  const roleOfTrack = (t: string) => mySkills.find((s) => s.skill.toLowerCase() === t.toLowerCase())?.role;
  const finalHobby = customMode ? customHobby.trim() : hobby;

  const handlePickAvatar = async (mode: 'camera' | 'library') => {
    const res = mode === 'camera' ? await takePhoto() : await pickPhoto();
    if (res.status === 'denied') {
      Alert.alert('Access Needed', 'Please allow photo/camera access for LERNEX in your device settings.');
      return;
    }
    if (res.status !== 'ok') return;
    setAvatarUrl(res.uri); // instant preview
    setAvatarUploading(true);
    try {
      await updateAvatar(res.uri, res.mimeType); // uploads + persists on the server
    } catch {
      Alert.alert('Upload Failed', 'Could not upload your photo. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }
    if (finalHobby.length < 2) {
      Alert.alert('Focus Track', 'Pick a focus track or type your own (at least 2 letters).');
      return;
    }
    setIsSaving(true);
    try {
      // Saved on the server. Email / phone change through the verified flow.
      if (isMember) {
        // Switching main skill also switches the account's role to that skill's role.
        if (finalHobby.toLowerCase() !== currentHobby.toLowerCase()) await setPrimarySkill(finalHobby);
        await updateUser({ name: name.trim(), bio: bio.trim() });
      } else {
        await updateUser({
          name: name.trim(),
          bio: bio.trim(),
          hobby: finalHobby,
        });
      }
      onClose();
      Alert.alert('Profile Updated! ✨', 'Your changes have been saved.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, (Platform.OS === 'ios' ? spacing.xl : spacing.lg) - 8) + 8 }]}>
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
            {/* Profile photo — real camera / upload */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handlePickAvatar('library')}
                style={styles.avatarContainer}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.currentAvatarImg} />
                ) : (
                  <Avatar name={name || user?.name} size={92} />
                )}
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              <View style={styles.photoBtnRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handlePickAvatar('camera')}
                  style={styles.photoBtn}
                  disabled={avatarUploading}
                >
                  <Ionicons name="camera-outline" size={16} color="#4F46E5" />
                  <Text style={styles.photoBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handlePickAvatar('library')}
                  style={styles.photoBtn}
                  disabled={avatarUploading}
                >
                  <Ionicons name="image-outline" size={16} color="#4F46E5" />
                  <Text style={styles.photoBtnText}>Upload</Text>
                </TouchableOpacity>
              </View>
              {avatarUploading && <Text style={styles.uploadingText}>Uploading photo…</Text>}
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

              {/* Primary Focus Track: current + suggestions + custom */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{isMember ? 'Main Skill' : 'Primary Focus Track'}</Text>
                {!!currentHobby && (
                  <Text style={styles.currentTrack}>
                    Current: <Text style={styles.currentTrackValue}>{currentHobby}</Text>
                  </Text>
                )}
                <View style={styles.tracksRow}>
                  {trackOptions.map((track) => {
                    const isSelected = !customMode && hobby.toLowerCase() === track.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={track}
                        activeOpacity={0.8}
                        onPress={() => {
                          setCustomMode(false);
                          setHobby(track);
                        }}
                        style={[styles.trackChip, isSelected && styles.trackChipActive]}
                      >
                        {track === currentHobby && <Ionicons name="star" size={11} color={isSelected ? '#FFFFFF' : '#F59E0B'} />}
                        <Text style={[styles.trackChipText, isSelected && styles.trackChipTextActive]}>
                          {track}{roleOfTrack(track) ? ` · ${roleOfTrack(track)}` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!isMember && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setCustomMode(true)}
                    style={[styles.trackChip, customMode && styles.trackChipActive]}
                  >
                    <Ionicons name="add" size={13} color={customMode ? '#FFFFFF' : '#4F46E5'} />
                    <Text style={[styles.trackChipText, customMode && styles.trackChipTextActive]}>Custom</Text>
                  </TouchableOpacity>
                  )}
                </View>
                {customMode && (
                  <View style={[styles.inputWrapper, { marginTop: 10 }]}>
                    <Ionicons name="create-outline" size={16} color="#4F46E5" style={styles.fieldIcon} />
                    <TextInput
                      value={customHobby}
                      onChangeText={setCustomHobby}
                      placeholder="e.g. Classical Dance, Guitar, UI Design"
                      placeholderTextColor="#94A3B8"
                      maxLength={40}
                      autoFocus
                      style={styles.textInput}
                    />
                  </View>
                )}
                <Text style={styles.trackHint}>
                  {isMember
                    ? 'Your main skill is shown first on your profile. Add more from “My skills” on your profile.'
                    : 'Your focus decides which circles we recommend.'}
                </Text>
              </View>

              {(['email', 'phone'] as const).map((f) => (
                <View key={f} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{f === 'email' ? 'Email Address' : 'Phone Number'}</Text>
                  <View style={styles.contactRow}>
                    <Ionicons name={f === 'email' ? 'mail-outline' : 'call-outline'} size={16} color="#4F46E5" />
                    <Text style={styles.contactValue} numberOfLines={1}>
                      {(f === 'email' ? user?.email : user?.phone) || 'Not set'}
                    </Text>
                    {f === 'email' && (
                      <View style={[styles.verifyBadge, !user?.emailVerified && styles.verifyBadgeWarn]}>
                        <Text style={[styles.verifyBadgeText, !user?.emailVerified && styles.verifyBadgeWarnText]}>
                          {user?.emailVerified ? 'Verified' : 'Unverified'}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => setContactField(f)} style={styles.changeBtn}>
                      <Text style={styles.changeText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
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
      <ContactChangeSheet visible={!!contactField} field={contactField ?? 'email'} onClose={() => setContactField(null)} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  currentTrack: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  currentTrackValue: { fontWeight: '800', color: '#0F172A' },
  trackHint: { fontSize: 11, color: '#94A3B8', marginTop: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  contactValue: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '600' },
  verifyBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  verifyBadgeText: { fontSize: 10, fontWeight: '800', color: '#15803D' },
  verifyBadgeWarn: { backgroundColor: '#FEF3C7' },
  verifyBadgeWarnText: { color: '#B45309' },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EEF2FF' },
  changeText: { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
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
  photoBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.full,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  uploadingText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
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
    flexWrap: 'wrap',
    gap: 8,
  },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trackChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  trackChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  trackChipTextActive: {
    color: '#FFFFFF',
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
