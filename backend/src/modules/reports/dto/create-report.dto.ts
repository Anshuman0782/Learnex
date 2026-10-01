import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @IsIn(['POST', 'COMMENT', 'USER'])
  targetType!: 'POST' | 'COMMENT' | 'USER';

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  commentId?: string;

  @IsOptional()
  @IsString()
  reportedUserId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
