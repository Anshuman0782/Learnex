import { UserRole } from '@prisma/client';

/**
 * Multi-skill helpers. A member can join several skills (Music, Coding, ...)
 * and holds a separate role — Learner or Mentor — in each one. Their main
 * skill is mirrored on User.hobby / User.role.
 */

export type Track = 'Learner' | 'Mentor';

export const MAX_SKILLS = 10;

/** Tidy a skill label for display ("  music   theory " → "music theory"). */
export const cleanSkill = (s?: string | null): string => (s ?? '').trim().replace(/\s+/g, ' ');

/** Comparison key — "Music" and "music" are the same skill. */
export const skillKey = (s?: string | null): string => cleanSkill(s).toLowerCase();

export interface SkillRow {
  skill: string;
  skillKey: string;
  role: UserRole;
}

export interface SkillOwner {
  role: UserRole | null;
  hobby?: string | null;
  skills?: SkillRow[];
}

export interface SkillContext {
  /** Display label of the skill the activity counts toward. */
  skill: string;
  key: string;
  /** The member's role in that skill. */
  role: Track;
  /** True when the member has actually joined the requested skill (not a fallback). */
  exact: boolean;
}

const trackOf = (r: UserRole | null): Track => (r === UserRole.MENTOR ? 'Mentor' : 'Learner');

/** The member's main skill (the one mirrored on hobby/role), if they have any. */
export function primarySkill(user: SkillOwner): SkillRow | null {
  const skills = user.skills ?? [];
  if (skills.length === 0) return null;
  const hobbyKey = skillKey(user.hobby);
  return skills.find((s) => s.skillKey === hobbyKey) ?? skills[0];
}

/**
 * Which skill + role an activity counts toward. If the member has joined
 * `skill`, that's the one; otherwise it falls back to their main skill.
 * Guests and accounts without a role have no context (they earn nothing).
 */
export function resolveContext(user: SkillOwner, skill?: string | null): SkillContext | null {
  if (user.role !== UserRole.LEARNER && user.role !== UserRole.MENTOR) return null;
  const skills = user.skills ?? [];
  const wanted = skillKey(skill);
  const hit = wanted ? skills.find((s) => s.skillKey === wanted) : undefined;
  if (hit) return { skill: hit.skill, key: hit.skillKey, role: trackOf(hit.role), exact: true };

  const main = primarySkill(user);
  if (main) return { skill: main.skill, key: main.skillKey, role: trackOf(main.role), exact: false };

  // No skill rows (shouldn't happen after onboarding) — use the account itself.
  const label = cleanSkill(user.hobby) || 'General';
  return { skill: label, key: label.toLowerCase(), role: trackOf(user.role), exact: false };
}

/** Is the member a Mentor in exactly this skill? */
export function isMentorIn(user: SkillOwner, skill?: string | null): boolean {
  const ctx = resolveContext(user, skill);
  return !!ctx && ctx.exact && ctx.role === 'Mentor';
}

/** Badge shown next to a name on content of the given skill. */
export function roleLabelIn(user: SkillOwner, skill?: string | null): 'Mentor' | 'Learner' | 'Guest' {
  if (user.role === UserRole.GUEST) return 'Guest';
  return isMentorIn(user, skill) ? 'Mentor' : 'Learner';
}

/** Prisma `select` fragment for the fields the helpers above need. */
export const SKILL_OWNER_SELECT = {
  role: true,
  hobby: true,
  skills: { select: { skill: true, skillKey: true, role: true } },
} as const;
