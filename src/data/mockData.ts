import { RoleOption, UserPersonalStats } from '../types';

export const DEFAULT_USER_STATS: UserPersonalStats = {
  weeklyTargetSessions: 5,
  completedTargetSessions: 4,
  weeklyTargetHours: 3.5,
  completedTargetHours: 2.8,
  streakDays: 6,
  xpPoints: 1240,
  levelBadge: 'Rising Vocalist',
  accuracyRate: 88,
  consistencyRate: 94,
  critiquesCompleted: 12,
  improvementTrend: '+18% technique accuracy this week',
  badges: [
    { id: 'b-1', title: 'Top 5% Performer', icon: 'trophy', bgColor: '#FEF3C7', color: '#D97706' },
    { id: 'b-2', title: '6-Day Streak', icon: 'flame', bgColor: '#FFEDD5', color: '#EA580C' },
    { id: 'b-3', title: 'Vocal Pitch Pro', icon: 'mic', bgColor: '#EDE9FE', color: '#7C3AED' },
  ],
};

export const POPULAR_HOBBIES: string[] = [
  'Music',
  'Coding',
  'Design',
  'Photography',
  'Fitness',
  'Marketing',
  'Business',
  'Writing',
];

export const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'Learner',
    title: 'I am a Learner',
    subtitle: 'Student • Explorer • Skill Seeker',
    description: 'I want to upload practice videos, receive mentor video critiques, and learn with peers.',
    iconName: 'school',
    iconBgColor: '#EDE9FE',
    iconColor: '#5B4DFF',
    perks: [
      'Upload singing, music, and coding practice videos',
      'Get personalized video feedback from certified mentors',
      'Join live peer discussion channels & community groups',
    ],
  },
  {
    id: 'Mentor',
    title: 'I am a Mentor',
    subtitle: 'Guide • Professional • Creator',
    description: 'Pass the 5-question test (4/5 to qualify) to give video critiques and guide community members.',
    iconName: 'person',
    iconBgColor: '#FFE4E6',
    iconColor: '#E11D48',
    perks: [
      'Record and post video critiques directly on learner clips',
      'Identify vocal/skill faults with timestamped feedback',
      'Earn mentor reputation points and verified badges',
    ],
  },
];

