import { SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../auth/auth-user';
import { Role } from '../users/role.enum';
import { Todo } from './todo.entity';

/**
 * Row-level task rules (plan §3.4, §5.1). Visibility is applied inside the SQL
 * query, so a member can never load a task they are not allowed to see.
 * Owners and managers have full task access (AS3).
 */

const isMember = (user: AuthUser): boolean => user.role === Role.Member;

/** Adds the member visibility filter to a query whose todo alias is `alias`. */
export function scopeTodosToUser<T extends SelectQueryBuilder<Todo>>(
  qb: T,
  user: AuthUser,
  alias = 'todo',
): T {
  if (isMember(user)) {
    qb.andWhere(`(${alias}.createdById = :viewerId OR ${alias}.assigneeId = :viewerId)`, {
      viewerId: user.id,
    });
  }
  return qb;
}

/** A member may only give a task to themselves or to nobody. */
export function canAssignTo(user: AuthUser, assigneeId: string | null): boolean {
  return !isMember(user) || assigneeId === null || assigneeId === user.id;
}

/** Changing the assignee of an existing (visible) task. Members: only on tasks they created. */
export function canChangeAssignee(
  user: AuthUser,
  todo: Pick<Todo, 'createdById'>,
  assigneeId: string | null,
): boolean {
  if (!isMember(user)) return true;
  return todo.createdById === user.id && canAssignTo(user, assigneeId);
}

/** Deleting a (visible) task. Members: only tasks they created. */
export function canDeleteTodo(user: AuthUser, todo: Pick<Todo, 'createdById'>): boolean {
  return !isMember(user) || todo.createdById === user.id;
}
