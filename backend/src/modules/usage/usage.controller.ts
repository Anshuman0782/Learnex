import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { UsageService } from './usage.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';

class HeartbeatDto {
  @IsInt()
  @Min(1)
  @Max(600)
  seconds!: number;
}

@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  /** Foreground-time heartbeat from the app (time-spent statistics). */
  @HttpCode(HttpStatus.OK)
  @Post('heartbeat')
  heartbeat(@CurrentUser() user: AuthenticatedUser, @Body() dto: HeartbeatDto) {
    return this.usage.heartbeat(user.userId, dto.seconds);
  }
}
