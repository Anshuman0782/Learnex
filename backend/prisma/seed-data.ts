/**
 * Seed catalog for communities and skills. Communities are the app's structural
 * circles (topics users can join); all membership data (counts, members, mentors)
 * is computed from real users — none of it is fabricated here.
 */

export interface SeedCommunity {
  id: string;
  name: string;
  category: string;
  description: string;
  iconName: string;
  iconBgColor: string;
  iconColor: string;
  isHot?: boolean;
  tags: string[];
}

export interface SeedSkill {
  id: string;
  name: string;
  category: string;
  iconName: string;
  iconBgColor: string;
  iconColor: string;
  topicsCount: number;
  badge?: string;
}

export const COMMUNITIES: SeedCommunity[] = [
  { id: 'comm-music-2', name: 'Vocal & Singing Mastery', category: 'Music', description: 'Post your singing clips, get pitch critiques from certified vocal mentors, and learn chest-to-head mix.', iconName: 'mic', iconBgColor: '#FFE4E6', iconColor: '#F43F5E', isHot: true, tags: ['#VocalCritiques', '#SingingVideos', '#PitchCorrection'] },
  { id: 'comm-music-1', name: 'Indie Producers & Beatmakers', category: 'Music', description: 'Share DAW setups, mixing video reviews, beat battles, and sound design techniques.', iconName: 'musical-notes', iconBgColor: '#EDE9FE', iconColor: '#7C3AED', isHot: true, tags: ['#DAW', '#MixingCritique', '#Beatmaking'] },
  { id: 'comm-music-3', name: 'Guitarists & Jam Hub', category: 'Music', description: 'Upload fingerstyle & solo videos, get finger posture feedback, and participate in jam sessions.', iconName: 'radio', iconBgColor: '#FEF3C7', iconColor: '#D97706', isHot: true, tags: ['#GuitarVideos', '#SoloFeedback', '#Chords'] },
  { id: 'comm-music-4', name: 'Music Theory & Songwriting', category: 'Music', description: 'Deconstruct hit song chord progressions, melody crafting, and lyrical analysis.', iconName: 'book', iconBgColor: '#DBEAFE', iconColor: '#2563EB', tags: ['#Songwriting', '#Melody', '#Theory'] },
  { id: 'comm-coding-1', name: 'Full-Stack Developers Guild', category: 'Coding', description: 'Post code demo videos, get architecture reviews from Senior mentors, and debug tough bugs.', iconName: 'code-slash', iconBgColor: '#D1FAE5', iconColor: '#059669', isHot: true, tags: ['#CodeReviews', '#React', '#NodeJS'] },
  { id: 'comm-coding-2', name: 'React & Mobile Ninjas', category: 'Coding', description: 'Master component architecture, hooks, animations, and cross-platform apps.', iconName: 'logo-react', iconBgColor: '#DBEAFE', iconColor: '#2563EB', tags: ['#ReactNative', '#Expo', '#Hooks'] },
  { id: 'comm-coding-3', name: 'Python & AI Innovations', category: 'Coding', description: 'Explore generative AI, PyTorch, LLMs, data science, and backend APIs.', iconName: 'hardware-chip', iconBgColor: '#EDE9FE', iconColor: '#7C3AED', tags: ['#GenAI', '#PyTorch', '#Python'] },
  { id: 'comm-design-1', name: 'UI/UX Designers Hub', category: 'Design', description: 'Design systems, Figma plugins, wireframing, usability tests, and career growth.', iconName: 'brush', iconBgColor: '#EDE9FE', iconColor: '#7C3AED', isHot: true, tags: ['#FigmaCritique', '#DesignSystems', '#Wireframes'] },
];

