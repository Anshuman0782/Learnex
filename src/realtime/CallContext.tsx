import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
// Type-only import: erased at build time, so it never triggers a runtime
// require of the native module (which would crash in Expo Go).
import type { MediaStream, RTCPeerConnection } from 'react-native-webrtc';
import { getSocket, onSocketChange } from './socket';
import { getIceServersRequest } from '../api/calls.api';
import { FEATURES } from '../config/features';
import { dismissCallNotification, type PushData } from './push';

/**
 * Native modules are loaded lazily, at call time, and never inside Expo Go
 * (they only exist in a development / production build).
 */
type WebRTC = typeof import('react-native-webrtc');
let webrtcMod: WebRTC | null = null;
async function loadWebRTC(): Promise<WebRTC> {
  if (!webrtcMod) webrtcMod = await import('react-native-webrtc');
  return webrtcMod;
}
type InCall = {
  start: (o?: { media?: 'audio' | 'video'; auto?: boolean; ringback?: string }) => void;
  stop: (o?: { busytone?: string }) => void;
  startRingtone: (ringtone: string, vibrate?: number[], iosCategory?: string, seconds?: number) => void;
  stopRingtone: () => void;
  stopRingback: () => void;
  setForceSpeakerphoneOn: (on: boolean | null) => void;
  setKeepScreenOn: (on: boolean) => void;
};
let inCallMod: InCall | null = null;
function inCall(): InCall | null {
  if (!FEATURES.calls) return null;
  try {
    if (!inCallMod) inCallMod = require('react-native-incall-manager').default as InCall;
    return inCallMod;
  } catch {
    return null;
  }
}
const safe = (fn: () => void) => {
  try {
    fn();
  } catch {
    /* audio routing is best-effort */
  }
};

export type CallStatus = 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended';
export type CallType = 'voice' | 'video';

export interface CallState {
  callId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  callType: CallType;
  status: CallStatus;
  /** Outgoing: the callee's phone is reachable and ringing. */
  ringing: boolean;
  /** Why the call ended (shown briefly before the screen closes). */
  endReason?: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  videoOff: boolean;
  speakerOn: boolean;
}

