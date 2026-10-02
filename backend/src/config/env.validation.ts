import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Allowed runtime environments.
 */
export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * The shape of every environment variable the app needs.
 * If any are missing or malformed, the app refuses to start (fail fast).
 */
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsInt()
  @Min(0)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  // --- Admin Panel owners (optional) ---
  // Comma-separated emails that are always admins and can't be revoked.
  @IsOptional()
  @IsString()
  ADMIN_EMAILS?: string;

  // --- Media storage (optional; defaults to local disk in ./uploads) ---
  @IsOptional()
  @IsString()
  STORAGE_DRIVER?: string;

  @IsOptional()
  @IsString()
  UPLOADS_DIR?: string;

  // Cloud media storage: cloudinary://<api_key>:<api_secret>@<cloud_name>
  @IsOptional()
  @IsString()
  CLOUDINARY_URL?: string;

  // --- Email (Brevo HTTPS API; free 300/day) ---
  @IsOptional()
  @IsString()
  BREVO_API_KEY?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM_EMAIL?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM_NAME?: string;

  // --- Optional TURN relay for calls ---
  @IsOptional()
  @IsString()
  TURN_URL?: string;

  @IsOptional()
  @IsString()
  TURN_USERNAME?: string;

  @IsOptional()
  @IsString()
  TURN_CREDENTIAL?: string;
}

/**
 * Called by ConfigModule at startup. Coerces types (e.g. PORT string -> number)
 * and throws a readable error listing exactly what is wrong.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  // Production hosts (e.g. Render free) wipe the local disk on every restart,
  // so uploads MUST go to cloud storage there.
  if (
    validated.NODE_ENV === NodeEnv.Production &&
    !/^cloudinary:\/\/[^:]+:[^@]+@[A-Za-z0-9_-]+$/.test(validated.CLOUDINARY_URL ?? '')
  ) {
    throw new Error(
      'Invalid environment configuration:\nCLOUDINARY_URL is required in production (cloudinary://<key>:<secret>@<cloud>)',
    );
  }

  return validated;
}
