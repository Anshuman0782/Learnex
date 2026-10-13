import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { CreatePostDto, UpdatePostDto } from './dto/create-post.dto.js';
import { AddCommentDto } from './dto/add-comment.dto.js';
import { RepostDto } from './dto/repost.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  /** The feed: public posts + the viewer's own. Filters: ?communityId, ?saved,
   *  ?authorId, ?shorts (Reels feed — vertical clips under 60s). */
  @Get()
  feed(
    @CurrentUser() user: AuthenticatedUser,
    @Query('communityId') communityId?: string,
    @Query('saved') saved?: string,
    @Query('authorId') authorId?: string,
    @Query('shorts') shorts?: string,
    @Query('reposted') reposted?: string,
  ) {
    return this.posts.feed(user.userId, {
      communityId,
      authorId,
      savedOnly: saved === 'true' || saved === '1',
      shortsOnly: shorts === 'true' || shorts === '1',
      repostedOnly: reposted === 'true' || reposted === '1',
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.findOne(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user.userId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/view')
  recordView(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.recordView(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.remove(user.userId, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/like')
  like(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.setLike(user.userId, id, true);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id/like')
  unlike(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.setLike(user.userId, id, false);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/repost')
  repost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RepostDto,
  ) {
    return this.posts.setRepost(user.userId, id, true, {
      caption: dto.caption,
      communityId: dto.communityId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id/repost')
  unrepost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.setRepost(user.userId, id, false);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/save')
  save(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.setSave(user.userId, id, true);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id/save')
  unsave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.setSave(user.userId, id, false);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.posts.addComment(user.userId, id, dto);
  }
}
