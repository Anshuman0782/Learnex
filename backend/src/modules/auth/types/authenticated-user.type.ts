import { UserRole } from '@prisma/client';

/**
 * The identity attached to `request.user` after a valid access token.
 * Kept intentionally small — never the full DB record.
 */
export interface AuthenticatedUser {
  userId: string;
  role: UserRole | null;
}

/**
 * Same as above but also carries the raw refresh token — only produced by the
 * refresh flow so the service can compare it against the stored hash.
 */
export interface AuthenticatedUserWithRefresh extends AuthenticatedUser {
  refreshToken: string;
}

/**
 * Contents we sign into each JWT.
 */
export interface JwtPayload {
  sub: string; // user id
  role: UserRole | null;
}
