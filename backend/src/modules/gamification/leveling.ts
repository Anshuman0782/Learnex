/** XP → level → title curve, plus UTC day/week helpers used across the engine. */

// XP required to REACH a given level: threshold(L) = 50 * L * (L-1).
// L1=0, L2=100, L3=300, L4=600, L5=1000, L6=1500, L7=2100, L10=4500, L16=12000…
export function thresholdForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (thresholdForLevel(level + 1) <= xp) level++;
  return level;
}

export const TIER_TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 16, title: 'Master' },
  { minLevel: 11, title: 'Expert' },
  { minLevel: 7, title: 'Advanced' },
  { minLevel: 4, title: 'Skilled' },
  { minLevel: 2, title: 'Rising Talent' },
  { minLevel: 1, title: 'Newcomer' },
];

export function titleForLevel(level: number): string {
  return TIER_TITLES.find((t) => level >= t.minLevel)?.title ?? 'Newcomer';
}

export interface LevelInfo {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelFromXp(xp);
  const base = thresholdForLevel(level);
  const next = thresholdForLevel(level + 1);
  return {
    level,
    title: titleForLevel(level),
    xpIntoLevel: xp - base,
    xpForNextLevel: next - base,
  };
}

/** Level tiers for display, lowest first: title, level it starts at, lifetime XP needed. */
export function levelTiers(): { title: string; minLevel: number; minXp: number }[] {
  return [...TIER_TITLES]
    .reverse()
    .map((t) => ({ title: t.title, minLevel: t.minLevel, minXp: thresholdForLevel(t.minLevel) }));
}

// --- seasons ---

/** Season numbering epoch: Season 1 = January 2026. */
const SEASON_EPOCH_YEAR = 2026;

/**
 * The monthly season containing `date`: the UTC calendar month. Season XP is
 * the XP earned inside [startsAt, endsAt), so rankings reset automatically on
 * the 1st of every month without deleting any history.
 */
export function seasonWindow(date: Date = new Date()): {
  number: number;
  startsAt: Date;
  endsAt: Date;
} {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return {
    number: (y - SEASON_EPOCH_YEAR) * 12 + m + 1,
    startsAt: new Date(Date.UTC(y, m, 1)),
    endsAt: new Date(Date.UTC(y, m + 1, 1)),
  };
}

// --- date helpers (UTC) ---

export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export function startOfUtcDay(d: Date = new Date()): Date {
  return new Date(`${utcDay(d)}T00:00:00.000Z`);
}

export function daysAgoUtc(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** ISO week key, e.g. '2026-W39'. */
export function isoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Start of the current ISO week (Monday 00:00 UTC). */
export function startOfIsoWeek(date: Date = new Date()): Date {
  const d = startOfUtcDay(date);
  const dayNum = d.getUTCDay() || 7; // Sun=7
  d.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return d;
}

/** Difference in whole UTC days between two 'YYYY-MM-DD' strings (b - a). */
export function dayDiff(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000,
  );
}
