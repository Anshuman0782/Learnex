/**
 * Event challenge catalog. Every task is measured by the server from real
 * activity (never self-reported), only inside the event's circle where that
 * applies, and only during the event's live phase.
 */

export type Track = 'Learner' | 'Mentor';
export type ContentKind = 'any' | 'video' | 'reel' | 'audio' | 'photo' | 'discussion';

export type TaskType =
  | 'PUBLISH'
  | 'COMMENT'
  | 'EARN_LIKES'
  | 'GET_CRITIQUED'
  | 'PRACTICE'
  | 'ACTIVE_DAYS'
  | 'GIVE_CRITIQUES'
  | 'DEEP_CRITIQUES'
  | 'HELPFUL_CRITIQUES';

export interface EventTask {
  id: string;
  type: TaskType;
  target: number;
  kind?: ContentKind; // PUBLISH only
}

/** A critique this long (characters) counts as a "deep-dive" critique. */
export const DEEP_CRITIQUE_CHARS = 120;
/** Practice sessions count at most this many times per day (self-logged). */
export const PRACTICE_PER_DAY_CAP = 2;

interface TaskDef {
  title: string;
  icon: string;
  tracks: Track[];
  min: number;
  max: number;
  /** How the server measures it — shown to members. */
  howMeasured: string;
}

export const TASKS: Record<TaskType, TaskDef> = {
  PUBLISH: {
    title: 'Publish content',
    icon: 'cloud-upload',
    tracks: ['Learner', 'Mentor'],
    min: 1,
    max: 10,
    howMeasured: 'Public posts you publish in this circle.',
  },
  COMMENT: {
    title: 'Comment on posts',
    icon: 'chatbubbles',
    tracks: ['Learner', 'Mentor'],
    min: 1,
    max: 30,
    howMeasured: 'Other members’ posts in this circle you comment on (once per post).',
  },
  EARN_LIKES: {
    title: 'Earn likes',
    icon: 'heart',
    tracks: ['Learner'],
    min: 3,
    max: 200,
    howMeasured: 'Likes from other members on your posts in this circle.',
  },
  GET_CRITIQUED: {
    title: 'Get mentor feedback',
    icon: 'ribbon',
    tracks: ['Learner'],
    min: 1,
    max: 10,
    howMeasured: 'Mentor critiques received on your posts in this circle.',
  },
  PRACTICE: {
    title: 'Log practice sessions',
    icon: 'timer',
    tracks: ['Learner'],
    min: 1,
    max: 14,
    howMeasured: `Practice sessions you log (max ${PRACTICE_PER_DAY_CAP} per day count).`,
  },
  ACTIVE_DAYS: {
    title: 'Show up daily',
    icon: 'flame',
    tracks: ['Learner', 'Mentor'],
    min: 1,
    max: 6,
    howMeasured: 'Different days you post, comment or critique in this circle.',
  },
  GIVE_CRITIQUES: {
    title: 'Give critiques',
    icon: 'school',
    tracks: ['Mentor'],
    min: 1,
    max: 30,
    howMeasured: 'Members’ posts in this circle you critique (once per post).',
  },
  DEEP_CRITIQUES: {
    title: 'Deep-dive critiques',
    icon: 'bulb',
    tracks: ['Mentor'],
    min: 1,
    max: 15,
    howMeasured: `Critiques of ${DEEP_CRITIQUE_CHARS}+ characters on members’ posts in this circle.`,
  },
  HELPFUL_CRITIQUES: {
    title: 'Be the most helpful',
    icon: 'thumbs-up',
    tracks: ['Mentor'],
    min: 1,
    max: 100,
    howMeasured: 'Likes from members on your critiques in this circle.',
  },
};

const KIND_WORD: Record<ContentKind, [string, string]> = {
  any: ['post', 'posts'],
  video: ['video', 'videos'],
  reel: ['reel', 'reels'],
  audio: ['audio take', 'audio takes'],
  photo: ['photo post', 'photo posts'],
  discussion: ['discussion', 'discussions'],
};

