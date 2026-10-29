import { randomInt } from 'node:crypto';
import type { AiSkillId } from './ai-skills.js';

/**
 * Mentor-test task bank. A task is drawn at random the moment the test starts,
 * so it can't be prepared or copied in advance. Audio tasks also start with a
 * random spoken "check phrase" to show it's a live recording by a real person.
 */

export interface CritiqueCase {
  title: string;
  /** What the applicant reads (learner work + context). */
  content: string;
  /** Known issues — given to the AI judge only, never to the applicant. */
  keyIssues: string[];
}

export interface MentorTask {
  skill: AiSkillId;
  /** 'code' = timed in-app editor; 'audio' = live in-app recording. */
  mode: 'code' | 'audio';
  prompt: string;
  /** Hidden checks for the AI judge (coding: expected behaviour / edge cases). */
  judgeNotes: string[];
  checkPhrase?: string;
  timeLimitSec: number;
  /** For audio: recommended length of the performance. */
  minSec?: number;
  maxSec?: number;
  critique: CritiqueCase;
}

const pick = <T>(arr: T[]): T => arr[randomInt(arr.length)];

const CHECK_WORDS = [
  'orange', 'river', 'seven', 'planet', 'window', 'silver', 'garden', 'thunder', 'pencil', 'mountain',
  'yellow', 'rocket', 'forest', 'candle', 'ocean', 'tiger', 'bridge', 'cloud', 'lemon', 'violet',
];

function checkPhrase(): string {
  const words = new Set<string>();
  while (words.size < 3) words.add(pick(CHECK_WORDS));
  return [...words].join(' ');
}

// ---------------- Coding ----------------
const CODING_TASKS: { prompt: string; judgeNotes: string[] }[] = [
  {
    prompt: 'Write a function that returns the second largest DISTINCT number in a list of integers. If there is no such number, return null (or your language’s equivalent). Add a short explanation of your approach.',
    judgeNotes: ['[5, 1, 5, 3] → 3', '[2, 2] → null', '[] → null', 'negative numbers work', 'O(n) single pass is ideal; sorting is acceptable'],
  },
  {
    prompt: 'Write a function that checks whether a string is a palindrome, ignoring case, spaces and punctuation. Explain your approach briefly.',
    judgeNotes: ['"A man, a plan, a canal: Panama" → true', '"race a car" → false', 'empty string → true', 'two-pointer O(n) is ideal'],
  },
  {
    prompt: 'Write a function that groups a list of words into anagram groups (words with the same letters). Return the groups. Explain your approach.',
    judgeNotes: ['["eat","tea","tan","ate","nat","bat"] → [eat,tea,ate],[tan,nat],[bat]', 'use a sorted-letters or letter-count key in a map', 'empty list → empty result'],
  },
  {
    prompt: 'Write a function that returns the first non-repeating character in a string, or null if every character repeats. Explain your approach.',
    judgeNotes: ['"leetcode" → "l"', '"aabb" → null', 'count first, then scan — O(n)'],
  },
  {
    prompt: 'Write a function that merges overlapping intervals, e.g. [[1,3],[2,6],[8,10]] → [[1,6],[8,10]]. Explain your approach.',
    judgeNotes: ['sort by start first', '[[1,4],[4,5]] → [[1,5]] (touching intervals merge)', 'empty input → empty output', 'unsorted input must work'],
  },
  {
    prompt: 'Write a function that checks whether a string of brackets "()[]{}" is balanced. Explain your approach.',
    judgeNotes: ['"([]{})" → true', '"(]" → false', '"((" → false', 'stack-based O(n)'],
  },
  {
    prompt: 'Write a function that returns the indices of two numbers in a list that add up to a target (assume exactly one answer). Explain your approach.',
    judgeNotes: ['[2,7,11,15], 9 → [0,1]', 'hash map O(n) is ideal; O(n²) works but is weaker', 'must not use the same element twice'],
  },
  {
    prompt: 'Write a function that counts the words in a sentence and returns the most frequent word (case-insensitive, ignore punctuation). Explain your approach.',
    judgeNotes: ['"The cat and the hat." → "the"', 'ties: any reasonable rule, stated', 'empty input handled'],
  },
];

