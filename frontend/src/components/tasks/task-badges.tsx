import clsx from 'clsx';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/labels';
import type { TodoPriority, TodoStatus } from '@/types/api';

/** Status colour classes (plan §8.3). Always paired with the text label, never alone. */
export const STATUS_STYLES: Record<TodoStatus, { badge: string; dot: string; edge: string }> = {
  todo: { badge: 'bg-todo-100 text-todo-800 ring-todo-200', dot: 'bg-todo-500', edge: 'border-s-todo-500' },
  in_progress: {
    badge: 'bg-progress-100 text-progress-800 ring-progress-200',
    dot: 'bg-progress-500',
    edge: 'border-s-progress-500',
  },
  done: { badge: 'bg-done-100 text-done-800 ring-done-200', dot: 'bg-done-500', edge: 'border-s-done-500' },
};

const PRIORITY_STYLES: Record<TodoPriority, string> = {
  high: 'bg-danger-50 text-danger-800 ring-danger-200',
  medium: 'bg-neutral-100 text-neutral-800 ring-neutral-200',
  low: 'bg-white text-neutral-700 ring-neutral-200',
};

const BADGE = 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

export function StatusBadge({ status }: { status: TodoStatus }) {
  return (
    <span className={clsx(BADGE, STATUS_STYLES[status].badge)}>
      <span aria-hidden="true" className={clsx('size-1.5 rounded-full', STATUS_STYLES[status].dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TodoPriority }) {
  return <span className={clsx(BADGE, PRIORITY_STYLES[priority])}>{PRIORITY_LABELS[priority]}</span>;
}
