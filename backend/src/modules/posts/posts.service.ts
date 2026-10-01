import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PostType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { timeAgo } from '../../common/utils/time-ago.js';
import { XpService } from '../gamification/xp.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CLOUD_FOLDER, parseCloudinaryUrl } from '../media/storage/cloudinary-storage.driver.js';
import { CreatePostDto, type PostTypeInput } from './dto/create-post.dto.js';
import { AddCommentDto } from './dto/add-comment.dto.js';

const POST_TYPE_TO_DB: Record<PostTypeInput, PostType> = {
  text: PostType.TEXT,
  video: PostType.VIDEO,
  audio: PostType.AUDIO,
  image: PostType.IMAGE,
  critique_request: PostType.CRITIQUE_REQUEST,
};
const POST_TYPE_TO_API: Record<PostType, PostTypeInput> = {
  TEXT: 'text',
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGE: 'image',
  CRITIQUE_REQUEST: 'critique_request',
};

const roleLabel = (role: UserRole | null): 'Mentor' | 'Learner' =>
  role === UserRole.MENTOR ? 'Mentor' : 'Learner';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** Everything needed to build the app-shaped post, scoped to the viewer. */
  private include(userId: string) {
    return {
      author: { select: { id: true, name: true, role: true, hobby: true, avatarUrl: true } },
      communities: { include: { community: { select: { id: true, name: true } } } },
      comments: {
        where: { deletedAt: null, isHidden: false },
        orderBy: { createdAt: 'desc' as const },
        include: {
          author: { select: { id: true, name: true, role: true, avatarUrl: true } },
          likes: { where: { userId }, select: { userId: true } },
          _count: { select: { likes: true } },
        },
      },
      likes: { where: { userId }, select: { userId: true } },
      saves: { where: { userId }, select: { userId: true } },
      reposts: { where: { userId }, select: { userId: true } },
      _count: { select: { likes: true, reposts: true } },
    } satisfies Prisma.PostInclude;
  }

  /** Only public + already-published posts, plus the viewer's own (including their
   *  private and scheduled) posts. Moderator-hidden posts are never shown. */
  private visibilityWhere(userId: string): Prisma.PostWhereInput {
    const now = new Date();
    return {
      deletedAt: null,
      isHidden: false,
      OR: [
        {
          isPrivate: false,
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        },
        { authorId: userId },
      ],
    };
  }

  private serialize(post: any) {
    const comments = post.comments.map((c: any) => ({
      id: c.id,
      postId: c.postId,
      authorId: c.author.id,
      authorName: c.author.name,
      authorRole: roleLabel(c.author.role),
      authorAvatar: c.author.avatarUrl ?? '',
      timeAgo: timeAgo(c.createdAt),
      text: c.text,
      isMentorCritique: c.isMentorCritique,
      commentType: c.isMentorCritique ? 'mentor' : 'general',
      mentorRating: c.mentorRating ?? undefined,
      critiqueFocus: c.critiqueFocus ?? undefined,
      videoCritiqueThumbnail: c.videoCritiqueThumbnail ?? undefined,
      videoCritiqueDuration: c.videoCritiqueDuration ?? undefined,
      videoCritiqueTitle: c.videoCritiqueTitle ?? undefined,
      likesCount: c._count.likes,
      isLiked: c.likes.length > 0,
    }));

    const communityNames: string[] = post.communities.map((pc: any) => pc.community.name);
    const communityIds: string[] = post.communities.map((pc: any) => pc.community.id);
    const mentorCritiqueCount = comments.filter((c: any) => c.isMentorCritique).length;

    const communityName =
      communityNames.length === 0
        ? post.isPrivate
          ? 'Private Vault 🔒'
          : 'General Circle'
        : communityNames.length > 1
        ? `${communityNames[0]} (+${communityNames.length - 1} groups)`
        : communityNames[0];

    return {
      id: post.id,
      // Stable list key. Repost entries override this with a repost-specific key
      // so an original post and a repost of it can coexist in the same feed.
      feedId: `post:${post.id}`,
      communityId: communityIds[0] ?? (post.isPrivate ? 'private-vault' : 'comm-general'),
      communityName,
      communityIds,
      communityNames,
      authorId: post.author.id,
      authorName: post.author.name,
      authorRole: roleLabel(post.author.role),
      authorSkill: post.author.hobby ?? 'Music',
      authorAvatar: post.author.avatarUrl ?? '',
      timeAgo: timeAgo(post.createdAt),
      content: post.content,
      tag: (post.tags as string[]).join(' '),
      tags: post.tags as string[],
      postType: POST_TYPE_TO_API[post.postType as PostType],
      videoTitle: post.title ?? undefined,
      videoUrl: post.videoUrl ?? undefined,
      videoThumbnail: post.videoThumbnail ?? undefined,
      videoDuration: post.videoDuration ?? undefined,
      audioUrl: post.audioUrl ?? undefined,
      imageUrls: Array.isArray(post.imageUrls) ? (post.imageUrls as string[]) : undefined,
      isShort: post.isShort,
      viewsCount: post.viewsCount,
      likesCount: post._count.likes,
      commentsCount: comments.length,
      generalCommentsCount: comments.length - mentorCritiqueCount,
      mentorCritiqueCount,
      isLiked: post.likes.length > 0,
      isSaved: post.saves.length > 0,
      repostsCount: post._count.reposts,
      isReposted: post.reposts.length > 0,
      isPrivate: post.isPrivate,
      scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : undefined,
      isScheduled: !!post.scheduledAt && post.scheduledAt.getTime() > Date.now(),
      focusArea: post.focusArea ?? undefined,
      bgStyle: post.bgStyle ?? undefined,
      comments,
    };
  }

  // --- queries ---

  async feed(
    userId: string,
    opts: {
      communityId?: string;
      savedOnly?: boolean;
      authorId?: string;
      shortsOnly?: boolean;
      repostedOnly?: boolean;
    } = {},
  ) {
    const where: Prisma.PostWhereInput = { ...this.visibilityWhere(userId) };
    // Shorts live in the Reels feed; the Home feed excludes them. A circle's feed
    // and the reposts list show both, so reels tagged to a circle appear there.
    if (opts.shortsOnly) {
      where.isShort = true;
    } else if (!opts.repostedOnly && !opts.communityId) {
      where.isShort = false;
    }
    if (opts.communityId) {
      where.communities = { some: { communityId: opts.communityId } };
    }
    if (opts.authorId) {
      where.authorId = opts.authorId;
    }
    if (opts.savedOnly) {
      where.saves = { some: { userId } };
    }
    if (opts.repostedOnly) {
      where.reposts = { some: { userId } };
    }

    const posts = await this.prisma.post.findMany({
      where,
      include: this.include(userId),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let items = posts.map((p) => ({ item: this.serialize(p), sortAt: p.createdAt.getTime() }));

    // The general Home feed (no filters) also surfaces reposts made by other
    // users — each shown as its own entry attributed to the reposter.
    const isGeneralFeed =
      !opts.communityId && !opts.savedOnly && !opts.authorId && !opts.repostedOnly && !opts.shortsOnly;
    if (isGeneralFeed) {
      const repostItems = await this.repostFeedItems(userId);
      items = [...items, ...repostItems];
    }

    // Newest first.
    items.sort((a, b) => b.sortAt - a.sortAt);
    const serialized = items.map((x) => x.item);

    // Home + Reels bias toward the viewer's own category so their hobby is the
    // majority while everything stays visible. Other lists keep pure recency.
    if (isGeneralFeed || opts.shortsOnly) {
      const ordered = await this.prioritizeByCategory(userId, serialized);
      return ordered.slice(0, 100);
    }
    return serialized.slice(0, 100);
  }

  /** Recent reposts by everyone (public, published, non-short) as feed entries. */
  private async repostFeedItems(userId: string) {
    const reposts = await this.prisma.repost.findMany({
      where: {
        post: {
          deletedAt: null,
          isHidden: false,
          isPrivate: false,
          isShort: false,
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        },
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        post: { include: this.include(userId) },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Resolve any tagged-circle names in one query.
    const circleIds = Array.from(
      new Set(reposts.map((r) => r.communityId).filter((id): id is string => !!id)),
    );
    const circles = circleIds.length
      ? await this.prisma.community.findMany({
          where: { id: { in: circleIds } },
          select: { id: true, name: true },
        })
      : [];
    const circleName = new Map(circles.map((c) => [c.id, c.name]));

    return reposts.map((r) => ({
      sortAt: r.createdAt.getTime(),
      item: {
        ...this.serialize(r.post),
        feedId: `repost:${r.postId}:${r.userId}`,
        timeAgo: timeAgo(r.createdAt),
        repostedById: r.user.id,
        repostedByName: r.user.name,
        repostedByAvatar: r.user.avatarUrl ?? '',
        repostCaption: r.caption ?? undefined,
        repostedCircleId: r.communityId ?? undefined,
        repostedCircleName: r.communityId ? circleName.get(r.communityId) ?? undefined : undefined,
      },
    }));
  }

  /** Interleave so the viewer's own hobby is the majority (2:1) while keeping
   *  recency order within each group and still showing every other category. */
  private async prioritizeByCategory<T extends { authorSkill?: string }>(
    userId: string,
    items: T[],
  ): Promise<T[]> {
    const viewer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hobby: true },
    });
    const hobby = viewer?.hobby?.toLowerCase();
    if (!hobby) return items;

    const match: T[] = [];
    const rest: T[] = [];
    for (const it of items) {
      if ((it.authorSkill ?? '').toLowerCase() === hobby) match.push(it);
      else rest.push(it);
    }
    if (match.length === 0 || rest.length === 0) return items;

    const out: T[] = [];
    let mi = 0;
    let ri = 0;
    while (mi < match.length || ri < rest.length) {
      if (mi < match.length) out.push(match[mi++]);
      if (mi < match.length) out.push(match[mi++]);
      if (ri < rest.length) out.push(rest[ri++]);
    }
    return out;
  }

  async findOne(userId: string, id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, ...this.visibilityWhere(userId) },
      include: this.include(userId),
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return this.serialize(post);
  }

  // --- mutations ---

  async create(userId: string, dto: CreatePostDto) {
    const tags = dto.tags && dto.tags.length > 0 ? dto.tags : dto.tag ? [dto.tag] : [];

    if (dto.postType === 'image') {
      if (!dto.imageUrls || dto.imageUrls.length === 0) {
        throw new BadRequestException('A photo post needs at least one image');
      }
      if (dto.isShort) throw new BadRequestException('Photo posts cannot be reels');
      // Cloud images must come from OUR Cloudinary account + LERNEX's image folder.
      const cloud = parseCloudinaryUrl(process.env.CLOUDINARY_URL)?.cloudName;
      for (const u of dto.imageUrls) {
        if (!u.startsWith('https://res.cloudinary.com/')) continue;
        if (!cloud || !u.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) || !u.includes(`/${CLOUD_FOLDER}/images/`)) {
          throw new BadRequestException('imageUrls must be images uploaded to Lernex');
        }
      }
    }

    // Keep only community ids that actually exist.
    let validIds: string[] = [];
    if (dto.communityIds && dto.communityIds.length > 0) {
      const found = await this.prisma.community.findMany({
        where: { id: { in: dto.communityIds } },
        select: { id: true },
      });
      validIds = found.map((c) => c.id);
    }

    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        content: dto.content,
        postType: POST_TYPE_TO_DB[dto.postType],
        isPrivate: dto.isPrivate ?? false,
        title: dto.title,
        tags,
        focusArea: dto.focusArea,
        videoUrl: dto.videoUrl,
        videoThumbnail: dto.videoThumbnail,
        videoDuration: dto.videoDuration,
        audioUrl: dto.audioUrl,
        imageUrls: dto.postType === 'image' ? dto.imageUrls : undefined,
        bgStyle: dto.postType === 'text' && dto.bgStyle && dto.bgStyle !== 'default' ? dto.bgStyle : null,
        isShort: dto.isShort ?? false,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        communities: { create: validIds.map((communityId) => ({ communityId })) },
      },
      include: this.include(userId),
    });

    const scheduledFuture = !!post.scheduledAt && post.scheduledAt.getTime() > Date.now();
    // Award XP for public, published posts only (private/scheduled can't farm XP).
    if (!post.isPrivate && !scheduledFuture) {
      const kind = post.isShort
        ? 'reel'
        : post.postType === PostType.VIDEO
        ? 'video'
        : post.postType === PostType.AUDIO
        ? 'audio'
        : post.postType === PostType.IMAGE
        ? 'photo'
        : 'discussion';
      await this.xp.onPostCreated(userId, post.id, kind);
    }
    return this.serialize(post);
  }

  /** Update a post's own settings (author only): privacy toggle, title, content. */
  async update(
    userId: string,
    id: string,
    dto: { isPrivate?: boolean; title?: string; content?: string },
  ) {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }
    await this.prisma.post.update({
      where: { id },
      data: {
        isPrivate: dto.isPrivate ?? undefined,
        title: dto.title ?? undefined,
        content: dto.content ?? undefined,
      },
    });
    return this.findOne(userId, id);
  }

  /** Record a unique view (first time this user watches). Returns the updated post. */
  async recordView(userId: string, postId: string) {
    await this.assertVisible(userId, postId);
    const existing = await this.prisma.postView.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (!existing) {
      await this.prisma.$transaction([
        this.prisma.postView.create({ data: { postId, userId } }),
        this.prisma.post.update({
          where: { id: postId },
          data: { viewsCount: { increment: 1 } },
        }),
      ]);
    }
    return this.findOne(userId, postId);
  }

  async remove(userId: string, id: string): Promise<{ success: true }> {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }
    await this.prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  /** Confirms a post is visible to the viewer before mutating relations on it. */
  private async assertVisible(userId: string, postId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, ...this.visibilityWhere(userId) },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found');
  }

  async setLike(userId: string, postId: string, liked: boolean) {
    await this.assertVisible(userId, postId);
    if (liked) {
      await this.prisma.postLike.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId },
        update: {},
      });
      // The author earns like-XP once per liker per post (public posts only).
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true, isPrivate: true },
      });
      if (post && !post.isPrivate) {
        await this.xp.onLikeReceived(post.authorId, userId, postId);
      }
      if (post && post.authorId !== userId) {
        const liker = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        await this.notifications.create({
          userId: post.authorId,
          type: 'LIKE',
          title: 'New like ❤️',
          body: `${liker?.name ?? 'Someone'} liked your post`,
          actorName: liker?.name,
          actorId: userId,
          postId,
          data: { kind: 'post', postId },
          dedupeKey: `like:${postId}:${userId}`,
        });
      }
    } else {
      await this.prisma.postLike.deleteMany({ where: { postId, userId } });
    }
    return this.findOne(userId, postId);
  }

  async setRepost(
    userId: string,
    postId: string,
    reposted: boolean,
    opts: { caption?: string; communityId?: string } = {},
  ) {
    await this.assertVisible(userId, postId);
    if (reposted) {
      // You can't repost your own post.
      const owner = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });
      if (owner?.authorId === userId) {
        throw new BadRequestException('You cannot repost your own post.');
      }
      // Only keep a tagged circle the user is actually allowed to reference.
      let communityId: string | null = null;
      if (opts.communityId) {
        const found = await this.prisma.community.findUnique({
          where: { id: opts.communityId },
          select: { id: true },
        });
        communityId = found?.id ?? null;
      }
      const caption = opts.caption?.trim() ? opts.caption.trim() : null;
      await this.prisma.repost.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId, caption, communityId },
        update: { caption, communityId },
      });
      if (owner) {
        await this.xp.onRepostReceived(owner.authorId, userId, postId);
        const who = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        await this.notifications.create({
          userId: owner.authorId,
          type: 'REPOST',
          title: 'Your post was reposted 🔁',
          body: `${who?.name ?? 'Someone'} reposted your post${caption ? `: “${caption.slice(0, 80)}”` : ''}`,
          actorName: who?.name,
          actorId: userId,
          postId,
          data: { kind: 'post', postId },
          dedupeKey: `repost:${postId}:${userId}`,
        });
      }
    } else {
      await this.prisma.repost.deleteMany({ where: { postId, userId } });
    }
    return this.findOne(userId, postId);
  }

  async setSave(userId: string, postId: string, saved: boolean) {
    await this.assertVisible(userId, postId);
    if (saved) {
      await this.prisma.postSave.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId },
        update: {},
      });
    } else {
      await this.prisma.postSave.deleteMany({ where: { postId, userId } });
    }
    return this.findOne(userId, postId);
  }

  async addComment(userId: string, postId: string, dto: AddCommentDto, role: UserRole | null) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, ...this.visibilityWhere(userId) },
      select: { id: true, authorId: true },
    });
    if (!post) throw new NotFoundException('Post not found');

    const isMentorCritique = dto.isMentorCritique === true || dto.commentType === 'mentor';
    // Only mentors may post a mentor critique — enforced on the server.
    if (isMentorCritique && role !== UserRole.MENTOR) {
      throw new ForbiddenException('Only mentors can post a critique');
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        text: dto.text,
        isMentorCritique,
        mentorRating: isMentorCritique ? dto.mentorRating ?? null : null,
        critiqueFocus: dto.critiqueFocus,
        videoCritiqueThumbnail: dto.videoCritiqueThumbnail,
        videoCritiqueDuration: dto.videoCritiqueDuration,
        videoCritiqueTitle: dto.videoCritiqueTitle,
      },
    });

    // Mentor critiques award XP to the mentor and the post's author; regular
    // comments award the commenter. Neither pays on your own post.
    if (isMentorCritique) {
      await this.xp.onCritiqueGiven(userId, post.authorId, comment.id);
    } else {
      await this.xp.onCommentPosted(userId, post.authorId, comment.id);
    }

    // Live update + notification.
    const author = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, role: true, avatarUrl: true },
    });
    this.realtime.emitToPost(postId, 'comment:new', {
      postId,
      comment: {
        id: comment.id,
        postId,
        authorName: author?.name ?? 'Someone',
        authorRole: role === UserRole.MENTOR ? 'Mentor' : 'Learner',
        authorAvatar: author?.avatarUrl ?? '',
        timeAgo: 'Just now',
        text: comment.text,
        isMentorCritique,
        commentType: isMentorCritique ? 'mentor' : 'general',
        mentorRating: comment.mentorRating ?? undefined,
        critiqueFocus: comment.critiqueFocus ?? undefined,
        likesCount: 0,
        isLiked: false,
      },
    });

    if (post.authorId !== userId) {
      await this.notifications.create({
        userId: post.authorId,
        type: isMentorCritique ? 'CRITIQUE' : 'COMMENT',
        title: isMentorCritique ? 'New mentor critique 🎯' : 'New comment 💬',
        body: `${author?.name ?? 'Someone'} ${isMentorCritique ? 'critiqued' : 'commented on'} your post`,
        actorName: author?.name,
        actorId: userId,
        postId,
        data: { kind: 'post', postId, openComments: true },
      });
    }
    return this.findOne(userId, postId);
  }

  async setCommentLike(userId: string, commentId: string, liked: boolean) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { postId: true, authorId: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.assertVisible(userId, comment.postId);

    if (liked) {
      await this.prisma.commentLike.upsert({
        where: { commentId_userId: { commentId, userId } },
        create: { commentId, userId },
        update: {},
      });
      if (comment.authorId !== userId) {
        const liker = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        await this.notifications.create({
          userId: comment.authorId,
          type: 'LIKE',
          title: 'Comment liked 👍',
          body: `${liker?.name ?? 'Someone'} liked your comment`,
          actorName: liker?.name,
          actorId: userId,
          postId: comment.postId,
          data: { kind: 'post', postId: comment.postId, openComments: true },
          dedupeKey: `clike:${commentId}:${userId}`,
        });
      }
    } else {
      await this.prisma.commentLike.deleteMany({ where: { commentId, userId } });
    }
    return this.findOne(userId, comment.postId);
  }

  /** Delete your own comment (soft-delete). Returns the updated post. */
  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { postId: true, authorId: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return this.findOne(userId, comment.postId);
  }

  /** Edit your own comment's text. Returns the updated post. */
  async editComment(userId: string, commentId: string, text: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { postId: true, authorId: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    await this.prisma.comment.update({ where: { id: commentId }, data: { text } });
    return this.findOne(userId, comment.postId);
  }
}
