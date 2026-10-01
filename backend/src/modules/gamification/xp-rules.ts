import { XpSource } from '@prisma/client';

/**
 * The XP economy catalog.
 *
 * - `isCore: true`  → fixed platform rules. Their values are re-asserted from this
 *   file on every boot, so they can't drift or be edited by an admin.
 * - `isCore: false` → defaults for tunable rules. They're created once; after that
 *   an admin can change `xp`, `dailyCap` and on/off without a deploy.
 *
 * Each rule maps to one XpSource so daily caps can be counted from the ledger.
 */
export type XpRuleKey =
  | 'DAILY_CHECKIN'
  | 'STREAK_7'
  | 'STREAK_30'
  | 'STREAK_100'
  | 'CONTENT_PUBLISHED'
  | 'PRACTICE_SESSION'
  | 'CRITIQUE_RECEIVED'
  | 'CRITIQUE_GIVEN'
  | 'COMMENT_POSTED'
  | 'LIKE_RECEIVED'
  | 'GOAL_COMPLETED';

/**
 * Real app events an XP rule can listen to. Every active rule on a trigger pays
 * out when that event happens, so admins can add rules without code changes.
 * All triggers already skip self-interaction (e.g. liking your own post).
 */
export const XP_TRIGGERS = [
  { id: 'daily.checkin', label: 'Daily check-in', description: 'User opens the app. Fires once per day.' },
  { id: 'post.published', label: 'Publish any public post', description: 'Any public video, reel, photo, audio or discussion is published.' },
  { id: 'video.published', label: 'Publish a video', description: 'A public long-form video is published.' },
  { id: 'reel.published', label: 'Publish a reel', description: 'A public reel (short) is published.' },
  { id: 'audio.published', label: 'Publish an audio take', description: 'A public audio post is published.' },
  { id: 'photo.published', label: 'Publish a photo post', description: 'A public photo post is published.' },
  { id: 'discussion.published', label: 'Publish a discussion', description: 'A public text discussion is published.' },
  { id: 'comment.posted', label: 'Comment on a post', description: "User comments on someone else's post." },
  { id: 'like.received', label: 'Receive a like', description: 'Someone likes the user’s public post (once per person per post).' },
  { id: 'repost.received', label: 'Get reposted', description: 'Someone reposts the user’s post (once per person per post).' },
  { id: 'follower.gained', label: 'Gain a follower', description: 'Someone follows the user (once per follower).' },
  { id: 'critique.given', label: 'Give a critique', description: "A mentor critiques someone else's post." },
  { id: 'critique.received', label: 'Receive a critique', description: 'A mentor critiques the user’s post.' },
  { id: 'session.logged', label: 'Log a practice session', description: 'User logs a practice session.' },
  { id: 'goal.completed', label: 'Complete a goal', description: 'User completes their active practice goal.' },
  { id: 'event.completed', label: 'Complete a circle event', description: 'User completes a circle event / challenge.' },
  { id: 'streak.7', label: 'Reach a 7-day streak', description: 'User is active 7 days in a row (once per season).' },
  { id: 'streak.30', label: 'Reach a 30-day streak', description: 'User is active 30 days in a row (once per season).' },
  { id: 'streak.100', label: 'Reach a 100-day streak', description: 'User is active 100 days in a row (once per season).' },
] as const;

export type XpTrigger = (typeof XP_TRIGGERS)[number]['id'];
export const XP_TRIGGER_IDS = new Set<string>(XP_TRIGGERS.map((t) => t.id));

export type XpRuleRole = 'Learner' | 'Mentor' | 'Both';
export type XpRuleCategory = 'Consistency' | 'Practice' | 'Community' | 'Mentoring' | 'Milestones';

export interface XpRuleDef {
  key: XpRuleKey;
  trigger: XpTrigger;
  source: XpSource;
  title: string;
  description: string;
  role: XpRuleRole;
  category: XpRuleCategory;
  xp: number;
  dailyCap: number | null;
  isCore: boolean;
  sortOrder: number;
}

