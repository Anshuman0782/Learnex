import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { ChatService } from './chat.service.js';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}

@Controller('chats')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** My conversations (inbox), most recent first. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.list(user.userId);
  }

  /** Total unread messages (badge). Declared before `:id` routes. */
  @Get('unread-count')
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.unreadCount(user.userId);
  }

  /** Open (get or create) my conversation with another user. */
  @HttpCode(HttpStatus.OK)
  @Post('with/:userId')
  openWith(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.chat.openWith(user.userId, userId);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('before') before?: string,
  ) {
    return this.chat.messages(user.userId, id, before);
  }

  @Post(':id/messages')
  send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.send(user.userId, id, dto.text);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/read')
  read(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.chat.markRead(user.userId, id);
  }
}
