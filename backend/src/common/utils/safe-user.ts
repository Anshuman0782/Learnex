import { User } from '@prisma/client';

/** A user record safe to send to clients — never includes secrets. */
export type SafeUser = Omit<User, 'passwordHash' | 'hashedRefreshToken' | 'prevRefreshTokenHash' | 'refreshRotatedAt'>;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _p, hashedRefreshToken: _r, prevRefreshTokenHash: _pr, refreshRotatedAt: _ra, ...safe } = user;
  return safe;
}
