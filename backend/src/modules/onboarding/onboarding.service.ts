import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service.js';
import { AuthService, type AuthResult } from '../auth/auth.service.js';
import {
  findQuestionById,
  getRandomMentorQuestions,
  type PublicMentorQuestion,
} from './data/mentor-questions.js';
import { QuizAnswerDto } from './dto/submit-quiz.dto.js';

/** Number of questions per quiz, and how many must be correct to qualify. */
const QUIZ_SIZE = 5;
const PASS_MARK = 4;

export interface QuizStartResponse {
  questions: PublicMentorQuestion[];
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
  /** Present only when the user passed and became a Mentor (new session tokens). */
  session?: AuthResult;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  /** Learner path: enroll directly. Reissues a session so the JWT carries the new role. */
  async enrollAsLearner(userId: string): Promise<AuthResult> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    const updated = await this.users.update(user.id, { role: UserRole.LEARNER });
    return this.auth.issueSession(updated);
  }

  /** Returns a fresh quiz (no answer key) tailored to the user's hobby. */
  async startMentorQuiz(userId: string): Promise<QuizStartResponse> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    const picked = getRandomMentorQuestions(user.hobby, QUIZ_SIZE);
    const questions: PublicMentorQuestion[] = picked.map((q) => ({
      id: q.id,
      category: q.category,
      question: q.question,
      options: q.options,
    }));

    return { questions, total: QUIZ_SIZE, passMark: PASS_MARK };
  }

  /** Grades a submission server-side and grants Mentor on a pass. */
  async submitMentorQuiz(userId: string, answers: QuizAnswerDto[]): Promise<QuizResultResponse> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    // Reject anything that isn't a full, non-duplicated quiz — stops score gaming.
    const uniqueIds = new Set(answers.map((a) => a.questionId));
    if (answers.length !== QUIZ_SIZE || uniqueIds.size !== QUIZ_SIZE) {
      throw new BadRequestException(`A complete quiz has exactly ${QUIZ_SIZE} distinct answers`);
    }

    const results: GradedAnswer[] = answers.map((a) => {
      const question = findQuestionById(a.questionId);
      if (!question) {
        throw new BadRequestException(`Unknown question: ${a.questionId}`);
      }
      if (a.selectedIndex >= question.options.length) {
        throw new BadRequestException(`Invalid option for question ${a.questionId}`);
      }
      return {
        questionId: question.id,
        correctIndex: question.correctIndex,
        selectedIndex: a.selectedIndex,
        isCorrect: a.selectedIndex === question.correctIndex,
        explanation: question.explanation,
      };
    });

    const score = results.filter((r) => r.isCorrect).length;
    const passed = score >= PASS_MARK;

    let session: AuthResult | undefined;
    if (passed) {
      const updated = await this.users.update(user.id, { role: UserRole.MENTOR });
      session = await this.auth.issueSession(updated);
    }

    return { passed, score, total: QUIZ_SIZE, passMark: PASS_MARK, results, session };
  }
}
