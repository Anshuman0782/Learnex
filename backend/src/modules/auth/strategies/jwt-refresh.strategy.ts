import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type {
  AuthenticatedUserWithRefresh,
  JwtPayload,
} from '../types/authenticated-user.type.js';

/**
 * Validates the long-lived REFRESH token (only on the /auth/refresh route).
 * It also passes the raw token through so the service can compare it against
 * the hash stored in the database (rotation + revocation).
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET')!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): AuthenticatedUserWithRefresh {
    const refreshToken =
      req.get('authorization')?.replace('Bearer', '').trim() ?? '';
    return { userId: payload.sub, role: payload.role, refreshToken };
  }
}
