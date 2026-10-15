import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Keyboard,
  Linking,
} from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { uploadFileRequest } from '../../api/media.api';
import {
  CHAT_LIMIT_BYTES,
  captureChatMedia,
  pickChatAudio,
  pickChatDocument,
  pickChatMedia,
  type AttachmentResult,
  type PickedAttachment,
} from '../../services/imagePicker';
import { EmojiPanel } from './EmojiPanel';
import { AttachmentSheet, type AttachmentSource } from './AttachmentSheet';
import { ChatMediaViewer, MessageAttachment, formatBytes, type AudioState } from './MessageAttachment';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useComposerBottomPadding } from '../common/KeyboardSafe';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, type ChatPeer } from '../../context/AppContext';
import { getSocket } from '../../realtime/socket';
import { useCall } from '../../realtime/CallContext';
import { FEATURES } from '../../config/features';
import { Avatar } from '../common/Avatar';
import {
  getConversationsRequest,
  getMessagesRequest,
  markConversationReadRequest,
  openConversationRequest,
  sendMessageRequest,
  messagePreview,
  type ChatAttachment,
  type ChatMessage,
  type Conversation,
} from '../../api/chat.api';
import { searchUsersRequest, type FollowUserRow } from '../../api/social.api';

const ACCENT = '#4F46E5';

/** "10:42 PM" today, "Yesterday", "Mon", or "28 Sep". */
function listTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * Real 1:1 chat: inbox + conversation in one modal. Messages are stored on the
 * server and delivered live over the socket, with read receipts ("Seen").
 */
