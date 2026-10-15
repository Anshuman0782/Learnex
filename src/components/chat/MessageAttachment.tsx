import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Modal, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatAttachment } from '../../api/chat.api';

const MEDIA_W = 220;

/** "1.2 MB", "820 KB". */
export function formatBytes(n?: number): string {
  if (!n) return '';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** "0:42", "12:05". */
export function formatDuration(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return '0:00';
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A still frame for a Cloudinary video (first second), or null elsewhere. */
function videoPoster(url: string): string | null {
  if (!url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return null;
  return url.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[A-Za-z0-9]{2,5}$/, '.jpg');
}

const FILE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: 'document-text',
  doc: 'document',
  docx: 'document',
  xls: 'grid',
  xlsx: 'grid',
  csv: 'grid',
  ppt: 'easel',
  pptx: 'easel',
  zip: 'archive',
  txt: 'reader',
};

export interface AudioState {
  id: string;
  playing: boolean;
  pos: number;
  dur: number;
}

interface Props {
  messageId: string;
  attachment: ChatAttachment;
  mine: boolean;
  pending?: boolean;
  audio: AudioState | null;
  onToggleAudio: () => void;
  onOpenMedia: (a: ChatAttachment) => void;
  onOpenFile: (a: ChatAttachment) => void;
}

/** Renders a chat attachment inside its bubble: photo, video, audio or document. */
export const MessageAttachment: React.FC<Props> = ({
  messageId,
  attachment: a,
  mine,
  pending,
  audio,
  onToggleAudio,
  onOpenMedia,
  onOpenFile,
}) => {
  const [loaded, setLoaded] = useState(false);
  const fg = mine ? '#FFFFFF' : '#0F172A';
  const sub = mine ? 'rgba(255,255,255,0.75)' : '#64748B';

  if (a.type === 'image') {
    return (
      <TouchableOpacity activeOpacity={0.9} disabled={pending} onPress={() => onOpenMedia(a)} style={styles.media}>
        <Image source={{ uri: a.url }} style={styles.media} resizeMode="cover" onLoad={() => setLoaded(true)} />
        {(!loaded || pending) && (
          <View style={styles.mediaOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (a.type === 'video') {
    const poster = pending ? null : videoPoster(a.url);
    return (
      <TouchableOpacity activeOpacity={0.9} disabled={pending} onPress={() => onOpenMedia(a)} style={[styles.media, styles.videoBox]}>
        {!!poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        <View style={styles.playCircle}>
          {pending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />}
        </View>
        {!!a.durationMs && (
          <View style={styles.durationPill}>
            <Ionicons name="videocam" size={11} color="#FFFFFF" />
            <Text style={styles.durationText}>{formatDuration(a.durationMs / 1000)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (a.type === 'audio') {
    const active = audio?.id === messageId;
    const dur = active && audio!.dur > 0 ? audio!.dur : (a.durationMs ?? 0) / 1000;
    const pct = active && dur > 0 ? Math.min(1, audio!.pos / dur) : 0;
    return (
      <View style={styles.audioRow}>
        <TouchableOpacity
          disabled={pending}
          onPress={onToggleAudio}
          style={[styles.audioBtn, { backgroundColor: mine ? 'rgba(255,255,255,0.2)' : '#EEF2FF' }]}
          accessibilityLabel={active && audio!.playing ? 'Pause audio' : 'Play audio'}
        >
          {pending ? (
            <ActivityIndicator size="small" color={mine ? '#FFFFFF' : '#4F46E5'} />
          ) : (
            <Ionicons name={active && audio!.playing ? 'pause' : 'play'} size={18} color={mine ? '#FFFFFF' : '#4F46E5'} />
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={[styles.track, { backgroundColor: mine ? 'rgba(255,255,255,0.3)' : '#E2E8F0' }]}>
            <View style={[styles.trackFill, { width: `${pct * 100}%`, backgroundColor: mine ? '#FFFFFF' : '#4F46E5' }]} />
          </View>
          <Text style={[styles.audioTime, { color: sub }]}>
            {active && audio!.pos > 0 ? `${formatDuration(audio!.pos)} / ` : ''}
            {formatDuration(dur)}
          </Text>
        </View>
      </View>
    );
  }

  // Document
  const ext = (a.name?.split('.').pop() || '').toLowerCase();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={pending}
      onPress={() => onOpenFile(a)}
      style={[styles.fileRow, { backgroundColor: mine ? 'rgba(255,255,255,0.15)' : '#F1F5F9' }]}
    >
      <View style={[styles.fileIcon, { backgroundColor: mine ? 'rgba(255,255,255,0.25)' : '#E0E7FF' }]}>
        {pending ? (
          <ActivityIndicator size="small" color={mine ? '#FFFFFF' : '#4F46E5'} />
        ) : (
          <Ionicons name={FILE_ICON[ext] ?? 'document'} size={20} color={mine ? '#FFFFFF' : '#4F46E5'} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fileName, { color: fg }]} numberOfLines={2}>{a.name || 'Document'}</Text>
        <Text style={[styles.fileMeta, { color: sub }]}>
          {[ext.toUpperCase(), formatBytes(a.size)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {!pending && <Ionicons name="download-outline" size={18} color={sub} />}
    </TouchableOpacity>
  );
};

/** Full-screen photo / video viewer for chat attachments. */
export const ChatMediaViewer: React.FC<{ media: ChatAttachment | null; onClose: () => void }> = ({ media, onClose }) => (
  <Modal visible={!!media} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    {media && <ViewerBody media={media} onClose={onClose} />}
  </Modal>
);

const ViewerBody: React.FC<{ media: ChatAttachment; onClose: () => void }> = ({ media, onClose }) => {
  const insets = useSafeAreaInsets();
  const isVideo = media.type === 'video';
  // Only create a player when showing a video (mounted per open).
  const player = useVideoPlayer(isVideo ? media.url : null, (p) => {
    p.loop = false;
    if (isVideo) p.play();
  });
  return (
    <View style={styles.viewer}>
      <StatusBar barStyle="light-content" />
      {isVideo ? (
        <VideoView player={player} style={styles.viewerMedia} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
      ) : (
        <Image source={{ uri: media.url }} style={styles.viewerMedia} resizeMode="contain" />
      )}
      <TouchableOpacity onPress={onClose} style={[styles.viewerClose, { top: insets.top + 10 }]} accessibilityLabel="Close">
        <Ionicons name="close" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  media: { width: MEDIA_W, height: MEDIA_W * 1.15, borderRadius: 14, backgroundColor: '#CBD5E1', overflow: 'hidden' },
  mediaOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.25)' },
  videoBox: { height: MEDIA_W * 0.75, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center' },
  durationPill: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  durationText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 220, paddingVertical: 4 },
  audioBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2 },
  audioTime: { fontSize: 11, marginTop: 5 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 230, padding: 8, borderRadius: 12 },
  fileIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13, fontWeight: '700' },
  fileMeta: { fontSize: 11, marginTop: 2 },
  viewer: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  viewerMedia: { width: '100%', height: '100%' },
  viewerClose: {
    position: 'absolute',
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
