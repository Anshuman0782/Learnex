import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Optional metadata attached when a user reposts a post. */
export class RepostDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  communityId?: string;
}
