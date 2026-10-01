/** Seed catalog for the competition layer: rewards and community events.
 *  Seeded with sensible defaults now; an admin panel will manage these later. */

export interface SeedReward {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  tag: string;
  targetRole: string; // 'Learner' | 'Mentor' | 'Both'
  minRankLabel: string;
  minRank: number;
  rankScope: string; // 'overall' | 'learner' | 'mentor'
  sampleCode?: string;
  perks: string[];
  gradientColors: [string, string];
  sortOrder: number;
}

export const REWARDS: SeedReward[] = [
  { id: 'reward-gift-voucher', type: 'voucher', title: 'Gift & Voucher Coupons', subtitle: '$25 - $100 Brand & Gear Cards', description: 'Top-ranked users receive digital gift cards for gear, courses, or shopping vouchers.', icon: 'gift', tag: 'Top 10 Earners', targetRole: 'Both', minRankLabel: 'Top 10 in Leaderboard', minRank: 10, rankScope: 'overall', sampleCode: 'LRNX-GIFT-VOUCHER', perks: ['Gear & equipment credit', 'Usable on major retailers', 'Delivered via digital promo code'], gradientColors: ['#FF5722', '#F97316'], sortOrder: 1 },
  { id: 'reward-badges', type: 'badge', title: 'Prestige Season Badges', subtitle: 'Champion Medals & Profile Flair', description: 'Permanent seasonal medals displayed on your profile and posts showing your rank.', icon: 'medal', tag: 'Top 25 Earners', targetRole: 'Both', minRankLabel: 'Top 25 in Leaderboard', minRank: 25, rankScope: 'overall', sampleCode: 'BADGE-SEASON-CHAMP', perks: ['Gold/Silver/Bronze seasonal medal', 'Exclusive profile avatar ring', 'Permanent trophy cabinet showcase'], gradientColors: ['#F59E0B', '#D97706'], sortOrder: 2 },
  { id: 'reward-tokens', type: 'tokens', title: 'Platform Tokens', subtitle: 'Spendable Platform Currency', description: 'Earn redeemable tokens to tip mentors, unlock premium critique requests, or redeem perks.', icon: 'cash', tag: 'Top 50 Earners', targetRole: 'Both', minRankLabel: 'Top 50 in Leaderboard', minRank: 50, rankScope: 'overall', sampleCode: 'TOKENS-CREDITED', perks: ['Tokens added to your wallet', 'Unlock VIP critique priority', 'Tip outstanding mentors'], gradientColors: ['#10B981', '#059669'], sortOrder: 3 },
  { id: 'reward-coaching', type: 'coaching', title: 'Free 1-on-1 Coaching', subtitle: '45-Min Private Masterclass Pass', description: 'A private 1-on-1 video session with a certified lead coach.', icon: 'school', tag: 'Top 5 Learners', targetRole: 'Learner', minRankLabel: 'Top 5 in Learner Ranking', minRank: 5, rankScope: 'learner', sampleCode: 'CLASS-45MIN-FREE', perks: ['45-minute private 1-on-1 call', 'Personalized skill diagnostic', 'Custom 4-week action plan'], gradientColors: ['#6366F1', '#4F46E5'], sortOrder: 4 },
  { id: 'reward-top-mentor', type: 'top_mentor', title: 'Top Mentor Recognition', subtitle: 'Spotlight & Verified Status', description: 'Top mentors receive verified recognition and a featured spotlight on the feed.', icon: 'star', tag: 'Top 3 Mentors', targetRole: 'Mentor', minRankLabel: 'Top 3 in Mentor Ranking', minRank: 3, rankScope: 'mentor', sampleCode: 'SPOTLIGHT-TOP-MENTOR', perks: ['Featured on Home & Community spotlight', 'Verified Top Mentor badge', 'Priority routing for requests'], gradientColors: ['#8B5CF6', '#7C3AED'], sortOrder: 5 },
  { id: 'reward-opportunities', type: 'opportunities', title: 'Advanced Opportunities', subtitle: 'Paid Creator Roster & Gigs', description: 'Invitation to the paid creator program and talent showcase referrals.', icon: 'rocket', tag: 'Podium Champions', targetRole: 'Both', minRankLabel: 'Top 3 Overall Podium', minRank: 3, rankScope: 'overall', sampleCode: 'CREATOR-INVITE', perks: ['Monetized masterclass eligibility', 'Talent scouting list', 'Early access to beta tools'], gradientColors: ['#EC4899', '#DB2777'], sortOrder: 6 },
];

