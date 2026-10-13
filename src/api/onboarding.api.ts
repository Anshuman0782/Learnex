import { apiRequest } from './client';
import type { AuthResponse } from './auth.api';

/** A quiz question as sent to the client — no answer key. */
export interface QuizQuestion {
  id: string;
  category: string;
  question: string;
  options: string[];
}

export interface QuizStartResponse {
  questions: QuizQuestion[];
  total: number;
  passMark: number;
}

export interface GradedAnswer {
  questionId: string;
  correctIndex: number;
  selectedIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizResultResponse {
  passed: boolean;
  score: number;
  total: number;
  passMark: number;
  results: GradedAnswer[];
  /** Present only on a pass — the new Mentor session. */
  session?: AuthResponse;
  /** The skill the test was for. */
  skill?: string;
}

/** One of the member's skills, with their role and XP in it. */
export interface ApiUserSkill {
  skill: string;
  role: 'Learner' | 'Mentor';
  isPrimary: boolean;
  xp: number;
  seasonXp: number;
}

export interface QuizAnswer {
  questionId: string;
  selectedIndex: number;
}

/** Learner enrolls directly. Returns a fresh session with the LEARNER role. */
/** Continue as Guest: full access, but no XP and never ranked. */
export function continueAsGuestRequest(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/onboarding/continue-guest', { method: 'POST' });
}

/** Join a skill as a Learner — the first one at sign-up, or another later. */
export function enrollAsLearnerRequest(skill?: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/onboarding/enroll-learner', {
    method: 'POST',
    body: skill ? { skill } : {},
  });
}

/** Mentor test for a skill (defaults to the member's main skill). */
export function getMentorQuizRequest(skill?: string): Promise<QuizStartResponse> {
  return apiRequest<QuizStartResponse>(
    `/onboarding/mentor-quiz${skill ? `?skill=${encodeURIComponent(skill)}` : ''}`,
  );
}

export function submitMentorQuizRequest(answers: QuizAnswer[], skill?: string): Promise<QuizResultResponse> {
  return apiRequest<QuizResultResponse>('/onboarding/mentor-quiz/submit', {
    method: 'POST',
    body: skill ? { answers, skill } : { answers },
  });
}

/** The member's skills, main skill first. Empty for guests. */
export function getMySkillsRequest(): Promise<ApiUserSkill[]> {
  return apiRequest<ApiUserSkill[]>('/onboarding/skills');
}

/** Make one of the member's skills their main skill. Returns a fresh session. */
export function setPrimarySkillRequest(skill: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/onboarding/skills/primary', { method: 'POST', body: { skill } });
}
