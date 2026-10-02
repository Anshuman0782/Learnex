export type UserRole = 'Learner' | 'Mentor';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  dob: string;
  hobby: string;
  role?: UserRole;
  joinedCommunities: string[];
  avatarUrl?: string;
  bio?: string;
  handle?: string;
  streakDays?: number;
  /** Lifetime XP (drives Level; never resets). */
  xpPoints?: number;
  levelBadge?: string;
  level?: number;
  /** XP earned this season (month) — drives ranking, resets on the 1st. */
  seasonXp?: number;
  /** Rank on the user's own board this season (0 = not ranked yet). */
  seasonRank?: number;
  /** Can open the Admin Panel (UI hint only — the server re-checks every call). */
  isAdmin?: boolean;
  /** Proved ownership of their email (code sent at sign-up / after a change). */
  emailVerified?: boolean;
}

// A real community member = an actual joined user. Profile extras (avatar, xp,
// badges) are optional and only present once those systems are real.
export interface CommunityMember {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  badge?: string;
  streakDays?: number;
  xpPoints?: number;
  specialty?: string;
  rating?: number;
  critiquesGiven?: number;
  isAdmin?: boolean;
}

export interface Community {
  id: string;
  name: string;
  category: string;
  description: string;
  iconName: string;
  iconBgColor: string;
  iconColor: string;
  tags: string[];
  isHot?: boolean;
  createdById?: string | null;
  avatarUrl?: string | null;
  postPolicy?: 'ALL' | 'ADMINS';
  // Real, computed membership data from the backend.
  memberCount: number;
  mentorCount: number;
  adminCount?: number;
  isAdmin?: boolean; // is the current user an admin of this circle
  isCreator?: boolean; // is the current user the creator
  mentors: CommunityMember[];
  members: CommunityMember[];
  admins?: CommunityMember[];
  allMembers?: CommunityMember[];
}

