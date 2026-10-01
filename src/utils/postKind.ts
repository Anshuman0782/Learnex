import type { CommunityPost } from '../types';

/** What a post is, for labels, filters and icons — mirrors the composer tabs. */
export type PostKind = 'reel' | 'photo' | 'video' | 'audio' | 'discussion';

export function postKind(p: CommunityPost): PostKind {
  if (p.isShort) return 'reel';
  if (p.postType === 'image' && (p.imageUrls?.length ?? 0) > 0) return 'photo';
  if (p.postType === 'audio' || (!!p.audioUrl && !p.videoUrl)) return 'audio';
  if (p.postType === 'video' || !!p.videoUrl) return 'video';
  return 'discussion';
}

/** "Posts" tab content: photo, video or audio (not reels, not discussions). */
export const isMediaPost = (p: CommunityPost) => {
  const k = postKind(p);
  return k === 'photo' || k === 'video' || k === 'audio';
};

/** Best cover image for list thumbnails (video poster or first photo). */
export const postCover = (p: CommunityPost): string | undefined => p.videoThumbnail || p.imageUrls?.[0] || undefined;

export const POST_KIND_LABEL: Record<PostKind, string> = {
  reel: 'Reel',
  photo: 'Photo',
  video: 'Video',
  audio: 'Audio',
  discussion: 'Discuss',
};

export const POST_KIND_ICON: Record<PostKind, string> = {
  reel: 'film',
  photo: 'image',
  video: 'videocam',
  audio: 'musical-notes',
  discussion: 'chatbubbles',
};
