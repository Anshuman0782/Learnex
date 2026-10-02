import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import {
  User,
  UserRole,
  Community,
  Skill,
  CommunityPost,
  PostComment,
  XPTask,
  XPLeaderboardEntry,
  SeasonRewardItem,
  SeasonCycleInfo,
  CommunityEvent,
  UserPersonalStats,
} from '../types';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, getRecordingPermissionsAsync, type AudioPlayer } from 'expo-audio';
import { audioMeter, pushAudioSample, resetAudioMeter, quietAudioMeter, setAudioMetered } from '../services/audioMeter';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { VideoPlayerModal } from '../components/common/VideoPlayerModal';
import { NowPlayingBar } from '../components/common/NowPlayingBar';
import { RepostModal } from '../components/common/RepostModal';
import {
  loginRequest,
  logoutRequest,
  meRequest,
  registerRequest,
  type ApiUser,
  type AuthResponse,
} from '../api/auth.api';
import { enrollAsLearnerRequest } from '../api/onboarding.api';
import {
  getRecommendedCommunitiesRequest,
  getJoinedCommunitiesRequest,
  getSkillsRequest,
  joinCommunityRequest,
  leaveCommunityRequest,
  createCommunityRequest,
  updateCommunityRequest,
  deleteCommunityRequest,
  removeCommunityMemberRequest,
  addCommunityMembersRequest,
  setCommunityAdminRequest,
  type CreateCommunityBody,
  type UpdateCommunityBody,
} from '../api/communities.api';
import {
  getFeedRequest,
  getReelsRequest,
  createPostRequest,
  recordPostViewRequest,
  setPostLikeRequest,
  setPostSaveRequest,
  setPostRepostRequest,
  addCommentRequest,
  setCommentLikeRequest,
  deletePostRequest,
  updatePostRequest,
} from '../api/posts.api';
import { uploadFileRequest } from '../api/media.api';
import { updateProfileRequest } from '../api/users.api';
import {
  getStatsRequest,
  checkInRequest,
  sendUsageHeartbeatRequest,
  getQuestsRequest,
  getGoalRequest,
  saveGoalRequest,
  logSessionRequest,
  claimQuestRequest,
} from '../api/gamification.api';
import {
  getCurrentSeasonRequest,
  getLeaderboardRequest,
  getRewardsRequest,
  claimRewardRequest,
  getEventsRequest,
  voteEventRequest,
  unvoteEventRequest,
  collectEventRequest,
  createEventRequest,
  deleteEventRequest,
  type CreateEventBody,
  type EventCollectResult,
} from '../api/competition.api';
import {
  getNotificationsRequest,
  getUnreadCountRequest,
  markNotificationsReadRequest,
  deleteNotificationRequest,
  clearNotificationsRequest,
  type AppNotification,
} from '../api/notifications.api';
import { connectSocket, disconnectSocket } from '../realtime/socket';
import { registerForPush, unregisterPush, setAppBadge, type PushData } from '../realtime/push';
import { FEATURES } from '../config/features';
import { getChatUnreadRequest, type ChatMessage } from '../api/chat.api';

/** Who a chat thread is with (enough to render the header before loading). */
export interface ChatPeer {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: string | null;
}

export type ChatView = { mode: 'inbox' } | { mode: 'thread'; peer: ChatPeer };
import { deleteCommentRequest, editCommentRequest } from '../api/social.api';
import { NotificationsModal } from '../components/common/NotificationsModal';
import { saveTokens, clearTokens, getAccessToken } from '../services/tokenStorage';
import { setOnAuthFailure } from '../api/client';
/** Placeholder until the server's season loads: the real current month (UTC). */
function currentMonthSeason(): SeasonCycleInfo {
  const now = new Date();
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const number = (now.getUTCFullYear() - 2026) * 12 + now.getUTCMonth() + 1;
  const month = startsAt.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return {
    id: `season-${number}`,
    seasonNumber: number,
    title: `Season ${number} · ${month}`,
    subtitle: 'Earn XP this month to climb your leaderboard. Rankings reset on the 1st.',
    daysLeft: Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86400000)),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    endsAtDate: endsAt.toISOString().slice(0, 10),
    totalPrizePool: '',
    activeParticipants: '',
  };
}
import { UserProfileData } from '../components/common/UserProfileModal';

