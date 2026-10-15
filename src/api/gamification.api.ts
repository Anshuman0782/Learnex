import { apiRequest } from './client';
import type { UserPersonalStats, XPTask } from '../types';

/** Stats from the backend extend the app's stats with level + season fields. */
export interface ApiUserStats extends UserPersonalStats {
  longestStreak: number;
  // Lifetime XP (xpPoints) → Level. Never resets.
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  // Season (calendar month) → ranking. Resets on the 1st.
  seasonNumber: number;
  seasonEndsAt: string;
  seasonXp: number;
  seasonRank: number; // 0 = not ranked yet
  seasonRankTotal: number;
  seasonBoard: 'Learner' | 'Mentor';
  lastSeason: { seasonNumber: number; rank: number; xp: number; board: string } | null;
}

export interface XpRuleView {
  key: string;
  trigger: string;
  title: string;
  description: string;
  role: 'Learner' | 'Mentor' | 'Both';
  category: string;
  xp: number;
  dailyCap: number | null;
  isCore: boolean;
}

export interface XpRulebook {
  season: { number: number; startsAt: string; endsAt: string; daysLeft: number };
  seasonRules: string[];
  rules: XpRuleView[];
  quests: Array<{
    id: string;
    title: string;
    description: string;
    role: 'Learner' | 'Mentor';
    category: 'daily' | 'weekly';
    xpReward: number;
    target: number;
  }>;
  levels: Array<{ title: string; minLevel: number; minXp: number }>;
  fairPlay: string[];
}

export interface XpHistoryRow {
  id: string;
  source: string;
  label: string;
  icon: string;
  amount: number;
  createdAt: string;
  thisSeason: boolean;
  /** The skill it was earned in, and the role held there. */
  skill?: string | null;
  role?: 'Learner' | 'Mentor' | null;
}

/** The live rulebook — exactly what the server enforces. */
export function getXpRulesRequest(): Promise<XpRulebook> {
  return apiRequest<XpRulebook>('/gamification/rules');
}

/** The current user's recent XP activity. */
export function getXpHistoryRequest(limit = 100): Promise<XpHistoryRow[]> {
  return apiRequest<XpHistoryRow[]>(`/gamification/history?limit=${limit}`);
}

/** Foreground-time heartbeat (admin "time spent" statistics). */
export function sendUsageHeartbeatRequest(seconds: number): Promise<unknown> {
  return apiRequest('/usage/heartbeat', { method: 'POST', body: { seconds } });
}

export interface ApiGoal {
  id: string;
  title: string;
  targetSessions: number;
  targetHours: number;
  targetDate: string;
  completedSessions: number;
  dailyReminders: boolean;
}

export interface SaveGoalBody {
  title?: string;
  targetSessions?: number;
  targetHours?: number;
  targetDate?: string;
  dailyReminders?: boolean;
}

export function getStatsRequest(): Promise<ApiUserStats> {
  return apiRequest<ApiUserStats>('/gamification/stats');
}

/** Daily check-in: advances the real streak and returns fresh stats. */
export function checkInRequest(): Promise<ApiUserStats> {
  return apiRequest<ApiUserStats>('/gamification/check-in', { method: 'POST' });
}

export function getGoalRequest(): Promise<ApiGoal | null> {
  return apiRequest<ApiGoal | null>('/gamification/goal');
}

export function saveGoalRequest(body: SaveGoalBody): Promise<ApiGoal> {
  return apiRequest<ApiGoal>('/gamification/goal', { method: 'POST', body });
}

export function logSessionRequest(minutes?: number): Promise<{ goal: ApiGoal | null; awardedXp: number }> {
  return apiRequest<{ goal: ApiGoal | null; awardedXp: number }>('/gamification/sessions', {
    method: 'POST',
    body: { minutes },
  });
}

export function getQuestsRequest(): Promise<XPTask[]> {
  return apiRequest<XPTask[]>('/gamification/quests');
}

export function claimQuestRequest(
  id: string,
): Promise<{ earnedXP: number; taskTitle: string; quests: XPTask[] }> {
  return apiRequest<{ earnedXP: number; taskTitle: string; quests: XPTask[] }>(
    `/gamification/quests/${id}/claim`,
    { method: 'POST' },
  );
}
