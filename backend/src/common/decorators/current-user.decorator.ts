import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../modules/auth/types/authenticated-user.type.js';

/**
 * Injects the authenticated user (attached by the JWT strategy) into a handler.
 * Example: `@CurrentUser() user: AuthenticatedUser`
 * Pass a key to grab one field: `@CurrentUser('userId') id: string`
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
