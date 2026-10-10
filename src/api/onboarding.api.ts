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

export function enrollAsLearnerRequest(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/onboarding/enroll-learner', { method: 'POST' });
}

export function getMentorQuizRequest(): Promise<QuizStartResponse> {
  return apiRequest<QuizStartResponse>('/onboarding/mentor-quiz');
}

export function submitMentorQuizRequest(answers: QuizAnswer[]): Promise<QuizResultResponse> {
  return apiRequest<QuizResultResponse>('/onboarding/mentor-quiz/submit', {
    method: 'POST',
    body: { answers },
  });
}
