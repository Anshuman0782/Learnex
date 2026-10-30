import { apiRequest } from './client';
import type { AuthResponse } from './auth.api';

export type AiSkillId = 'coding' | 'music' | 'spoken_english';

// ---------------- Learner progress ----------------

export interface AiCriterionScore {
  key: string;
  label: string;
  score: number | null;
}

export interface AiSkillProgress {
  skill: AiSkillId;
  label: string;
  skillLabel: string;
  reviewedPosts: number;
  /** 'collecting' until there are enough confident reviews for a trend. */
  status: 'ready' | 'collecting';
  neededPosts: number;
  trend: 'up' | 'down' | 'steady' | null;
  changePct: number | null;
  currentScore: number | null;
  earlierScore: number | null;
  criteria: AiCriterionScore[];
  strongest: string | null;
  weakest: string | null;
  latest: {
    postId: string;
    title: string;
    overall: number;
    strengths: string[];
    improvements: string[];
    summary: string;
    partial: boolean;
    createdAt: string;
  };
  history: { postId: string; score: number; at: string; mentorRated: boolean; partial: boolean }[];
  since: string;
}

export interface AiProgressResponse {
  skills: AiSkillProgress[];
  /** My posts still waiting for their AI review. */
  reviewing: number;
  /** My skills the AI can judge (even with no reviews yet). */
  eligible: { skill: AiSkillId; label: string; skillLabel: string }[];
  minPosts: number;
}

export const getAiProgressRequest = () => apiRequest<AiProgressResponse>('/ai/progress');

// ---------------- Mentor test ----------------

export interface MentorTestTask {
  skill: AiSkillId;
  mode: 'code' | 'audio';
  prompt: string;
  checkPhrase: string | null;
  timeLimitSec: number;
  minSec: number | null;
  maxSec: number | null;
  critique: { title: string; content: string };
}

export type MentorTestStatus = 'STARTED' | 'SUBMITTED' | 'PASSED' | 'REVIEW' | 'FAILED' | 'EXPIRED';

export interface MentorApplication {
  id: string;
  skill: AiSkillId;
  skillLabel: string;
  status: MentorTestStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  score: number | null;
  performanceScore: number | null;
  critiqueScore: number | null;
  feedback: { summary: string; strengths: string[]; improvements: string[]; critiqueSummary: string } | null;
  decisionNote: string | null;
  retryAfter: string | null;
  task?: MentorTestTask;
}

export interface MentorEligibility {
  mode: 'ai' | 'quiz';
  skill: AiSkillId | null;
  label?: string;
  application: MentorApplication | null;
}

export const getMentorEligibilityRequest = (skill: string) =>
  apiRequest<MentorEligibility>(`/ai/mentor-test/eligibility?skill=${encodeURIComponent(skill)}`);

export const getMyMentorTestsRequest = () => apiRequest<MentorApplication[]>('/ai/mentor-test/mine');

export const startMentorTestRequest = (skill: string) =>
  apiRequest<MentorApplication>('/ai/mentor-test/start', { method: 'POST', body: { skill } });

export const submitMentorTestRequest = (
  id: string,
  body: { codeAnswer?: string; recordingUrl?: string; recordingMime?: string; durationMs?: number; critiqueText: string },
) =>
  apiRequest<{ application: MentorApplication; session?: AuthResponse }>(`/ai/mentor-test/${id}/submit`, {
    method: 'POST',
    body,
  });

// ---------------- Admin ----------------

export interface AiProviderStatus {
  name: string;
  model: string;
  configured: boolean;
  canHear: boolean;
  requestsToday: number;
  failuresToday: number;
  dailyLimit: number | null;
  coolingUntil: string | null;
  lastError: string | null;
  lastOkAt?: string | null;
  lastOkMs?: number | null;
}

export interface AiAdminStatus {
  providers: AiProviderStatus[];
  queue: { kind: string; status: string; count: number }[];
  skills: { skill: AiSkillId; label: string; progressEnabled: boolean; mentorTestEnabled: boolean }[];
  mentorTestsWaiting: number;
  audioTool: boolean;
}

export interface AdminMentorTestRow extends MentorApplication {
  user: { id: string; name: string; email: string; avatarUrl: string };
  aiNote: string | null;
}

export interface AdminMentorTestDetail extends AdminMentorTestRow {
  /** While the AI is still judging (status SUBMITTED). */
  judging?: { state: string; attempts: number; nextTryAt: string | null; lastError: string | null } | null;
  task: any;
  recordingUrl: string | null;
  codeAnswer: string | null;
  critiqueText: string | null;
  aiResult: any;
}

export const getAiAdminStatusRequest = () => apiRequest<AiAdminStatus>('/admin/ai/status');
export const testAiProvidersRequest = () =>
  apiRequest<{ name: string; label?: string; ok: boolean; ms: number; error?: string }[]>('/admin/ai/test', { method: 'POST' });
export const setAiSkillRequest = (skill: AiSkillId, body: { progressEnabled?: boolean; mentorTestEnabled?: boolean }) =>
  apiRequest<AiAdminStatus['skills']>(`/admin/ai/skills/${skill}`, { method: 'PATCH', body });
export const getAdminMentorTestsRequest = (status?: string) =>
  apiRequest<AdminMentorTestRow[]>(`/admin/ai/mentor-tests${status ? `?status=${status}` : ''}`);
export const getAdminMentorTestRequest = (id: string) => apiRequest<AdminMentorTestDetail>(`/admin/ai/mentor-tests/${id}`);
export const decideMentorTestRequest = (id: string, decision: 'approve' | 'reject', note?: string) =>
  apiRequest<AdminMentorTestDetail>(`/admin/ai/mentor-tests/${id}/decide`, { method: 'POST', body: { decision, note } });
export const rerunMentorTestRequest = (id: string) =>
  apiRequest<{ queued: boolean }>(`/admin/ai/mentor-tests/${id}/rerun`, { method: 'POST' });
