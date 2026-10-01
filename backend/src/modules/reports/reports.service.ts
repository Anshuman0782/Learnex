import { BadRequestException, Injectable } from '@nestjs/common';
import { ReportTargetType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** File a report. Lands in the moderation queue (reviewed via the admin panel later). */
  async create(reporterId: string, dto: CreateReportDto): Promise<{ success: true }> {
    if (dto.targetType === 'POST' && !dto.postId) {
      throw new BadRequestException('postId is required for a post report');
    }
    if (dto.targetType === 'COMMENT' && !dto.commentId) {
      throw new BadRequestException('commentId is required for a comment report');
    }
    if (dto.targetType === 'USER' && !dto.reportedUserId) {
      throw new BadRequestException('reportedUserId is required for a user report');
    }

    await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType as ReportTargetType,
        postId: dto.postId,
        commentId: dto.commentId,
        reportedUserId: dto.reportedUserId,
        reason: dto.reason,
      },
    });
    return { success: true };
  }
}
