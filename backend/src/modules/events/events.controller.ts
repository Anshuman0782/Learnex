import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,

} from '@nestjs/common';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** Active events (voting or live), optionally for one circle, with my progress. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('communityId') communityId?: string) {
    return this.events.list(user.userId, communityId);
  }

  /** Rules, limits, task types and challenge presets. Declared before `:id`. */
  @Get('catalog')
  catalog() {
    return this.events.catalog();
  }

  /** Back-compat alias for older app builds. */
  @Get('rules')
  rules() {
    return this.events.catalog();
  }

  /** One event with the participants' status board. */
  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.events.detail(user.userId, id);
  }

  /** Create an event — app admins or that circle's admins (checked in the service). */
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.events.create(user.userId, dto);
  }

  /** Vote to join (only while voting is open). */
  @HttpCode(HttpStatus.OK)
  @Post(':id/vote')
  vote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.events.vote(user.userId, id);
  }

  /** Withdraw a vote (only while voting is open). */
  @Delete(':id/vote')
  unvote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.events.unvote(user.userId, id);
  }

  /** Collect XP earned so far (proportional to completion). */
  @HttpCode(HttpStatus.OK)
  @Post(':id/collect')
  collect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.events.collect(user.userId, id);
  }

  /** End an event early — app admins or that circle's admins. */
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.events.remove(user.userId, id);
  }
}