const CODING_CRITIQUES: CritiqueCase[] = [
  {
    title: 'A learner’s average function',
    content: 'Learner wrote (Python):\n\ndef average(nums):\n    total = 0\n    for i in range(1, len(nums)):\n        total += nums[i]\n    return total / len(nums)\n\nThey say: "It works but my answer is a bit low sometimes."',
    keyIssues: ['loop starts at 1, skipping the first element', 'division by zero for an empty list', 'could use sum(nums)/len(nums)'],
  },
  {
    title: 'A learner’s JavaScript fetch',
    content: 'Learner wrote (JavaScript):\n\nfunction getUser(id) {\n  let user;\n  fetch("/api/users/" + id).then(r => r.json()).then(d => { user = d; });\n  return user;\n}\n\nThey say: "It always returns undefined, why?"',
    keyIssues: ['returns before the async fetch completes', 'should return the promise or use async/await', 'no error handling for failed requests / non-OK status'],
  },
  {
    title: 'A learner’s login check',
    content: 'Learner wrote (JavaScript, Node):\n\nconst q = "SELECT * FROM users WHERE email = \'" + email + "\' AND password = \'" + password + "\'";\ndb.query(q);\n\nThey say: "My login works fine!"',
    keyIssues: ['SQL injection — must use parameterised queries', 'storing/comparing plain-text passwords — must hash (bcrypt/argon2)', 'SELECT * fetches more than needed'],
  },
  {
    title: 'A learner’s duplicate finder',
    content: 'Learner wrote (Python):\n\ndef has_duplicates(items):\n    for i in range(len(items)):\n        for j in range(len(items)):\n            if items[i] == items[j]:\n                return True\n    return False\n\nThey say: "It says True for every list!"',
    keyIssues: ['compares each element with itself (i == j) so always True', 'should start j at i+1', 'O(n²) — a set gives O(n)'],
  },
];

// ---------------- Music ----------------
const KEYS = ['C', 'D', 'E', 'F', 'G', 'A'];
const MUSIC_TASKS = [
  (k: string) => `Sing or play the ${k} major scale up and down once, slowly and steadily. Then perform 30–60 seconds of any song or piece you know well.`,
  (k: string) => `Sing or play a ${k} major arpeggio (1-3-5-8 and back down) twice. Then perform 30–60 seconds of a song or piece of your choice.`,
  (k: string) => `Sing or play the first five notes of the ${k} major scale up and down three times, keeping an even tempo. Then perform 30–60 seconds of any song or piece.`,
];

const MUSIC_CRITIQUES: CritiqueCase[] = [
  {
    title: 'A learner’s chorus practice',
    content: 'A learner sang the chorus of a pop song. Our pitch analysis measured: 61% of sung notes in tune; they drift flat on the highest notes; tempo speeds up by about 8% in the last line. The learner wrote: "I always run out of breath at the end and my high notes feel strained."',
    keyIssues: ['flat high notes linked to breath support / strain', 'rushing tempo at the end — practise with a metronome', 'breath planning: where to breathe in the phrase', 'warm-ups / sirens for the high register'],
  },
  {
    title: 'A learner’s guitar strumming',
    content: 'A learner recorded a strumming pattern over four chords (G, D, Em, C). Analysis: chord changes arrive late (about a quarter beat) every time; several strings buzz on the Em→C change; overall tempo steady otherwise. The learner wrote: "The changes feel slow and messy."',
    keyIssues: ['late chord changes — practise the changes slowly / one-minute changes', 'buzzing — finger placement close to the fret, pressure', 'anticipate the change by lifting fingers early'],
  },
  {
    title: 'A learner’s piano scale',
    content: 'A learner played a C major scale with both hands. Analysis: notes are correct but uneven in volume and timing; the thumb-under on F is audibly late; hands are slightly out of sync. The learner wrote: "I can play it, but it doesn’t sound smooth."',
    keyIssues: ['uneven evenness — practise with metronome, slow', 'thumb-under preparation', 'hands separately before together', 'dynamics control'],
  },
];

