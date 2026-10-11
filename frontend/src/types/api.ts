// Mirrors of the backend response shapes the frontend uses (plan §2: no shared package).

export type Role = 'owner' | 'manager' | 'member';

/** POST /auth/login, POST /auth/refresh and GET /auth/me. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface FieldError {
  field: string;
  message: string;
}

/** Every non-2xx response from the backend and the proxy (plan §6.4). */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details: FieldError[];
}