interface CallContextType {
  call: CallState | null;
  startCall: (peerId: string, peerName: string, callType: CallType, peerAvatar?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  switchCamera: () => void;
  /** A call notification (or its Answer / Decline button) was tapped. */
  handleCallPush: (data: PushData, action: string) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const randomId = () => `call-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const REFUSED: Record<string, string> = {
  not_mutual: 'You can only call people who follow you back.',
  busy: 'is on another call.',
  busy_self: 'You are already in a call.',
  unavailable: 'This account is no longer available.',
  slow_down: 'Please wait a moment before calling again.',
  invalid: 'Could not start the call.',
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [call, setCall] = useState<CallState | null>(null);
  const [socketTick, setSocketTick] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const callRef = useRef<CallState | null>(null);
  callRef.current = call;
  // Answer / Decline tapped on a push before the ring reached the socket.
  const pushIntentRef = useRef<{ callId: string; action: 'answer' | 'decline'; at: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = (p: Partial<CallState>) => setCall((prev) => (prev ? { ...prev, ...p } : prev));
  const emit = (event: string, body: unknown) => getSocket()?.emit(event, body);

  const stopSounds = () => {
    const m = inCall();
    if (!m) return;
    safe(() => m.stopRingtone());
    safe(() => m.stopRingback());
  };

  const cleanup = () => {
    stopSounds();
    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    localRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current = null;
    localRef.current = null;
    pendingCandidatesRef.current = [];
    const m = inCall();
    if (m) {
      safe(() => m.setKeepScreenOn(false));
      safe(() => m.stop());
    }
  };

  /** Ends locally, shows `reason` briefly, then closes the call screen. */
  const finish = (reason: string) => {
    const id = callRef.current?.callId;
    cleanup();
    if (id) void dismissCallNotification(id);
    setCall((prev) => (prev ? { ...prev, status: 'ended', endReason: reason, localStream: null, remoteStream: null } : prev));
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setCall(null), 1600);
  };

  const buildPeer = async (peerId: string, callId: string): Promise<RTCPeerConnection> => {
    const rtc = await loadWebRTC();
    let iceServers: any[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    try {
      iceServers = (await getIceServersRequest()).iceServers as any[];
    } catch {
      /* fall back to default STUN */
    }
    const pc = new rtc.RTCPeerConnection({ iceServers });
    (pc as any).onicecandidate = (e: any) => {
      if (e.candidate) emit('call:signal', { callId, data: { type: 'ice', candidate: e.candidate } });
    };
    (pc as any).ontrack = (e: any) => {
      if (e.streams && e.streams[0]) patch({ remoteStream: e.streams[0] });
    };
    (pc as any).onconnectionstatechange = () => {
      const s = (pc as any).connectionState;
      if (s === 'connected') patch({ status: 'connected' });
      if ((s === 'failed' || s === 'closed') && callRef.current?.callId === callId) {
        emit('call:end', { callId });
        finish(s === 'failed' ? 'Connection lost' : 'Call ended');
      }
    };
    return pc;
  };

  const getLocalStream = async (callType: CallType): Promise<MediaStream> => {
    const rtc = await loadWebRTC();
    const stream = await rtc.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video' ? { facingMode: 'user' } : false,
    });
    localRef.current = stream;
    return stream;
  };

  const flushCandidates = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const rtc = await loadWebRTC();
    for (const cand of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new rtc.RTCIceCandidate(cand));
      } catch {
        /* ignore bad candidate */
      }
    }
    pendingCandidatesRef.current = [];
  };

  const startAudioRoute = (callType: CallType) => {
    const m = inCall();
    if (!m) return;
    safe(() => m.start({ media: callType === 'video' ? 'video' : 'audio', auto: true }));
    safe(() => m.setForceSpeakerphoneOn(callType === 'video'));
    safe(() => m.setKeepScreenOn(true));
  };

  // ---------- outgoing ----------
  const startCall = async (peerId: string, peerName: string, callType: CallType, peerAvatar?: string) => {
    if (!FEATURES.calls) {
      Alert.alert('Calls need the app build', 'Voice and video calls work in the installed LERNEX app, not in Expo Go.');
      return;
    }
    if (callRef.current) return;
    const sock = getSocket();
    if (!sock?.connected) {
      Alert.alert('No connection', 'Check your internet connection and try again.');
      return;
    }
    const callId = randomId();
    setCall({
      callId,
      peerId,
      peerName,
      peerAvatar,
      callType,
      status: 'outgoing',
      ringing: false,
      localStream: null,
      remoteStream: null,
      muted: false,
      videoOff: false,
      speakerOn: callType === 'video',
    });
    try {
      // Ask for mic/camera first so the permission prompt doesn't interrupt the call.
      const stream = await getLocalStream(callType);
      patch({ localStream: stream });
    } catch {
      Alert.alert('Permission needed', 'Allow microphone' + (callType === 'video' ? ' and camera' : '') + ' access to make calls.');
      cleanup();
      setCall(null);
      return;
    }
    sock.emit('call:invite', { toUserId: peerId, callId, callType }, (r: { ok: boolean; reason?: string; calleeOnline?: boolean }) => {
      if (callRef.current?.callId !== callId) return;
      if (!r?.ok) {
        const reason = r?.reason ?? 'invalid';
        const msg = reason === 'busy' ? `${peerName} ${REFUSED.busy}` : REFUSED[reason] ?? REFUSED.invalid;
        finish(msg);
        return;
      }
      patch({ ringing: true });
      const m = inCall();
      if (m) safe(() => m.start({ media: callType === 'video' ? 'video' : 'audio', ringback: '_DTMF_' }));
    });
  };

  /** Caller: the callee answered → create and send the offer. */
  const onAccepted = async (callId: string) => {
    const c = callRef.current;
    if (!c || c.callId !== callId || c.status !== 'outgoing') return;
    stopSounds();
    patch({ status: 'connecting' });
    try {
      const pc = await buildPeer(c.peerId, callId);
      pcRef.current = pc;
      const stream = localRef.current ?? (await getLocalStream(c.callType));
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      emit('call:signal', { callId, data: { type: 'offer', sdp: pc.localDescription } });
      startAudioRoute(c.callType);
    } catch {
      emit('call:end', { callId });
      finish('Could not connect');
    }
  };

  // ---------- incoming ----------
  const acceptCall = async () => {
    const c = callRef.current;
    if (!c || c.status !== 'incoming') return;
    stopSounds();
    void dismissCallNotification(c.callId);
    patch({ status: 'connecting' });
    try {
      const stream = await getLocalStream(c.callType);
      patch({ localStream: stream });
      const pc = await buildPeer(c.peerId, c.callId);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      emit('call:accept', { callId: c.callId }); // caller now sends the offer
      startAudioRoute(c.callType);
    } catch {
      emit('call:reject', { callId: c.callId });
      finish('Microphone / camera permission is needed');
    }
  };

  const rejectCall = () => {
    const c = callRef.current;
    if (!c) return;
    emit('call:reject', { callId: c.callId });
    void dismissCallNotification(c.callId);
    cleanup();
    setCall(null);
  };

  const endCall = () => {
    const c = callRef.current;
    if (!c) return;
    if (c.status === 'incoming') return rejectCall();
    emit('call:end', { callId: c.callId });
    finish(c.status === 'outgoing' ? 'Cancelled' : 'Call ended');
  };

  const toggleMute = () => {
    const track = localRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      patch({ muted: !track.enabled });
    }
  };
  const toggleVideo = () => {
    const track = localRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      patch({ videoOff: !track.enabled });
    }
  };
  const toggleSpeaker = () => {
    const next = !callRef.current?.speakerOn;
    const m = inCall();
    if (m) safe(() => m.setForceSpeakerphoneOn(next));
    patch({ speakerOn: next });
  };
  const switchCamera = () => {
    const track: any = localRef.current?.getVideoTracks()[0];
    if (track && typeof track._switchCamera === 'function') safe(() => track._switchCamera());
  };

  /** Push tapped: Answer / Decline (or plain tap → show the ringing screen). */
  const handleCallPush = (data: PushData, action: string) => {
    if (!data.callId) return;
    const c = callRef.current;
    const intent = action === 'decline' ? 'decline' : action === 'answer' ? 'answer' : null;
    if (c && c.callId === data.callId && c.status === 'incoming') {
      if (intent === 'decline') rejectCall();
      else if (intent === 'answer') void acceptCall();
      return;
    }
    // The ring hasn't reached this device yet (app was closed): remember the
    // choice; it's applied when the server re-delivers the ring on connect.
    if (intent) pushIntentRef.current = { callId: data.callId, action: intent, at: Date.now() };
  };

  // Re-run the listener effect whenever the socket instance changes.
  useEffect(() => onSocketChange(() => setSocketTick((t) => t + 1)), []);

  // ---------- socket signaling ----------
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;

    const onIncoming = (d: { callId: string; callType: CallType; fromUserId: string; fromName: string; fromAvatar?: string }) => {
      const cur = callRef.current;
      if (cur && cur.callId === d.callId) return; // re-delivery of the same ring
      if (cur && cur.status !== 'ended') return; // already busy (server also guards)
      if (!FEATURES.calls) return;
      const next: CallState = {
        callId: d.callId,
        peerId: d.fromUserId,
        peerName: d.fromName,
        peerAvatar: d.fromAvatar,
        callType: d.callType,
        status: 'incoming',
        ringing: false,
        localStream: null,
        remoteStream: null,
        muted: false,
        videoOff: false,
        speakerOn: d.callType === 'video',
      };
      callRef.current = next; // visible to accept/reject immediately
      setCall(next);
      const intent = pushIntentRef.current;
      pushIntentRef.current = null;
      if (intent && intent.callId === d.callId && Date.now() - intent.at < 60_000) {
        // Decided from the notification already.
        if (intent.action === 'answer') void acceptCall();
        else rejectCall();
        return;
      }
      const m = inCall();
      if (m) safe(() => m.startRingtone('_DEFAULT_', [0, 800, 600], 'playback', 40));
    };

    const onSignal = async (d: { callId: string; data: any }) => {
      const c = callRef.current;
      if (!c || c.callId !== d.callId) return;
      const { data } = d;
      const rtc = await loadWebRTC();
      const pc = pcRef.current;
      if (data.type === 'offer' && pc) {
        // Callee: answer the caller's offer.
        await pc.setRemoteDescription(new rtc.RTCSessionDescription(data.sdp));
        await flushCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit('call:signal', { callId: c.callId, data: { type: 'answer', sdp: pc.localDescription } });
      } else if (data.type === 'answer' && pc) {
        await pc.setRemoteDescription(new rtc.RTCSessionDescription(data.sdp));
        await flushCandidates();
      } else if (data.type === 'ice') {
        if (pc && (pc as any).remoteDescription) {
          try {
            await pc.addIceCandidate(new rtc.RTCIceCandidate(data.candidate));
          } catch {
            /* ignore */
          }
        } else {
          pendingCandidatesRef.current.push(data.candidate);
        }
      }
    };

    const matches = (d: { callId: string }) => callRef.current?.callId === d.callId;
    const accepted = (d: { callId: string }) => void onAccepted(d.callId);
    const rejected = (d: { callId: string }) => matches(d) && finish('Declined');
    const unanswered = (d: { callId: string }) => matches(d) && finish('No answer');
    const ended = (d: { callId: string }) => matches(d) && finish('Call ended');
    const cancelled = (d: { callId: string }) => {
      void dismissCallNotification(d.callId);
      if (matches(d)) finish('Missed call');
    };
    const handled = (d: { callId: string }) => {
      void dismissCallNotification(d.callId);
      if (matches(d) && callRef.current?.status === 'incoming') {
        cleanup();
        setCall(null); // answered / declined on another of my devices
      }
    };

    sock.on('call:incoming', onIncoming);
    sock.on('call:signal', onSignal);
    sock.on('call:accepted', accepted);
    sock.on('call:rejected', rejected);
    sock.on('call:unanswered', unanswered);
    sock.on('call:ended', ended);
    sock.on('call:cancelled', cancelled);
    sock.on('call:handled', handled);

    return () => {
      sock.off('call:incoming', onIncoming);
      sock.off('call:signal', onSignal);
      sock.off('call:accepted', accepted);
      sock.off('call:rejected', rejected);
      sock.off('call:unanswered', unanswered);
      sock.off('call:ended', ended);
      sock.off('call:cancelled', cancelled);
      sock.off('call:handled', handled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketTick]);

  // Never leave the mic/camera/ringtone running if the provider unmounts.
  useEffect(() => () => cleanup(), []);

  return (
    <CallContext.Provider
      value={{
        call,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleSpeaker,
        switchCamera,
        handleCallPush,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = (): CallContextType => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
};