// ---------------- Spoken English ----------------
const TOPICS = [
  'a skill you learned recently and how you learned it',
  'your favourite place in your town and why you like it',
  'a challenge you faced and what it taught you',
  'how technology has changed the way people study',
  'a person who inspires you',
  'your plans for the next year',
  'a book, film or song you would recommend',
  'the pros and cons of working from home',
  'a memorable trip or day out',
  'what makes a good teacher',
  'how you usually spend a weekend',
  'a habit you would like to build',
];

const ENGLISH_CRITIQUES: CritiqueCase[] = [
  {
    title: 'A learner talking about their weekend',
    content: 'Transcript of a learner (60 seconds):\n"Um, last weekend I go to my uncle house. Um, it was very, very nice. We are eating, um, many foods and, like, we watch the cricket match. Um, my uncle he is telling story about, uh, his childhood. I am very enjoy it."\nNotes: speaking pace was slow (~85 words/min) with 7 filler words.',
    keyIssues: ['past tense errors (go → went, are eating → ate, watch → watched, is telling → told)', 'possessive: uncle house → uncle’s house', '"I am very enjoy it" → "I really enjoyed it"', 'reduce fillers (um, like) — pause instead', 'repetition of "very"'],
  },
  {
    title: 'A learner describing their job',
    content: 'Transcript of a learner (70 seconds):\n"I am working in the company since three years. My work is to handling the customers complain. Everyday I am attending many calls, and the customers they are angry sometimes but I am keeping calm. I want to improve my English for getting promotion."\nNotes: clear voice, steady pace (~120 words/min), few fillers.',
    keyIssues: ['"since three years" → "for three years" / present perfect "have been working"', '"to handling" → "to handle"', '"complain" → "complaints"', 'present continuous overused for habits ("I attend")', '"for getting promotion" → "to get a promotion"'],
  },
];

export function drawTask(skill: AiSkillId): MentorTask {
  if (skill === 'coding') {
    const t = pick(CODING_TASKS);
    return { skill, mode: 'code', prompt: t.prompt, judgeNotes: t.judgeNotes, timeLimitSec: 25 * 60, critique: pick(CODING_CRITIQUES) };
  }
  if (skill === 'music') {
    return {
      skill,
      mode: 'audio',
      prompt: pick(MUSIC_TASKS)(pick(KEYS)),
      judgeNotes: ['scale/arpeggio: steady tempo and accurate intervals', 'song: musicality, pitch and timing'],
      checkPhrase: checkPhrase(),
      timeLimitSec: 15 * 60,
      minSec: 30,
      maxSec: 180,
      critique: pick(MUSIC_CRITIQUES),
    };
  }
  return {
    skill,
    mode: 'audio',
    prompt: `Speak for 60–90 seconds about: ${pick(TOPICS)}.`,
    judgeNotes: ['stays on topic', 'speaks for about 60–90 seconds'],
    checkPhrase: checkPhrase(),
    timeLimitSec: 15 * 60,
    minSec: 45,
    maxSec: 180,
    critique: pick(ENGLISH_CRITIQUES),
  };
}

/** What the applicant is allowed to see (no judge notes / key issues). */
export function publicTask(t: MentorTask) {
  return {
    skill: t.skill,
    mode: t.mode,
    prompt: t.prompt,
    checkPhrase: t.checkPhrase ?? null,
    timeLimitSec: t.timeLimitSec,
    minSec: t.minSec ?? null,
    maxSec: t.maxSec ?? null,
    critique: { title: t.critique.title, content: t.critique.content },
  };
}
