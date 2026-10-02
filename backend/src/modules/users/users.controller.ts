import { Body, Controller, Delete, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
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
    const updated = await this.users.update(user.userId, {
      avatarUrl: dto.avatarUrl,
      name: dto.name,
      bio: dto.bio,
      handle: dto.handle,
      hobby: dto.hobby?.trim(),
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