export interface SeedEvent {
  id: string;
  communityId: string;
  title: string;
  subtitle: string;
  description: string;
  targetRole: string;
  category: string;
  xpReward: number;
  bonusReward?: string;
  status: string;
  daysLeft: number;
  bannerGradient: [string, string];
  icon: string;
  requirements: string[];
}

export const EVENTS: SeedEvent[] = [
  { id: 'event-vocal-pitch-challenge', communityId: 'comm-music-2', title: 'Chorus Pitch Benchmark Drill', subtitle: 'Score 85%+ pitch accuracy on a 30-sec take', description: 'Record a 30-second chorus take. Mentors evaluate pitch accuracy, head-mix transition, and breath stability.', targetRole: 'Learner', category: 'challenge', xpReward: 250, bonusReward: 'Gold Vocalist Badge & Guaranteed Review', status: 'active', daysLeft: 6, bannerGradient: ['#E11D48', '#BE123C'], icon: 'mic', requirements: ['Record a 30-second singing clip in this Circle', 'Demonstrate smooth chest-to-head register transition', 'Submit take before cycle deadline'] },
  { id: 'event-vocal-streak-sprint', communityId: 'comm-music-2', title: '7-Day Consistency Sprint', subtitle: 'Complete 15 mins daily exercises for 7 days', description: 'Build range and control. Complete 15 minutes of practice daily without breaking your streak.', targetRole: 'Learner', category: 'speed_run', xpReward: 300, bonusReward: '500 Tokens & Consistency Flair', status: 'active', daysLeft: 7, bannerGradient: ['#EA580C', '#C2410C'], icon: 'flame', requirements: ['Log at least 15 minutes of practice each day', 'Upload a brief progress reel on Day 7', 'Keep your daily streak uninterrupted'] },
  { id: 'event-vocal-live-showcase', communityId: 'comm-music-2', title: 'Circle Live Audio Showcase', subtitle: 'Live performance evaluated by coaches', description: 'Perform one live unedited take in the Circle audio room with instant mentor feedback.', targetRole: 'Learner', category: 'showcase', xpReward: 400, bonusReward: 'Free 1-on-1 Coach Masterclass Pass', status: 'active', daysLeft: 4, bannerGradient: ['#4F46E5', '#3730A3'], icon: 'musical-notes', requirements: ['RSVP your stage slot', 'Sing one unedited take during the audio stage', 'Receive instant rubric scores'] },
  { id: 'event-mentor-critique-marathon', communityId: 'comm-music-2', title: '48-Hour Speed Critique Sprint', subtitle: 'Deliver 10 in-depth video critiques', description: 'Provide timestamped, actionable feedback for 10 student submissions within 48 hours.', targetRole: 'Mentor', category: 'speed_run', xpReward: 500, bonusReward: 'Gear Voucher & Speed Mentor Badge', status: 'active', daysLeft: 3, bannerGradient: ['#7C3AED', '#5B21B6'], icon: 'flash', requirements: ['Review at least 10 student clips', 'Demonstrate one corrective exercise per critique', 'Maintain a 4.8+ average rating'] },
  { id: 'event-mentor-live-workshop', communityId: 'comm-music-2', title: 'Masterclass Workshop', subtitle: 'Host a 45-min live technique stage', description: 'Host an interactive session covering technique, resonance, and tension release.', targetRole: 'Mentor', category: 'workshop', xpReward: 600, bonusReward: 'Top Mentor Spotlight on Feed', status: 'active', daysLeft: 5, bannerGradient: ['#0D9488', '#0F766E'], icon: 'school', requirements: ['Schedule a 45-minute stage slot', 'Lead interactive warm-up drills', 'Provide live feedback to 3 volunteers'] },
  { id: 'event-mentor-student-boost', communityId: 'comm-music-2', title: 'Mentee Growth Cohort', subtitle: 'Guide 5 learners to measurable improvement', description: 'Mentor 5 learners through targeted routines and measure technique improvement over the season.', targetRole: 'Mentor', category: 'challenge', xpReward: 750, bonusReward: '2,500 Tokens & Paid Masterclass Eligibility', status: 'active', daysLeft: 8, bannerGradient: ['#2563EB', '#1D4ED8'], icon: 'trophy', requirements: ['Conduct feedback reviews for 5 learners', 'Assign personalized exercises', 'Verify measurable progress'] },
];
