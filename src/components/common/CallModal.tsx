import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall } from '../../realtime/CallContext';
import { Avatar } from './Avatar';
import { typography } from '../../theme';

/**
 * Lazily resolves the native `RTCView` component. `react-native-webrtc` is a
 * native module that crashes in Expo Go on import, so we only require it at the
 * moment we actually render a live stream — which never happens in Expo Go,
 * since calls can't start there.
 */
let RTCViewCache: React.ComponentType<any> | null = null;
function getRTCView(): React.ComponentType<any> {
  if (!RTCViewCache) {
    RTCViewCache = require('react-native-webrtc').RTCView as React.ComponentType<any>;
  }
  return RTCViewCache as React.ComponentType<any>;
}

/**
 * Global call UI, driven entirely by CallContext (real WebRTC media).
 * Renders whenever there is an active call — outgoing, incoming or connected.
 */
export const CallModal: React.FC = () => {
  const { call, acceptCall, rejectCall, endCall, toggleMute, toggleVideo, toggleSpeaker, switchCamera } = useCall();
  const insets = useSafeAreaInsets();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (call?.status !== 'connected') {
      setSeconds(0);
      return;
    }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.status]);

  if (!call) return null;

  const isVideo = call.callType === 'video';
  const showRemoteVideo = isVideo && call.remoteStream && call.status === 'connected';
  const showLocalVideo = isVideo && call.localStream && !call.videoOff;
  // Only resolved when a live stream is actually being rendered (never in Expo Go).
  const RTCView = showRemoteVideo || showLocalVideo ? getRTCView() : null;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const statusText =
    call.status === 'incoming'
      ? `Incoming ${call.callType} call…`
      : call.status === 'outgoing'
      ? call.ringing
        ? 'Ringing…'
        : 'Calling…'
      : call.status === 'connecting'
      ? 'Connecting…'
      : call.status === 'connected'
      ? fmt(seconds)
      : call.endReason ?? 'Call ended';

  return (
    <Modal visible animationType="slide" onRequestClose={call.status === 'incoming' ? rejectCall : endCall}>
      <View style={styles.container}>
        {/* Remote video fills the screen; otherwise a gradient + avatar */}
        {showRemoteVideo && RTCView ? (
          <RTCView streamURL={call.remoteStream!.toURL()} style={styles.remoteVideo} objectFit="cover" zOrder={0} />
        ) : (
          <LinearGradient colors={['#312E81', '#4F46E5', '#7C3AED']} style={styles.remoteVideo} />
        )}

        {/* Local preview (PiP) */}
        {showLocalVideo && RTCView && (
          <View style={styles.localWrap}>
            {/* zOrder 1 + re-mount when the remote video appears: on Android both
                videos are native surfaces, and without this the full-screen remote
                surface can cover the self-view until it's toggled. */}
            <RTCView
              key={`local-${showRemoteVideo ? 'over-remote' : 'alone'}`}
              streamURL={call.localStream!.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror
              zOrder={1}
            />
          </View>
        )}

        {/* Top info */}
        <View style={styles.topInfo}>
          <View style={styles.callTypeChip}>
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={12} color="#FFFFFF" />
            <Text style={styles.callTypeChipText}>{isVideo ? 'VIDEO CALL' : 'VOICE CALL'}</Text>
          </View>
        </View>

        {/* Center identity (hidden when remote video is showing) */}
        {!showRemoteVideo && (
          <View style={styles.center}>
            <Avatar uri={call.peerAvatar} name={call.peerName} size={110} showRing />
            <Text style={styles.peerName}>{call.peerName}</Text>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        )}
        {showRemoteVideo && (
          <View style={styles.connectedBanner}>
            <Text style={styles.connectedName}>{call.peerName}</Text>
            <Text style={styles.connectedTimer}>{fmt(seconds)}</Text>
          </View>
        )}

        {/* Controls */}
        <View style={[styles.controls, { bottom: 48 + insets.bottom }]}>
          {call.status === 'incoming' ? (
            <View style={styles.incomingRow}>
              <TouchableOpacity onPress={rejectCall} style={[styles.roundBtn, styles.declineBtn]}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={acceptCall} style={[styles.roundBtn, styles.acceptBtn]}>
                <Ionicons name={isVideo ? 'videocam' : 'call'} size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : call.status === 'ended' ? null : (
            <View style={{ alignItems: 'center', gap: 22 }}>
              <View style={styles.activeRow}>
                <TouchableOpacity onPress={toggleSpeaker} style={[styles.ctrlBtn, call.speakerOn && styles.ctrlBtnActive]}>
                  <Ionicons name={call.speakerOn ? 'volume-high' : 'volume-medium-outline'} size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleMute} style={[styles.ctrlBtn, call.muted && styles.ctrlBtnActive]}>
                  <Ionicons name={call.muted ? 'mic-off' : 'mic'} size={22} color="#FFFFFF" />
                </TouchableOpacity>
                {isVideo && (
                  <TouchableOpacity onPress={toggleVideo} style={[styles.ctrlBtn, call.videoOff && styles.ctrlBtnActive]}>
                    <Ionicons name={call.videoOff ? 'videocam-off' : 'videocam'} size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                {isVideo && (
                  <TouchableOpacity onPress={switchCamera} style={styles.ctrlBtn}>
                    <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={endCall} style={[styles.roundBtn, styles.declineBtn]}>
                <Ionicons name="call" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  localWrap: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: '#1E293B',
  },
  localVideo: { width: '100%', height: '100%' },
  topInfo: { position: 'absolute', top: 54, left: 0, right: 0, alignItems: 'center' },
  callTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  callTypeChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  peerName: { color: '#FFFFFF', fontSize: 24, fontWeight: typography.weights.bold, marginTop: 8 },
  statusText: { color: 'rgba(255,255,255,0.85)', fontSize: 15 },
  connectedBanner: { position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' },
  connectedName: { color: '#FFFFFF', fontSize: 18, fontWeight: typography.weights.bold },
  connectedTimer: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  controls: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
  incomingRow: { flexDirection: 'row', gap: 90 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  roundBtn: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: '#16A34A' },
  declineBtn: { backgroundColor: '#EF4444' },
  ctrlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  ctrlBtnActive: { backgroundColor: 'rgba(255,255,255,0.4)' },
});
