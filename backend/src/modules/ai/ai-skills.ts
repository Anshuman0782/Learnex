import { skillKey } from '../../common/utils/skill.js';

/**
 * The skills the AI can judge in Stage 1, each with a fixed checklist
 * (rubric). Every score is 0-100 per criterion; the overall score is the
 * weighted average of the criteria that could be scored.
 *
 * Bump `version` whenever a checklist changes — stored reviews keep the
 * version they were scored with, so old and new scores are never mixed up.
 */

export type AiSkillId = 'coding' | 'music' | 'spoken_english';

export interface Criterion {
  key: string;
  label: string;
  /** What the AI looks for — sent to the model verbatim. */
  guide: string;
  weight: number;
}

export interface AiSkillDef {
  id: AiSkillId;
  label: string;
  version: number;
  /** User skill names that map to this AI skill (compared case-insensitively). */
  aliases: string[];
  /** Words that, when part of a skill name, map to this AI skill. */
  keywords: string[];
  /** What a post needs before it can be reviewed. */
  needs: 'text' | 'audio';
  criteria: Criterion[];
}

export const AI_SKILLS: Record<AiSkillId, AiSkillDef> = {
  coding: {
    id: 'coding',
    label: 'Coding',
    version: 1,
    aliases: ['coding', 'programming', 'software development', 'web development', 'app development', 'development'],
    keywords: ['coding', 'programming', 'developer', 'python', 'javascript', 'typescript', 'java', 'c++', 'react', 'full-stack', 'full stack', 'software'],
    needs: 'text',
    criteria: [
      { key: 'correctness', label: 'Correctness', guide: 'Does the code/solution do what it claims? Bugs, wrong logic, unhandled edge cases lower this.', weight: 0.35 },
      { key: 'readability', label: 'Readability', guide: 'Clear names, structure, formatting, comments where useful.', weight: 0.2 },
      { key: 'efficiency', label: 'Efficiency', guide: 'Sensible algorithm and data structures for the problem size.', weight: 0.15 },
      { key: 'bestPractices', label: 'Best practices', guide: 'Idiomatic use of the language, error handling, security, no obvious anti-patterns.', weight: 0.15 },
      { key: 'explanation', label: 'Explanation', guide: 'How well the author explains what they built, why, and what they learned.', weight: 0.15 },
    ],
  },
  music: {
    id: 'music',
    label: 'Music',
    version: 1,
    aliases: ['music', 'singing', 'vocals', 'vocal', 'guitar', 'piano', 'keyboard', 'violin', 'flute', 'drums', 'ukulele'],
    // Whole-word-ish keywords only ("sing" would also match "processing").
    keywords: ['music', 'singing', 'singer', 'vocal', 'guitar', 'piano', 'violin', 'flute', 'drum', 'ukulele', 'instrument'],
    needs: 'audio',
    criteria: [
      { key: 'pitch', label: 'Pitch accuracy', guide: 'Notes are in tune; no drifting sharp or flat; intervals land correctly.', weight: 0.3 },
      { key: 'rhythm', label: 'Rhythm & timing', guide: 'Steady tempo, notes on time, no rushing or dragging.', weight: 0.25 },
      { key: 'tone', label: 'Tone quality', guide: 'Pleasant, controlled sound; breath/support for singers, clean technique for instruments.', weight: 0.2 },
      { key: 'expression', label: 'Expression', guide: 'Dynamics, phrasing and musical feeling.', weight: 0.15 },
      { key: 'technique', label: 'Technique', guide: 'Control, transitions between notes/registers, cleanness of execution.', weight: 0.1 },
    ],
  },
  spoken_english: {
    id: 'spoken_english',
    label: 'Spoken English',
    version: 1,
    aliases: ['spoken english', 'english', 'english speaking', 'english communication', 'speaking english', 'english language'],
    keywords: ['english'],
    needs: 'audio',
    criteria: [
      { key: 'pronunciation', label: 'Pronunciation', guide: 'Clear, understandable sounds, word stress and intonation.', weight: 0.25 },
      { key: 'fluency', label: 'Fluency', guide: 'Smooth flow, natural pace, few long pauses or fillers (um, uh, like).', weight: 0.25 },
      { key: 'grammar', label: 'Grammar', guide: 'Correct sentence structure, tenses, agreement.', weight: 0.2 },
      { key: 'vocabulary', label: 'Vocabulary', guide: 'Range and appropriateness of words.', weight: 0.15 },
      { key: 'coherence', label: 'Coherence', guide: 'Ideas are organised and on topic; the listener can follow.', weight: 0.15 },
    ],
  },
};

export const AI_SKILL_IDS = Object.keys(AI_SKILLS) as AiSkillId[];

/** Which AI skill a member's skill name belongs to (null = not AI-judged yet). */
export function aiSkillOf(label?: string | null): AiSkillId | null {
  const key = skillKey(label);
  if (!key) return null;
  for (const def of Object.values(AI_SKILLS)) {
    if (def.aliases.includes(key)) return def.id;
  }
  for (const def of Object.values(AI_SKILLS)) {
    if (def.keywords.some((w) => key.includes(w))) return def.id;
  }
  return null;
}

/** Weighted overall score from the criteria that were scored (null = not judged). */
export function overallScore(skill: AiSkillId, scores: Record<string, number | null>): number | null {
  let sum = 0;
  let weight = 0;
  for (const c of AI_SKILLS[skill].criteria) {
    const v = scores[c.key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v * c.weight;
      weight += c.weight;
    }
  }
  return weight > 0 ? Math.round(sum / weight) : null;
}

/** Checklist for judging the CRITIQUE part of a mentor test (all skills). */
export const CRITIQUE_CRITERIA: Criterion[] = [
  { key: 'accuracy', label: 'Accuracy', guide: 'Spots the real problems in the learner work; no wrong advice.', weight: 0.35 },
  { key: 'specificity', label: 'Specificity', guide: 'Points to concrete moments/lines, not generic praise.', weight: 0.25 },
  { key: 'actionability', label: 'Actionable', guide: 'Gives clear next steps or exercises the learner can do.', weight: 0.25 },
  { key: 'tone', label: 'Tone', guide: 'Respectful and encouraging while honest.', weight: 0.15 },
];

export function weighted(criteria: Criterion[], scores: Record<string, number | null>): number | null {
  let sum = 0;
  let weight = 0;
  for (const c of criteria) {
    const v = scores[c.key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v * c.weight;
      weight += c.weight;
    }
  }
  return weight > 0 ? Math.round(sum / weight) : null;
}
