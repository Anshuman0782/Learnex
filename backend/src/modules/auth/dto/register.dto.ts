import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Payload for POST /auth/register. Mirrors the app's SignUp screen fields.
 * Role is intentionally NOT here — it is chosen later during onboarding.
 */
export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  // E.164-ish: optional leading +, 7–15 digits. Spaces are stripped before validation.
  @IsOptional()
  @Matches(/^\+?\d{7,15}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dob must be YYYY-MM-DD' })
  dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  hobby?: string;
}
