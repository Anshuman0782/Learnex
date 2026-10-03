import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import { useApp } from '../../context/AppContext';
import {
  recordVideo,
  pickVideo,
  recordShort,
  pickAudioFile,
  pickPhoto,
  pickPostPhotos,
  capturePostPhoto,
  MAX_POST_PHOTOS,
  type PickedPhoto,
  generateVideoThumbnail,
  type MediaResult,
} from '../../services/imagePicker';
import { uploadFileRequest } from '../../api/media.api';
import * as FileSystem from 'expo-file-system/legacy';
import { ScheduleSheet } from '../../components/common/ScheduleSheet';
import { POST_BACKGROUNDS, postBackground, type PostBgKey } from '../../config/postBackgrounds';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

const QUICK_TAGS = [
  { label: '#VocalPitch', icon: 'mic' },
  { label: '#GuitarSolo', icon: 'musical-notes' },
  { label: '#MixingCritique', icon: 'options' },
  { label: '#BreathSupport', icon: 'fitness' },
  { label: '#DailyPractice', icon: 'flame' },
  { label: '#SpeedTechnique', icon: 'flash' },
];

/** A locally-selected media file, before upload. */
type SelectedMedia = {
  kind: 'video' | 'audio';
  uri: string;
  mimeType: string;
  durationMs?: number;
};

