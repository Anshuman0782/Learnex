import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class LogSessionDto {
  /** Minutes practiced (defaults to 30 when omitted). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  minutes?: number;
}
