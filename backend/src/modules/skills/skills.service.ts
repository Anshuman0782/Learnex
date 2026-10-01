import { Injectable } from '@nestjs/common';
import { Skill } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Skills for a hobby/category. Falls back to the 'General' catalog when the
   * hobby has no dedicated skills (mirrors the app's Default set).
   */
  async findForCategory(category?: string | null): Promise<Skill[]> {
    if (category) {
      const matched = await this.prisma.skill.findMany({
        where: { category: { equals: category, mode: 'insensitive' } },
      });
      if (matched.length > 0) {
        return matched;
      }
    }
    return this.prisma.skill.findMany({ where: { category: 'General' } });
  }
}