const fmtDuration = (ms?: number): string => {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const AddContentPlaceholderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    createPost,
    getJoinedCommunityObjects,
    joinedCommunities,
    showDialog,
    saveUserGoal,
    logGoalSession,
    activeGoal,
    user,
  } = useApp();

  const joinedCommunityObjects = getJoinedCommunityObjects();

  // Content type: 'goal' | 'video' | 'short' | 'text'
  // NOTE: the Goal option is temporarily hidden (see the format selector below);
  // default is 'video'. Goal code is kept but not shown for now.
  const [contentType, setContentType] = useState<'goal' | 'video' | 'short' | 'text'>('video');
  const isShort = contentType === 'short';

  // Video & Discussion states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bgKey, setBgKey] = useState<PostBgKey>('default');
  const [isPrivate, setIsPrivate] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  // Custom (dynamic) schedule date & time picker — any date/time the user wants.
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const nowPlus1h = new Date(Date.now() + 60 * 60 * 1000);
  const [schedYear, setSchedYear] = useState(nowPlus1h.getFullYear());
  const [schedMonth, setSchedMonth] = useState(nowPlus1h.getMonth()); // 0-11
  const [schedDay, setSchedDay] = useState(nowPlus1h.getDate());
  const [schedHour, setSchedHour] = useState(nowPlus1h.getHours()); // 0-23
  const [schedMinute, setSchedMinute] = useState(0);

  const SCHED_MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const daysInSchedMonth = new Date(schedYear, schedMonth + 1, 0).getDate();
  const openSchedulePicker = () => {
    const base = scheduledAt ?? new Date(Date.now() + 60 * 60 * 1000);
    setSchedYear(base.getFullYear());
    setSchedMonth(base.getMonth());
    setSchedDay(base.getDate());
    setSchedHour(base.getHours());
    setSchedMinute(base.getMinutes() - (base.getMinutes() % 5));
    setShowSchedulePicker(true);
  };
  const applySchedulePicker = () => {
    const picked = new Date(schedYear, schedMonth, schedDay, schedHour, schedMinute, 0, 0);
    if (picked.getTime() <= Date.now()) {
      Alert.alert('Pick a future time', 'The scheduled time must be later than now.');
      return;
    }
    setScheduledAt(picked);
    setScheduleMode(true);
    setShowSchedulePicker(false);
  };

  const SCHEDULE_PRESETS: { label: string; getDate: () => Date }[] = [
    { label: 'In 1 hour', getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
    { label: 'In 3 hours', getDate: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
    {
      label: 'Tonight 8 PM',
      getDate: () => {
        const d = new Date();
        d.setHours(20, 0, 0, 0);
        if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
        return d;
      },
    },
    {
      label: 'Tomorrow 9 AM',
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];
  const [customFocusArea, setCustomFocusArea] = useState('');

  // Goal Set states
  const [goalTitle, setGoalTitle] = useState('');
  const [targetSessions, setTargetSessions] = useState<number>(5);
  const [isCustomSessions, setIsCustomSessions] = useState(false);
  const [customSessionsText, setCustomSessionsText] = useState('5');

  const [targetHours, setTargetHours] = useState<number>(4.0);
  const [isCustomHours, setIsCustomHours] = useState(false);
  const [customHoursText, setCustomHoursText] = useState('4.0');

  const [targetDate, setTargetDate] = useState('September 30, 2026');
  const [showGoalDatePickerModal, setShowGoalDatePickerModal] = useState(false);
  const [goalYear, setGoalYear] = useState('2026');
  const [goalMonth, setGoalMonth] = useState('09');
  const [goalDay, setGoalDay] = useState('30');

  const [dailyReminders, setDailyReminders] = useState(true);

  const [selectedCommunityIds, setSelectedCommunityIds] = useState<string[]>(() => {
    if (joinedCommunities && joinedCommunities.length > 0) {
      return [joinedCommunities[0]];
    }
    return joinedCommunityObjects.length > 0 ? [joinedCommunityObjects[0].id] : [];
  });

  // Opened from inside a circle: pre-select that circle on the Post tab.
  const route = useRoute<any>();
  const presetCircleId: string | undefined = route.params?.circleId;
  useEffect(() => {
    if (!presetCircleId) return;
    setContentType('video');
    setSelectedCommunityIds([presetCircleId]);
    navigation.setParams({ circleId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCircleId]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  // --- Real media capture state ---
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [thumbUri, setThumbUri] = useState<string | null>(null); // local thumbnail image
  const [busyPicking, setBusyPicking] = useState(false);
  // Photo post: 1–5 photos (mutually exclusive with video/audio media).
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  // Audio recording (expo-audio)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset selected media whenever the format tab changes.
  useEffect(() => {
    setMedia(null);
    setThumbUri(null);
    setPhotos([]);
  }, [contentType]);

  useEffect(() => {
    return () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
    };
  }, []);

  const handleToggleCommunity = (commId: string) => {
    setSelectedCommunityIds((prev) =>
      prev.includes(commId) ? prev.filter((id) => id !== commId) : [...prev, commId]
    );
  };

  const handleToggleTag = (tagItem: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagItem) ? prev.filter((t) => t !== tagItem) : [...prev, tagItem]
    );
  };

  const handleMediaResult = async (res: MediaResult, kind: 'video' | 'audio') => {
    if (res.status === 'denied') {
      Alert.alert('Access Needed', 'Please allow camera / microphone / storage access for LERNEX in your device settings.');
      return;
    }
    if (res.status === 'error') {
      Alert.alert('Could not use this file', res.message);
      return;
    }
    if (res.status !== 'ok') return;

    // Shorts must be under 60 seconds.
    if (isShort && res.durationMs && res.durationMs > 60_000) {
      Alert.alert('Too long for a Short', 'Shorts must be under 60 seconds. Please pick a shorter clip.');
      return;
    }

    setMedia({ kind, uri: res.uri, mimeType: res.mimeType, durationMs: res.durationMs });
    setPhotos([]);

    // Auto-generate a poster for a regular video (not for shorts — those have none).
    if (kind === 'video' && !isShort) {
      const thumb = await generateVideoThumbnail(res.uri);
      setThumbUri(thumb);
    } else {
      setThumbUri(null);
    }
  };

  const handleRecordVideo = async () => {
    setBusyPicking(true);
    try {
      const res = isShort ? await recordShort() : await recordVideo();
      await handleMediaResult(res, 'video');
    } finally {
      setBusyPicking(false);
    }
  };

  const handlePickVideo = async () => {
    setBusyPicking(true);
    try {
      await handleMediaResult(await pickVideo(), 'video');
    } finally {
      setBusyPicking(false);
    }
  };

  const handleUploadAudio = async () => {
    setBusyPicking(true);
    try {
      await handleMediaResult(await pickAudioFile(), 'audio');
    } finally {
      setBusyPicking(false);
    }
  };

  const handleToggleVoiceRecording = async () => {
    if (isRecording) {
      // Stop recording.
      try {
        await audioRecorder.stop();
      } catch {
        /* ignore */
      }
      if (recordTimer.current) clearInterval(recordTimer.current);
      setIsRecording(false);
      const uri = audioRecorder.uri;
      if (uri) {
        if (isShort && recordSeconds > 60) {
          Alert.alert('Too long for a Short', 'Audio shorts must be under 60 seconds.');
          setRecordSeconds(0);
          return;
        }
        setMedia({ kind: 'audio', uri, mimeType: 'audio/m4a', durationMs: recordSeconds * 1000 });
        setThumbUri(null);
        setPhotos([]);
      }
      return;
    }

    // Start recording.
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone Needed', 'Please allow microphone access for LERNEX to record a voice take.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setRecordSeconds(0);
    setIsRecording(true);
    recordTimer.current = setInterval(() => {
      setRecordSeconds((s) => {
        const next = s + 1;
        // Auto-stop an audio short at 60s.
        if (isShort && next >= 60) {
          void handleToggleVoiceRecording();
        }
        return next;
      });
    }, 1000);
  };

  const handleSetThumbnail = async () => {
    // Long video → 16:9 (YouTube-style, matches the feed); audio reel → 9:16; audio post → square.
    const aspect: [number, number] = media?.kind === 'video' ? [16, 9] : isShort ? [9, 16] : [1, 1];
    const res = await pickPhoto(aspect);
    if (res.status === 'denied') {
      Alert.alert('Access Needed', 'Please allow photo access to choose a thumbnail.');
      return;
    }
    if (res.status === 'ok') setThumbUri(res.uri);
  };

  const handlePhotos = async (fromCamera: boolean) => {
    const room = MAX_POST_PHOTOS - photos.length;
    if (room <= 0) {
      Alert.alert('Photo limit', `A post can have up to ${MAX_POST_PHOTOS} photos.`);
      return;
    }
    setBusyPicking(true);
    try {
      const res = fromCamera ? await capturePostPhoto() : await pickPostPhotos(room);
      if (res.status === 'denied') {
        Alert.alert('Access Needed', 'Please allow camera / photo access for LERNEX in your device settings.');
        return;
      }
      if (res.status !== 'ok') return;
      setMedia(null);
      setThumbUri(null);
      setPhotos((prev) => [...prev, ...res.photos].slice(0, MAX_POST_PHOTOS));
    } finally {
      setBusyPicking(false);
    }
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p.uri !== uri));

  const clearMedia = () => {
    setMedia(null);
    setThumbUri(null);
    setRecordSeconds(0);
    setPhotos([]);
  };

  const handleSaveGoal = () => {
    if (!goalTitle.trim()) {
      showDialog({
        title: 'Goal Required',
        message: 'Please enter your practice goal objective.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
      return;
    }

    saveUserGoal({
      title: goalTitle.trim(),
      targetSessions,
      targetHours,
      targetDate,
      completedSessions: activeGoal?.title === goalTitle.trim() ? activeGoal.completedSessions : 1,
      dailyReminders,
    });

    showDialog({
      title: 'Target Goal Active!',
      message: `Your goal "${goalTitle.trim()}" (${targetSessions} sessions/wk) is now active and tracked directly in this section!`,
      icon: 'checkmark-circle-outline',
      confirmText: 'Awesome',
    });
  };

  const handlePublish = async () => {
    if (contentType === 'goal') {
      handleSaveGoal();
      return;
    }

    if (contentType === 'text' ? !description.trim() : !title.trim()) {
      showDialog({
        title: contentType === 'text' ? 'Write Something' : 'Title Required',
        message: contentType === 'text' ? 'Please write your discussion.' : 'Please enter a title.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
      return;
    }

    // Video / Short / Audio need a captured media file; Discussion is text-only.
    if (contentType !== 'text' && !media && photos.length === 0) {
      showDialog({
        title: 'Add Your Media',
        message: isShort
          ? 'Record or pick a reel (video or voice) under 60 seconds.'
          : 'Add photos, a video, or a voice / audio take.',
        icon: 'cloud-upload-outline',
        confirmText: 'OK',
      });
      return;
    }

    // A regular (non-short) post needs a target community; shorts go to Reels.
    if (!isShort && selectedCommunityIds.length === 0) {
      showDialog({
        title: 'Community Circle Required',
        message: 'Please select a community circle.',
        icon: 'alert-circle-outline',
        confirmText: 'OK',
      });
      return;
    }

    setIsPublishing(true);
    try {
      let videoUrl: string | undefined;
      let audioUrl: string | undefined;
      let videoThumbnail: string | undefined;

      // Photo post: upload each photo (in order).
      let imageUrls: string[] | undefined;
      if (photos.length > 0) {
        imageUrls = [];
        for (const ph of photos) {
          const up = await uploadFileRequest(ph.uri, ph.mimeType);
          imageUrls.push(up.url);
        }
      }

      // Upload the main media file.
      if (media) {
        const up = await uploadFileRequest(media.uri, media.mimeType);
        if (media.kind === 'video') videoUrl = up.url;
        else audioUrl = up.url;
      }

      // Upload the poster thumbnail (regular video always; audio optional; video-short none).
      // Resilient: if the cached thumbnail went missing, regenerate it; and if the
      // poster still can't be uploaded, publish without it rather than failing.
      if (thumbUri && !(media?.kind === 'video' && isShort)) {
        try {
          let localThumb = thumbUri;
          const info = await FileSystem.getInfoAsync(localThumb);
          if (!info.exists && media?.kind === 'video') {
            const regen = await generateVideoThumbnail(media.uri);
            if (regen) localThumb = regen;
          }
          const mime = localThumb.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          const upThumb = await uploadFileRequest(localThumb, mime);
          videoThumbnail = upThumb.url;
        } catch {
          // Poster is optional — continue publishing without a custom thumbnail.
          videoThumbnail = undefined;
        }
      }

      const postType: 'video' | 'audio' | 'text' | 'image' =
        contentType === 'text'
          ? 'text'
          : imageUrls && imageUrls.length > 0
          ? 'image'
          : media?.kind === 'audio'
          ? 'audio'
          : 'video';

      const scheduledIso =
        scheduleMode && scheduledAt && scheduledAt.getTime() > Date.now()
          ? scheduledAt.toISOString()
          : undefined;

      // Discussions have no separate topic: the text IS the post.
      const discussText = description.trim();
      await createPost({
        title: contentType === 'text' ? discussText.split('\n')[0].slice(0, 80) : title.trim(),
        content: contentType === 'text' ? discussText : description.trim() || title.trim(),
        bgStyle: contentType === 'text' ? bgKey : undefined,
        communityIds: isShort ? selectedCommunityIds : selectedCommunityIds,
        communityId: selectedCommunityIds[0],
        // Tag = the creator's own focus (e.g. #Dance) — no made-up default.
        tag: selectedTags.join(' ') || (user?.hobby ? `#${user.hobby.replace(/\s+/g, '')}` : ''),
        tags: selectedTags,
        postType,
        videoUrl,
        audioUrl,
        imageUrls,
        videoThumbnail,
        videoDuration: fmtDuration(media?.durationMs) || undefined,
        isShort,
        isPrivate: scheduleMode ? false : isPrivate,
        scheduledAt: scheduledIso,
        focusArea: selectedTags.map((t) => t.replace('#', '')).join(', '),
      });

      setTitle('');
      setDescription('');
      setBgKey('default');
      clearMedia();
      setScheduleMode(false);
      setScheduledAt(null);

      showDialog({
        title: scheduledIso
          ? 'Scheduled ⏰'
          : isShort
          ? 'Reel Published! 🎬'
          : isPrivate
          ? 'Shared to Circle Only'
          : 'Published Successfully!',
        message: scheduledIso
          ? `This will publish automatically on ${scheduledAt!.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
          : isShort
          ? 'Your reel is now live in the Reels feed.'
          : isPrivate
          ? 'This practice post is private to your selected community.'
          : 'Your post is live in your community circle!',
        icon: scheduledIso ? 'time-outline' : isShort ? 'play-circle-outline' : isPrivate ? 'lock-closed-outline' : 'checkmark-circle-outline',
        confirmText: scheduledIso ? 'Done' : isShort ? 'View Reels' : 'View Feed',
        onConfirm: () => navigation.navigate(isShort && !scheduledIso ? 'ReelsTab' : 'HomeTab'),
      });
    } catch (err: any) {
      showDialog({
        title: 'Upload Failed',
        message: err?.message || 'Could not publish. Please check your connection and try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Try Again',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 6, 40) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.closeHeaderBtn}
        >
          <Ionicons name="close" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Create Content</Text>
        </View>

        {/* Header Share button removed — the bottom "Share Practice Content" button
            is the single publish action. Spacer keeps the title centered. */}
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 95, 120) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Format Selector Bar: Goal | Video | Short | Discuss */}
        <View style={styles.formatSelector}>
          {([
            // Goal is temporarily hidden — do not remove, we may re-enable it later.
            // { key: 'goal', label: 'Goal', icon: 'flag', iconOutline: 'flag-outline' },
            { key: 'video', label: 'Post', icon: 'add-circle', iconOutline: 'add-circle-outline' },
            { key: 'short', label: 'Reels', icon: 'film', iconOutline: 'film-outline' },
            { key: 'text', label: 'Discuss', icon: 'chatbubbles', iconOutline: 'chatbubbles-outline' },
          ] as const).map((tab) => {
            const active = contentType === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                onPress={() => setContentType(tab.key)}
                style={styles.formatTabTouch}
              >
                {active ? (
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.formatTabActiveGradient}
                  >
                    <Ionicons name={tab.icon} size={14} color="#FFFFFF" />
                    <Text style={styles.formatTabActiveText}>{tab.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.formatTabInactive}>
                    <Ionicons name={tab.iconOutline} size={14} color="#64748B" />
                    <Text style={styles.formatTabInactiveText}>{tab.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ================= GOAL SET FORM & INSTANT ACTIVE GOAL CARD ================= */}
        {contentType === 'goal' && (
          <View style={{ gap: spacing.base }}>
            {/* Instant Active Goal Display Card (Shown when a goal is active) */}
            {activeGoal && (
              <View style={styles.activeGoalDisplayCard}>
                <View style={styles.activeGoalHeaderRow}>
                  <View style={styles.activeGoalBadge}>
                    <Ionicons name="flag" size={12} color="#4F46E5" />
                    <Text style={styles.activeGoalBadgeText}>ACTIVE TARGET GOAL</Text>
                  </View>
                  <Text style={styles.activeGoalDueTag}>Due {activeGoal.targetDate}</Text>
                </View>

                <Text style={styles.activeGoalCardTitle}>{activeGoal.title}</Text>

                {/* Progress Bar & Stats */}
                <View style={styles.activeGoalProgressBox}>
                  <View style={styles.goalProgressRow}>
                    <View style={styles.goalProgressBarBg}>
                      <View
                        style={[
                          styles.goalProgressBarFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.round(
                                (activeGoal.completedSessions / activeGoal.targetSessions) * 100
                              )
                            )}%`,
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={['#4F46E5', '#7C3AED']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </View>
                    <Text style={styles.goalProgressPercent}>
                      {activeGoal.completedSessions}/{activeGoal.targetSessions} (
                      {Math.round(
                        (activeGoal.completedSessions / activeGoal.targetSessions) * 100
                      )}
                      %)
                    </Text>
                  </View>

                  <View style={styles.goalDetailsRow}>
                    <Text style={styles.goalDetailSubText}>
                      Commitment: {activeGoal.targetHours} Hours / Week
                    </Text>
                    <Text style={styles.goalDetailSubText}>
                      Reminders: {activeGoal.dailyReminders ? 'Enabled' : 'Disabled'}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.activeGoalActionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      logGoalSession();
                      showDialog({
                        title: 'Practice Logged!',
                        message: `Logged session ${Math.min(
                          activeGoal.completedSessions + 1,
                          activeGoal.targetSessions
                        )} of ${activeGoal.targetSessions}! Keep up the consistent progress.`,
                        icon: 'checkmark-circle-outline',
                        confirmText: 'Keep Going',
                      });
                    }}
                    style={styles.logSessionActionBtn}
                  >
                    <Ionicons name="add-circle" size={16} color="#4F46E5" />
                    <Text style={styles.logSessionActionText}>Log Practice Session (+1)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setGoalTitle(activeGoal.title);
                      setTargetSessions(activeGoal.targetSessions);
                      setTargetHours(activeGoal.targetHours);
                      setTargetDate(activeGoal.targetDate);
                      setDailyReminders(activeGoal.dailyReminders);
                    }}
                    style={styles.editGoalActionBtn}
                  >
                    <Ionicons name="pencil" size={13} color="#475569" />
                    <Text style={styles.editGoalActionText}>Edit Goal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Streamlined Goal Target Settings Card */}
            <View style={styles.goalSectionBox}>
              <View style={styles.goalCardHeader}>
                <View style={styles.goalIconCircle}>
                  <Ionicons name="compass-outline" size={22} color="#4F46E5" />
                </View>
                <View>
                  <Text style={styles.goalCardTitle}>
                    {activeGoal ? 'Update Skill Target' : 'Set Your Skill Target'}
                  </Text>
                  <Text style={styles.goalCardSub}>
                    Define practice sessions and weekly commitment hours
                  </Text>
                </View>
              </View>

              {/* Goal Objective Input */}
              <View style={styles.goalInputGroup}>
                <Text style={styles.inputLabel}>Skill Goal Objective</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="flag-outline" size={18} color="#6366F1" style={styles.inputIcon} />
                  <TextInput
                    value={goalTitle}
                    onChangeText={setGoalTitle}
                    placeholder="e.g. Master High C5 vocal mix & belt phonation"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Targets Split Row: Sessions & Hours */}
              <View style={styles.targetSplitRow}>
                {/* Target Sessions Selection */}
                <View style={[styles.goalInputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Weekly Sessions</Text>
                  <View style={styles.optionPillRowCompact}>
                    {[3, 5, 7].map((num) => {
                      const isSel = targetSessions === num;
                      return (
                        <TouchableOpacity
                          key={num}
                          activeOpacity={0.8}
                          onPress={() => setTargetSessions(num)}
                          style={[styles.targetPillBtnCompact, isSel && styles.targetPillBtnActive]}
                        >
                          <Text style={[styles.targetPillTextCompact, isSel && styles.targetPillTextActive]}>
                            {num} Wk
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Target Hours Selection */}
                <View style={[styles.goalInputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Weekly Hours</Text>
                  <View style={styles.optionPillRowCompact}>
                    {[2.5, 4.0, 6.0].map((hrs) => {
                      const isSel = targetHours === hrs;
                      return (
                        <TouchableOpacity
                          key={hrs}
                          activeOpacity={0.8}
                          onPress={() => setTargetHours(hrs)}
                          style={[styles.targetPillBtnCompact, isSel && styles.targetPillBtnActive]}
                        >
                          <Text style={[styles.targetPillTextCompact, isSel && styles.targetPillTextActive]}>
                            {hrs}h
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Target Deadline Date & Interactive Custom Date Picker */}
              <View style={styles.goalInputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.inputLabel}>Target Completion Date</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setShowGoalDatePickerModal(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <Ionicons name="calendar-outline" size={13} color="#4F46E5" />
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#4F46E5' }}>
                      Custom Date
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowGoalDatePickerModal(true)}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#6366F1" style={styles.inputIcon} />
                  </TouchableOpacity>
                  <TextInput
                    value={targetDate}
                    onChangeText={setTargetDate}
                    placeholder="Target completion date"
                    placeholderTextColor="#94A3B8"
                    style={styles.textInput}
                  />
                </View>

                {/* Quick Date Presets Strip */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  {[
                    { label: 'In 30 Days', date: 'October 15, 2026' },
                    { label: 'In 60 Days', date: 'November 15, 2026' },
                    { label: 'End of Year', date: 'December 31, 2026' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      activeOpacity={0.8}
                      onPress={() => setTargetDate(item.date)}
                      style={[
                        styles.targetPresetChip,
                        targetDate === item.date && styles.targetPresetChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.targetPresetText,
                          targetDate === item.date && styles.targetPresetTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Daily Reminder Switch */}
              <View style={styles.reminderRow}>
                <View style={styles.reminderInfo}>
                  <Ionicons name="notifications-outline" size={18} color="#4F46E5" />
                  <Text style={styles.reminderText}>Daily Practice Reminder</Text>
                </View>
                <Switch
                  value={dailyReminders}
                  onValueChange={setDailyReminders}
                  trackColor={{ false: '#E2E8F0', true: '#A5B4FC' }}
                  thumbColor={dailyReminders ? '#4F46E5' : '#FFFFFF'}
                />
              </View>

              {/* Save Goal Button */}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleSaveGoal}
                style={styles.saveGoalBtn}
              >
                <LinearGradient
                  colors={['#4F46E5', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveGoalGradient}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.saveGoalText}>
                    {activeGoal ? 'Update Target Goal' : 'Save Goal Target'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================= VIDEO / SHORT CAPTURE FORM ================= */}
        {(contentType === 'video' || contentType === 'short') && (
          <>
            {isShort && (
              <View style={styles.shortHintBox}>
                <Ionicons name="information-circle-outline" size={15} color="#4F46E5" />
                <Text style={styles.shortHintText}>
                  Reels are under 60 seconds and appear in the Reels tab. Video reels
                  have no thumbnail; voice reels can use a 9:16 cover image.
                </Text>
              </View>
            )}

            {!isShort && (
              <Text style={styles.postHint}>Share photos, a video or an audio take with your circles.</Text>
            )}
            {/* Capture Tiles */}
            <View style={[styles.quickActionsDeck, !isShort && styles.quickActionsGrid]}>
              {!isShort && (
                <>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={busyPicking || isRecording}
                    onPress={() => handlePhotos(false)}
                    style={[styles.quickTile, styles.quickTileGrid]}
                  >
                    <View style={[styles.quickTileIconCircle, { backgroundColor: '#FCE7F3' }]}>
                      <Ionicons name="image-outline" size={18} color="#DB2777" />
                    </View>
                    <Text style={styles.quickTileLabel}>Photos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={busyPicking || isRecording}
                    onPress={() => handlePhotos(true)}
                    style={[styles.quickTile, styles.quickTileGrid]}
                  >
                    <View style={[styles.quickTileIconCircle, { backgroundColor: '#E0F2FE' }]}>
                      <Ionicons name="camera-outline" size={18} color="#0284C7" />
                    </View>
                    <Text style={styles.quickTileLabel}>Camera</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={busyPicking || isRecording}
                onPress={handleRecordVideo}
                style={[styles.quickTile, !isShort && styles.quickTileGrid]}
              >
                <View style={[styles.quickTileIconCircle, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="videocam-outline" size={18} color="#EF4444" />
                </View>
                <Text style={styles.quickTileLabel}>{isShort ? 'Record' : 'Record Video'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={busyPicking || isRecording}
                onPress={handlePickVideo}
                style={[styles.quickTile, !isShort && styles.quickTileGrid]}
              >
                <View style={[styles.quickTileIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="film-outline" size={17} color="#4F46E5" />
                </View>
                <Text style={styles.quickTileLabel}>{isShort ? 'Gallery' : 'Video'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={busyPicking}
                onPress={handleToggleVoiceRecording}
                style={[styles.quickTile, !isShort && styles.quickTileGrid]}
              >
                <View
                  style={[
                    styles.quickTileIconCircle,
                    { backgroundColor: isRecording ? '#EF4444' : '#D1FAE5' },
                  ]}
                >
                  <Ionicons
                    name={isRecording ? 'stop' : 'mic-outline'}
                    size={18}
                    color={isRecording ? '#FFFFFF' : '#059669'}
                  />
                </View>
                <Text style={styles.quickTileLabel}>
                  {isRecording ? `Stop ${fmtDuration(recordSeconds * 1000)}` : 'Voice'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={busyPicking || isRecording}
                onPress={handleUploadAudio}
                style={[styles.quickTile, !isShort && styles.quickTileGrid]}
              >
                <View style={[styles.quickTileIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="musical-notes-outline" size={17} color="#D97706" />
                </View>
                <Text style={styles.quickTileLabel}>Audio</Text>
              </TouchableOpacity>
            </View>

            {busyPicking && (
              <View style={styles.pickingRow}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <Text style={styles.pickingText}>Preparing media…</Text>
              </View>
            )}

            {/* Selected photos */}
            {photos.length > 0 && (
              <View style={[styles.photoStripCard, shadows.card]}>
                <View style={styles.photoStripHead}>
                  <Ionicons name="images" size={14} color="#DB2777" />
                  <Text style={styles.photoStripTitle}>
                    {photos.length} / {MAX_POST_PHOTOS} photos
                  </Text>
                  <TouchableOpacity onPress={() => setPhotos([])}>
                    <Text style={styles.photoStripClear}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                  {photos.map((ph, i) => (
                    <View key={ph.uri} style={styles.photoThumbWrap}>
                      <Image source={{ uri: ph.uri }} style={styles.photoThumb} />
                      {i === 0 && (
                        <View style={styles.photoCoverTag}>
                          <Text style={styles.photoCoverText}>COVER</Text>
                        </View>
                      )}
                      <TouchableOpacity onPress={() => removePhoto(ph.uri)} style={styles.photoRemove}>
                        <Ionicons name="close" size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photos.length < MAX_POST_PHOTOS && (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => handlePhotos(false)} style={styles.photoAdd}>
                      <Ionicons name="add" size={26} color="#DB2777" />
                      <Text style={styles.photoAddText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Selected media preview */}
            {media && (
              <View style={[styles.previewCard, shadows.card]}>
                <View
                  style={[
                    styles.previewMedia,
                    media.kind === 'video' && !isShort && styles.previewMediaWide,
                    isShort && styles.previewMediaVertical,
                  ]}
                >
                  {media.kind === 'video' ? (
                    thumbUri ? (
                      <Image source={{ uri: thumbUri }} style={styles.previewImage} />
                    ) : (
                      <View style={[styles.previewImage, styles.previewPlaceholder]}>
                        <Ionicons name="videocam" size={30} color="#94A3B8" />
                      </View>
                    )
                  ) : thumbUri ? (
                    <Image source={{ uri: thumbUri }} style={styles.previewImage} />
                  ) : (
                    <View style={[styles.previewImage, styles.audioPlaceholder]}>
                      <Ionicons name="musical-notes" size={34} color="#FFFFFF" />
                      <Text style={styles.audioPlaceholderText}>Now Playing Cover</Text>
                    </View>
                  )}

                  <View style={styles.previewBadgeRow}>
                    <View style={styles.previewKindBadge}>
                      <Ionicons
                        name={media.kind === 'video' ? 'videocam' : 'musical-notes'}
                        size={11}
                        color="#FFFFFF"
                      />
                      <Text style={styles.previewKindText}>
                        {media.kind === 'video' ? 'VIDEO' : 'AUDIO'}
                        {isShort ? ' • SHORT' : ''}
                      </Text>
                    </View>
                    {!!fmtDuration(media.durationMs) && (
                      <View style={styles.durationPill}>
                        <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                        <Text style={styles.durationText}>{fmtDuration(media.durationMs)}</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity onPress={clearMedia} style={styles.previewRemoveBtn}>
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Thumbnail controls — video (non-short) OR any audio; never for a video short */}
                {!(media.kind === 'video' && isShort) && (
                  <TouchableOpacity onPress={handleSetThumbnail} style={styles.setThumbBtn}>
                    <Ionicons name="image-outline" size={16} color="#4F46E5" />
                    <Text style={styles.setThumbText}>
                      {thumbUri ? 'Change Thumbnail' : 'Set Thumbnail from Gallery'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {/* ================= INPUTS BLOCK (Video & Discussion) ================= */}
        {contentType !== 'goal' && (
          <>
            {contentType === 'text' ? (
              <View style={styles.inputsBlock}>
                <LinearGradient
                  colors={postBackground(bgKey)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.discussPreview}
                >
                  <Ionicons name="chatbubbles" size={20} color="rgba(255,255,255,0.55)" />
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Share your question or discussion…"
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    style={[styles.discussInput, description.length > 140 && styles.discussInputSmall]}
                    multiline
                    maxLength={5000}
                  />
                </LinearGradient>
                <Text style={styles.bgLabel}>Background</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bgRow}>
                  {POST_BACKGROUNDS.map((b) => {
                    const on = bgKey === b.key;
                    return (
                      <TouchableOpacity key={b.key} activeOpacity={0.85} onPress={() => setBgKey(b.key)} style={styles.bgItem}>
                        <View style={[styles.bgRing, on && styles.bgRingOn]}>
                          <LinearGradient colors={b.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bgSwatch}>
                            {on && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                          </LinearGradient>
                        </View>
                        <Text style={[styles.bgName, on && styles.bgNameOn]}>{b.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
            <View style={styles.inputsBlock}>
              <View style={styles.inputWrapper}>
                <Ionicons name="create-outline" size={17} color="#4F46E5" style={styles.inputIcon} />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={isShort ? 'Short Title (e.g. 15s Vocal Run)' : 'Title (e.g. Chorus High Pitch Practice)'}
                  placeholderTextColor="#94A3B8"
                  style={styles.textInput}
                />
              </View>

              <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                <Ionicons
                  name="document-text-outline"
                  size={17}
                  color="#4F46E5"
                  style={[styles.inputIcon, { marginTop: 10 }]}
                />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What technique details should mentors evaluate?"
                  placeholderTextColor="#94A3B8"
                  style={styles.textArea}
                  multiline
                />
              </View>
            </View>
            )}

            {/* Target Communities Selector */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeader}>
                {isShort ? 'Target Circle (optional)' : 'Target Circle'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {joinedCommunityObjects.map((comm) => {
                  const isSelected = selectedCommunityIds.includes(comm.id);
                  return (
                    <TouchableOpacity
                      key={comm.id}
                      activeOpacity={0.8}
                      onPress={() => handleToggleCommunity(comm.id)}
                      style={[styles.commChip, isSelected && styles.commChipSelected]}
                    >
                      <Text
                        style={[
                          styles.commChipText,
                          isSelected && styles.commChipTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {comm.name.split('&')[0].trim()}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={14} color="#4F46E5" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Sharing / visibility — Public · Private · Schedule */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeader}>Visibility</Text>
              <View style={styles.privacyCardRow}>
                {/* Option 1: Public */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    setIsPrivate(false);
                    setScheduleMode(false);
                  }}
                  style={[
                    styles.privacyOptionCard,
                    !isPrivate && !scheduleMode && styles.privacyOptionPublicActive,
                  ]}
                >
                  <View style={[styles.privacyCardIconBox, !isPrivate && !scheduleMode && { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="globe-outline" size={20} color={!isPrivate && !scheduleMode ? '#4F46E5' : '#64748B'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.privacyCardTitle, !isPrivate && !scheduleMode && { color: '#4F46E5' }]}>
                      Public
                    </Text>
                    <Text style={styles.privacyCardSub}>Visible now in feeds & search</Text>
                  </View>
                  {!isPrivate && !scheduleMode && <Ionicons name="checkmark-circle" size={18} color="#4F46E5" />}
                </TouchableOpacity>

                {/* Option 2: Private */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    setIsPrivate(true);
                    setScheduleMode(false);
                  }}
                  style={[styles.privacyOptionCard, isPrivate && styles.privacyOptionPrivateActive]}
                >
                  <View style={[styles.privacyCardIconBox, isPrivate && { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={isPrivate ? '#D97706' : '#64748B'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.privacyCardTitle, isPrivate && { color: '#D97706' }]}>Private</Text>
                    <Text style={styles.privacyCardSub}>Only you can see it</Text>
                  </View>
                  {isPrivate && <Ionicons name="checkmark-circle" size={18} color="#D97706" />}
                </TouchableOpacity>

                {/* Option 3: Schedule */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    setScheduleMode(true);
                    setIsPrivate(false);
                    if (!scheduledAt) setScheduledAt(SCHEDULE_PRESETS[0].getDate());
                  }}
                  style={[styles.privacyOptionCard, scheduleMode && styles.privacyOptionScheduleActive]}
                >
                  <View style={[styles.privacyCardIconBox, scheduleMode && { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="time-outline" size={20} color={scheduleMode ? '#16A34A' : '#64748B'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.privacyCardTitle, scheduleMode && { color: '#16A34A' }]}>Schedule</Text>
                    <Text style={styles.privacyCardSub}>
                      {scheduleMode && scheduledAt
                        ? `Publishes ${scheduledAt.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                        : 'Publish automatically later'}
                    </Text>
                  </View>
                  {scheduleMode && <Ionicons name="checkmark-circle" size={18} color="#16A34A" />}
                </TouchableOpacity>
              </View>

              {/* Schedule: quick presets + full custom date & time */}
              {scheduleMode && (
                <>
                  <View style={styles.schedulePresetRow}>
                    {SCHEDULE_PRESETS.map((p) => {
                      const d = p.getDate();
                      const active = !!scheduledAt && Math.abs(scheduledAt.getTime() - d.getTime()) < 60 * 1000;
                      return (
                        <TouchableOpacity
                          key={p.label}
                          activeOpacity={0.85}
                          onPress={() => setScheduledAt(p.getDate())}
                          style={[styles.schedulePresetChip, active && styles.schedulePresetChipActive]}
                        >
                          <Text style={[styles.schedulePresetText, active && styles.schedulePresetTextActive]}>
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={openSchedulePicker}
                    style={styles.schedulePickBtn}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#16A34A" />
                    <Text style={styles.schedulePickBtnText}>
                      {scheduledAt
                        ? `Publishes ${scheduledAt.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                        : 'Pick exact date & time'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#16A34A" />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Share / Submit Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handlePublish}
              disabled={isPublishing}
              style={styles.submitBtn}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Ionicons name="paper-plane-outline" size={17} color="#FFFFFF" />
                <Text style={styles.submitText}>
                  {isPublishing
                    ? 'Publishing...'
                    : isShort
                    ? 'Publish Short'
                    : 'Share Practice Content'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Schedule: calendar → time (two clear steps) */}
      <ScheduleSheet
        visible={showSchedulePicker}
        initial={scheduledAt}
        onClose={() => setShowSchedulePicker(false)}
        onConfirm={(d) => {
          setScheduledAt(d);
          setScheduleMode(true);
          setShowSchedulePicker(false);
        }}
      />

      {/* Interactive Goal Date Picker Modal Sheet */}
      <Modal
        visible={showGoalDatePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.datePickerSheet, { paddingBottom: Math.max(insets.bottom, spacing.base - 8) + 8 }]}>
            <View style={styles.dragHandle} />
            <View style={styles.datePickerHeader}>
              <View>
                <Text style={styles.datePickerTitle}>Set Custom Goal Target Date</Text>
                <Text style={styles.datePickerSub}>Pick your target completion year, month, and day</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowGoalDatePickerModal(false)}
                style={styles.closePickerBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Selected Date Preview */}
            <View style={styles.selectedDateBanner}>
              <Ionicons name="calendar" size={18} color="#4F46E5" />
              <Text style={styles.selectedDateText}>
                {goalYear}-{goalMonth}-{goalDay}
              </Text>
            </View>

            {/* 3 Column Date Selector */}
            <View style={styles.dateColumnsWrapper}>
              {/* Year Column */}
              <View style={styles.dateColumn}>
                <Text style={styles.columnLabel}>Year</Text>
                <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                  {['2026', '2027', '2028'].map((y) => {
                    const isActive = goalYear === y;
                    return (
                      <TouchableOpacity
                        key={y}
                        onPress={() => setGoalYear(y)}
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
                  {[
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
                  ].map((m) => {
                    const isActive = goalMonth === m.val;
                    return (
                      <TouchableOpacity
                        key={m.val}
                        onPress={() => setGoalMonth(m.val)}
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
                  {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => {
                    const isActive = goalDay === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setGoalDay(d)}
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
                const monthNames = [
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ];
                const mIdx = parseInt(goalMonth, 10) - 1;
                const formatted = `${monthNames[mIdx] || 'September'} ${parseInt(goalDay, 10)}, ${goalYear}`;
                setTargetDate(formatted);
                setShowGoalDatePickerModal(false);
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
                <Text style={styles.applyDateText}>Set Target Date ({goalYear}-{goalMonth}-{goalDay})</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  closeHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  publishHeaderBtn: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  publishHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  publishHeaderBtnText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    gap: spacing.base,
  },
  formatSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  formatTabTouch: {
    flex: 1,
  },
  formatTabActiveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.lg,
    gap: 5,
  },
  formatTabActiveText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  formatTabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.lg,
    gap: 5,
  },
  formatTabInactiveText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
    color: '#64748B',
  },
  // Goal Set Styles & Active Goal Card
  activeGoalDisplayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    padding: spacing.base,
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    gap: 10,
  },
  activeGoalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeGoalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  activeGoalBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  activeGoalDueTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  activeGoalCardTitle: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  activeGoalProgressBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: borderRadius.lg,
    gap: 6,
  },
  goalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalProgressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalProgressPercent: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  goalDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalDetailSubText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  activeGoalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  logSessionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  logSessionActionText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  editGoalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
    gap: 4,
  },
  editGoalActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  targetSplitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionPillRowCompact: {
    flexDirection: 'row',
    gap: 4,
  },
  targetPillBtnCompact: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  targetPillTextCompact: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  targetPresetChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  targetPresetChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  targetPresetText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  targetPresetTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  goalSectionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: spacing.base,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  goalIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCardTitle: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  goalCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  goalInputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  optionPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  targetPillBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  targetPillBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  targetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  targetPillTextActive: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  saveGoalBtn: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  saveGoalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  saveGoalText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  // Video Practice & Shared Styles
  postHint: { fontSize: 12, color: '#64748B', marginBottom: 8, fontWeight: '600' },
  quickActionsGrid: { flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: 12, paddingVertical: 12 },
  quickTileGrid: { width: '33.33%' },
  photoStripCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 12, marginTop: 12, gap: 10 },
  photoStripHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoStripTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  photoStripClear: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
  photoStrip: { gap: 10 },
  photoThumbWrap: { width: 92, height: 116, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  photoThumb: { width: '100%', height: '100%' },
  photoCoverTag: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  photoCoverText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF' },
  photoRemove: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 92, height: 116, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#F9A8D4', alignItems: 'center', justifyContent: 'center', gap: 2 },
  photoAddText: { fontSize: 11, fontWeight: '800', color: '#DB2777' },
  quickActionsDeck: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickTile: {
    alignItems: 'center',
    gap: 4,
  },
  quickTileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  // Short hint banner
  shortHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: borderRadius.lg,
    padding: 10,
  },
  shortHintText: {
    flex: 1,
    fontSize: 11,
    color: '#4338CA',
    lineHeight: 15,
  },
  // Picking spinner row
  pickingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  pickingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  // Selected media preview
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewMedia: {
    height: 190,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  previewMediaWide: {
    height: undefined,
    width: '100%',
    aspectRatio: 16 / 9,
  },
  previewMediaVertical: {
    height: 300, // 9:16 feel for shorts
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlaceholder: {
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  audioPlaceholderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewKindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  previewKindText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  previewRemoveBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setThumbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    backgroundColor: '#F8FAFC',
  },
  setThumbText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cinemaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cinemaMediaContainer: {
    height: 160,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  cinemaImage: {
    width: '100%',
    height: '100%',
  },
  cinemaOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  cinemaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cinemaCategoryBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  cinemaCategoryText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  durationText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  centerPlayArea: {
    alignSelf: 'center',
  },
  playHalo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripContainer: {
    padding: spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  stripLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 6,
  },
  stripScroll: {
    gap: 8,
  },
  stripThumbnailCard: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stripThumbnailActive: {
    borderColor: '#4F46E5',
    borderWidth: 2,
  },
  miniStripImg: {
    width: '100%',
    height: '100%',
  },
  selectedCheckOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  discussPreview: { borderRadius: 22, padding: 18, minHeight: 170, gap: 6 },
  discussInput: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', lineHeight: 28, minHeight: 110, textAlignVertical: 'top', padding: 0 },
  discussInputSmall: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  bgLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 14, marginBottom: 8 },
  bgRow: { gap: 12, paddingRight: 8 },
  bgItem: { alignItems: 'center', gap: 4 },
  bgRing: { padding: 3, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
  bgRingOn: { borderColor: '#4F46E5' },
  bgSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bgName: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  bgNameOn: { color: '#4F46E5' },
  inputsBlock: {
    gap: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: spacing.sm,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
  },
  textArea: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 65,
  },
  sectionContainer: {
    gap: 6,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  chipsScroll: {
    gap: 8,
  },
  commChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  commChipSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  commChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  commChipTextSelected: {
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  mentorVipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mentorVipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  mentorVipTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  mentorVipSub: {
    fontSize: 10,
    color: '#64748B',
  },
  submitBtn: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  submitText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  // Goal Date Picker Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.base,
    gap: spacing.sm,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  datePickerSub: {
    fontSize: 11,
    color: '#64748B',
  },
  closePickerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.lg,
    gap: 8,
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  dateColumnsWrapper: {
    flexDirection: 'row',
    height: 170,
    gap: 8,
  },
  dateColumn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  columnScroll: {
    flex: 1,
  },
  dateOptionBtn: {
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    marginBottom: 3,
  },
  dateOptionBtnActive: {
    backgroundColor: '#4F46E5',
  },
  dateOptionText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  dateOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  applyDateBtn: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  applyDateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 6,
  },
  applyDateText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // Privacy Scope Option Cards
  privacyCardRow: {
    gap: 8,
  },
  privacyOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  privacyOptionPublicActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  privacyOptionPrivateActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  privacyOptionScheduleActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  schedulePresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  schedulePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  schedulePickBtnText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  schedulePresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  schedulePresetChipActive: {
    backgroundColor: '#DCFCE7',
  },
  schedulePresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  schedulePresetTextActive: {
    color: '#15803D',
    fontWeight: 'bold',
  },
  privacyCardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  privacyCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
});
