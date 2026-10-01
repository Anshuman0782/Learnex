/** Quest and badge catalog (server-defined; progress is measured from real activity). */

export type QuestMeasure =
  | 'sessions_today'
  | 'posts_today'
  | 'critiques_given_today'
  | 'active_days_week'
  | 'posts_week'
  | 'critiques_given_week';

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  role: 'Learner' | 'Mentor';
  category: 'daily' | 'weekly';
  xpReward: number;
  target: number;
  measure: QuestMeasure;
  icon: string;
  iconBg: string;
  iconColor: string;
}

export const QUEST_DEFS: QuestDef[] = [
  // Learner — daily
  { id: 'q-l-session', title: 'Daily Practice Session', description: 'Log at least one focused practice session today.', role: 'Learner', category: 'daily', xpReward: 15, target: 1, measure: 'sessions_today', icon: 'flame', iconBg: '#FFEDD5', iconColor: '#EA580C' },
  { id: 'q-l-post', title: 'Share a Practice Clip', description: 'Post a practice video to a circle for feedback.', role: 'Learner', category: 'daily', xpReward: 30, target: 1, measure: 'posts_today', icon: 'videocam', iconBg: '#EDE9FE', iconColor: '#7C3AED' },
  // Learner — weekly
  { id: 'q-l-week-days', title: 'Practice 5 Days This Week', description: 'Stay consistent — be active on 5 different days this week.', role: 'Learner', category: 'weekly', xpReward: 120, target: 5, measure: 'active_days_week', icon: 'sparkles', iconBg: '#FEF3C7', iconColor: '#D97706' },
  { id: 'q-l-week-posts', title: 'Post 3 Videos This Week', description: 'Share three practice takes this week.', role: 'Learner', category: 'weekly', xpReward: 100, target: 3, measure: 'posts_week', icon: 'mic', iconBg: '#FFE4E6', iconColor: '#E11D48' },

  // Mentor — daily
  { id: 'q-m-critique', title: 'Give a Critique Today', description: 'Deliver at least one critique to a learner today.', role: 'Mentor', category: 'daily', xpReward: 40, target: 1, measure: 'critiques_given_today', icon: 'flash', iconBg: '#FEF3C7', iconColor: '#D97706' },
  // Mentor — weekly
  { id: 'q-m-week-critiques', title: 'Critique 10 Learners', description: 'Deliver ten critiques across the week.', role: 'Mentor', category: 'weekly', xpReward: 250, target: 10, measure: 'critiques_given_week', icon: 'trophy', iconBg: '#DBEAFE', iconColor: '#1D4ED8' },
  { id: 'q-m-week-days', title: 'Be Active 5 Days', description: 'Show up for your students on 5 days this week.', role: 'Mentor', category: 'weekly', xpReward: 120, target: 5, measure: 'active_days_week', icon: 'people', iconBg: '#DCFCE7', iconColor: '#16A34A' },
];

export interface BadgeDef {
  code: string;
  title: string;
  icon: string;
  bgColor: string;
  color: string;
}

export const BADGE_DEFS: Record<string, BadgeDef> = {
  first_post: { code: 'first_post', title: 'First Post', icon: 'videocam', bgColor: '#EDE9FE', color: '#7C3AED' },
  first_critique_received: { code: 'first_critique_received', title: 'First Feedback', icon: 'chatbubble-ellipses', bgColor: '#DBEAFE', color: '#2563EB' },
  first_critique_given: { code: 'first_critique_given', title: 'First Critique', icon: 'ribbon', bgColor: '#EDE9FE', color: '#7C3AED' },
  streak_7: { code: 'streak_7', title: '7-Day Streak', icon: 'flame', bgColor: '#FFEDD5', color: '#EA580C' },
  streak_30: { code: 'streak_30', title: '30-Day Streak', icon: 'flame', bgColor: '#FFE4E6', color: '#E11D48' },
  goal_crusher: { code: 'goal_crusher', title: 'Goal Crusher', icon: 'trophy', bgColor: '#FEF3C7', color: '#D97706' },
  level_5: { code: 'level_5', title: 'Level 5', icon: 'star', bgColor: '#FEF08A', color: '#CA8A04' },
  top_rated: { code: 'top_rated', title: 'Top Rated', icon: 'star', bgColor: '#DCFCE7', color: '#15803D' },
};
