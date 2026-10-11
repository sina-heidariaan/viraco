import type { Role, TodoPriority, TodoStatus } from '@/types/api';

// The only place enum values get Persian labels (plan §8.1). Arrays give display order.

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'مالک',
  manager: 'مدیر',
  member: 'عضو',
};

export const ROLES: Role[] = ['owner', 'manager', 'member'];

export const STATUS_LABELS: Record<TodoStatus, string> = {
  todo: 'برای انجام',
  in_progress: 'در حال انجام',
  done: 'انجام‌شده',
};

/** Board column order. */
export const STATUSES: TodoStatus[] = ['todo', 'in_progress', 'done'];

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  low: 'کم',
  medium: 'متوسط',
  high: 'زیاد',
};

export const PRIORITIES: TodoPriority[] = ['high', 'medium', 'low'];