export interface AppDialogConfig {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  confirmText?: string;
  cancelText?: string | null;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AddCommentPayload {
  text: string;
  isMentorCritique?: boolean;
  commentType?: 'general' | 'mentor';
  mentorRating?: number;
  critiqueFocus?: string;
  videoCritiqueThumbnail?: string;
  videoCritiqueDuration?: string;
  videoCritiqueTitle?: string;
}

export interface UserGoalTarget {
  id: string;
  title: string;
  targetSessions: number;
  targetHours: number;
  targetDate: string;
  completedSessions: number;
  dailyReminders: boolean;
}

interface CreatePostPayload {
  title?: string;
  communityId?: string;
  communityIds?: string[];
  content: string;
  tag: string;
  tags?: string[];
  postType: 'text' | 'video' | 'audio' | 'image' | 'critique_request';
  imageUrls?: string[];
  videoUrl?: string;
  videoThumbnail?: string;
  videoDuration?: string;
  audioUrl?: string;
  isShort?: boolean;
  isPrivate?: boolean;
  scheduledAt?: string;
  focusArea?: string;
  bgStyle?: string;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  selectedHobby: string;
  joinedCommunities: string[];
  selectedRole: UserRole | null;
  posts: CommunityPost[];
  activeGoal: UserGoalTarget | null;
  userStats: UserPersonalStats | null;
  saveUserGoal: (goal: Partial<UserGoalTarget>) => Promise<void>;
  logGoalSession: () => Promise<void>;
  selectedProfileUser: UserProfileData | null;
  openUserProfile: (profile: UserProfileData) => void;
  closeUserProfile: () => void;
  isMyProfileOpen: boolean;
  openMyProfile: () => void;
  closeMyProfile: () => void;
  // Rewards & XP Leaderboards
  isRewardsModalOpen: boolean;
  openRewardsModal: () => void;
  closeRewardsModal: () => void;
  xpTasks: XPTask[];
  mentorLeaderboard: XPLeaderboardEntry[];
  learnerLeaderboard: XPLeaderboardEntry[];
  seasonCycle: SeasonCycleInfo;
  /** Increments when an admin changes XP rules (screens refetch on change). */
  xpRulesVersion: number;
  // Chat
  chatUnread: number;
  refreshChatUnread: () => void;
  chatView: ChatView | null;
  openChatInbox: () => void;
  openChatWith: (peer: ChatPeer) => void;
  closeChat: () => void;
  setActiveChatConversation: (id: string | null) => void;
  seasonRewards: SeasonRewardItem[];
  claimXPTask: (taskId: string) => Promise<{ earnedXP: number; taskTitle: string } | null>;
  activeRewardClaimModal: SeasonRewardItem | null;
  openRewardClaimModal: (reward: SeasonRewardItem) => void;
  closeRewardClaimModal: () => void;
  // Community Events
  communityEvents: CommunityEvent[];
  /** Vote to join (true) or withdraw (false) while voting is open. */
  voteCommunityEvent: (eventId: string, join: boolean) => Promise<boolean>;
  /** Collect XP earned so far (the server re-verifies progress). */
  collectEventXp: (
    eventId: string,
  ) => Promise<{ ok: true; result: EventCollectResult } | { ok: false; message: string }>;
  createCommunityEvent: (body: CreateEventBody) => Promise<void>;
  endCommunityEvent: (eventId: string) => Promise<void>;
  refreshEvents: () => Promise<void>;
  fetchLeaderboard: (role: UserRole, category: string) => Promise<XPLeaderboardEntry[]>;
  claimReward: (rewardId: string) => Promise<{ title: string; code: string } | null>;
  // Auth & General
  bootstrapping: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  signup: (data: {
    name: string;
    phone: string;
    email: string;
    password?: string;
    dob: string;
    hobby: string;
    avatarUrl?: string;
  }) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  updateAvatar: (uri: string, mimeType: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  editComment: (commentId: string, text: string) => Promise<void>;
  toggleCommunityJoin: (communityId: string) => Promise<void>;
  createCommunity: (body: CreateCommunityBody) => Promise<Community>;
  updateCircle: (id: string, body: UpdateCommunityBody) => Promise<Community>;
  addCircleMembers: (id: string, members: { userId: string; isAdmin?: boolean }[]) => Promise<Community>;
  setCircleAdmin: (id: string, userId: string, isAdmin: boolean) => Promise<Community>;
  removeCircleMember: (id: string, userId: string) => Promise<Community>;
  deleteCircle: (id: string) => Promise<void>;
  toggleLikePost: (postId: string) => Promise<void>;
  toggleSavePost: (postId: string) => Promise<void>;
  toggleLikeComment: (postId: string, commentId: string) => Promise<void>;
  addCommentToPost: (postId: string, payload: AddCommentPayload) => Promise<void>;
  recordPostView: (postId: string) => Promise<void>;
  toggleRepost: (postId: string) => Promise<void>;
  // Repost composer: tap repost → compose (caption + optional circle) or un-repost.
  repostComposerPost: CommunityPost | null;
  pressRepost: (post: CommunityPost) => void;
  closeRepostComposer: () => void;
  submitRepost: (opts: { caption?: string; communityId?: string }) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  setPostPrivacy: (postId: string, isPrivate: boolean) => Promise<CommunityPost>;
  createPost: (payload: CreatePostPayload) => Promise<void>;
  enrollAsLearner: () => Promise<void>;
  applyMentorSession: (session: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  getRecommendedCommunities: () => Community[];
  getSkillsForUser: () => Skill[];
  getJoinedCommunityObjects: () => Community[];
  showDialog: (config: AppDialogConfig) => void;
  hideDialog: () => void;
  playVideo: (url: string) => void;
  closeVideo: () => void;
  // Reels (shorts) feed
  reels: CommunityPost[];
  loadReels: () => Promise<void>;
  // App-level audio player (voice takes / audio posts)
  audioPost: CommunityPost | null;
  isAudioPlaying: boolean;
  playAudioPost: (post: CommunityPost) => void;
  toggleAudioPlayback: () => void;
  closeAudioPost: () => void;
  // Realtime notifications
  notifications: AppNotification[];
  unreadCount: number;
  openNotifications: () => void;
  closeNotifications: () => void;
  markNotificationsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  /** NotificationRouter registers how to open a notification's target. */
  setNotificationOpener: (fn: ((data: PushData) => void) | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [bootstrapping, setBootstrapping] = useState<boolean>(true);
  const [selectedHobby, setSelectedHobby] = useState<string>('Music');
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  // Community & skill catalog, loaded from the backend once authenticated.
  const [recommendedCommunities, setRecommendedCommunities] = useState<Community[]>([]);
  const [joinedCommunityObjects, setJoinedCommunityObjects] = useState<Community[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [activeGoal, setActiveGoal] = useState<UserGoalTarget | null>(null);
  const [userStats, setUserStats] = useState<UserPersonalStats | null>(null);

  /** Copy the real gamification numbers onto the `user` object so the header,
   *  profile and streak pill all read live values instead of placeholders. */
  const mergeStatsIntoUser = (stats: {
    streakDays: number;
    xpPoints: number;
    levelBadge: string;
    level: number;
    seasonXp?: number;
    seasonRank?: number;
  }) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            streakDays: stats.streakDays,
            xpPoints: stats.xpPoints,
            levelBadge: stats.levelBadge,
            level: stats.level,
            seasonXp: stats.seasonXp ?? 0,
            seasonRank: stats.seasonRank ?? 0,
          }
        : prev,
    );
  };

  const refreshStats = async () => {
    try {
      const stats = await getStatsRequest();
      setUserStats(stats);
      mergeStatsIntoUser(stats);
    } catch {
      // keep previous stats
    }
  };

  /** Daily check-in: advances the real streak once per day, then syncs stats. */
  const dailyCheckIn = async () => {
    try {
      const stats = await checkInRequest();
      setUserStats(stats);
      mergeStatsIntoUser(stats);
    } catch {
      // non-fatal — stats will still load via loadGamification
    }
  };

  const saveUserGoal = async (goalData: Partial<UserGoalTarget>) => {
    try {
      const saved = await saveGoalRequest({
        title: goalData.title,
        targetSessions: goalData.targetSessions,
        targetHours: goalData.targetHours,
        targetDate: goalData.targetDate,
        dailyReminders: goalData.dailyReminders,
      });
      setActiveGoal(saved);
    } catch (err: any) {
      showDialog({
        title: 'Could Not Save Goal',
        message: err?.message || 'Please check your connection and try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Got it',
      });
    }
  };

  const logGoalSession = async () => {
    try {
      const res = await logSessionRequest();
      if (res.goal) setActiveGoal(res.goal);
      await refreshStats();
    } catch {
      // ignore — stats will re-sync on next load
    }
  };
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfileData | null>(null);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);