export const ChatModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const composerPad = useComposerBottomPadding(10);
  const { user, chatView, closeChat, openChatWith, openChatInbox, setActiveChatConversation, refreshChatUnread } =
    useApp();
  const myId = user?.id;
  const visible = !!chatView;

  // ---- inbox ----
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FollowUserRow[]>([]);
  const [searching, setSearching] = useState(false);

  // ---- thread ----
  const [conv, setConv] = useState<Conversation | null>(null);
  const { startCall } = useCall();
  const { openUserProfile, closeAudioPost } = useApp();
  const [peer, setPeer] = useState<ChatPeer | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // newest first (inverted list)
  const [hasMore, setHasMore] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const convIdRef = useRef<string | null>(null);

  // ---- composer extras: emoji keyboard, attachments, viewer, audio ----
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<ChatAttachment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  // Files being sent, by temp message id (kept for "tap to retry").
  const pendingFiles = useRef(new Map<string, PickedAttachment>());
  const uploadedFiles = useRef(new Map<string, ChatAttachment>());

  // One chat audio player at a time (and never alongside a feed audio post).
  const audioRef = useRef<AudioPlayer | null>(null);
  const audioSubRef = useRef<{ remove: () => void } | null>(null);
  const [audioState, setAudioState] = useState<AudioState | null>(null);

  const stopChatAudio = () => {
    audioSubRef.current?.remove();
    audioSubRef.current = null;
    const p = audioRef.current;
    audioRef.current = null;
    if (p) {
      try {
        p.pause();
      } catch {
        /* ignore */
      }
      try {
        p.remove();
      } catch {
        /* ignore */
      }
    }
    setAudioState(null);
  };

  const toggleAudio = (m: ChatMessage) => {
    const url = m.attachment?.url;
    if (!url) return;
    const current = audioRef.current;
    if (current && audioState?.id === m.id) {
      try {
        if (current.playing) current.pause();
        else {
          if (audioState.dur > 0 && audioState.pos >= audioState.dur - 0.3) void current.seekTo(0);
          current.play();
        }
      } catch {
        /* ignore */
      }
      return;
    }
    stopChatAudio();
    closeAudioPost();
    try {
      void setAudioModeAsync({ playsInSilentMode: true });
      const p = createAudioPlayer({ uri: url }, { updateInterval: 200 });
      audioRef.current = p;
      audioSubRef.current = p.addListener('playbackStatusUpdate', (st) => {
        if (audioRef.current !== p) return;
        if (st.didJustFinish) {
          try {
            p.pause();
            void p.seekTo(0);
          } catch {
            /* ignore */
          }
          setAudioState({ id: m.id, playing: false, pos: 0, dur: st.duration });
          return;
        }
        setAudioState({ id: m.id, playing: st.playing, pos: st.currentTime, dur: st.duration });
      });
      p.play();
      setAudioState({ id: m.id, playing: true, pos: 0, dur: (m.attachment?.durationMs ?? 0) / 1000 });
    } catch {
      stopChatAudio();
    }
  };

  // Stop chat audio whenever the chat closes or switches conversation.
  useEffect(() => {
    return () => stopChatAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatView]);

  const openFile = (a: ChatAttachment) => {
    Linking.openURL(a.url).catch(() => Alert.alert('Can’t open file', 'No app on this phone can open this file.'));
  };

  // Emoji keyboard: insert at the cursor / delete the character before it.
  const insertEmoji = (e: string) => {
    const { start, end } = selectionRef.current;
    const s = Math.min(start, text.length);
    const en = Math.min(Math.max(end, s), text.length);
    const next = text.slice(0, s) + e + text.slice(en);
    if (next.length > 2000) return;
    setText(next);
    selectionRef.current = { start: s + e.length, end: s + e.length };
  };
  const backspace = () => {
    const { start, end } = selectionRef.current;
    const s = Math.min(start, text.length);
    const en = Math.min(Math.max(end, s), text.length);
    if (s !== en) {
      setText(text.slice(0, s) + text.slice(en));
      selectionRef.current = { start: s, end: s };
      return;
    }
    if (s === 0) return;
    // Remove one whole symbol (emoji incl. joiners / variation selectors).
    const before = Array.from(text.slice(0, s));
    const isMod = (c: string) => /[\ufe0f\u{1F3FB}-\u{1F3FF}]/u.test(c);
    const popSymbol = () => {
      while (before.length && isMod(before[before.length - 1])) before.pop();
      before.pop();
    };
    popSymbol();
    // Joined emojis (e.g. a technologist) are several symbols glued with a zero-width joiner.
    while (before.length && before[before.length - 1] === '\u200d') {
      before.pop();
      popSymbol();
    }
    const head = before.join('');
    setText(head + text.slice(s));
    selectionRef.current = { start: head.length, end: head.length };
  };

  const toggleEmoji = () => {
    setShowAttach(false);
    if (showEmoji) {
      setShowEmoji(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      setShowEmoji(true);
    }
  };

  const pickAttachment = async (source: AttachmentSource) => {
    let res: AttachmentResult;
    try {
      res =
        source === 'gallery'
          ? await pickChatMedia()
          : source === 'camera'
          ? await captureChatMedia()
          : source === 'document'
          ? await pickChatDocument()
          : await pickChatAudio();
    } catch {
      Alert.alert('Attachment', 'Could not open that file. Please try again.');
      return;
    }
    if (res.status === 'denied') {
      Alert.alert('Access needed', 'Please allow LERNEX to use your camera / photos in your phone settings.');
      return;
    }
    if (res.status === 'error') {
      Alert.alert('Attachment', res.message);
      return;
    }
    if (res.status !== 'ok') return;
    const f = res.file;
    if (f.size && f.size > CHAT_LIMIT_BYTES[f.type]) {
      Alert.alert('File too large', `${f.type === 'file' ? 'Documents' : f.type === 'image' ? 'Photos' : f.type === 'video' ? 'Videos' : 'Audio files'} can be up to ${formatBytes(CHAT_LIMIT_BYTES[f.type])}.`);
      return;
    }
    void send({ file: f });
  };

  const loadInbox = useCallback(async () => {
    try {
      setConversations(await getConversationsRequest());
    } catch {
      /* keep what we have */
    }
  }, []);

  // React to open/close and inbox ↔ thread switches.
  useEffect(() => {
    if (!chatView) {
      convIdRef.current = null;
      setActiveChatConversation(null);
      setConv(null);
      setMessages([]);
      setText('');
      setShowEmoji(false);
      setShowAttach(false);
      setSearchMode(false);
      setQuery('');
      return;
    }
    if (chatView.mode === 'inbox') {
      convIdRef.current = null;
      setActiveChatConversation(null);
      setConv(null);
      setPeer(null);
      setInboxLoading(true);
      loadInbox().finally(() => setInboxLoading(false));
      return;
    }

    // Thread with a specific person.
    const target = chatView.peer;
    setPeer(target);
    setConv(null);
    setMessages([]);
    setHasMore(false);
    setThreadLoading(true);
    let active = true;
    (async () => {
      try {
        const c = await openConversationRequest(target.id);
        if (!active) return;
        setConv(c);
        convIdRef.current = c.id;
        setActiveChatConversation(c.id);
        const page = await getMessagesRequest(c.id);
        if (!active) return;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        if (c.unreadCount > 0) {
          await markConversationReadRequest(c.id).catch(() => {});
          refreshChatUnread();
        }
      } catch (e) {
        if (active) Alert.alert('Chat', (e as Error)?.message || 'Could not open this conversation.');
      } finally {
        if (active) setThreadLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatView]);

  // Live updates while the chat is open.
  useEffect(() => {
    if (!visible) return;
    const sock = getSocket();
    if (!sock) return;

    const onMessage = (m: ChatMessage) => {
      if (convIdRef.current && m.conversationId === convIdRef.current) {
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          // Our own message echoed back: replace the optimistic copy.
          if (m.senderId === myId) {
            const idx = prev.findIndex(
              (x) => x.pending && x.text === m.text && (x.attachment?.type ?? null) === (m.attachment?.type ?? null),
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = m;
              return next;
            }
          }
          return [m, ...prev];
        });
        if (m.senderId !== myId) {
          markConversationReadRequest(m.conversationId).catch(() => {});
        }
      } else if (!convIdRef.current) {
        void loadInbox();
      }
    };

    const onRead = (p: { conversationId: string; readerId: string; readAt: string }) => {
      if (p.conversationId === convIdRef.current && p.readerId !== myId) {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === myId && !m.readAt ? { ...m, readAt: p.readAt } : m)),
        );
      }
    };

    sock.on('chat:message', onMessage);
    sock.on('chat:read', onRead);
    return () => {
      sock.off('chat:message', onMessage);
      sock.off('chat:read', onRead);
    };
  }, [visible, myId, loadInbox]);

  // Debounced people search for "new message".
  useEffect(() => {
    const q = query.trim();
    if (!searchMode || q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let active = true;
    const t = setTimeout(() => {
      searchUsersRequest(q)
        .then((r) => active && setResults(r))
        .catch(() => active && setResults([]))
        .finally(() => active && setSearching(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, searchMode]);

  const loadOlder = async () => {
    if (!conv || !hasMore || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[messages.length - 1];
      const page = await getMessagesRequest(conv.id, oldest.createdAt);
      setMessages((prev) => [...prev, ...page.messages.filter((m) => !prev.some((p) => p.id === m.id))]);
      setHasMore(page.hasMore);
    } catch {
      /* ignore */
    } finally {
      setLoadingOlder(false);
    }
  };

  /**
   * Send text, or an attachment (with the typed text as its caption). A file is
   * uploaded first, then the message is sent. `retry` re-sends a failed one.
   */
  const send = async (opts: { retry?: ChatMessage; file?: PickedAttachment } = {}) => {
    if (!conv || !myId) return;
    const { retry } = opts;
    const tempId = retry?.id ?? `temp-${Date.now()}`;
    const file = opts.file ?? (retry ? pendingFiles.current.get(retry.id) : undefined);
    const body = (retry ? retry.text : text).trim();
    if (!body && !file) return;
    if (opts.file) pendingFiles.current.set(tempId, opts.file);

    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: conv.id,
      senderId: myId,
      text: body,
      attachment: file
        ? { url: file.uri, type: file.type, name: file.name, mime: file.mimeType, size: file.size, durationMs: file.durationMs }
        : null,
      createdAt: new Date().toISOString(),
      readAt: null,
      pending: true,
    };
    if (retry) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? optimistic : m)));
    } else {
      setMessages((prev) => [optimistic, ...prev]);
      setText('');
      selectionRef.current = { start: 0, end: 0 };
    }
    try {
      let attachment = uploadedFiles.current.get(tempId);
      if (file && !attachment) {
        const up = await uploadFileRequest(file.uri, file.mimeType, file.name);
        attachment = {
          url: up.url,
          type: file.type,
          name: file.name,
          mime: file.mimeType,
          size: up.size || file.size,
          durationMs: file.durationMs ? Math.round(file.durationMs) : undefined,
        };
        uploadedFiles.current.set(tempId, attachment); // a retry won't re-upload
      }
      const saved = await sendMessageRequest(conv.id, body, attachment);
      pendingFiles.current.delete(tempId);
      uploadedFiles.current.delete(tempId);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return withoutTemp.some((m) => m.id === saved.id) ? withoutTemp : [saved, ...withoutTemp];
      });
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      if (file) Alert.alert('Not sent', (e as Error)?.message || 'The file could not be sent. Tap it to retry.');
    }
  };

  const goBack = () => {
    if (chatView?.mode === 'thread') openChatInbox();
    else closeChat();
  };

  // ---------- renderers ----------

  const renderConversation = ({ item }: { item: Conversation }) => {
    const mine = item.lastMessage?.senderId === myId;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() =>
          openChatWith({
            id: item.otherUser.id,
            name: item.otherUser.name,
            avatarUrl: item.otherUser.avatarUrl,
            role: item.otherUser.role,
          })
        }
        style={styles.convRow}
      >
        <Avatar uri={item.otherUser.avatarUrl} name={item.otherUser.name} size={50} showOnlineDot={item.otherUser.isOnline} />
        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <Text style={[styles.convName, item.unreadCount > 0 && styles.bold]} numberOfLines={1}>
              {item.otherUser.name}
            </Text>
            <Text style={[styles.convTime, item.unreadCount > 0 && { color: ACCENT, fontWeight: '700' }]}>
              {listTime(item.lastMessageAt)}
            </Text>
          </View>
          <View style={styles.convBottom}>
            <Text
              style={[styles.convPreview, item.unreadCount > 0 && styles.convPreviewUnread]}
              numberOfLines={1}
            >
              {item.lastMessage ? `${mine ? 'You: ' : ''}${messagePreview(item.lastMessage)}` : 'Say hello 👋'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Inverted list: index 0 is the newest message.
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const mine = item.senderId === myId;
    const older = messages[index + 1];
    const showDay = !older || !sameDay(older.createdAt, item.createdAt);
    const isLatestMine = mine && messages.findIndex((m) => m.senderId === myId) === index;
    // Instagram-style: their avatar sits beside the LAST message of each run.
    const newer = messages[index - 1];
    const lastOfRun = !newer || newer.senderId !== item.senderId || !sameDay(newer.createdAt, item.createdAt);
    const a = item.attachment;
    const isMedia = a?.type === 'image' || a?.type === 'video';
    return (
      <View>
        {showDay && (
          <View style={styles.dayChip}>
            <Text style={styles.dayText}>{dayLabel(item.createdAt)}</Text>
          </View>
        )}
        <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs, !lastOfRun && { marginBottom: 0 }]}>
          {!mine &&
            (lastOfRun ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  peer &&
                  openUserProfile({
                    id: peer.id,
                    name: peer.name,
                    avatarUrl: peer.avatarUrl ?? '',
                    role: (peer.role ?? undefined) as any,
                    badge: peer.role === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                  })
                }
                style={styles.msgAvatar}
              >
                <Avatar uri={peer?.avatarUrl} name={peer?.name ?? ''} size={28} />
              </TouchableOpacity>
            ) : (
              <View style={styles.msgAvatar} />
            ))}
          <TouchableOpacity
            activeOpacity={item.failed ? 0.7 : 1}
            disabled={!item.failed}
            onPress={() => send({ retry: item })}
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleTheirs,
              isMedia && styles.bubbleMedia,
              item.failed && styles.bubbleFailed,
            ]}
          >
            {!!a && (
              <MessageAttachment
                messageId={item.id}
                attachment={a}
                mine={mine}
                pending={item.pending}
                audio={audioState}
                onToggleAudio={() => toggleAudio(item)}
                onOpenMedia={setViewerMedia}
                onOpenFile={openFile}
              />
            )}
            {!!item.text && (
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, !!a && styles.caption]}>{item.text}</Text>
            )}
            <View style={styles.bubbleMeta}>
              <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </Text>
              {mine && (
                <Ionicons
                  name={item.failed ? 'alert-circle' : item.pending ? 'time-outline' : item.readAt ? 'checkmark-done' : 'checkmark'}
                  size={13}
                  color={item.failed ? '#FECACA' : item.readAt ? '#A5F3FC' : 'rgba(255,255,255,0.75)'}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
        {item.failed && <Text style={styles.failedText}>Not sent · tap to retry</Text>}
        {isLatestMine && item.readAt && !item.pending && <Text style={styles.seenText}>Seen</Text>}
      </View>
    );
  };

  const isThread = chatView?.mode === 'thread';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={goBack} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}
        behavior="padding" automaticOffset
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
            <Ionicons name={isThread ? 'arrow-back' : 'close'} size={22} color="#0F172A" />
          </TouchableOpacity>

          {isThread && peer ? (
            <View style={styles.peerBox}>
              {/* Tap the person → their profile (opens over the chat) */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  openUserProfile({
                    id: peer.id,
                    name: peer.name,
                    avatarUrl: peer.avatarUrl ?? '',
                    role: (peer.role ?? undefined) as any,
                    badge: peer.role === 'Mentor' ? 'Verified Mentor' : 'Community Member',
                  })
                }
                style={styles.peerTap}
                accessibilityLabel={`Open ${peer.name}'s profile`}
              >
              <Avatar uri={peer.avatarUrl} name={peer.name} size={38} showOnlineDot={!!conv?.otherUser.isOnline} />
              <View style={{ flex: 1 }}>
                <Text style={styles.peerName} numberOfLines={1}>{peer.name}</Text>
                <Text style={styles.peerSub}>
                  {conv?.otherUser.isOnline ? 'Online' : peer.role === 'Mentor' ? 'Mentor' : peer.role === 'Guest' ? 'Guest' : 'Learner'}
                </Text>
              </View>
              </TouchableOpacity>
              {/* Calls: only between people who follow each other (server-enforced too). */}
              {FEATURES.calls && conv?.otherUser.canCall && (
                <>
                  <TouchableOpacity
                    onPress={() => startCall(peer.id, peer.name, 'voice', peer.avatarUrl)}
                    style={styles.callBtn}
                    accessibilityLabel={`Voice call ${peer.name}`}
                  >
                    <Ionicons name="call" size={19} color={ACCENT} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => startCall(peer.id, peer.name, 'video', peer.avatarUrl)}
                    style={styles.callBtn}
                    accessibilityLabel={`Video call ${peer.name}`}
                  >
                    <Ionicons name="videocam" size={21} color={ACCENT} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <Text style={styles.headerTitle}>{searchMode ? 'New message' : 'Messages'}</Text>
          )}

          {!isThread && (
            <TouchableOpacity
              onPress={() => {
                setSearchMode((s) => !s);
                setQuery('');
              }}
              style={styles.headerBtn}
            >
              <Ionicons name={searchMode ? 'close-circle-outline' : 'create-outline'} size={22} color={ACCENT} />
            </TouchableOpacity>
          )}
        </View>

        {/* ---------------- INBOX ---------------- */}
        {!isThread && (
          <View style={{ flex: 1 }}>
            {searchMode ? (
              <>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} color="#94A3B8" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search people by name"
                    placeholderTextColor="#94A3B8"
                    style={styles.searchInput}
                    autoFocus
                  />
                </View>
                {searching ? (
                  <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
                ) : (
                  <FlatList
                    data={results}
                    keyExtractor={(u) => u.id}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      query.trim() ? <Text style={styles.emptyHint}>No people found.</Text> : null
                    }
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.convRow}
                        onPress={() => {
                          setSearchMode(false);
                          openChatWith({ id: item.id, name: item.name, avatarUrl: item.avatarUrl, role: item.role });
                        }}
                      >
                        <Avatar uri={item.avatarUrl} name={item.name} size={44} />
                        <View style={styles.convInfo}>
                          <Text style={styles.convName}>{item.name}</Text>
                          <Text style={styles.convPreview}>{item.role ?? 'Member'}</Text>
                        </View>
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color={ACCENT} />
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            ) : inboxLoading && conversations.length === 0 ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 30 }} />
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(c) => c.id}
                renderItem={renderConversation}
                refreshing={inboxLoading}
                onRefresh={() => {
                  setInboxLoading(true);
                  loadInbox().finally(() => setInboxLoading(false));
                }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="chatbubbles-outline" size={30} color={ACCENT} />
                    </View>
                    <Text style={styles.emptyTitle}>No messages yet</Text>
                    <Text style={styles.emptyBody}>
                      Tap the pencil to start a conversation, or open someone’s profile and tap Message.
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        )}

        {/* ---------------- THREAD ---------------- */}
        {isThread && (
          <>
            {threadLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={ACCENT} />
              </View>
            ) : messages.length === 0 ? (
              /* Rendered OUTSIDE the inverted list: inverted lists are flipped
                 (a 180° rotation on Android), which mirrored this text. */
              <View style={[styles.empty, styles.threadEmpty]}>
                <Avatar uri={peer?.avatarUrl} name={peer?.name ?? ''} size={64} />
                <Text style={styles.emptyTitle}>{peer?.name}</Text>
                <Text style={styles.emptyBody}>This is the start of your conversation. Say hello 👋</Text>
              </View>
            ) : (
              <FlatList
                data={messages}
                keyExtractor={(m) => m.id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={styles.threadContent}
                onEndReached={loadOlder}
                onEndReachedThreshold={0.3}
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={loadingOlder ? <ActivityIndicator color={ACCENT} style={{ margin: 10 }} /> : null}
              />
            )}

            {showAttach && <AttachmentSheet onPick={pickAttachment} onClose={() => setShowAttach(false)} />}

            <View style={[styles.composer, { paddingBottom: showEmoji ? 8 : composerPad }]}>
              <View style={styles.inputWrap}>
                <TouchableOpacity
                  onPress={toggleEmoji}
                  disabled={!conv}
                  style={styles.inputIcon}
                  accessibilityLabel={showEmoji ? 'Show keyboard' : 'Show emojis'}
                >
                  <Ionicons name={showEmoji ? 'keypad-outline' : 'happy-outline'} size={23} color="#64748B" />
                </TouchableOpacity>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  onSelectionChange={(e) => {
                    selectionRef.current = e.nativeEvent.selection;
                  }}
                  onFocus={() => {
                    setShowEmoji(false);
                    setShowAttach(false);
                  }}
                  placeholder={`Message ${peer?.name.split(' ')[0] ?? ''}…`}
                  placeholderTextColor="#94A3B8"
                  style={styles.composerInput}
                  multiline
                  maxLength={2000}
                  editable={!!conv}
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowEmoji(false);
                    Keyboard.dismiss();
                    setShowAttach((v) => !v);
                  }}
                  disabled={!conv}
                  style={styles.inputIcon}
                  accessibilityLabel="Attach a file"
                >
                  <Ionicons name="attach" size={24} color={showAttach ? ACCENT : '#64748B'} style={{ transform: [{ rotate: '45deg' }] }} />
                </TouchableOpacity>
                {!text.trim() && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowAttach(false);
                      void pickAttachment('camera');
                    }}
                    disabled={!conv}
                    style={styles.inputIcon}
                    accessibilityLabel="Camera"
                  >
                    <Ionicons name="camera-outline" size={22} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => send()}
                disabled={!conv || !text.trim()}
                style={[styles.sendBtn, (!conv || !text.trim()) && { opacity: 0.4 }]}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {showEmoji && (
              <View style={{ paddingBottom: Math.max(insets.bottom, 0) }}>
                <EmojiPanel onPick={insertEmoji} onBackspace={backspace} />
              </View>
            )}

            <ChatMediaViewer media={viewerMedia} onClose={() => setViewerMedia(null)} />
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#0F172A' },
  peerBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  peerTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  callBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  peerName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  peerSub: { fontSize: 11, color: '#16A34A', fontWeight: '600' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#0F172A' },

  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  convInfo: { flex: 1, gap: 3 },
  convTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  convName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0F172A' },
  convTime: { fontSize: 11, color: '#94A3B8' },
  convBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convPreview: { flex: 1, fontSize: 13, color: '#64748B' },
  convPreviewUnread: { color: '#0F172A', fontWeight: '700' },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptyBody: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19 },
  threadEmpty: { flex: 1, justifyContent: 'center', backgroundColor: '#F8FAFC' },
  emptyHint: { textAlign: 'center', color: '#94A3B8', marginTop: 20 },

  threadContent: { paddingHorizontal: 12, paddingVertical: 10, flexGrow: 1, backgroundColor: '#F8FAFC' },
  dayChip: { alignSelf: 'center', backgroundColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginVertical: 10 },
  dayText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 5, borderRadius: 18 },
  bubbleMine: { backgroundColor: ACCENT, borderBottomRightRadius: 5 },
  bubbleTheirs: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderBottomLeftRadius: 5 },
  bubbleFailed: { backgroundColor: '#DC2626' },
  bubbleMedia: { paddingHorizontal: 4, paddingTop: 4 },
  caption: { paddingHorizontal: 6, paddingTop: 6 },
  msgAvatar: { width: 28, marginRight: 6, alignSelf: 'flex-end' },
  bubbleText: { fontSize: 15, color: '#0F172A', lineHeight: 20 },
  bubbleTextMine: { color: '#FFFFFF' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  bubbleTime: { fontSize: 10, color: '#94A3B8' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  failedText: { alignSelf: 'flex-end', fontSize: 11, color: '#DC2626', marginRight: 4, marginBottom: 4 },
  seenText: { alignSelf: 'flex-end', fontSize: 11, color: '#64748B', marginRight: 4, marginTop: 2 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    paddingHorizontal: 4,
  },
  inputIcon: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: 4,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: '#0F172A',
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
});
