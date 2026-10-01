/**
 * Discussion-card backgrounds. Only the KEY is stored on the post (the server
 * whitelists the same keys), so colors can be tuned here without migrations.
 */
export type PostBgKey = 'default' | 'ocean' | 'sunset' | 'mint' | 'berry' | 'flame' | 'midnight' | 'forest' | 'gold';

export const POST_BACKGROUNDS: { key: PostBgKey; label: string; colors: [string, string] }[] = [
  { key: 'default', label: 'Default', colors: ['#6366F1', '#A855F7'] },
  { key: 'ocean', label: 'Ocean', colors: ['#0EA5E9', '#6366F1'] },
  { key: 'sunset', label: 'Sunset', colors: ['#F43F5E', '#F59E0B'] },
  { key: 'mint', label: 'Mint', colors: ['#10B981', '#0EA5E9'] },
  { key: 'berry', label: 'Berry', colors: ['#8B5CF6', '#EC4899'] },
  { key: 'flame', label: 'Flame', colors: ['#F97316', '#DB2777'] },
  { key: 'midnight', label: 'Midnight', colors: ['#0F172A', '#4338CA'] },
  { key: 'forest', label: 'Forest', colors: ['#065F46', '#84CC16'] },
  { key: 'gold', label: 'Gold', colors: ['#B45309', '#FACC15'] },
];

export function postBackground(key?: string | null): [string, string] {
  return (POST_BACKGROUNDS.find((b) => b.key === key) ?? POST_BACKGROUNDS[0]).colors;
}