  const openMyProfile = () => {
    setIsMyProfileOpen(true);
  };

  const closeMyProfile = () => {
    setIsMyProfileOpen(false);
  };
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);
  const [xpTasks, setXpTasks] = useState<XPTask[]>([]);
  const [mentorLeaderboard, setMentorLeaderboard] = useState<XPLeaderboardEntry[]>([]);
  const [learnerLeaderboard, setLearnerLeaderboard] = useState<XPLeaderboardEntry[]>([]);
  const [seasonCycle, setSeasonCycle] = useState<SeasonCycleInfo>(currentMonthSeason);
  // Bumped whenever an admin changes XP rules, so open screens refetch the rulebook.
  const [xpRulesVersion, setXpRulesVersion] = useState(0);

  // --- Chat ---
  const [chatUnread, setChatUnread] = useState(0);
  const [chatView, setChatView] = useState<ChatView | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const myIdRef = useRef<string | null>(null);

  const refreshChatUnread = () => {
    getChatUnreadRequest()
      .then((r) => setChatUnread(r.count))
      .catch(() => {});
  };
  const openChatInbox = () => setChatView({ mode: 'inbox' });
  const openChatWith = (peer: ChatPeer) => setChatView({ mode: 'thread', peer });
  const closeChat = () => {
    activeChatIdRef.current = null;
    setChatView(null);
    refreshChatUnread();
  };
  /** The chat screen reports which conversation is on screen (no badge for it). */
  const setActiveChatConversation = (id: string | null) => {
    activeChatIdRef.current = id;
  };

