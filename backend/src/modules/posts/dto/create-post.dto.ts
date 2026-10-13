import {
  ArrayMaxSize,
  IsArray,
  Matches,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export type PostTypeInput = 'text' | 'video' | 'audio' | 'image' | 'critique_request';

/** Only images uploaded through our own /media/upload endpoint are accepted. */
export const UPLOADED_IMAGE_URL =
  /^(https?:\/\/[^\s/]+\/uploads\/images\/[A-Za-z0-9._\-/]+|https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/[A-Za-z0-9._\-/]+)$/;

/** Allowed discussion-card backgrounds (keys only — colors live in the app). */
export const POST_BG_STYLES = ['default', 'ocean', 'sunset', 'mint', 'berry', 'flame', 'midnight', 'forest', 'gold'] as const;

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsIn(['text', 'video', 'audio', 'image', 'critique_request'])
  postType!: PostTypeInput;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  communityIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tag?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  focusArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoThumbnail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  videoDuration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  audioUrl?: string;

  @IsOptional()
  @IsBoolean()
  isShort?: boolean;

  /** Which of the author's skills this post belongs to (defaults to their main skill). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  skill?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  @Matches(UPLOADED_IMAGE_URL, { each: true, message: 'imageUrls must be images uploaded to Lernex' })
  imageUrls?: string[];

  @IsOptional()
  @IsIn(POST_BG_STYLES as unknown as string[])
  bgStyle?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string; // ISO datetime; future = scheduled/hidden until then
}

export class UpdatePostDto {
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
}
