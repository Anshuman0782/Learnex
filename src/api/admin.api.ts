import { apiRequest } from './client';

// ---------- Access ----------

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | 'Guest' | null;
  isOwner: boolean;
  grantedAt: string | null;
  grantedByName: string | null;
}

export interface AdminUserResult {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'Learner' | 'Mentor' | 'Guest' | null;
  isAdmin: boolean;
  isOwner: boolean;
}

export const getAdminMeRequest = () =>
  apiRequest<{ isAdmin: boolean; isOwner: boolean }>('/admin/me');
export const getAdminsRequest = () => apiRequest<AdminAccount[]>('/admin/admins');
export const searchAdminUsersRequest = (q: string) =>
  apiRequest<AdminUserResult[]>(`/admin/users/search?q=${encodeURIComponent(q)}`);
export const grantAdminRequest = (userId: string) =>
  apiRequest<AdminAccount[]>(`/admin/admins/${userId}`, { method: 'POST' });
export const revokeAdminRequest = (userId: string) =>
  apiRequest<AdminAccount[]>(`/admin/admins/${userId}`, { method: 'DELETE' });

// ---------- Dashboard ----------

export interface ContentStat {
  total: number;
  last7Days: number;
  views: number;
  likes: number;
  comments: number;
  private: number;
}

export interface AdminDashboard {
  generatedAt: string;
  users: {
    total: number;
    learners: number;
    mentors: number;
    /** Guests: full access, no XP, never ranked. */
    guests: number;
    onboarding: number;
    admins: number;
    newLast7Days: number;
    newLast30Days: number;
    growth: Array<{ day: string; signups: number; total: number }>;
  };
  activity: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    minutesToday: number;
    avgMinutesPerActiveUser: number;
    totalHoursLast30Days: number;
    timeSpent: Array<{ day: string; minutes: number; activeUsers: number; avgMinutesPerUser: number }>;
  };
  content: {
    videos: ContentStat;
    reels: ContentStat;
    audio: ContentStat;
    photos: ContentStat;
    discussions: ContentStat;
    scheduledPending: number;
    postsPerDay: Array<{ day: string; videos: number; reels: number; audio: number; photos: number; discussions: number }>;
  };
  circles: {
    total: number;
    userCreated: number;
    memberships: number;
    postsInCircles: number;
    events: number;
    eventCompletions: number;
    top: Array<{ id: string; name: string; category: string; members: number }>;
  };
  engagement: {
    comments: number;
    critiques: number;
    likes: number;
    reposts: number;
    saves: number;
    follows: number;
    views: number;
  };
  xp: {
    seasonNumber: number;
    seasonXpAwarded: number;
    seasonParticipants: number;
    lifetimeXpAwarded: number;
    activeRules: number;
    customRules: number;
    activeRewards: number;
    rewardClaims: number;
  };
  moderation: { openReports: number; reviewedReports: number; hiddenPosts: number };
}

export const getAdminStatsRequest = () => apiRequest<AdminDashboard>('/admin/stats');

// ---------- XP rules ----------

export interface XpTriggerDef {
  id: string;
  label: string;
  description: string;
}

export interface AdminXpRule {
  key: string;
  trigger: string;
  triggerLabel: string;
  title: string;
  description: string;
  role: 'Learner' | 'Mentor' | 'Both';
  category: string;
  xp: number;
  dailyCap: number | null;
  isActive: boolean;
  isCore: boolean;
  isBuiltIn: boolean;
  updatedAt: string;
  seasonPayouts: number;
  seasonXpPaid: number;
}

export interface XpRuleInput {
  trigger?: string;
  title?: string;
  description?: string;
  role?: 'Learner' | 'Mentor' | 'Both';
  category?: string;
  xp?: number;
  dailyCap?: number | null;
  isActive?: boolean;
}

export const RULE_CATEGORIES = ['Consistency', 'Practice', 'Community', 'Mentoring', 'Milestones'];

export const getXpTriggersRequest = () => apiRequest<XpTriggerDef[]>('/admin/xp/triggers');
export const getAdminXpRulesRequest = () => apiRequest<AdminXpRule[]>('/admin/xp/rules');
export const createXpRuleRequest = (body: XpRuleInput) =>
  apiRequest<AdminXpRule[]>('/admin/xp/rules', { method: 'POST', body });
export const updateXpRuleRequest = (key: string, body: XpRuleInput) =>
  apiRequest<AdminXpRule[]>(`/admin/xp/rules/${key}`, { method: 'PATCH', body });
export const deleteXpRuleRequest = (key: string) =>
  apiRequest<AdminXpRule[]>(`/admin/xp/rules/${key}`, { method: 'DELETE' });

// ---------- Rewards ----------

export const REWARD_TYPES = [
  { id: 'voucher', label: 'Voucher / Gift card', icon: 'gift' },
  { id: 'badge', label: 'Badge', icon: 'medal' },
  { id: 'tokens', label: 'Tokens / Credits', icon: 'cash' },
  { id: 'coaching', label: 'Coaching session', icon: 'school' },
  { id: 'top_mentor', label: 'Recognition', icon: 'star' },
  { id: 'opportunities', label: 'Opportunity', icon: 'rocket' },
] as const;

export interface AdminReward {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  tag: string;
  targetRole: 'Learner' | 'Mentor' | 'Both';
  minRank: number;
  minRankRequired: string;
  perks: string[];
  gradientColors: [string, string];
  codePrefix: string;
  sortOrder: number;
  isActive: boolean;
  claims: number;
  updatedAt: string;
}

export interface RewardInput {
  title?: string;
  subtitle?: string;
  description?: string;
  type?: string;
  icon?: string;
  targetRole?: 'Learner' | 'Mentor' | 'Both';
  minRank?: number;
  perks?: string[];
  codePrefix?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const getAdminRewardsRequest = () => apiRequest<AdminReward[]>('/admin/rewards');
export const createRewardRequest = (body: RewardInput) =>
  apiRequest<AdminReward[]>('/admin/rewards', { method: 'POST', body });
export const updateRewardRequest = (id: string, body: RewardInput) =>
  apiRequest<AdminReward[]>(`/admin/rewards/${id}`, { method: 'PATCH', body });
export const deleteRewardRequest = (id: string) =>
  apiRequest<AdminReward[]>(`/admin/rewards/${id}`, { method: 'DELETE' });

// ---------- Custom notifications (broadcasts) ----------
export type BroadcastAudience = 'ALL' | 'LEARNERS' | 'MENTORS' | 'CIRCLE' | 'USERS';

export interface BroadcastTarget {
  audience: BroadcastAudience;
  communityId?: string;
  userIds?: string[];
}

export interface AdminBroadcast {
  id: string;
  title: string;
  body: string;
  audience: BroadcastAudience;
  communityId?: string;
  communityName?: string;
  userCount?: number;
  scheduledAt?: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  recipients: number;
  pushed: number;
  createdAt: string;
  sentAt?: string;
}

export const getBroadcastsRequest = () => apiRequest<AdminBroadcast[]>('/admin/broadcasts');
export const previewBroadcastRequest = (body: BroadcastTarget) =>
  apiRequest<{ count: number; withPush: number }>('/admin/broadcasts/preview', { method: 'POST', body });
export const createBroadcastRequest = (body: BroadcastTarget & { title: string; body: string; scheduledAt?: string }) =>
  apiRequest<AdminBroadcast>('/admin/broadcasts', { method: 'POST', body });
export const cancelBroadcastRequest = (id: string) =>
  apiRequest<{ success: true }>(`/admin/broadcasts/${id}`, { method: 'DELETE' });
