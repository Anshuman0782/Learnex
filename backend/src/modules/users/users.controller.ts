import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { cleanSkill, skillKey } from '../../common/utils/skill.js';
import { IsString, Matches, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { toSafeUser, type SafeUser } from '../../common/utils/safe-user.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

class PushTokenDto {
  @IsString()
  @MaxLength(256)
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_\-]+\]$/, { message: 'Invalid push token' })
  token!: string;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  /** Update the current user's profile (e.g. avatar after an upload, name). */
  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    // Members pick their main skill from the skills they've joined (each has
    // its own role); guests have no skills yet, so theirs is free text.
    let hobby = dto.hobby === undefined ? undefined : cleanSkill(dto.hobby);
    let role: UserRole | undefined;
    if (hobby) {
      const me = await this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { skills: { select: { skill: true, skillKey: true, role: true } } },
      });
      if (me && me.skills.length > 0) {
        const mine = me.skills.find((s) => s.skillKey === skillKey(hobby));
        if (!mine) {
          throw new BadRequestException(`Add ${hobby} from “Add skill” in your profile first.`);
        }
        hobby = mine.skill;
        role = mine.role;
      }
    }
    const updated = await this.users.update(user.userId, {
      avatarUrl: dto.avatarUrl,
      name: dto.name,
      bio: dto.bio,
      handle: dto.handle,
      hobby,
      ...(role ? { role } : {}),
    });
    return toSafeUser(updated);
  }

  /** Register the device's Expo push token for offline notifications / calls. */
  @HttpCode(HttpStatus.OK)
  @Post('me/push-token')
  async setPushToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PushTokenDto,
  ): Promise<{ success: true }> {
    // One device = one account: if this phone was signed in as someone else,
    // stop sending their notifications here.
    await this.prisma.user.updateMany({
      where: { expoPushToken: dto.token, id: { not: user.userId } },
      data: { expoPushToken: null },
    });
    await this.users.update(user.userId, { expoPushToken: dto.token });
    return { success: true };
  }

  /** Called on logout: this device stops receiving the account's notifications. */
  @HttpCode(HttpStatus.OK)
  @Delete('me/push-token')
  async clearPushToken(@CurrentUser() user: AuthenticatedUser): Promise<{ success: true }> {
    await this.prisma.user.update({ where: { id: user.userId }, data: { expoPushToken: null } });
    return { success: true };
  }
}
