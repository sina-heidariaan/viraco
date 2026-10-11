import type { AuthUser, Todo } from '@/types/api';

/**
 * Plan §5.1, mirrored only to hide buttons the user may not use (plan §8.2).
 * NestJS enforces every one of these rules; a wrong answer here costs a 403, not a leak.
 * Every task the frontend holds is one the backend already let this user see, so every
 * held task is editable: owners and managers edit all, members their own (AS1).
 */

const isMember = (user: AuthUser) => user.role === 'member';

export function canDeleteTask(user: AuthUser, todo: Todo): boolean {
  return !isMember(user) || todo.createdBy.id === user.id;
}

/** Members may change the assignee only on tasks they created (and only to self or nobody). */
export function canChangeAssignee(user: AuthUser, todo: Todo | null): boolean {
  return !isMember(user) || todo === null || todo.createdBy.id === user.id;
}

/** GET /users/options is owner + manager; a member may only pick self or nobody. */
export function canListAssignees(user: AuthUser): boolean {
  return !isMember(user);
}

export function canManageUsers(user: AuthUser): boolean {
  return user.role === 'owner';
}
