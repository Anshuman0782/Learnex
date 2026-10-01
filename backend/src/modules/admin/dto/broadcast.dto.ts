import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const BROADCAST_AUDIENCES = ['ALL', 'LEARNERS', 'MENTORS', 'CIRCLE', 'USERS'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

/** Who should receive a broadcast. */
export class BroadcastAudienceDto {
  @IsIn(BROADCAST_AUDIENCES as unknown as string[])
  audience!: BroadcastAudience;

  @ValidateIf((o: BroadcastAudienceDto) => o.audience === 'CIRCLE')
  @IsString()
  @MaxLength(100)
  communityId?: string;

  @ValidateIf((o: BroadcastAudienceDto) => o.audience === 'USERS')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  userIds?: string[];
}

export class CreateBroadcastDto extends BroadcastAudienceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(65)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(240)
  body!: string;

  /** Omit to send now; otherwise an ISO time in the future (≤ 60 days). */
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
