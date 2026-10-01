import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  targetSessions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(200)
  targetHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetDate?: string;

  @IsOptional()
  @IsBoolean()
  dailyReminders?: boolean;
}
