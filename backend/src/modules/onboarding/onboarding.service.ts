import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserRole, UserSkill } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { seasonWindow } from '../gamification/leveling.js';
import { cleanSkill, MAX_SKILLS, skillKey } from '../../common/utils/skill.js';
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
  /** The skill the quiz was for. */
  skill: string;
}

/** One of the member's skills, with their role and XP in it. */
export interface UserSkillView {
  skill: string;
  role: 'Learner' | 'Mentor';
  /** The main skill (shown on the profile; check-ins and quests count here). */
  isPrimary: boolean;
  xp: number;
  seasonXp: number;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private isMember(user: User): boolean {
    return user.role === UserRole.LEARNER || user.role === UserRole.MENTOR;
  }

  /** The skill a request is about: the one named, else the member's main skill. */
  private labelFor(user: User, skill?: string | null): string {
    const label = cleanSkill(skill) || cleanSkill(user.hobby) || 'General';
    if (label.length < 2 || label.length > 40) {
      throw new BadRequestException('A skill name must be 2–40 characters');
    }
    return label;
  }

  private assertRoom(rows: UserSkill[]): void {
    if (rows.length >= MAX_SKILLS) {
      throw new BadRequestException(`You can have up to ${MAX_SKILLS} skills`);
    }
  }

  // ---------- skills ----------

  /** The member's skills (main skill first) with the XP earned in each. */
  async listSkills(userId: string): Promise<UserSkillView[]> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    const rows = await this.prisma.userSkill.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (rows.length === 0) return [];

    const { startsAt, endsAt } = seasonWindow();
    const [total, season] = await Promise.all([
      this.prisma.xpEvent.groupBy({ by: ['skill'], where: { userId }, _sum: { amount: true } }),
      this.prisma.xpEvent.groupBy({
        by: ['skill'],
        where: { userId, createdAt: { gte: startsAt, lt: endsAt } },
        _sum: { amount: true },
      }),
    ]);
    const totalOf = new Map(total.map((t) => [t.skill ?? '', t._sum.amount ?? 0]));
    const seasonOf = new Map(season.map((t) => [t.skill ?? '', t._sum.amount ?? 0]));

    const mainKey = rows.some((r) => r.skillKey === skillKey(user.hobby)) ? skillKey(user.hobby) : rows[0].skillKey;
    return rows
      .map((r) => ({
        skill: r.skill,
        role: r.role === UserRole.MENTOR ? ('Mentor' as const) : ('Learner' as const),
        isPrimary: r.skillKey === mainKey,
        xp: totalOf.get(r.skillKey) ?? 0,
        seasonXp: seasonOf.get(r.skillKey) ?? 0,
      }))
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  }

  /** Make one of the member's skills their main skill. Reissues the session. */
  async setPrimarySkill(userId: string, skill?: string): Promise<AuthResult> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    const row = await this.prisma.userSkill.findUnique({
      where: { userId_skillKey: { userId, skillKey: skillKey(skill) } },
    });
    if (!row) throw new NotFoundException('You haven’t added that skill');
    const updated = await this.users.update(user.id, { hobby: row.skill, role: row.role });
    return this.auth.issueSession(updated);
  }

  /**
   * Guest path: full access to posting, commenting and chat — but no XP and no
   * leaderboard. Only for accounts that haven't chosen Learner / Mentor yet
   * (a ranked member can't drop to Guest). Guests can upgrade any time.
   */
  async continueAsGuest(userId: string): Promise<AuthResult> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    if (user.role === UserRole.LEARNER || user.role === UserRole.MENTOR) {
      throw new BadRequestException('You already have a Learner / Mentor account');
    }
    const updated = await this.users.update(user.id, { role: UserRole.GUEST });
    return this.auth.issueSession(updated);
  }

  /**
   * Join a skill as a Learner. First time (new account or a Guest upgrading)
   * this is the account's first skill; later it adds another skill. Never
   * lowers an existing role. Reissues a session so the JWT carries the role.
   */
  async enrollAsLearner(userId: string, skill?: string): Promise<AuthResult> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    const label = this.labelFor(user, skill);
    const rows = await this.prisma.userSkill.findMany({ where: { userId } });
    const existing = rows.find((r) => r.skillKey === skillKey(label));
    if (!existing) {
      this.assertRoom(rows);
      await this.prisma.userSkill.create({
        data: { userId, skill: label, skillKey: skillKey(label), role: UserRole.LEARNER },
      });
    }

    // The first skill becomes the main one (and gives the account its role).
    let updated = user;
    if (!this.isMember(user) || rows.length === 0) {
      updated = await this.users.update(user.id, {
        role: existing?.role ?? UserRole.LEARNER,
        hobby: existing?.skill ?? label,
      });
    }
    return this.auth.issueSession(updated);
  }

  /** Returns a fresh quiz (no answer key) tailored to the skill being tested. */
  async startMentorQuiz(userId: string, skill?: string): Promise<QuizStartResponse> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    const label = this.labelFor(user, skill);
    const rows = await this.prisma.userSkill.findMany({ where: { userId } });
    const existing = rows.find((r) => r.skillKey === skillKey(label));
    if (existing?.role === UserRole.MENTOR) {
      throw new BadRequestException(`You’re already a Mentor in ${existing.skill}`);
    }
    if (!existing) this.assertRoom(rows);

    const picked = getRandomMentorQuestions(label, QUIZ_SIZE);
    const questions: PublicMentorQuestion[] = picked.map((q) => ({
      id: q.id,
      category: q.category,
      question: q.question,
      options: q.options,
    }));

    return { questions, total: QUIZ_SIZE, passMark: PASS_MARK };
  }

  /** Grades a submission server-side and grants Mentor on a pass. */
  async submitMentorQuiz(userId: string, answers: QuizAnswerDto[], skill?: string): Promise<QuizResultResponse> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    const label = this.labelFor(user, skill);

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
      // Mentor IN THIS SKILL only — their role in other skills is untouched.
      const key = skillKey(label);
      const rows = await this.prisma.userSkill.findMany({ where: { userId } });
      const existing = rows.find((r) => r.skillKey === key);
      if (existing) {
        await this.prisma.userSkill.update({ where: { id: existing.id }, data: { role: UserRole.MENTOR } });
      } else {
        this.assertRoom(rows);
        await this.prisma.userSkill.create({ data: { userId, skill: label, skillKey: key, role: UserRole.MENTOR } });
      }
      // The account's own role follows its main skill.
      const isMain = !this.isMember(user) || rows.length === 0 || skillKey(user.hobby) === key;
      const updated = isMain
        ? await this.users.update(user.id, { role: UserRole.MENTOR, hobby: existing?.skill ?? label })
        : user;
      session = await this.auth.issueSession(updated);
    }

    return { passed, score, total: QUIZ_SIZE, passMark: PASS_MARK, results, session, skill: label };
  }
}