/** A lightweight person row for member pickers (search / followers). */
export interface UserRow {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | null;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  iconName: string;
  iconBgColor: string;
  iconColor: string;
  topicsCount: number;
  badge?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId?: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatar: string;
  timeAgo: string;
  text: string;
  isMentorCritique?: boolean;
  commentType?: 'general' | 'mentor';
  mentorRating?: number;
  critiqueFocus?: string;
  videoCritiqueThumbnail?: string;
  videoCritiqueDuration?: string;
  videoCritiqueTitle?: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface CommunityPost {
  id: string;
  /** Stable list key ('post:<id>' or 'repost:<postId>:<userId>'). */
  feedId?: string;
  authorId?: string;
  communityId: string;
  // Repost entries (a post another user reposted, surfaced in the feed).
  repostedById?: string;
  repostedByName?: string;
  repostedByAvatar?: string;
  repostCaption?: string;
  repostedCircleId?: string;
  repostedCircleName?: string;
  communityName: string;
  communityIds?: string[];
  communityNames?: string[];
  authorName: string;
  authorRole: UserRole;
  authorSkill: string;
  authorAvatar: string;
  timeAgo: string;
  content: string;
  tag: string;
  tags?: string[];
  postType: 'text' | 'video' | 'audio' | 'image' | 'critique_request';
  videoTitle?: string;
  videoUrl?: string;
  videoThumbnail?: string;
  videoDuration?: string;
  audioUrl?: string;
  /** Photo posts: 1–5 image URLs (swipeable carousel). */
  imageUrls?: string[];
  isShort?: boolean;
  viewsCount?: number;
  likesCount: number;
  commentsCount: number;
  generalCommentsCount?: number;
  mentorCritiqueCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  repostsCount?: number;
  isReposted?: boolean;
  isPrivate?: boolean;
  scheduledAt?: string;
  isScheduled?: boolean;
  focusArea?: string;
  /** Discussion card background key (see config/postBackgrounds). */
  bgStyle?: string;
  comments?: PostComment[];
}

export interface RoleOption {
  id: UserRole;
  title: string;
  subtitle: string;
  description: string;
  iconName: string;
  iconBgColor: string;
  iconColor: string;
  perks: string[];
}

export interface MentorQuestion {
  id: string;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface UserPersonalStats {
  weeklyTargetSessions: number;
  completedTargetSessions: number;
  weeklyTargetHours: number;
  completedTargetHours: number;
  streakDays: number;
  xpPoints: number;
  levelBadge: string;
  accuracyRate: number; // e.g. 88%
  consistencyRate: number; // e.g. 94%
  critiquesCompleted: number; // e.g. 12
  improvementTrend: string; // e.g. "+18% this month"
  badges: Array<{
    id: string;
    title: string;
    icon: string;
    bgColor: string;
    color: string;
  }>;
}

export interface XPTask {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  role: UserRole | 'Both';
  category: 'daily' | 'weekly' | 'milestone';
  icon: string;
  iconBg: string;
  iconColor: string;
  progress?: {
    current: number;
    total: number;
    unit: string;
  };
  completed: boolean;
  claimable: boolean;
}

export interface XPLeaderboardEntry {
  id: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  rank: number;
  xpPoints: number;
  badge: string;
  specialtyOrHobby: string;
  keyMetricLabel: string;
  keyMetricValue: string;
  isCurrentUser?: boolean;
}

export type SeasonRewardType =
  | 'voucher'
  | 'badge'
  | 'tokens'
  | 'coaching'
  | 'top_mentor'
  | 'opportunities';

export interface SeasonRewardItem {
  id: string;
  type: SeasonRewardType;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  tag: string;
  targetRole: 'Mentor' | 'Learner' | 'Both';
  minRankRequired: string;
  sampleCode?: string;
  perks: string[];
  gradientColors: [string, string];
  // Real eligibility/claim status from the backend.
  /** Claimable now — earned from the last finished season's final rank. */
  eligible?: boolean;
  /** This season the user is currently ranked inside this reward's range. */
  onTrack?: boolean;
  minRank?: number;
  earnedSeasonNumber?: number;
  claimed?: boolean;
  claimedCode?: string;
}

export interface SeasonCycleInfo {
  id: string;
  title: string;
  subtitle: string;
  seasonNumber: number;
  daysLeft: number;
  /** ISO timestamps of the season window (a calendar month, UTC). */
  startsAt?: string;
  endsAt?: string;
  endsAtDate: string;
  participantsCount?: number;
  totalPrizePool: string;
  activeParticipants: string;
}

export type EventTaskType =
  | 'PUBLISH'
  | 'COMMENT'
  | 'EARN_LIKES'
  | 'GET_CRITIQUED'
  | 'PRACTICE'
  | 'ACTIVE_DAYS'
  | 'GIVE_CRITIQUES'
  | 'DEEP_CRITIQUES'
  | 'HELPFUL_CRITIQUES';

export interface EventTaskView {
  id: string;
  type: EventTaskType;
  target: number;
  kind?: 'any' | 'video' | 'reel' | 'audio' | 'photo' | 'discussion';
  label: string;
  icon: string;
  howMeasured: string;
  /** Present on the viewer's own tasks. */
  current?: number;
  done?: boolean;
}

export interface EventTrackView {
  name: string;
  xp: number;
  tasks: EventTaskView[];
}

export type EventPhase = 'voting' | 'live' | 'ended' | 'cancelled';

/** A circle event: vote to join → live challenge (separate Learner / Mentor tracks). */
export interface CommunityEvent {
  id: string;
  communityId: string;
  communityName: string;
  title: string;
  description: string;
  phase: EventPhase;
  createdAt: string;
  votingEndsAt?: string;
  endsAt?: string;
  daysLeft: number;
  votingHoursLeft: number;
  tracks: { Learner: EventTrackView | null; Mentor: EventTrackView | null };
  /** Highest track XP (for compact labels). */
  xpReward: number;
  votes: { Learner: number; Mentor: number; total: number; countedForStart: number };
  minVoters: number;
  hasVoted: boolean;
  myRole: 'Learner' | 'Mentor' | null;
  myTrackAvailable: boolean;
  isCreator: boolean;
  my: null | {
    role: 'Learner' | 'Mentor';
    pct: number;
    tasks: EventTaskView[];
    xpEarned: number;
    xpAwarded: number;
    collectable: number;
    maxXp: number;
    tasksDone: number;
  };
  bannerGradient: [string, string];
  icon: string;
  createdByName: string;
}

export interface EventBoardRow {
  userId: string;
  name: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor';
  pct: number;
  tasksDone: number;
  tasksTotal: number;
  xpAwarded: number;
  isCreator: boolean;
  isMe: boolean;
}

export interface CommunityEventDetail extends CommunityEvent {
  board: EventBoardRow[];
}