export const SKILLS: SeedSkill[] = [
  // Music
  { id: 's-sing', name: 'Singing & Vocals', category: 'Music', iconName: 'mic', iconBgColor: '#FFE4E6', iconColor: '#F43F5E', topicsCount: 16, badge: 'Hot' },
  { id: 's-prod', name: 'Music Production', category: 'Music', iconName: 'musical-notes', iconBgColor: '#EDE9FE', iconColor: '#7C3AED', topicsCount: 18, badge: 'Popular' },
  { id: 's-guitar', name: 'Guitar Mastery', category: 'Music', iconName: 'radio', iconBgColor: '#FEF3C7', iconColor: '#D97706', topicsCount: 15 },
  { id: 's-theory', name: 'Music Theory', category: 'Music', iconName: 'book', iconBgColor: '#DBEAFE', iconColor: '#2563EB', topicsCount: 9 },
  { id: 's-audio', name: 'Audio Editing', category: 'Music', iconName: 'hardware-chip', iconBgColor: '#D1FAE5', iconColor: '#059669', topicsCount: 14 },
  { id: 's-more-m', name: 'More Tracks', category: 'Music', iconName: 'grid', iconBgColor: '#F1F5F9', iconColor: '#64748B', topicsCount: 25 },
  // Coding
  { id: 's-dev', name: 'Full-Stack Dev', category: 'Coding', iconName: 'code-slash', iconBgColor: '#D1FAE5', iconColor: '#059669', topicsCount: 24, badge: 'Top Rated' },
  { id: 's-career', name: 'Career Prep', category: 'Coding', iconName: 'briefcase', iconBgColor: '#DBEAFE', iconColor: '#2563EB', topicsCount: 11 },
  { id: 's-mkt', name: 'App Growth', category: 'Coding', iconName: 'locate-outline', iconBgColor: '#FFE4E6', iconColor: '#F43F5E', topicsCount: 8 },
  { id: 's-design', name: 'Frontend Design', category: 'Coding', iconName: 'pencil', iconBgColor: '#FEF3C7', iconColor: '#D97706', topicsCount: 16 },
  { id: 's-biz', name: 'AI & Data', category: 'Coding', iconName: 'stats-chart', iconBgColor: '#EDE9FE', iconColor: '#7C3AED', topicsCount: 20, badge: 'Trending' },
  { id: 's-more', name: 'More Topics', category: 'Coding', iconName: 'grid', iconBgColor: '#F1F5F9', iconColor: '#64748B', topicsCount: 30 },
  // Design
  { id: 's-uiux', name: 'UI/UX Design', category: 'Design', iconName: 'brush', iconBgColor: '#EDE9FE', iconColor: '#7C3AED', topicsCount: 22, badge: 'Popular' },
  { id: 's-graphic', name: 'Brand Identity', category: 'Design', iconName: 'color-palette', iconBgColor: '#FFE4E6', iconColor: '#F43F5E', topicsCount: 14 },
  { id: 's-3d', name: '3D Modeling', category: 'Design', iconName: 'cube', iconBgColor: '#DBEAFE', iconColor: '#2563EB', topicsCount: 10 },
  { id: 's-typo', name: 'Typography', category: 'Design', iconName: 'text', iconBgColor: '#FEF3C7', iconColor: '#D97706', topicsCount: 7 },
  { id: 's-figma', name: 'Figma Systems', category: 'Design', iconName: 'layers', iconBgColor: '#D1FAE5', iconColor: '#059669', topicsCount: 18, badge: 'Essential' },
  { id: 's-more-d', name: 'More Tracks', category: 'Design', iconName: 'grid', iconBgColor: '#F1F5F9', iconColor: '#64748B', topicsCount: 20 },
  // General (fallback when the hobby has no dedicated catalog)
  { id: 's-dev-d', name: 'Development', category: 'General', iconName: 'code-slash', iconBgColor: '#D1FAE5', iconColor: '#059669', topicsCount: 20 },
  { id: 's-career-d', name: 'Career Skills', category: 'General', iconName: 'briefcase', iconBgColor: '#DBEAFE', iconColor: '#2563EB', topicsCount: 15 },
  { id: 's-mkt-d', name: 'Marketing', category: 'General', iconName: 'locate-outline', iconBgColor: '#FFE4E6', iconColor: '#F43F5E', topicsCount: 12 },
  { id: 's-design-d', name: 'Design Craft', category: 'General', iconName: 'pencil', iconBgColor: '#FEF3C7', iconColor: '#D97706', topicsCount: 18 },
  { id: 's-biz-d', name: 'Business Logic', category: 'General', iconName: 'stats-chart', iconBgColor: '#EDE9FE', iconColor: '#7C3AED', topicsCount: 14 },
  { id: 's-more-gen', name: 'Explore More', category: 'General', iconName: 'grid', iconBgColor: '#F1F5F9', iconColor: '#64748B', topicsCount: 28 },
];
