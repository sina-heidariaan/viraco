import { SetMetadata } from '@nestjs/common';
import { Role } from '../../modules/users/role.enum';

export const ROLES_KEY = 'roles';

/** Restricts a route to the listed roles (checked by RolesGuard → 403). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
