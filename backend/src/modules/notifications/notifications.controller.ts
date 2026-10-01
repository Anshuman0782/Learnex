import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.userId);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('read')
  markRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.userId);
  }
}
