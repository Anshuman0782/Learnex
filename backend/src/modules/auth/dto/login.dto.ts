import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Payload for POST /auth/login.
 * `identifier` is the user's email OR phone (name-based login is not supported).
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  identifier!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  code!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}
