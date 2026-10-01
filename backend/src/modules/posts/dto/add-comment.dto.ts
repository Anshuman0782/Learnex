import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AddCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsBoolean()
  isMentorCritique?: boolean;

  @IsOptional()
  @IsIn(['general', 'mentor'])
  commentType?: 'general' | 'mentor';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  mentorRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  critiqueFocus?: string;

  @IsOptional()
  @IsString()
  videoCritiqueThumbnail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  videoCritiqueDuration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  videoCritiqueTitle?: string;
}
