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

// ---- Users (backend users/user.response.ts, users/dto) ----

/** GET /users, POST /users, PATCH /users/:id. Dates are ISO strings. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /users/options: active users only, for the assignee picker (AS4). */
export interface UserRef {
  id: string;
  name: string;
}

/** Limits from CreateUserDto / UpdateUserDto (AS7). */
export const USER_LIMITS = { emailMax: 255, nameMax: 100, passwordMin: 8, passwordMax: 128 } as const;

export interface CreateUserBody {
  email: string;
  name: string;
  password: string;
  role: Role;
}

/** Only the fields sent are changed. Email and password are not editable. */
export interface UpdateUserBody {
  name?: string;
  role?: Role;
  isActive?: boolean;
}

// ---- Todos (backend todos/todo.response.ts, todos/dto) ----

export type TodoStatus = 'todo' | 'in_progress' | 'done';
export type TodoPriority = 'low' | 'medium' | 'high';

/** TipTap (ProseMirror) JSON. Only the plan §5.4 allowlist is accepted by the backend. */
export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapDoc extends TiptapNode {
  type: 'doc';
}

export interface Todo {
  id: string;
  title: string;
  description: TiptapDoc;
  status: TodoStatus;
  priority: TodoPriority;
  /** yyyy-mm-dd or null. */
  dueDate: string | null;
  assignee: UserRef | null;
  createdBy: UserRef;
  createdAt: string;
  updatedAt: string;
}

/** Limits from CreateTodoDto and the TipTap validator. */
export const TODO_LIMITS = { titleMax: 200, descriptionMaxBytes: 100 * 1024 } as const;

/** `assigneeId` filter value for tasks without an assignee (ListTodosQueryDto). */
export const UNASSIGNED = 'unassigned';

export interface CreateTodoBody {
  title: string;
  description?: TiptapDoc;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
}

/** Only the fields sent are changed; `null` clears dueDate / assigneeId. */
export type UpdateTodoBody = Partial<CreateTodoBody>;
