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
import { CommunitiesService, type CommunityView } from './communities.service.js';
import { UsersService } from '../users/users.service.js';
import {
  AddMembersDto,
  CreateCommunityDto,
  SetMemberRoleDto,
  UpdateCommunityDto,
} from './dto/create-community.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communities: CommunitiesService,
    private readonly users: UsersService,
  ) {}

  /** All communities (optionally ?category=Music), each flagged isJoined. */
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('category') category?: string,
  ): Promise<CommunityView[]> {
    return this.communities.findAll(user.userId, category);
  }

  /** Communities recommended for the user's hobby. */
  @Get('recommended')
  async findRecommended(@CurrentUser() user: AuthenticatedUser): Promise<CommunityView[]> {
    const me = await this.users.findById(user.userId);
    return this.communities.findRecommended(user.userId, me?.hobby);
  }

  /** Communities the user has joined. */
  @Get('joined')
  findJoined(@CurrentUser() user: AuthenticatedUser): Promise<CommunityView[]> {
    return this.communities.findJoined(user.userId);
  }

  /** Create a new circle (creator becomes admin). */
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCommunityDto) {
    return this.communities.create(user.userId, dto);
  }

  /** Add members to a circle (admin only). */
  @Post(':id/members')
  addMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.communities.addMembers(user.userId, id, dto.members);
  }

  /** Promote/demote a member's admin role (admin only). */
  @Post(':id/admins')
  setRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetMemberRoleDto,
  ) {
    return this.communities.setMemberRole(user.userId, id, dto.userId, dto.isAdmin ?? true);
  }

  /** Update circle settings — name, about, category, logo, post policy (admin only). */
  @Patch(':id')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communities.updateSettings(user.userId, id, dto);
  }

  /** Delete a circle (creator only). */
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communities.deleteCircle(user.userId, id);
  }

  /** Remove a member (admin only). */
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') targetId: string,
  ) {
    return this.communities.removeMember(user.userId, id, targetId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/join')
  join(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communities.join(user.userId, id);
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':id/join')
  leave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.communities.leave(user.userId, id);
  }
}
