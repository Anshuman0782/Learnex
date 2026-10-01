import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TaskInputDto {
  @IsIn(['PUBLISH', 'COMMENT', 'EARN_LIKES', 'GET_CRITIQUED', 'PRACTICE', 'ACTIVE_DAYS', 'GIVE_CRITIQUES', 'DEEP_CRITIQUES', 'HELPFUL_CRITIQUES'])
  type!: string;

  @IsInt()
  @Min(1)
  @Max(200)
  target!: number;

  @IsOptional()
  @IsIn(['any', 'video', 'reel', 'audio', 'photo', 'discussion'])
  kind?: string;
}

export class TrackInputDto {
  /** Display name, e.g. a preset name like "Reel Rush". */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string;

  /** Full XP for 100% completion (partial completion pays proportionally). */
  @IsInt()
  @Min(10)
  @Max(300)
  xp!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => TaskInputDto)
  tasks!: TaskInputDto[];
}

export class CreateEventDto {
  @IsString()
  @MaxLength(64)
  communityId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  title!: string;

  @IsString()
  @MaxLength(300)
  description!: string;

  /** How long members can vote to join before the challenge goes live. */
  @IsIn([6, 12, 24, 48])
  votingHours!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TrackInputDto)
  learner?: TrackInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TrackInputDto)
  mentor?: TrackInputDto;
}
