import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Applied only to POST /auth/refresh — requires a valid refresh token.
 * The explicit constructor stops Nest from trying to inject Passport's
 * internal options into the guard.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  constructor() {
    super();
  }
}
