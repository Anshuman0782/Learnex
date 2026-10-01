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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AdminGuard } from './admin.guard.js';
import { AdminAccessService } from './admin-access.service.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AdminEconomyService } from './admin-economy.service.js';
import { AdminBroadcastService } from './admin-broadcast.service.js';
import { BroadcastAudienceDto, CreateBroadcastDto } from './dto/broadcast.dto.js';
import {
  CreateRewardDto,
  CreateXpRuleDto,
  UpdateRewardDto,
  UpdateXpRuleDto,
} from './dto/admin.dto.js';

/** Admin Panel API. Every route requires current Admin access (see AdminGuard). */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly access: AdminAccessService,
    private readonly stats: AdminStatsService,
    private readonly economy: AdminEconomyService,
    private readonly broadcasts: AdminBroadcastService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.access.me(user.userId);
  }

  // ---- Dashboard ----
  @Get('stats')
  dashboard() {
    return this.stats.dashboard();
  }

  // ---- Admin access ----
  @Get('admins')
  admins() {
    return this.access.listAdmins();
  }

  @Get('users/search')
  searchUsers(@Query('q') q = '') {
    return this.access.searchUsers(q);
  }

  @HttpCode(HttpStatus.OK)
  @Post('admins/:userId')
  grant(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.access.grant(user.userId, userId);
  }

  @Delete('admins/:userId')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.access.revoke(user.userId, userId);
  }

  // ---- XP rules ----
  @Get('xp/triggers')
  triggers() {
    return this.economy.triggers();
  }

  @Get('xp/rules')
  rules() {
    return this.economy.listRules();
  }

  @Post('xp/rules')
  createRule(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateXpRuleDto) {
    return this.economy.createRule(user.userId, dto);
  }

  @Patch('xp/rules/:key')
  updateRule(@Param('key') key: string, @Body() dto: UpdateXpRuleDto) {
    return this.economy.updateRule(key, dto);
  }

  @Delete('xp/rules/:key')
  deleteRule(@Param('key') key: string) {
    return this.economy.deleteRule(key);
  }

  // ---- Rewards ----
  @Get('rewards')
  rewards() {
    return this.economy.listRewards();
  }

  @Post('rewards')
  createReward(@Body() dto: CreateRewardDto) {
    return this.economy.createReward(dto);
  }

  @Patch('rewards/:id')
  updateReward(@Param('id') id: string, @Body() dto: UpdateRewardDto) {
    return this.economy.updateReward(id, dto);
  }

  @Delete('rewards/:id')
  deleteReward(@Param('id') id: string) {
    return this.economy.deleteReward(id);
  }

  // ---- Custom notifications (broadcasts) ----
  @Get('broadcasts')
  listBroadcasts() {
    return this.broadcasts.list();
  }

  @HttpCode(HttpStatus.OK)
  @Post('broadcasts/preview')
  previewBroadcast(@Body() dto: BroadcastAudienceDto) {
    return this.broadcasts.preview(dto);
  }

  @Post('broadcasts')
  createBroadcast(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBroadcastDto) {
    return this.broadcasts.create(user.userId, dto);
  }

  @Delete('broadcasts/:id')
  cancelBroadcast(@Param('id') id: string) {
    return this.broadcasts.cancel(id);
  }
}
