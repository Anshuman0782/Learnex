import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { FollowService, type PublicProfile, type UserRow } from './follow.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('users')
export class FollowController {
  constructor(private readonly follow: FollowService) {}

  // NOTE: these static routes MUST be declared before `:id` so they aren't
  // swallowed by the wildcard profile route.

  /** Search users by name (member pickers). */
  @Get('search')
  search(@CurrentUser() user: AuthenticatedUser, @Query('q') q = ''): Promise<UserRow[]> {
    return this.follow.searchUsers(user.userId, q);
  }

  /** People who follow the current user. */
  @Get('me/followers')
  followers(@CurrentUser() user: AuthenticatedUser): Promise<UserRow[]> {
    return this.follow.getFollowers(user.userId);
  }

  /** Followers of any user (decorated with the viewer's follow status). */
  @Get(':id/followers')
  followersOf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<UserRow[]> {
    return this.follow.getFollowersList(user.userId, id);
  }

  /** Who a user is following (decorated with the viewer's follow status). */
  @Get(':id/following')
  followingOf(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<UserRow[]> {
    return this.follow.getFollowingList(user.userId, id);
  }

  /** Public profile of a user (counts + whether the viewer follows them). */
  @Get(':id')
  profile(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<PublicProfile> {
    return this.follow.getProfile(user.userId, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/follow')
  followUser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.follow.follow(user.userId, id);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id/follow')
  unfollowUser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.follow.unfollow(user.userId, id);
  }
}