/** Human label for a task, e.g. "Publish 3 reels". */
export function taskLabel(t: Pick<EventTask, 'type' | 'target' | 'kind'>): string {
  const n = t.target;
  const s = (one: string, many: string) => (n === 1 ? one : many);
  switch (t.type) {
    case 'PUBLISH': {
      const [one, many] = KIND_WORD[t.kind ?? 'any'];
      return `Publish ${n} ${s(one, many)}`;
    }
    case 'COMMENT':
      return `Comment on ${n} member ${s('post', 'posts')}`;
    case 'EARN_LIKES':
      return `Earn ${n} ${s('like', 'likes')} on your posts`;
    case 'GET_CRITIQUED':
      return `Get ${n} mentor ${s('critique', 'critiques')}`;
    case 'PRACTICE':
      return `Log ${n} practice ${s('session', 'sessions')}`;
    case 'ACTIVE_DAYS':
      return `Be active on ${n} different ${s('day', 'days')}`;
    case 'GIVE_CRITIQUES':
      return `Critique ${n} member ${s('post', 'posts')}`;
    case 'DEEP_CRITIQUES':
      return `Write ${n} deep-dive ${s('critique', 'critiques')}`;
    case 'HELPFUL_CRITIQUES':
      return `Get ${n} ${s('like', 'likes')} on your critiques`;
  }
}

export interface Preset {
  id: string;
  track: Track;
  name: string;
  icon: string;
  tagline: string;
  suggestedXp: number;
  tasks: Array<Omit<EventTask, 'id'>>;
}

/** Ready-made, exciting challenges an admin can launch in one tap (and tweak). */
export const PRESETS: Preset[] = [
  // ---- Learners ----
  { id: 'reel-rush', track: 'Learner', name: 'Reel Rush', icon: 'flash', tagline: 'Drop 3 reels and get the circle talking.', suggestedXp: 120,
    tasks: [{ type: 'PUBLISH', kind: 'reel', target: 3 }, { type: 'EARN_LIKES', target: 10 }] },
  { id: 'crowd-favorite', track: 'Learner', name: 'Crowd Favorite', icon: 'star', tagline: 'Post your best work and win the crowd.', suggestedXp: 150,
    tasks: [{ type: 'PUBLISH', kind: 'any', target: 2 }, { type: 'EARN_LIKES', target: 25 }] },
  { id: 'feedback-seeker', track: 'Learner', name: 'Feedback Seeker', icon: 'ribbon', tagline: 'Share takes and learn from mentors.', suggestedXp: 120,
    tasks: [{ type: 'PUBLISH', kind: 'video', target: 2 }, { type: 'GET_CRITIQUED', target: 2 }] },
  { id: 'practice-streak', track: 'Learner', name: 'Practice Streak', icon: 'flame', tagline: 'Show up and practice all week.', suggestedXp: 100,
    tasks: [{ type: 'ACTIVE_DAYS', target: 5 }, { type: 'PRACTICE', target: 5 }] },
  { id: 'community-spark', track: 'Learner', name: 'Community Spark', icon: 'chatbubbles', tagline: 'Hype up other members’ work.', suggestedXp: 80,
    tasks: [{ type: 'COMMENT', target: 10 }, { type: 'ACTIVE_DAYS', target: 3 }] },
  // ---- Mentors ----
  { id: 'critique-marathon', track: 'Mentor', name: 'Critique Marathon', icon: 'school', tagline: 'Review as many members as you can.', suggestedXp: 200,
    tasks: [{ type: 'GIVE_CRITIQUES', target: 10 }] },
  { id: 'deep-dive-coach', track: 'Mentor', name: 'Deep-Dive Coach', icon: 'bulb', tagline: 'Fewer, richer critiques that really help.', suggestedXp: 180,
    tasks: [{ type: 'DEEP_CRITIQUES', target: 5 }] },
  { id: 'most-helpful', track: 'Mentor', name: 'Most Helpful Mentor', icon: 'thumbs-up', tagline: 'Give feedback members love.', suggestedXp: 200,
    tasks: [{ type: 'GIVE_CRITIQUES', target: 5 }, { type: 'HELPFUL_CRITIQUES', target: 10 }] },
  { id: 'teach-in-60', track: 'Mentor', name: 'Teach in 60s', icon: 'videocam', tagline: 'Post quick tutorial reels and review members.', suggestedXp: 150,
    tasks: [{ type: 'PUBLISH', kind: 'reel', target: 2 }, { type: 'GIVE_CRITIQUES', target: 3 }] },
  { id: 'mentor-on-call', track: 'Mentor', name: 'Mentor on Call', icon: 'people', tagline: 'Be there for your circle every day.', suggestedXp: 120,
    tasks: [{ type: 'ACTIVE_DAYS', target: 5 }, { type: 'COMMENT', target: 10 }] },
];
