import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CallModalProps {
  visible: boolean;
  user: {
    name: string;
    avatarUrl?: string;
    role?: string;
    specialty?: string;
  } | null;
  callType: 'voice' | 'video';
  onClose: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  visible,
  user,
  callType,
  onClose,
}) => {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Handle ringing simulation to connected
  useEffect(() => {
    if (!visible) {
      setCallStatus('ringing');
      setCallSeconds(0);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsSpeakerOn(true);
      return;
    }

    setCallStatus('ringing');
    setCallSeconds(0);

    const connectTimeout = setTimeout(() => {
      setCallStatus('connected');
    }, 2200);

    return () => clearTimeout(connectTimeout);
  }, [visible]);

  // Running call timer
  useEffect(() => {
    let interval: any = null;
    if (visible && callStatus === 'connected') {
      interval = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible, callStatus]);

  if (!visible || !user) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const isMentor = Boolean(
    user.role === 'Mentor' || (user.name && user.name.toLowerCase().includes('mentor'))
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleEndCall}>
      <View style={styles.container}>
        {/* Background / Video Viewport */}
        {callType === 'video' && !isVideoOff ? (
          <View style={styles.videoViewport}>
            <Image
              source={{
                uri:
                  user.avatarUrl ||
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
              }}
              style={styles.fullVideoBg}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(15, 23, 42, 0.7)', 'transparent', 'rgba(15, 23, 42, 0.9)']}
              style={styles.videoGradientOverlay}
            />

            {/* Self Picture-in-Picture window */}
            <View style={[styles.selfPipBox, shadows.card]}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
                }}
                style={styles.selfPipImg}
              />
              <View style={styles.pipLabelBadge}>
                <Text style={styles.pipLabelText}>You</Text>
              </View>
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={isMentor ? ['#1E1B4B', '#0F172A'] : ['#0F172A', '#1E293B']}
            style={styles.voiceBackground}
          />
        )}

        {/* Top Floating Status Bar */}
        <View style={styles.topStatusSection}>
          <View style={styles.callTypeChip}>
            <Ionicons
              name={callType === 'video' ? 'videocam' : 'call'}
              size={12}
              color="#FFFFFF"
            />
            <Text style={styles.callTypeChipText}>
              {callType === 'video' ? 'HD VIDEO CALL' : 'VOICE CALL'}
            </Text>
          </View>

          <Text style={styles.participantName}>{user.name}</Text>
          <Text style={styles.participantRole}>
            {user.specialty || (isMentor ? 'Verified Mentor' : 'Community Member')}
          </Text>

          {/* Status / Running Duration */}
          <View style={styles.statusRow}>
            {callStatus === 'ringing' ? (
              <View style={styles.ringingRow}>
                <View style={styles.pulsingDot} />
                <Text style={styles.statusText}>Ringing...</Text>
              </View>
            ) : callStatus === 'connected' ? (
              <View style={styles.connectedRow}>
                <View style={styles.greenActiveDot} />
                <Text style={styles.timerText}>{formatTimer(callSeconds)}</Text>
              </View>
            ) : (
              <Text style={styles.endedText}>Call Ended</Text>
            )}
          </View>
        </View>

        {/* Center Calling Avatar / Waveform (Always in voice mode or when video is off) */}
        {(callType === 'voice' || isVideoOff) && (
          <View style={styles.centerAvatarContainer}>
            <View style={styles.outerAvatarHalo}>
              <View style={styles.innerAvatarHalo}>
                <Avatar
                  uri={user.avatarUrl}
                  name={user.name}
                  size={110}
                  showRing={isMentor}
                />
              </View>
            </View>

            {/* Audio Waveform Bars Simulation */}
            <View style={styles.waveformContainer}>
              {[8, 16, 26, 38, 20, 32, 14, 28, 36, 18, 24, 12].map((height, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.waveformBar,
                    {
                      height: callStatus === 'connected' ? height : 6,
                      backgroundColor: isMuted ? '#64748B' : '#38BDF8',
                    },
                  ]}
                />
              ))}
            </View>

            {isMuted && (
              <View style={styles.mutedBadge}>
                <Ionicons name="mic-off" size={12} color="#EF4444" />
                <Text style={styles.mutedBadgeText}>Your Microphone is Muted</Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom Call Controls Deck */}
        <View style={styles.bottomControlsDeck}>
          {/* Mute Button */}
          <View style={styles.controlItemWrapper}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsMuted(!isMuted)}
              style={[styles.controlCircleBtn, isMuted && styles.controlCircleBtnMuted]}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </View>

          {/* Camera Button */}
          <View style={styles.controlItemWrapper}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (callType === 'video') {
                  setIsVideoOff(!isVideoOff);
                } else {
                  setIsVideoOff((prev) => !prev);
                }
              }}
              style={[styles.controlCircleBtn, isVideoOff && styles.controlCircleBtnOff]}
            >
              <Ionicons
                name={isVideoOff ? 'videocam-off' : 'videocam'}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>
              {isVideoOff ? 'Cam Off' : 'Camera'}
            </Text>
          </View>

          {/* Speaker Button: Clean frosted circle matching Mute & Camera */}
          <View style={styles.controlItemWrapper}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsSpeakerOn(!isSpeakerOn)}
              style={[styles.controlCircleBtn, isSpeakerOn && styles.controlCircleBtnSpeakerOn]}
            >
              <Ionicons
                name={isSpeakerOn ? 'volume-high' : 'volume-mute'}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
          </View>

          {/* End Call Button */}
          <View style={styles.controlItemWrapper}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleEndCall}
              style={styles.endCallGradientWrapper}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.endCallCircle}
              >
                <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.endCallLabel}>End</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
  },
  videoViewport: {
    ...StyleSheet.absoluteFillObject,
  },
  fullVideoBg: {
    width: '100%',
    height: '100%',
  },
  videoGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  voiceBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  selfPipBox: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 50,
    right: 18,
    width: 100,
    height: 140,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#1E293B',
  },
  selfPipImg: {
    width: '100%',
    height: '100%',
  },
  pipLabelBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pipLabelText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  topStatusSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 65 : 45,
    paddingHorizontal: spacing.base,
    zIndex: 10,
  },
  callTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 6,
    marginBottom: 12,
  },
  callTypeChipText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  participantName: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  participantRole: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 2,
  },
  statusRow: {
    marginTop: 8,
  },
  ringingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontSize: 13,
    color: '#FDE68A',
    fontWeight: '600',
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  greenActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  timerText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  endedText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  centerAvatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  outerAvatarHalo: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerAvatarHalo: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 44,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  mutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    gap: 6,
  },
  mutedBadgeText: {
    fontSize: 11,
    color: '#FCA5A5',
    fontWeight: '600',
  },
  bottomControlsDeck: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.base,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingTop: spacing.md,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },
  controlItemWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  controlCircleBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  controlCircleBtnMuted: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  controlCircleBtnOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.65)',
    borderColor: '#EF4444',
  },
  controlCircleBtnSpeakerOn: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  controlLabel: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  endCallGradientWrapper: {
    alignItems: 'center',
  },
  endCallCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  endCallLabel: {
    fontSize: 11,
    color: '#FCA5A5',
    fontWeight: 'bold',
  },
});