export const XP_RULE_DEFS: XpRuleDef[] = [
  // --- Consistency (core) ---
  {
    key: 'DAILY_CHECKIN',
    trigger: 'daily.checkin',
    source: XpSource.DAILY_CHECKIN,
    title: 'Daily check-in',
    description: 'Open LERNEX on any day. Counts once per day and keeps your streak alive.',
    role: 'Both',
    category: 'Consistency',
    xp: 5,
    dailyCap: 1,
    isCore: true,
    sortOrder: 10,
  },
  {
    key: 'STREAK_7',
    trigger: 'streak.7',
    source: XpSource.STREAK_MILESTONE,
    title: '7-day streak',
    description: 'Be active 7 days in a row. Paid once per season.',
    role: 'Both',
    category: 'Consistency',
    xp: 50,
    dailyCap: null,
    isCore: true,
    sortOrder: 11,
  },
  {
    key: 'STREAK_30',
    trigger: 'streak.30',
    source: XpSource.STREAK_MILESTONE,
    title: '30-day streak',
    description: 'Be active 30 days in a row. Paid once per season.',
    role: 'Both',
    category: 'Consistency',
    xp: 200,
    dailyCap: null,
    isCore: true,
    sortOrder: 12,
  },
  {
    key: 'STREAK_100',
    trigger: 'streak.100',
    source: XpSource.STREAK_MILESTONE,
    title: '100-day streak',
    description: 'Be active 100 days in a row. Paid once per season.',
    role: 'Both',
    category: 'Consistency',
    xp: 750,
    dailyCap: null,
    isCore: true,
    sortOrder: 13,
  },

  // --- Practice (configurable) ---
  {
    key: 'CONTENT_PUBLISHED',
    trigger: 'post.published',
    source: XpSource.POST,
    title: 'Publish content',
    description: 'Publish a public video, reel, audio take or discussion.',
    role: 'Both',
    category: 'Practice',
    xp: 25,
    dailyCap: 3,
    isCore: false,
    sortOrder: 20,
  },
  {
    key: 'PRACTICE_SESSION',
    trigger: 'session.logged',
    source: XpSource.SESSION,
    title: 'Log a practice session',
    description: 'Log a practice session toward your active goal.',
    role: 'Both',
    category: 'Practice',
    xp: 10,
    dailyCap: 4,
    isCore: false,
    sortOrder: 21,
  },
  {
    key: 'CRITIQUE_RECEIVED',
    trigger: 'critique.received',
    source: XpSource.CRITIQUE_RECEIVED,
    title: 'Receive a mentor critique',
    description: 'A mentor leaves a critique on one of your posts.',
    role: 'Both',
    category: 'Practice',
    xp: 15,
    dailyCap: 5,
    isCore: false,
    sortOrder: 22,
  },

  // --- Mentoring (configurable) ---
  {
    key: 'CRITIQUE_GIVEN',
    trigger: 'critique.given',
    source: XpSource.CRITIQUE_GIVEN,
    title: 'Give a critique',
    description: "Deliver a mentor critique on someone else's post.",
    role: 'Mentor',
    category: 'Mentoring',
    xp: 30,
    dailyCap: 10,
    isCore: false,
    sortOrder: 30,
  },

  // --- Community (configurable) ---
  {
    key: 'COMMENT_POSTED',
    trigger: 'comment.posted',
    source: XpSource.COMMENT,
    title: 'Comment on a post',
    description: "Leave a comment on someone else's post.",
    role: 'Both',
    category: 'Community',
    xp: 3,
    dailyCap: 10,
    isCore: false,
    sortOrder: 40,
  },
  {
    key: 'LIKE_RECEIVED',
    trigger: 'like.received',
    source: XpSource.LIKE_RECEIVED,
    title: 'Get a like',
    description: 'Someone likes your post. Each person counts once per post.',
    role: 'Both',
    category: 'Community',
    xp: 2,
    dailyCap: 25,
    isCore: false,
    sortOrder: 41,
  },

  // --- Milestones (configurable) ---
  {
    key: 'GOAL_COMPLETED',
    trigger: 'goal.completed',
    source: XpSource.GOAL_COMPLETE,
    title: 'Complete a goal',
    description: 'Finish every session of your active practice goal.',
    role: 'Both',
    category: 'Milestones',
    xp: 150,
    dailyCap: null,
    isCore: false,
    sortOrder: 50,
  },
];

export const XP_RULE_DEF_BY_KEY = new Map(XP_RULE_DEFS.map((d) => [d.key, d]));

/** How each season (month) works — shown verbatim in the app's Rules tab. */
export const SEASON_RULES: string[] = [
  'A season is one calendar month. It starts on the 1st and ends when the next month begins.',
  'Your rank is based only on the XP you earn during the current season.',
  'Learners and Mentors are ranked on separate leaderboards. You can also filter a board by hobby.',
  'When a new season starts, Season XP and ranks reset to zero. The finished season’s final standings are saved.',
  'If two people have the same Season XP, whoever reached it first ranks higher.',
  'Your Level comes from lifetime XP and never resets.',
];

/** Anti-abuse policy — enforced on the server, shown in the Rules tab. */
export const FAIR_PLAY_RULES: string[] = [
  'You never earn XP from your own content: liking, commenting on or critiquing your own posts gives nothing, and you can’t repost your own posts.',
  'A like pays its post’s author once per person. Unliking and liking again doesn’t repeat it.',
  'Rules with a daily limit stop paying XP once you reach that limit for the day. Limits reset every day.',
  'Only public posts earn publishing XP. Private and scheduled posts don’t.',
  'Spam, fake engagement or abusive content can lead to XP being removed and removal from the leaderboard.',
];
