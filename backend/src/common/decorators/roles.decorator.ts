import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given role(s). Enforced by RolesGuard.
 * Example: @Roles(UserRole.MENTOR) on a mentor-only critique endpoint.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
