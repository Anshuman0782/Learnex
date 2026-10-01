import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { utcDay } from '../gamification/leveling.js';

/** Max seconds one heartbeat may add (client beats every ~60s while foregrounded). */
const MAX_BEAT_SECONDS = 120;
const MAX_DAY_SECONDS = 24 * 60 * 60;

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  /** Add foreground time for today. Clamped so a bad client can't inflate stats. */
  async heartbeat(userId: string, seconds: number): Promise<{ day: string; seconds: number }> {
    const add = Math.max(0, Math.min(MAX_BEAT_SECONDS, Math.round(seconds)));
    const day = utcDay();
    const row = await this.prisma.usageDay.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, seconds: add },
      update: { seconds: { increment: add } },
    });
    if (row.seconds > MAX_DAY_SECONDS) {
      await this.prisma.usageDay.update({
        where: { userId_day: { userId, day } },
        data: { seconds: MAX_DAY_SECONDS },
      });
      return { day, seconds: MAX_DAY_SECONDS };
    }
    return { day, seconds: row.seconds };
  }
}
