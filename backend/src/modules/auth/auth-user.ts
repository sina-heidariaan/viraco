import { Role } from '../users/role.enum';
import { User } from '../users/user.entity';

/** The user attached to an authenticated request and returned by GET /auth/me. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Claims inside the access token. `tv` must equal users.token_version. */
export interface AccessTokenPayload {
  sub: string;
  tv: number;
}

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
