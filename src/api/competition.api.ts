import { apiRequest } from './client';
import type {
  SeasonCycleInfo,
  XPLeaderboardEntry,
  SeasonRewardItem,
  CommunityEvent,
  CommunityEventDetail,
  EventTaskType,
  UserRole,
} from '../types';

/** Reward with the current user's eligibility/claim status. */
export interface ApiReward extends SeasonRewardItem {
  eligible: boolean;
  claimed: boolean;
  claimedCode?: string;
}

export function getCurrentSeasonRequest(): Promise<SeasonCycleInfo> {
  return apiRequest<SeasonCycleInfo>('/seasons/current');
}

export function getLeaderboardRequest(
  role: UserRole,
  category?: string,
): Promise<XPLeaderboardEntry[]> {
  const qs = new URLSearchParams({ role });
  if (category) qs.set('category', category);
  return apiRequest<XPLeaderboardEntry[]>(`/leaderboard?${qs.toString()}`);
}

export function getRewardsRequest(): Promise<ApiReward[]> {
  return apiRequest<ApiReward[]>('/rewards');
}

export function claimRewardRequest(id: string): Promise<{ rewardId: string; title: string; code: string }> {
  return apiRequest<{ rewardId: string; title: string; code: string }>(`/rewards/${id}/claim`, {
    method: 'POST',
  });
}

export function getEventsRequest(communityId?: string): Promise<CommunityEvent[]> {
  const qs = communityId ? `?communityId=${encodeURIComponent(communityId)}` : '';
  return apiRequest<CommunityEvent[]>(`/events${qs}`);
}

export function getEventDetailRequest(id: string): Promise<CommunityEventDetail> {
  return apiRequest<CommunityEventDetail>(`/events/${id}`);
}

/** Vote to join (only while voting is open). */
export function voteEventRequest(id: string): Promise<CommunityEventDetail> {
  return apiRequest<CommunityEventDetail>(`/events/${id}/vote`, { method: 'POST' });
}

/** Withdraw a vote (only while voting is open). */
export function unvoteEventRequest(id: string): Promise<CommunityEventDetail> {
  return apiRequest<CommunityEventDetail>(`/events/${id}/vote`, { method: 'DELETE' });
}

export interface EventCollectResult {
  earnedXP: number;
  pct: number;
  totalXp: number;
  creatorNoXp: boolean;
  eventTitle: string;
}

/** Collect XP earned so far (proportional to completion). */
export function collectEventRequest(id: string): Promise<EventCollectResult> {
  return apiRequest<EventCollectResult>(`/events/${id}/collect`, { method: 'POST' });
}

export interface EventTaskInput {
  type: EventTaskType;
  target: number;
  kind?: 'any' | 'video' | 'reel' | 'audio' | 'photo' | 'discussion';
}

export interface EventTrackInput {
  name?: string;
  xp: number;
  tasks: EventTaskInput[];
}

export interface CreateEventBody {
  communityId: string;
  title: string;
  description: string;
  votingHours: number;
  learner?: EventTrackInput;
  mentor?: EventTrackInput;
}

export interface EventCatalog {
  rules: string[];
  limits: {
    days: number;
    minXp: number;
    maxXp: number;
    minOtherMembers: number;
    minVoters: number;
    maxActivePerCircle: number;
    maxTasks: number;
    votingHours: number[];
  };
  tasks: Array<{ type: EventTaskType; title: string; icon: string; tracks: Array<'Learner' | 'Mentor'>; min: number; max: number; howMeasured: string }>;
  presets: Array<{ id: string; track: 'Learner' | 'Mentor'; name: string; icon: string; tagline: string; suggestedXp: number; tasks: EventTaskInput[] }>;
}

export function getEventCatalogRequest(): Promise<EventCatalog> {
  return apiRequest<EventCatalog>('/events/catalog');
}

/** Admins only (the server re-checks Admin access). */
export function createEventRequest(body: CreateEventBody): Promise<CommunityEventDetail> {
  return apiRequest<CommunityEventDetail>('/events', { method: 'POST', body });
}

/** Admins only: end an event early (everyone is paid for progress so far). */
export function deleteEventRequest(id: string): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/events/${id}`, { method: 'DELETE' });
}

/** Hobby categories that real members have (ranking filter). */
export function getLeaderboardCategoriesRequest(): Promise<string[]> {
  return apiRequest<string[]>('/leaderboard/categories');
}
