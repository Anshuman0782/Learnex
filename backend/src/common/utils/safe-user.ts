import { User } from '@prisma/client';

/** A user record safe to send to clients — never includes secrets. */
export type SafeUser = Omit<User, 'passwordHash' | 'hashedRefreshToken'>;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _p, hashedRefreshToken: _r, ...safe } = user;
  return safe;
}
