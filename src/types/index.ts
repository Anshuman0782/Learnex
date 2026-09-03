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
  xpPoints?: number;
  levelBadge?: string;
}

export interface CommunityMember {
  id: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  badge: string;
  streakDays?: number;
  xpPoints?: number;
  specialty?: string;
  rating?: number;
  critiquesGiven?: number;
}

export interface CommunityStats {
  totalMembers: string;
  activeMentorsCount: number;
  critiquesThisWeek: number;
  responseRate: string;
  dailyActive: string;
}

export interface Community {
  id: string;
  name: string;
  category: string;
  description: string;
  memberCount: string;
  iconName: string;
  iconBgColor: string;
  iconColor: string;
  tags: string[];
  avatarStack: string[];
  isHot?: boolean;
  stats?: CommunityStats;
  mentors?: CommunityMember[];
  members?: CommunityMember[];
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
  communityId: string;
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
  postType: 'text' | 'video' | 'critique_request';
  videoTitle?: string;
  videoThumbnail?: string;
  videoDuration?: string;
  viewsCount?: number;
  likesCount: number;
  commentsCount: number;
  generalCommentsCount?: number;
  mentorCritiqueCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isPrivate?: boolean;
  focusArea?: string;
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
}

export interface SeasonCycleInfo {
  id: string;
  title: string;
  subtitle: string;
  seasonNumber: number;
  daysLeft: number;
  endsAtDate: string;
  totalPrizePool: string;
  activeParticipants: string;
}

export interface CommunityEvent {
  id: string;
  communityId: string;
  communityName: string;
  title: string;
  subtitle: string;
  description: string;
  targetRole: UserRole | 'Both';
  category: 'challenge' | 'workshop' | 'speed_run' | 'showcase';
  xpReward: number;
  bonusReward?: string;
  status: 'active' | 'upcoming' | 'completed';
  daysLeft: number;
  participantsCount: number;
  bannerGradient: [string, string];
  icon: string;
  requirements: string[];
  isJoined?: boolean;
  isCompleted?: boolean;
}

