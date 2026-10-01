import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as accessible without authentication.
 * Auth is default-deny (the JWT guard runs globally), so anything a logged-out
 * user must reach — register, login, refresh, health — is tagged with @Public().
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
