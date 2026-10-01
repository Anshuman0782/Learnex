import { Controller, Get, Query } from '@nestjs/common';
import { Skill } from '@prisma/client';
import { SkillsService } from './skills.service.js';
import { UsersService } from '../users/users.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

@Controller('skills')
export class SkillsController {
  constructor(
    private readonly skills: SkillsService,
    private readonly users: UsersService,
  ) {}

  /** Skills for the given ?category=, or for the user's hobby when omitted. */
  @Get()
  async find(
    @CurrentUser() user: AuthenticatedUser,
    @Query('category') category?: string,
  ): Promise<Skill[]> {
    if (category) {
      return this.skills.findForCategory(category);
    }
    const me = await this.users.findById(user.userId);
    return this.skills.findForCategory(me?.hobby);
  }
}
