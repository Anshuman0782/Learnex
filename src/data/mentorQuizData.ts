import { MentorQuestion } from '../types';

export const MENTOR_QUIZ_POOL: MentorQuestion[] = [
  // Music & Vocal Mentorship Questions
  {
    id: 'q-m-1',
    category: 'Music',
    question: 'When a singer strains during high notes in chest voice, what is the best mentor advice?',
    options: [
      'Sing louder to push more air through vocal cords',
      'Drop the larynx, relax the tongue base, and transition into mixed voice',
      'Hold breath before starting the phrase',
      'Avoid warming up to save vocal cords',
    ],
    correctIndex: 1,
    explanation: 'Lowering the larynx and blending into head/mixed resonance avoids vocal strain.',
  },
  {
    id: 'q-m-2',
    category: 'Music',
    question: 'What is the primary purpose of a "Dynamic EQ" in vocal audio mixing?',
    options: [
      'To increase maximum master volume by +12dB',
      'To clamp down only on harsh resonant frequencies when they spike',
      'To add artificial reverb to the background choir',
      'To change the tempo of the entire song',
    ],
    correctIndex: 1,
    explanation: 'Dynamic EQ acts adaptively, cutting problem frequencies only when they exceed a threshold.',
  },
  {
    id: 'q-m-3',
    category: 'Music',
    question: 'How should a guitar mentor guide a beginner struggling with barre chords?',
    options: [
      'Squeeze the neck as hard as possible with thumb pressure',
      'Roll index finger slightly onto its bony side and position it close to fret wire',
      'Skip barre chords entirely and only use open chords',
      'Tune strings higher to make fretting easier',
    ],
    correctIndex: 1,
    explanation: 'Slightly rolling the index finger utilizes bone structure rather than soft tissue.',
  },
  {
    id: 'q-m-4',
    category: 'Music',
    question: 'What constitutes an effective video critique for a music student?',
    options: [
      'Just saying "good job" without specific timestamps',
      'Pointing out specific timestamped faults with a live audio demonstration of the fix',
      'Writing a 10-page text theory report without audio',
      'Telling the student to switch instruments',
    ],
    correctIndex: 1,
    explanation: 'Effective mentorship combines clear timestamped feedback with actionable demonstrations.',
  },
  {
    id: 'q-m-5',
    category: 'Music',
    question: 'What is the key benefit of diaphragmatic breath support in vocal performance?',
    options: [
      'Allows sustained phrasing with controlled air pressure and zero throat tension',
      'Makes the voice 5 octaves higher instantly',
      'Stops the singer from needing to warm up',
      'Replaces the need for pitch accuracy',
    ],
    correctIndex: 0,
    explanation: 'Diaphragmatic support provides steady air flow without engaging constrictor muscles.',
  },

  // Coding & Software Mentorship Questions
  {
    id: 'q-c-1',
    category: 'Coding',
    question: 'In React, what is the best practice to prevent unnecessary re-renders in child components receiving callback props?',
    options: [
      'Wrap callback functions in useCallback and memoize child components with React.memo',
      'Declare functions in the global window object',
      'Avoid passing functions as props completely',
      'Call forceUpdate inside useEffect',
    ],
    correctIndex: 0,
    explanation: 'useCallback keeps function references stable across re-renders.',
  },
  {
    id: 'q-c-2',
    category: 'Coding',
    question: 'How should a mentor guide a junior developer during a code review?',
    options: [
      'Rewrite their whole pull request without explanation',
      'Provide constructive feedback explaining the "why" with examples and alternative approaches',
      'Approve everything without checking code quality',
      'Block the PR and criticize their coding speed',
    ],
    correctIndex: 1,
    explanation: 'Mentorship fosters learning by explaining the rationale behind best practices.',
  },
  {
    id: 'q-c-3',
    category: 'Coding',
    question: 'What is the time complexity of looking up a key in a standard Hash Map (average case)?',
    options: [
      'O(n^2)',
      'O(n log n)',
      'O(1)',
      'O(log n)',
    ],
    correctIndex: 2,
    explanation: 'Hash maps provide constant time average lookup O(1).',
  },
  {
    id: 'q-c-4',
    category: 'Coding',
    question: 'When mentoring on RESTful API design, which HTTP method should be recommended for partial updates?',
    options: [
      'GET',
      'DELETE',
      'PATCH',
      'HEAD',
    ],
    correctIndex: 2,
    explanation: 'PATCH applies partial modifications to a resource.',
  },
  {
    id: 'q-c-5',
    category: 'Coding',
    question: 'Why is avoiding mutation of React state directly critical for bug-free applications?',
    options: [
      'Because JavaScript throws a syntax error on mutation',
      'Direct mutations bypass React lifecycle and state diffing, causing stale UI bugs',
      'Direct mutations slow down network speeds',
      'Direct mutations delete the database tables',
    ],
    correctIndex: 1,
    explanation: 'Immutability ensures predictable state changes and triggers appropriate re-renders.',
  },

  // Design & General Mentorship Questions
  {
    id: 'q-d-1',
    category: 'Design',
    question: 'According to WCAG accessibility guidelines, what is the minimum contrast ratio for standard body text?',
    options: [
      '1.5:1',
      '4.5:1',
      '10:1',
      '2.1:1',
    ],
    correctIndex: 1,
    explanation: 'WCAG AA requires a minimum contrast ratio of 4.5:1 for normal text.',
  },
  {
    id: 'q-d-2',
    category: 'General Mentorship',
    question: 'What is the "Growth Mindset" approach when critiquing a learner\'s first practice submission?',
    options: [
      'Tell them they lack natural talent',
      'Praise their effort, highlight what worked well, and provide 1-2 focused areas for next iteration',
      'Give them a failing grade immediately',
      'Compare them unfavorably to expert creators',
    ],
    correctIndex: 1,
    explanation: 'Constructive scaffolding and recognizing effort builds learner confidence and mastery.',
  },
  {
    id: 'q-d-3',
    category: 'General Mentorship',
    question: 'How should a mentor handle a learner who repeatedly makes the same mistake?',
    options: [
      'Ban them from posting videos',
      'Break down the concept into simpler micro-steps and demonstrate a simplified practice drill',
      'Ignore their next three submissions',
      'Tell them to learn from another mentor',
    ],
    correctIndex: 1,
    explanation: 'Breaking complex skills into manageable micro-drills helps learners overcome plateaus.',
  },
];

/**
 * Returns a randomized set of 5 questions tailored to the hobby or domain.
 */
export const getRandomMentorQuestions = (hobby?: string, count: number = 5): MentorQuestion[] => {
  const hobbyClean = (hobby || 'Music').toLowerCase();

  // First pick questions related to the user's selected hobby
  const relevant = MENTOR_QUIZ_POOL.filter(
    (q) => q.category.toLowerCase() === hobbyClean
  );

  // Other questions from pool
  const others = MENTOR_QUIZ_POOL.filter(
    (q) => q.category.toLowerCase() !== hobbyClean
  );

  // Shuffle arrays
  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  const shuffledRelevant = shuffle(relevant);
  const shuffledOthers = shuffle(others);

  const combined = [...shuffledRelevant, ...shuffledOthers];
  return combined.slice(0, count);
};
