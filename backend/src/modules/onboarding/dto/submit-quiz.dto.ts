import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** One answer: which option the user chose for a given question. */
export class QuizAnswerDto {
  @IsString()
  questionId!: string;

  @IsInt()
  @Min(0)
  @Max(9)
  selectedIndex!: number;
}

/** The full quiz submission. Size is bounded so the quiz can't be gamed. */
export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];

  /** The skill being tested for (defaults to the member's main skill). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  skill?: string;
}

/** Names one skill — joining it as a Learner, or making it the main skill. */
export class SkillDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  skill?: string;
}