  useEffect(() => {
    myIdRef.current = user?.id ?? null;
    if (!user) {
      setChatUnread(0);
      setChatView(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const [seasonRewards, setSeasonRewards] = useState<SeasonRewardItem[]>([]);
  const [activeRewardClaimModal, setActiveRewardClaimModal] = useState<SeasonRewardItem | null>(null);
  const [activeDialog, setActiveDialog] = useState<AppDialogConfig | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [reels, setReels] = useState<CommunityPost[]>([]);
  const [audioPost, setAudioPost] = useState<CommunityPost | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  const openNotifications = () => setIsNotificationsOpen(true);
  const notificationOpenerRef = useRef<((data: PushData) => void) | null>(null);
  const setNotificationOpener = (fn: ((data: PushData) => void) | null) => {
    notificationOpenerRef.current = fn;
  };
  /** Bell item tapped: close the sheet and open what it's about. */
  const openNotificationItem = (n: AppNotification) => {
    const data: PushData = {
      ...((n.data as PushData | undefined) ?? {}),
      postId: (n.data as PushData | undefined)?.postId ?? n.postId,
      actorName: n.actorName,
      fromName: n.actorName,
    };
    if (!data.kind && n.postId) data.kind = 'post';
    if (data.kind === 'announcement') return; // already reading it here
    setIsNotificationsOpen(false);
    notificationOpenerRef.current?.(data);
  };
  const closeNotifications = () => setIsNotificationsOpen(false);
  const markNotificationsRead = async () => {
    try {
      await markNotificationsReadRequest();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  };

  /** Delete one notification (optimistic; restored if the server refuses). */
  const deleteNotification = async (id: string) => {
    const before = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - (before.find((n) => n.id === id && !n.read) ? 1 : 0)));
    try {
      await deleteNotificationRequest(id);
    } catch {
      setNotifications(before);
    }
  };

  /** Clear the whole notification history. */
  const clearNotifications = async () => {
    const before = notifications;
    setNotifications([]);
    setUnreadCount(0);
    try {
      await clearNotificationsRequest();
    } catch {
      setNotifications(before);
    }
  };

  const showDialog = (config: AppDialogConfig) => {
    setActiveDialog(config);
  };

  const hideDialog = () => {
    setActiveDialog(null);
  };

  const playVideo = (url: string) => setActiveVideoUrl(url);
  const closeVideo = () => setActiveVideoUrl(null);

  // --- App-level audio player (voice takes / audio posts) ---
  // Invariant: at most ONE audio exists at a time. Every player we create is
  // tracked; before anything new plays, all of them are STOPPED and released
  // (Android doesn't stop playback on release alone — that left orphaned audio
  // playing with no way to control it). UI state follows the player's REAL
  // status, never a guess.
  const livePlayersRef = useRef<Set<AudioPlayer>>(new Set());
  const playerSubsRef = useRef<Map<AudioPlayer, Array<{ remove: () => void }>>>(new Map());
  const audioPostIdRef = useRef<string | null>(null);

  const stopAndRelease = (player: AudioPlayer) => {
    playerSubsRef.current.get(player)?.forEach((sub) => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    });
    playerSubsRef.current.delete(player);
    try {
      player.pause();
    } catch {
      /* ignore */
    }
    try {
      if (player.isAudioSamplingSupported) player.setAudioSamplingEnabled(false);
    } catch {
      /* ignore */
    }
    try {
      player.remove();
    } catch {
      /* ignore */
    }
    livePlayersRef.current.delete(player);
  };

  const releaseAudioPlayer = () => {
    Array.from(livePlayersRef.current).forEach(stopAndRelease);
    audioPlayerRef.current = null;
    audioPostIdRef.current = null;
    resetAudioMeter();
  };

  const playAudioPost = (post: CommunityPost) => {
    if (!post.audioUrl) return;
    // Same post already loaded → just play/pause it (never a second player).
    if (audioPostIdRef.current === post.id && audioPlayerRef.current) {
      toggleAudioPlayback();
      return;
    }
    releaseAudioPlayer();
    try {
      void setAudioModeAsync({ playsInSilentMode: true });
      const player = createAudioPlayer({ uri: post.audioUrl }, { updateInterval: 100 });
      livePlayersRef.current.add(player);
      audioPlayerRef.current = player;
      audioPostIdRef.current = post.id;

      const subs: Array<{ remove: () => void }> = [];
      // Real status drives the UI (playing flag, progress, end of track).
      subs.push(
        player.addListener('playbackStatusUpdate', (st) => {
          if (audioPlayerRef.current !== player) return;
          if (st.duration > 0) audioMeter.progress.setValue(Math.min(1, st.currentTime / st.duration));
          if (st.didJustFinish) {
            try {
              player.pause();
              void player.seekTo(0);
            } catch {
              /* ignore */
            }
            quietAudioMeter();
            audioMeter.progress.setValue(0);
            setIsAudioPlaying(false);
            return;
          }
          setIsAudioPlaying(st.playing);
          if (!st.playing) quietAudioMeter();
        }),
      );
      // Real loudness levels — only if mic permission is ALREADY granted
      // (Android's visualizer needs it). Never prompt just for visuals.
      subs.push(
        player.addListener('audioSampleUpdate', (sample) => {
          if (audioPlayerRef.current === player) pushAudioSample(sample);
        }),
      );
      playerSubsRef.current.set(player, subs);
      void (async () => {
        try {
          const perm = await getRecordingPermissionsAsync();
          if (perm.granted && audioPlayerRef.current === player && player.isAudioSamplingSupported) {
            player.setAudioSamplingEnabled(true);
            setAudioMetered(true);
          }
        } catch {
          /* visuals fall back to progress-only */
        }
      })();
      player.play();
      setAudioPost(post);
      setIsAudioPlaying(true);
    } catch {
      releaseAudioPlayer();
      setAudioPost(null);
      setIsAudioPlaying(false);
    }
  };

  const toggleAudioPlayback = () => {
    const player = audioPlayerRef.current;
    if (!player) return;
    try {
      // Ask the player, not React state (which can be a render behind).
      if (player.playing) {
        player.pause();
        quietAudioMeter();
        setIsAudioPlaying(false);
      } else {
        player.play();
        setIsAudioPlaying(true);
      }
    } catch {
      /* ignore */
    }
  };

  /** Stops the audio completely and hides the mini player. */
  const closeAudioPost = () => {
    releaseAudioPlayer();
    setAudioPost(null);
    setIsAudioPlaying(false);
  };

  // Never leave audio running after the app tree unmounts (logout / reload).
  useEffect(() => () => releaseAudioPlayer(), []);

  /** Load the Reels feed (shorts) from the backend. */
  const loadReels = async () => {
    try {
      setReels(await getReelsRequest());
    } catch {
      /* keep whatever we have */
    }
  };

  const openRewardsModal = () => {
    setIsRewardsModalOpen(true);
  };

  const closeRewardsModal = () => {
    setIsRewardsModalOpen(false);
  };

  const openRewardClaimModal = (reward: SeasonRewardItem) => {
    setActiveRewardClaimModal(reward);
  };

  const closeRewardClaimModal = () => {
    setActiveRewardClaimModal(null);
  };

  const claimXPTask = async (
    taskId: string
  ): Promise<{ earnedXP: number; taskTitle: string } | null> => {
    try {
      const res = await claimQuestRequest(taskId);
      setXpTasks(res.quests);
      await refreshStats();
      return { earnedXP: res.earnedXP, taskTitle: res.taskTitle };
    } catch {
      return null;
    }
  };

  /** Load stats, quests and the active goal from the backend. */
  const loadGamification = async () => {
    try {
      const [stats, quests, goal] = await Promise.all([
        getStatsRequest(),
        getQuestsRequest(),
        getGoalRequest(),
      ]);
      setUserStats(stats);
      mergeStatsIntoUser(stats);
      setXpTasks(quests);
      setActiveGoal(goal);
    } catch {
      // screens handle empty gracefully
    }
  };

  const [communityEvents, setCommunityEvents] = useState<CommunityEvent[]>([]);

  /** Load season, rewards, events and the top leaderboards from the backend. */
  const loadCompetition = async () => {
    try {
      const [season, rewards, events, learners, mentors] = await Promise.all([
        getCurrentSeasonRequest(),
        getRewardsRequest(),
        getEventsRequest(),
        getLeaderboardRequest('Learner', 'All'),
        getLeaderboardRequest('Mentor', 'All'),
      ]);
      setSeasonCycle(season);
      setSeasonRewards(rewards);
      setCommunityEvents(events);
      setLearnerLeaderboard(learners);
      setMentorLeaderboard(mentors);
    } catch {
      // screens handle empty gracefully
    }
  };

  const refreshEvents = async () => {
    try {
      setCommunityEvents(await getEventsRequest());
    } catch {
      /* keep previous */
    }
  };

  /** Fetch a leaderboard for a specific role + hobby category (used by RankScreen). */
  const fetchLeaderboard = (role: UserRole, category: string): Promise<XPLeaderboardEntry[]> =>
    getLeaderboardRequest(role, category);

  const voteCommunityEvent = async (eventId: string, join: boolean): Promise<boolean> => {
    try {
      if (join) await voteEventRequest(eventId);
      else await unvoteEventRequest(eventId);
      await refreshEvents();
      return true;
    } catch (e) {
      showDialog({
        title: join ? 'Could Not Vote' : 'Could Not Withdraw',
        message: (e as Error)?.message || 'Please check your connection and try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Got it',
      });
      return false;
    }
  };

  const collectEventXp = async (
    eventId: string,
  ): Promise<{ ok: true; result: EventCollectResult } | { ok: false; message: string }> => {
    try {
      const result = await collectEventRequest(eventId);
      await Promise.all([refreshEvents(), refreshStats()]);
      return { ok: true, result };
    } catch (e) {
      return { ok: false, message: (e as Error)?.message || 'Please try again.' };
    }
  };

  /** Admins only — errors (e.g. anti-cheat limits) are thrown to the form. */
  const createCommunityEvent = async (body: CreateEventBody): Promise<void> => {
    await createEventRequest(body);
    await refreshEvents();
  };

  const endCommunityEvent = async (eventId: string): Promise<void> => {
    await deleteEventRequest(eventId);
    await refreshEvents();
  };

  /** Claim a season reward the user is eligible for. */
  const claimReward = async (rewardId: string): Promise<{ title: string; code: string } | null> => {
    try {
      const res = await claimRewardRequest(rewardId);
      setSeasonRewards(await getRewardsRequest());
      return { title: res.title, code: res.code };
    } catch {
      return null;
    }
  };

  const openUserProfile = (profile: UserProfileData) => {
    setSelectedProfileUser(profile);
  };

  const closeUserProfile = () => {
    setSelectedProfileUser(null);
  };

  useEffect(() => {
    if (user) {
      if (user.hobby) setSelectedHobby(user.hobby);
      if (user.joinedCommunities) setJoinedCommunities(user.joinedCommunities);
      if (user.role) setSelectedRole(user.role);
    }
  }, [user]);

  /**
   * Maps the backend user shape onto the frontend `User` type.
   * Backend uses UPPERCASE roles; the app uses 'Learner' / 'Mentor'.
   * Gamification/community fields aren't served yet (later phases) — we keep
   * any existing local values or fall back to sensible defaults so the UI holds.
   */
  const toLocalUser = (api: ApiUser, avatarOverride?: string): User => ({
    id: api.id,
    name: api.name,
    email: api.email,
    phone: api.phone ?? '',
    dob: api.dob ?? '',
    hobby: api.hobby ?? 'Music',
    role: api.role === 'MENTOR' ? 'Mentor' : api.role === 'LEARNER' ? 'Learner' : undefined,
    joinedCommunities: [],
    avatarUrl: avatarOverride || api.avatarUrl || user?.avatarUrl || undefined,
    streakDays: user?.streakDays ?? 0,
    xpPoints: user?.xpPoints ?? 0,
    levelBadge: user?.levelBadge ?? 'Newcomer',
    level: user?.level,
    seasonXp: user?.seasonXp,
    seasonRank: user?.seasonRank,
    isAdmin: !!api.isAdmin,
  });

  const applySession = (api: ApiUser, avatarOverride?: string) => {
    const localUser = toLocalUser(api, avatarOverride);
    setUser(localUser);
    setSelectedHobby(localUser.hobby || 'Music');
    setSelectedRole(localUser.role ?? null);
    setIsAuthenticated(!!localUser.role);
  };

  // On app launch: if a stored session exists, restore it via /me.
  useEffect(() => {
    let active = true;
    // If the refresh flow fails anywhere, force the app back to a logged-out state.
    setOnAuthFailure(() => {
      setUser(null);
      setIsAuthenticated(false);
      setSelectedRole(null);
      setJoinedCommunities([]);
    });

    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const me = await meRequest();
          if (active) applySession(me);
        }
      } catch {
        // No valid session — stay logged out.
        await clearTokens();
      } finally {
        if (active) setBootstrapping(false);
      }
    })();

