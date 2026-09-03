import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { UserRole } from '../../types';
import { Avatar } from './Avatar';
import { CallModal } from './CallModal';
import { useApp } from '../../context/AppContext';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

export interface UserProfileData {
  id?: string;
  name: string;
  avatarUrl?: string;
  role?: UserRole;
  badge?: string;
  specialty?: string;
  rating?: number;
  critiquesGiven?: number;
  studentsMentored?: number;
  responseTime?: string;
  streakDays?: number;
  xpPoints?: number;
  completedSessions?: number;
  bio?: string;
  track?: string;
}

interface UserProfileModalProps {
  visible: boolean;
  user: UserProfileData | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  user,
  onClose,
}) => {
  const { showDialog } = useApp();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [activeCallType, setActiveCallType] = useState<'voice' | 'video' | null>(null);
  const [selectedSessionType, setSelectedSessionType] = useState('30m Technique Check');
  const [selectedSlot, setSelectedSlot] = useState('Tomorrow, 4:00 PM');
  const [messageInput, setMessageInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'them' | 'me'; text: string; time: string }>>([
    { sender: 'them', text: 'Hey there! Thanks for reaching out. How can I help with your practice?', time: '2h ago' },
  ]);

  if (!user) return null;

  const isMentor = Boolean(
    user.role === 'Mentor' || (user.name && user.name.toLowerCase().includes('mentor'))
  );

  const handleConfirmBooking = () => {
    setIsBookingOpen(false);
    showDialog({
      title: 'Session Confirmed! 📅🎉',
      message: `Your 1-on-1 mentorship session with ${user.name} is booked for ${selectedSlot}.\n\nSession: ${selectedSessionType}\nMeeting link has been sent to your calendar!`,
      icon: 'calendar',
      confirmText: 'Great!',
    });
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const newMsg = {
      sender: 'me' as const,
      text: messageInput.trim(),
      time: 'Just now',
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setMessageInput('');

    // Simulate instant mentor/member reply
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'them',
          text: isMentor
            ? 'Got your message! Upload a short practice video clip and tag me so I can give you a timestamped critique.'
            : 'Thanks for the encouragement! Keep practicing!',
          time: 'Just now',
        },
      ]);
    }, 1200);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalSheet}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.roleTagTop}>
              <Ionicons
                name={isMentor ? 'star' : 'school'}
                size={12}
                color={isMentor ? '#7C3AED' : '#4F46E5'}
              />
              <Text style={[styles.roleTagTopText, isMentor && { color: '#7C3AED' }]}>
                {isMentor ? 'Verified Mentor' : 'Community Member'}
              </Text>
            </View>

            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Identity Card */}
            <View style={styles.identityCard}>
              <View style={styles.avatarRingContainer}>
                <LinearGradient
                  colors={isMentor ? ['#7C3AED', '#EC4899'] : ['#4F46E5', '#38BDF8']}
                  style={styles.avatarGradientRing}
                >
                  <Avatar
                    uri={user.avatarUrl}
                    name={user.name}
                    size={68}
                    showRing={false}
                  />
                </LinearGradient>
                {isMentor && (
                  <View style={styles.mentorVerifiedBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
              </View>

              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userBadge}>
                {user.badge || (isMentor ? 'Certified Master Coach' : 'Vocal Explorer')}
              </Text>

              {user.specialty && (
                <View style={styles.specialtyPill}>
                  <Ionicons name="sparkles" size={11} color="#4F46E5" />
                  <Text style={styles.specialtyText}>{user.specialty}</Text>
                </View>
              )}

              <Text style={styles.bioText}>
                {user.bio ||
                  (isMentor
                    ? 'Dedicated mentor helping students overcome technique hurdles, pitch issues, and breath control.'
                    : 'Learning and sharing practice takes daily. Focusing on technique consistency!')}
              </Text>
            </View>

            {/* Member / Mentor Stats Grid */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionHeading}>
                {isMentor ? 'Mentor Impact & Reputation' : 'Member Practice Stats'}
              </Text>

              {isMentor ? (
                /* Mentor Stats: 4-Grid */
                <View style={styles.statsGrid}>
                  <View style={[styles.statTile, shadows.soft]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="star" size={16} color="#D97706" />
                    </View>
                    <Text style={styles.statBigValue}>{user.rating || 4.9} ★</Text>
                    <Text style={styles.statLabel}>Rating (180+)</Text>
                  </View>

                  <View style={[styles.statTile, shadows.soft]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#F3E8FF' }]}>
                      <Ionicons name="videocam" size={16} color="#7C3AED" />
                    </View>
                    <Text style={styles.statBigValue}>{user.critiquesGiven || 245}</Text>
                    <Text style={styles.statLabel}>Critiques Given</Text>
                  </View>

                  <View style={[styles.statTile, shadows.soft]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                      <Ionicons name="people" size={16} color="#4F46E5" />
                    </View>
                    <Text style={styles.statBigValue}>{user.studentsMentored || 85}</Text>
                    <Text style={styles.statLabel}>Students Mentored</Text>
                  </View>

                  <View style={[styles.statTile, shadows.soft]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="flash" size={16} color="#15803D" />
                    </View>
                    <Text style={[styles.statBigValue, { color: '#15803D' }]}>
                      {user.responseTime || '< 2h'}
                    </Text>
                    <Text style={styles.statLabel}>Response Speed</Text>
                  </View>
                </View>
              ) : (
                /* Learner / Member Stats: 4-Grid */
                <View style={styles.statsGrid}>
                  <View style={[styles.statTile, shadows.soft]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#FFEDD5' }]}>
                      <Ionicons name="flame" size={16} color="#EA580C" />
                    </View>
                    <Text style={[styles.statBigValue, { color: '#EA580C' }]}>
                      {user.streakDays || 6}d
                    </Text>
                    <Text style={styles.statLabel}>Practice Streak</Text>
                  </View>

                  <View style={[styles.statTile, shadows.soft]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                      <Ionicons name="sparkles" size={16} color="#4F46E5" />
                    </View>
                    <Text style={styles.statBigValue}>{user.xpPoints || 1240}</Text>
                    <Text style={styles.statLabel}>XP Points</Text>
                  </View>

                  <View style={[styles.statTile, shadows.soft]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="checkmark-done" size={16} color="#15803D" />
                    </View>
                    <Text style={styles.statBigValue}>{user.completedSessions || 18}</Text>
                    <Text style={styles.statLabel}>Sessions Logged</Text>
                  </View>

                  <View style={[styles.statTile, shadows.soft]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="trophy" size={16} color="#D97706" />
                    </View>
                    <Text style={styles.statBigValue}>5</Text>
                    <Text style={styles.statLabel}>Badges Earned</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons: 4 Equal Balanced Actions for Mentor; Message + Calls for Learner */}
            <View style={styles.actionButtonsContainer}>
              {isMentor ? (
                /* Mentor 2x2 Balanced Action Grid */
                <View style={styles.actionGridContainer}>
                  {/* Row 1: Book Session & Message */}
                  <View style={styles.actionGridRow}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setIsBookingOpen(true)}
                      style={styles.gridBtn}
                    >
                      <LinearGradient
                        colors={['#7C3AED', '#6D28D9']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gridBtnGradient}
                      >
                        <Ionicons name="calendar" size={16} color="#FFFFFF" />
                        <Text style={styles.gridBtnText}>Book Session</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setIsMessageOpen(true)}
                      style={styles.gridBtn}
                    >
                      <LinearGradient
                        colors={['#4F46E5', '#4338CA']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gridBtnGradient}
                      >
                        <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
                        <Text style={styles.gridBtnText}>Message</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {/* Row 2: Video Call & Voice Call */}
                  <View style={styles.actionGridRow}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setActiveCallType('video')}
                      style={styles.gridBtn}
                    >
                      <LinearGradient
                        colors={['#2563EB', '#1D4ED8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gridBtnGradient}
                      >
                        <Ionicons name="videocam" size={16} color="#FFFFFF" />
                        <Text style={styles.gridBtnText}>Video Call</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setActiveCallType('voice')}
                      style={styles.gridBtn}
                    >
                      <LinearGradient
                        colors={['#059669', '#047857']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gridBtnGradient}
                      >
                        <Ionicons name="call" size={15} color="#FFFFFF" />
                        <Text style={styles.gridBtnText}>Voice Call</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* Learner Actions */
                <View style={styles.actionGridContainer}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setIsMessageOpen(true)}
                    style={styles.memberMessageBtn}
                  >
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.memberMessageGradient}
                    >
                      <Ionicons name="chatbubbles" size={17} color="#FFFFFF" />
                      <Text style={styles.memberMessageText}>Send Message</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.actionGridRow}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setActiveCallType('video')}
                      style={styles.gridBtn}
                    >
                      <LinearGradient
                        colors={['#2563EB', '#1D4ED8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gridBtnGradient}
                      >
                        <Ionicons name="videocam" size={16} color="#FFFFFF" />
                        <Text style={styles.gridBtnText}>Video Call</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setActiveCallType('voice')}
                      style={styles.gridBtn}
                    >
                      <LinearGradient
                        colors={['#059669', '#047857']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gridBtnGradient}
                      >
                        <Ionicons name="call" size={15} color="#FFFFFF" />
                        <Text style={styles.gridBtnText}>Voice Call</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* ================= MODAL 1: BOOK SESSION SHEET ================= */}
          <Modal visible={isBookingOpen} animationType="slide" transparent onRequestClose={() => setIsBookingOpen(false)}>
            <View style={styles.innerBackdrop}>
              <View style={styles.innerSheet}>
                <View style={styles.dragHandle} />
                <View style={styles.innerHeaderRow}>
                  <Text style={styles.innerTitle}>Book Mentorship Session</Text>
                  <TouchableOpacity onPress={() => setIsBookingOpen(false)}>
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.innerSub}>With {user.name} ({user.specialty || 'Coach'})</Text>

                {/* Session Type */}
                <Text style={styles.innerFieldLabel}>Select Session Format</Text>
                <View style={styles.sessionTypeOptions}>
                  {[
                    { id: '30m Technique Check', duration: '30 mins', desc: 'Live pitch, posture & fault check' },
                    { id: '45m Deep Dive', duration: '45 mins', desc: 'Repertoire critique & customized drills' },
                  ].map((item) => {
                    const isSelected = selectedSessionType === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.8}
                        onPress={() => setSelectedSessionType(item.id)}
                        style={[styles.sessionTypeCard, isSelected && styles.sessionTypeCardActive]}
                      >
                        <View style={styles.sessionTypeLeft}>
                          <Text style={[styles.sessionTypeTitle, isSelected && styles.sessionTypeTitleActive]}>
                            {item.id}
                          </Text>
                          <Text style={styles.sessionTypeDesc}>{item.desc}</Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={isSelected ? '#7C3AED' : '#CBD5E1'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Date & Time Slot */}
                <Text style={styles.innerFieldLabel}>Available Time Slots</Text>
                <View style={styles.slotsRow}>
                  {['Tomorrow, 4:00 PM', 'Friday, 6:30 PM', 'Saturday, 11:00 AM'].map((slot) => {
                    const isSelected = selectedSlot === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        activeOpacity={0.8}
                        onPress={() => setSelectedSlot(slot)}
                        style={[styles.slotChip, isSelected && styles.slotChipActive]}
                      >
                        <Ionicons
                          name="time-outline"
                          size={12}
                          color={isSelected ? '#FFFFFF' : '#475569'}
                        />
                        <Text style={[styles.slotText, isSelected && styles.slotTextActive]}>
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={handleConfirmBooking}
                  style={styles.confirmBookingBtn}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#4F46E5']}
                    style={styles.confirmBookingGradient}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmBookingText}>Confirm & Reserve Session</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ================= MODAL 2: DIRECT MESSAGE CHAT SHEET ================= */}
          <Modal visible={isMessageOpen} animationType="slide" transparent onRequestClose={() => setIsMessageOpen(false)}>
            <View style={styles.innerBackdrop}>
              <View style={styles.chatSheet}>
                <View style={styles.dragHandle} />
                <View style={styles.chatHeaderRow}>
                  <View style={styles.chatUserRow}>
                    <Avatar uri={user.avatarUrl} name={user.name} size={36} showRing={isMentor} />
                    <View style={styles.chatUserMeta}>
                      <Text style={styles.chatUserName}>{user.name}</Text>
                      <Text style={styles.chatUserRole}>
                        {isMentor ? '✨ Verified Mentor • Active' : '🎓 Community Member'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity onPress={() => setIsMessageOpen(false)}>
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Chat History */}
                <ScrollView contentContainerStyle={styles.chatMessagesScroll}>
                  {chatMessages.map((msg, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.chatBubble,
                        msg.sender === 'me' ? styles.myBubble : styles.theirBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chatBubbleText,
                          msg.sender === 'me' ? styles.myBubbleText : styles.theirBubbleText,
                        ]}
                      >
                        {msg.text}
                      </Text>
                      <Text
                        style={[
                          styles.chatBubbleTime,
                          msg.sender === 'me' ? styles.myBubbleTime : styles.theirBubbleTime,
                        ]}
                      >
                        {msg.time}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Message Input Box */}
                <View style={styles.chatInputRow}>
                  <TextInput
                    value={messageInput}
                    onChangeText={setMessageInput}
                    placeholder={`Message ${user.name.split(' ')[0]}...`}
                    placeholderTextColor="#94A3B8"
                    style={styles.chatTextInput}
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleSendMessage}
                    style={styles.chatSendBtn}
                  >
                    <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* ================= MODAL 3: VIDEO / VOICE CALL SIMULATOR ================= */}
          <CallModal
            visible={!!activeCallType}
            user={user}
            callType={activeCallType || 'voice'}
            onClose={() => setActiveCallType(null)}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '88%',
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xl,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: spacing.xs,
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
  roleTagTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  roleTagTopText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.base,
  },
  identityCard: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  avatarRingContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatarGradientRing: {
    padding: 3,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorVerifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  userBadge: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  specialtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 5,
    marginTop: 6,
  },
  specialtyText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  bioText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: spacing.base,
  },
  statsSection: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 3,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statBigValue: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  actionButtonsContainer: {
    marginTop: spacing.xs,
  },
  actionGridContainer: {
    gap: 8,
  },
  actionGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridBtn: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gridBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  gridBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberMessageBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  memberMessageGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 6,
  },
  memberMessageText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  innerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  innerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.base,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    gap: spacing.sm,
  },
  innerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  innerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  innerSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  innerFieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 4,
  },
  sessionTypeOptions: {
    gap: 8,
  },
  sessionTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  sessionTypeCardActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#7C3AED',
  },
  sessionTypeLeft: {
    flex: 1,
  },
  sessionTypeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  sessionTypeTitleActive: {
    color: '#7C3AED',
  },
  sessionTypeDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  slotChipActive: {
    backgroundColor: '#7C3AED',
  },
  slotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  slotTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  confirmBookingBtn: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  confirmBookingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 6,
  },
  confirmBookingText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  chatSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    height: '80%',
    paddingTop: spacing.xs + 2,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  chatUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatUserMeta: {
    gap: 1,
  },
  chatUserName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  chatUserRole: {
    fontSize: 10,
    color: '#64748B',
  },
  chatMessagesScroll: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: 10,
  },
  chatBubble: {
    maxWidth: '80%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  myBubble: {
    backgroundColor: '#4F46E5',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  chatBubbleText: {
    fontSize: 12,
    lineHeight: 17,
  },
  myBubbleText: {
    color: '#FFFFFF',
  },
  theirBubbleText: {
    color: '#1E293B',
  },
  chatBubbleTime: {
    fontSize: 9,
    alignSelf: 'flex-end',
  },
  myBubbleTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirBubbleTime: {
    color: '#94A3B8',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 12,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  videoCallBtn: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  videoCallGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  videoCallText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  voiceCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: borderRadius.xl,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 6,
  },
  voiceCallText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
});
