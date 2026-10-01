import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { XP_TRIGGERS } from '../../gamification/xp-rules.js';

export const RULE_ROLES = ['Learner', 'Mentor', 'Both'] as const;
export const RULE_CATEGORIES = ['Consistency', 'Practice', 'Community', 'Mentoring', 'Milestones'] as const;
export const REWARD_TYPES = ['voucher', 'badge', 'tokens', 'coaching', 'top_mentor', 'opportunities'] as const;
const TRIGGER_IDS = XP_TRIGGERS.map((t) => t.id);

export class CreateXpRuleDto {
  @IsIn(TRIGGER_IDS)
  trigger!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  title!: string;

  @IsString()
  @MaxLength(200)
  description!: string;

  @IsIn(RULE_ROLES)
  role!: string;

  @IsIn(RULE_CATEGORIES)
  category!: string;

  @IsInt()
  @Min(1)
  @Max(5000)
  xp!: number;

  /** null = unlimited per day. */
  @IsOptional()
  @ValidateIf((o: CreateXpRuleDto) => o.dailyCap !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  dailyCap?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateXpRuleDto {
  @IsOptional()
  @IsIn(TRIGGER_IDS)
  trigger?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsIn(RULE_ROLES)
  role?: string;

  @IsOptional()
  @IsIn(RULE_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  xp?: number;

  @IsOptional()
  @ValidateIf((o: UpdateXpRuleDto) => o.dailyCap !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  dailyCap?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRewardDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  title!: string;

  @IsString()
  @MaxLength(80)
  subtitle!: string;

  @IsString()
  @MaxLength(400)
  description!: string;

  @IsIn(REWARD_TYPES)
  type!: string;

  @IsString()
  @MaxLength(40)
  icon!: string;

  @IsIn(RULE_ROLES)
  targetRole!: string;

  /** Eligible if the season's final rank on the user's board is <= this. */
  @IsInt()
  @Min(1)
  @Max(1000)
  minRank!: number;

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  perks!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @Matches(/^#[0-9a-fA-F]{6}$/, { each: true })
  gradientColors?: string[];

  /** Prefix for generated claim codes, e.g. "LRNX-GIFT". */
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{2,20}$/)
  codePrefix?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRewardDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) title?: string;
  @IsOptional() @IsString() @MaxLength(80) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
  @IsOptional() @IsIn(REWARD_TYPES) type?: string;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @IsOptional() @IsIn(RULE_ROLES) targetRole?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) minRank?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  perks?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @Matches(/^#[0-9a-fA-F]{6}$/, { each: true })
  gradientColors?: string[];

  @IsOptional() @Matches(/^[A-Za-z0-9-]{2,20}$/) codePrefix?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
