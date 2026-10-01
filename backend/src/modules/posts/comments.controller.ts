import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PostsService } from './posts.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

class EditCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly posts: PostsService) {}

  @HttpCode(HttpStatus.OK)
  @Post(':id/like')
  like(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.setCommentLike(user.userId, id, true);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id/like')
  unlike(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.setCommentLike(user.userId, id, false);
  }

  /** Edit your own comment. */
  @Patch(':id')
  edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: EditCommentDto,
  ) {
    return this.posts.editComment(user.userId, id, dto.text);
  }

  /** Delete your own comment. */
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.posts.deleteComment(user.userId, id);
  }
}