    return () => {
      active = false;
      setOnAuthFailure(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (identifier: string, pass: string): Promise<void> => {
    const { user: apiUser, tokens } = await loginRequest(identifier.trim(), pass);
    await saveTokens(tokens);
    applySession(apiUser);
  };

  const signup = async (data: {
    name: string;
    phone: string;
    email: string;
    password?: string;
    dob: string;
    hobby: string;
    avatarUrl?: string;
  }): Promise<void> => {
    const { user: apiUser, tokens } = await registerRequest({
      name: data.name,
      email: data.email,
      phone: data.phone?.replace(/\s+/g, '') || undefined,
      password: data.password ?? '',
      dob: data.dob,
      hobby: data.hobby,
    });
    await saveTokens(tokens);

    // If they chose a profile photo (a local device URI), upload it now that we
    // have a token, and persist the resulting URL on their profile.
    let finalAvatar: string | undefined;
    if (data.avatarUrl && /^(file|content|ph):/i.test(data.avatarUrl)) {
      try {
        const mime = data.avatarUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const up = await uploadFileRequest(data.avatarUrl, mime);
        const updated = await updateProfileRequest({ avatarUrl: up.url });
        finalAvatar = updated.avatarUrl ?? up.url;
      } catch {
        // Non-fatal — they can set an avatar later from their profile.
      }
    }

    // New accounts have no role yet → keep them in onboarding (isAuthenticated stays false).
    applySession(apiUser, finalAvatar);
  };

  const updateUser = async (data: Partial<User>): Promise<void> => {
    setUser((prev) => (prev ? { ...prev, ...data } : null));
    if (data.hobby) setSelectedHobby(data.hobby);
    if (data.role) setSelectedRole(data.role);
    // Persist server-backed profile fields (name/avatar/bio/handle); hobby stays local.
    if (
      data.name !== undefined ||
      data.avatarUrl !== undefined ||
      data.bio !== undefined ||
      data.handle !== undefined
    ) {
      await updateProfileRequest({
        name: data.name,
        avatarUrl: data.avatarUrl,
        bio: data.bio,
        handle: data.handle,
      });
    }
  };

  /** Delete one of your own comments and update the feed. */
  const deleteComment = async (commentId: string): Promise<void> => {
    try {
      const updated = await deleteCommentRequest(commentId);
      replacePost(updated);
    } catch (err: any) {
      showDialog({
        title: 'Could Not Delete',
        message: err?.message || 'Please try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Got it',
      });
    }
  };

  /** Edit one of your own comments and update the feed. */
  const editComment = async (commentId: string, text: string): Promise<void> => {
    try {
      const updated = await editCommentRequest(commentId, text);
      replacePost(updated);
    } catch {
      /* ignore */
    }
  };

  /** Upload a newly-picked profile photo and persist it on the server. */
  const updateAvatar = async (uri: string, mimeType: string): Promise<void> => {
    const up = await uploadFileRequest(uri, mimeType);
    const updated = await updateProfileRequest({ avatarUrl: up.url });
    const url = updated.avatarUrl ?? up.url;
    setUser((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
  };

  /** Fetch communities + skills from the backend for the current user. */
  const loadCommunityData = async () => {
    try {
      const [recommended, joined, userSkills] = await Promise.all([
        getRecommendedCommunitiesRequest(),
        getJoinedCommunitiesRequest(),
        getSkillsRequest(),
      ]);
      setRecommendedCommunities(recommended);
      setJoinedCommunityObjects(joined);
      setSkills(userSkills);
      setJoinedCommunities(joined.map((c) => c.id));
    } catch {
      // Leave whatever we have; screens handle empty gracefully.
    }
  };

  /** Create a new circle; the creator is the first admin + member. */
  const createCommunity = async (body: CreateCommunityBody): Promise<Community> => {
    const created = await createCommunityRequest(body);
    setJoinedCommunityObjects((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    setJoinedCommunities((prev) => (prev.includes(created.id) ? prev : [created.id, ...prev]));
    return created;
  };

  /** Replace one circle in the joined/recommended lists with a fresh copy. */
  const replaceCommunity = (updated: Community) => {
    setJoinedCommunityObjects((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setRecommendedCommunities((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const updateCircle = async (id: string, body: UpdateCommunityBody): Promise<Community> => {
    const updated = await updateCommunityRequest(id, body);
    replaceCommunity(updated);
    return updated;
  };

  const addCircleMembers = async (
    id: string,
    members: { userId: string; isAdmin?: boolean }[],
  ): Promise<Community> => {
    const updated = await addCommunityMembersRequest(id, members);
    replaceCommunity(updated);
    return updated;
  };

  const setCircleAdmin = async (id: string, userId: string, isAdmin: boolean): Promise<Community> => {
    const updated = await setCommunityAdminRequest(id, userId, isAdmin);
    replaceCommunity(updated);
    return updated;
  };

  const removeCircleMember = async (id: string, userId: string): Promise<Community> => {
    const updated = await removeCommunityMemberRequest(id, userId);
    replaceCommunity(updated);
    return updated;
  };

  const deleteCircle = async (id: string): Promise<void> => {
    await deleteCommunityRequest(id);
    setJoinedCommunityObjects((prev) => prev.filter((c) => c.id !== id));
    setRecommendedCommunities((prev) => prev.filter((c) => c.id !== id));
    setJoinedCommunities((prev) => prev.filter((cid) => cid !== id));
  };

  // Load community/skill data whenever we have a signed-in user — including
  // during onboarding (a registered user with a token but no role yet), so the
  // Community Recommendation screen shows real communities.
  useEffect(() => {
    if (user) {
      loadCommunityData();
      loadPosts();
      loadReels();
      loadGamification();
      loadCompetition();
      dailyCheckIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedHobby]);

  // Realtime: connect the socket, load notifications, and listen for live events.
  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const token = await getAccessToken();
      if (!token || !active) return;
      const sock = connectSocket(token);

      // Phone notifications (dev / production build only — no-op in Expo Go).
      if (FEATURES.pushNotifications) void registerForPush();

      // Live chat: badge updates for messages in threads we're not looking at.
      sock.on('chat:message', (m: ChatMessage) => {
        if (m.senderId !== myIdRef.current && activeChatIdRef.current !== m.conversationId) {
          setChatUnread((c) => c + 1);
        }
      });
      sock.on('chat:read', (p: { readerId: string }) => {
        if (p.readerId === myIdRef.current) refreshChatUnread();
      });
      refreshChatUnread();

      // A new comment/critique on a post we're showing — merge it live.
      sock.on('comment:new', (payload: { postId: string; comment: PostComment }) => {
        const { postId, comment } = payload;
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== postId) return p;
            if (p.comments?.some((c) => c.id === comment.id)) return p; // dedupe our own
            const isMentor = !!comment.isMentorCritique;
            return {
              ...p,
              comments: [comment, ...(p.comments || [])],
              commentsCount: p.commentsCount + 1,
              mentorCritiqueCount: isMentor
                ? (p.mentorCritiqueCount || 0) + 1
                : p.mentorCritiqueCount,
              generalCommentsCount: !isMentor
                ? (p.generalCommentsCount || 0) + 1
                : p.generalCommentsCount,
            };
          })
        );
      });

      // A live in-app notification for us.
      sock.on('notification', (n: AppNotification) => {
        setNotifications((prev) => [n, ...prev]);
        setUnreadCount((c) => c + 1);
      });
      // Bulk notifications (admin announcements) → re-fetch the bell.
      sock.on('notifications:refresh', () => {
        Promise.all([getNotificationsRequest(), getUnreadCountRequest()])
          .then(([list, unread]) => {
            setNotifications(list);
            setUnreadCount(unread.count);
          })
          .catch(() => {});
      });

      // An admin changed the XP economy → refresh rules, quests and stats now.
      sock.on('xp:rules-updated', () => {
        setXpRulesVersion((v) => v + 1);
        getQuestsRequest().then(setXpTasks).catch(() => {});
        void refreshStats();
      });

      // An admin created or ended a circle event → refresh events now.
      sock.on('events:updated', () => {
        void refreshEvents();
      });

      // An admin changed the rewards catalog → refresh it now.
      sock.on('rewards:updated', () => {
        getRewardsRequest().then(setSeasonRewards).catch(() => {});
      });

      // Our own Admin Panel access was granted or revoked.
      sock.on('admin:access-changed', (payload: { isAdmin: boolean }) => {
        setUser((prev) => (prev ? { ...prev, isAdmin: payload.isAdmin } : prev));
      });

      try {
        const [list, unread] = await Promise.all([
          getNotificationsRequest(),
          getUnreadCountRequest(),
        ]);
        if (active) {
          setNotifications(list);
          setUnreadCount(unread.count);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      active = false;
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Time-in-app tracking: report foreground time (≤ once a minute, and when the
  // app goes to background) so admins can see real engagement.
  useEffect(() => {
    if (!user?.id) return;
    let foreground = AppState.currentState === 'active';
    let lastBeat = Date.now();
    const flush = () => {
      const secs = Math.round((Date.now() - lastBeat) / 1000);
      lastBeat = Date.now();
      if (secs >= 5) sendUsageHeartbeatRequest(Math.min(secs, 120)).catch(() => {});
    };
    const timer = setInterval(() => {
      if (foreground) flush();
    }, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        foreground = true;
        lastBeat = Date.now();
      } else if (foreground) {
        flush();
        foreground = false;
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      if (foreground) flush();
    };
  }, [user?.id]);

  /** Join or leave a community on the server, updating local lists optimistically. */
  const toggleCommunityJoin = async (communityId: string) => {
    const isJoined = joinedCommunities.includes(communityId);
    try {
      if (isJoined) {
        await leaveCommunityRequest(communityId);
      } else {
        await joinCommunityRequest(communityId);
      }
      // Reflect the change locally without a full refetch.
      setJoinedCommunities((prev) =>
        isJoined ? prev.filter((id) => id !== communityId) : [...prev, communityId]
      );
      setRecommendedCommunities((prev) =>
        prev.map((c) => (c.id === communityId ? { ...c, isJoined: !isJoined } : c))
      );
      if (isJoined) {
        setJoinedCommunityObjects((prev) => prev.filter((c) => c.id !== communityId));
      } else {
        const found = recommendedCommunities.find((c) => c.id === communityId);
        if (found) {
          setJoinedCommunityObjects((prev) =>
            prev.some((c) => c.id === communityId) ? prev : [{ ...found, isJoined: true }, ...prev]
          );
        } else {
          // Not in the recommended list — refetch joined to stay accurate.
          getJoinedCommunitiesRequest()
            .then((joined) => {
              setJoinedCommunityObjects(joined);
              setJoinedCommunities(joined.map((c) => c.id));
            })
            .catch(() => {});
        }
      }
    } catch {
      showDialog({
        title: 'Action Failed',
        message: 'Could not update your communities. Please check your connection and try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Got it',
      });
    }
  };

  /** Load the feed (public posts + the viewer's own) from the backend. */
  const loadPosts = async () => {
    try {
      const feed = await getFeedRequest();
      setPosts(feed);
    } catch {
      // Keep whatever we have; the feed screen handles empty gracefully.
    }
  };

  /** Replace one post in state with the authoritative server version. */
  // A post can live in the main feed OR the Reels feed — update/find in both.
  const findFeedPost = (postId: string): CommunityPost | undefined =>
    posts.find((p) => p.id === postId) ?? reels.find((p) => p.id === postId);

  const patchFeeds = (postId: string, patch: (p: CommunityPost) => CommunityPost) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? patch(p) : p)));
    setReels((prev) => prev.map((p) => (p.id === postId ? patch(p) : p)));
  };

  const replacePost = (updated: CommunityPost) => {
    patchFeeds(updated.id, () => updated);
  };

  /** Delete one of the user's own posts everywhere. */
  const deletePost = async (postId: string): Promise<void> => {
    await deletePostRequest(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setReels((prev) => prev.filter((p) => p.id !== postId));
  };

  /** Toggle a post's public/private state; returns the updated post. */
  const setPostPrivacy = async (postId: string, isPrivate: boolean): Promise<CommunityPost> => {
    const updated = await updatePostRequest(postId, { isPrivate });
    replacePost(updated);
    // A now-private post should drop out of the public reels feed.
    if (isPrivate) setReels((prev) => prev.filter((p) => p.id !== postId));
    return updated;
  };

  /** Record a unique view for a post after it's been watched a few seconds. */
  const recordPostView = async (postId: string): Promise<void> => {
    try {
      const updated = await recordPostViewRequest(postId);
      replacePost(updated);
    } catch {
      /* non-fatal — view counting is best-effort */
    }
  };

  const toggleLikePost = async (postId: string) => {
    const current = findFeedPost(postId);
    if (!current) return;
    const nextLiked = !current.isLiked;
    // Optimistic update for instant feedback.
    patchFeeds(postId, (p) => ({
      ...p,
      isLiked: nextLiked,
      likesCount: p.likesCount + (nextLiked ? 1 : -1),
    }));
    try {
      const updated = await setPostLikeRequest(postId, nextLiked);
      replacePost(updated);
    } catch {
      replacePost(current); // revert
    }
  };

  const toggleSavePost = async (postId: string) => {
    const current = findFeedPost(postId);
    if (!current) return;
    const nextSaved = !current.isSaved;
    patchFeeds(postId, (p) => ({ ...p, isSaved: nextSaved }));
    try {
      const updated = await setPostSaveRequest(postId, nextSaved);
      replacePost(updated);
    } catch {
      replacePost(current);
    }
  };

  const toggleRepost = async (postId: string) => {
    const current = findFeedPost(postId);
    if (!current) return;
    const nextReposted = !current.isReposted;
    patchFeeds(postId, (p) => ({
      ...p,
      isReposted: nextReposted,
      repostsCount: (p.repostsCount ?? 0) + (nextReposted ? 1 : -1),
    }));
    try {
      const updated = await setPostRepostRequest(postId, nextReposted);
      replacePost(updated);
    } catch {
      replacePost(current);
    }
  };

  // --- Repost composer ---
  const [repostComposerPost, setRepostComposerPost] = useState<CommunityPost | null>(null);

  /** Tapping the repost control: if already reposted, un-repost immediately;
   *  otherwise open the composer to add a caption / tag a circle. */
  const pressRepost = (post: CommunityPost) => {
    // You can't repost your own content.
    if (post.authorId && user?.id && post.authorId === user.id) {
      showDialog({
        title: 'Can’t repost your own post',
        message: 'Reposting shares someone else’s post with your followers. This one is already yours.',
        icon: 'repeat',
        confirmText: 'Got it',
      });
      return;
    }
    if (post.isReposted) {
      void toggleRepost(post.id);
    } else {
      setRepostComposerPost(post);
    }
  };

  const closeRepostComposer = () => setRepostComposerPost(null);

  const submitRepost = async (opts: { caption?: string; communityId?: string }) => {
    const post = repostComposerPost;
    if (!post) return;
    // Optimistic: mark reposted + bump count everywhere.
    patchFeeds(post.id, (p) => ({
      ...p,
      isReposted: true,
      repostsCount: (p.repostsCount ?? 0) + (p.isReposted ? 0 : 1),
    }));
    setRepostComposerPost(null);
    try {
      const updated = await setPostRepostRequest(post.id, true, opts);
      replacePost(updated);
      // Bring the new repost into the feed immediately.
      await loadPosts();
    } catch {
      // revert
      patchFeeds(post.id, (p) => ({
        ...p,
        isReposted: false,
        repostsCount: Math.max(0, (p.repostsCount ?? 1) - 1),
      }));
    }
  };

  const toggleLikeComment = async (postId: string, commentId: string) => {
    const current = findFeedPost(postId);
    const comment = current?.comments?.find((c) => c.id === commentId);
    if (!current || !comment) return;
    const nextLiked = !comment.isLiked;
    patchFeeds(postId, (p) =>
      p.comments
        ? {
            ...p,
            comments: p.comments.map((c) =>
              c.id === commentId
                ? { ...c, isLiked: nextLiked, likesCount: c.likesCount + (nextLiked ? 1 : -1) }
                : c
            ),
          }
        : p
    );
    try {
      const updated = await setCommentLikeRequest(commentId, nextLiked);
      replacePost(updated);
    } catch {
      replacePost(current);
    }
  };

  const addCommentToPost = async (postId: string, payload: AddCommentPayload) => {
    try {
      const updated = await addCommentRequest(postId, {
        text: payload.text,
        isMentorCritique: payload.isMentorCritique,
        commentType: payload.commentType,
        mentorRating: payload.mentorRating,
        critiqueFocus: payload.critiqueFocus,
        videoCritiqueThumbnail: payload.videoCritiqueThumbnail,
        videoCritiqueDuration: payload.videoCritiqueDuration,
        videoCritiqueTitle: payload.videoCritiqueTitle,
      });
      replacePost(updated);
    } catch (err: any) {
      showDialog({
        title: 'Comment Failed',
        message:
          err?.status === 403
            ? 'Only mentors can post a critique.'
            : err?.message || 'Could not post your comment. Please try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Got it',
      });
    }
  };

  const createPost = async (payload: CreatePostPayload) => {
    const targetIds =
      payload.communityIds && payload.communityIds.length > 0
        ? payload.communityIds
        : payload.communityId
        ? [payload.communityId]
        : [];
    try {
      const created = await createPostRequest({
        content: payload.content,
        postType: payload.postType,
        communityIds: targetIds,
        title: payload.title,
        tags: payload.tags,
        tag: payload.tag,
        isPrivate: payload.isPrivate,
        focusArea: payload.focusArea,
        bgStyle: payload.bgStyle,
        videoUrl: payload.videoUrl,
        videoThumbnail: payload.videoThumbnail,
        videoDuration: payload.videoDuration,
        audioUrl: payload.audioUrl,
        imageUrls: payload.imageUrls,
        isShort: payload.isShort,
        scheduledAt: payload.scheduledAt,
      });
      // Scheduled posts stay hidden from the live feeds until their time.
      if (created.isScheduled) {
        // no-op: it will appear in feeds/reels once published
      } else if (created.isShort) {
        setReels((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      } else {
        setPosts((prev) => [created, ...prev]);
      }
    } catch (err: any) {
      showDialog({
        title: 'Post Failed',
        message: err?.message || 'Could not publish your post. Please check your connection and try again.',
        icon: 'alert-circle-outline',
        confirmText: 'Got it',
      });
    }
  };

  /** Learner path: enroll directly on the server, then apply the returned session. */
  const enrollAsLearner = async (): Promise<void> => {
    const { user: apiUser, tokens } = await enrollAsLearnerRequest();
    await saveTokens(tokens);
    applySession(apiUser);
  };

  /** Mentor path: apply the session the quiz-submit returned after a pass. */
  const applyMentorSession = async (session: AuthResponse): Promise<void> => {
    await saveTokens(session.tokens);
    applySession(session.user);
  };

  // App-icon badge = unread notifications + unread chat messages.
  useEffect(() => {
    if (FEATURES.pushNotifications && user) void setAppBadge(unreadCount + chatUnread);
  }, [unreadCount, chatUnread, user]);

  const logout = async (): Promise<void> => {
    // This phone must stop receiving the account's notifications (needs auth,
    // so it runs before the session is revoked).
    await unregisterPush();
    closeAudioPost();
    // Best-effort server-side revocation; clear local state regardless.
    try {
      await logoutRequest();
    } catch {
      // ignore network/expiry errors on logout
    }
    await clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    setSelectedHobby('Music');
    setJoinedCommunities([]);
    setSelectedRole(null);
    setRecommendedCommunities([]);
    setJoinedCommunityObjects([]);
    setSkills([]);
    setPosts([]);
    setUserStats(null);
    setXpTasks([]);
    setActiveGoal(null);
    setSeasonRewards([]);
    setCommunityEvents([]);
    setLearnerLeaderboard([]);
    setMentorLeaderboard([]);
    setNotifications([]);
    setUnreadCount(0);
    disconnectSocket();
  };

  // These read from backend-loaded state (populated by loadCommunityData).
  const getRecommendedCommunities = (): Community[] => recommendedCommunities;

  const getSkillsForUser = (): Skill[] => skills;

  const getJoinedCommunityObjects = (): Community[] => joinedCommunityObjects;

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
        selectedHobby,
        joinedCommunities,
        selectedRole,
        posts,
        activeGoal,
        userStats,
        saveUserGoal,
        logGoalSession,
        selectedProfileUser,
        openUserProfile,
        closeUserProfile,
        isMyProfileOpen,
        openMyProfile,
        closeMyProfile,
        isRewardsModalOpen,
        openRewardsModal,
        closeRewardsModal,
        xpTasks,
        mentorLeaderboard,
        learnerLeaderboard,
        seasonCycle,
        xpRulesVersion,
        chatUnread,
        refreshChatUnread,
        chatView,
        openChatInbox,
        openChatWith,
        closeChat,
        setActiveChatConversation,
        seasonRewards,
        claimXPTask,
        activeRewardClaimModal,
        openRewardClaimModal,
        closeRewardClaimModal,
        communityEvents,
        voteCommunityEvent,
        collectEventXp,
        createCommunityEvent,
        endCommunityEvent,
        refreshEvents,
        fetchLeaderboard,
        claimReward,
        bootstrapping,
        login,
        signup,
        updateUser,
        updateAvatar,
        deleteComment,
        editComment,
        toggleCommunityJoin,
        createCommunity,
        updateCircle,
        addCircleMembers,
        setCircleAdmin,
        removeCircleMember,
        deleteCircle,
        toggleLikePost,
        toggleSavePost,
        toggleLikeComment,
        addCommentToPost,
        recordPostView,
        toggleRepost,
        repostComposerPost,
        pressRepost,
        closeRepostComposer,
        submitRepost,
        deletePost,
        setPostPrivacy,
        createPost,
        enrollAsLearner,
        applyMentorSession,
        logout,
        getRecommendedCommunities,
        getSkillsForUser,
        getJoinedCommunityObjects,
        showDialog,
        hideDialog,
        playVideo,
        closeVideo,
        reels,
        loadReels,
        audioPost,
        isAudioPlaying,
        playAudioPost,
        toggleAudioPlayback,
        closeAudioPost,
        notifications,
        unreadCount,
        openNotifications,
        closeNotifications,
        markNotificationsRead,
        deleteNotification,
        clearNotifications,
        setNotificationOpener,
      }}
    >
      {children}
      <NotificationsModal
        visible={isNotificationsOpen}
        notifications={notifications}
        onClose={closeNotifications}
        onMarkRead={markNotificationsRead}
        onOpen={openNotificationItem}
        onDelete={deleteNotification}
        onClearAll={clearNotifications}
      />
      <VideoPlayerModal
        visible={!!activeVideoUrl}
        uri={activeVideoUrl}
        onClose={closeVideo}
      />
      <NowPlayingBar
        post={audioPost}
        isPlaying={isAudioPlaying}
        onToggle={toggleAudioPlayback}
        onClose={closeAudioPost}
      />
      <RepostModal
        visible={!!repostComposerPost}
        post={repostComposerPost}
        circles={joinedCommunityObjects}
        onClose={closeRepostComposer}
        onSubmit={submitRepost}
      />
      {activeDialog && (
        <ConfirmModal
          visible={!!activeDialog}
          title={activeDialog.title}
          message={activeDialog.message}
          icon={activeDialog.icon || 'checkmark-circle-outline'}
          confirmText={activeDialog.confirmText || 'Got it'}
          cancelText={activeDialog.cancelText || undefined}
          isDestructive={activeDialog.isDestructive}
          onConfirm={() => {
            if (activeDialog.onConfirm) {
              activeDialog.onConfirm();
            }
            hideDialog();
          }}
          onCancel={() => {
            if (activeDialog.onCancel) {
              activeDialog.onCancel();
            }
            hideDialog();
          }}
        />
      )}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
