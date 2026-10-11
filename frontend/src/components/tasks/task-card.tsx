'use client';

import { PencilIcon, TrashIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import Link from 'next/link';
import { ActionMenu, type MenuAction } from '@/components/ui/menu';
import { formatDay } from '@/lib/format';
import type { Todo } from '@/types/api';
import { OverdueBadge, PriorityBadge, STATUS_STYLES, isOverdue, localToday } from './task-badges';

type TaskCardProps = {
  task: Todo;
  canDelete: boolean;
  onEdit: (task: Todo) => void;
  onDelete: (task: Todo) => void;
};

export function TaskCard({ task, canDelete, onEdit, onDelete }: TaskCardProps) {
  const actions: MenuAction[] = [{ label: 'ویرایش', icon: PencilIcon, onSelect: () => onEdit(task) }];
  if (canDelete) actions.push({ label: 'حذف', icon: TrashIcon, danger: true, onSelect: () => onDelete(task) });

  return (
    <li>
      <article
        className={clsx(
          'rounded-xl border border-s-4 border-neutral-200 bg-white p-3 shadow-xs',
          STATUS_STYLES[task.status].edge,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 pt-2 text-sm font-medium text-neutral-900">
            <Link
              href={`/tasks/${task.id}`}
              className="rounded-sm break-words hover:text-accent-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              <bdi dir="auto">{task.title}</bdi>
            </Link>
          </h3>
          <ActionMenu label={`گزینه‌های کار «${task.title}»`} actions={actions} />
        </div>
        <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-700">
          <div className="flex items-center gap-1">
            <dt>اولویت:</dt>
            <dd>
              <PriorityBadge priority={task.priority} />
            </dd>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <dt>مسئول:</dt>
            <dd className="truncate">
              {task.assignee ? <bdi dir="auto">{task.assignee.name}</bdi> : <span className="text-neutral-600">بدون مسئول</span>}
            </dd>
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <dt>موعد:</dt>
              <dd>
                <time dateTime={task.dueDate}>{formatDay(task.dueDate)}</time>
                {isOverdue(task, localToday()) && (
                  <>
                    {' '}
                    <OverdueBadge />
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
      </article>
    </li>
  );
}
