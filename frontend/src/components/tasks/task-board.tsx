'use client';

import { PlusIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useCurrentUser } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import type { SelectOption } from '@/components/ui/select';
import { StatePanel } from '@/components/ui/state-panel';
import { describeError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { STATUSES, STATUS_LABELS } from '@/lib/labels';
import { canDeleteTask, canListAssignees } from '@/lib/permissions';
import { useApiQuery } from '@/lib/use-api-query';
import { UNASSIGNED, type Todo, type TodoStatus, type UserRef } from '@/types/api';
import { STATUS_STYLES } from './task-badges';
import { TaskCard } from './task-card';
import { DeleteTaskDialog } from './delete-task-dialog';
import { TaskFiltersBar, filtersToQuery, hasFilters, parseFilters, type TaskFilters } from './task-filters';
import { TaskFormDialog } from './task-form-dialog';

const NOT_FOUND_MESSAGE = 'این کار دیگر وجود ندارد یا به آن دسترسی ندارید. فهرست به‌روز شد.';

export function TaskBoard() {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseFilters(searchParams);
  const filtered = hasFilters(filters);

  const todos = useApiQuery<Todo[]>(`/todos${filtersToQuery(filters)}`);
  const options = useApiQuery<UserRef[]>(canListAssignees(user) ? '/users/options' : null);
  const assignees = {
    users: options.state.status === 'ready' ? options.state.data : [],
    loaded: options.state.status === 'ready',
  };

  const [message, setMessage] = useState('');
  const [form, setForm] = useState<{ open: boolean; task: Todo | null; key: number }>({ open: false, task: null, key: 0 });
  const [removal, setRemoval] = useState<{ open: boolean; task: Todo | null }>({ open: false, task: null });

  // push, not replace: the back button steps through filter changes (plan §8.5).
  function applyFilters(next: TaskFilters) {
    router.push(`${pathname}${filtersToQuery(next)}`, { scroll: false });
  }

  function openForm(task: Todo | null) {
    setMessage('');
    setForm((prev) => ({ open: true, task, key: prev.key + 1 }));
  }

  function taskGone() {
    setForm((prev) => ({ ...prev, open: false }));
    setRemoval((prev) => ({ ...prev, open: false }));
    setMessage(NOT_FOUND_MESSAGE);
    todos.reload();
  }

  const loaded = todos.state.status === 'ready' ? todos.state.data : null;
  const people = filterPeople(user, assignees.users, filters.assigneeId, loaded);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">کارها</h1>
        <Button onClick={() => openForm(null)}>
          <PlusIcon aria-hidden="true" className="size-5" />
          کار جدید
        </Button>
      </div>

      <div className="mt-5">
        <TaskFiltersBar filters={filters} onChange={applyFilters} people={people} />
      </div>

      <p role="status" className="mt-4 text-sm text-neutral-800 empty:hidden">
        {message}
      </p>

      <div className="mt-5">
        {todos.state.status === 'loading' && <BoardSkeleton />}

        {todos.state.status === 'error' && (
          <StatePanel
            role="alert"
            tone="danger"
            title="فهرست کارها بارگذاری نشد."
            action={<Button onClick={todos.retry}>تلاش دوباره</Button>}
          >
            {describeError(todos.state.error)}
          </StatePanel>
        )}

        {todos.state.status === 'ready' &&
          (todos.state.data.length === 0 ? (
            filtered ? (
              <StatePanel
                title="هیچ کاری با این فیلترها پیدا نشد."
                action={
                  <Button variant="secondary" onClick={() => applyFilters({ status: null, assigneeId: null })}>
                    پاک کردن فیلترها
                  </Button>
                }
              >
                فیلتر وضعیت یا مسئول را تغییر دهید یا همهٔ فیلترها را پاک کنید.
              </StatePanel>
            ) : (
              <StatePanel
                title="هنوز کاری ثبت نشده"
                action={
                  <Button onClick={() => openForm(null)}>
                    <PlusIcon aria-hidden="true" className="size-5" />
                    ساخت اولین کار
                  </Button>
                }
              >
                {user.role === 'member'
                  ? 'کارهایی که می‌سازید یا به شما سپرده می‌شوند اینجا نمایش داده می‌شوند.'
                  : 'کارهای تیم اینجا در سه ستون وضعیت نمایش داده می‌شوند.'}
              </StatePanel>
            )
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {`${formatNumber(todos.state.data.length)} کار نمایش داده می‌شود.`}
              </p>
              <div className={clsx('grid gap-4', filters.status ? 'max-w-xl' : 'md:grid-cols-3')}>
                {(filters.status ? [filters.status] : STATUSES).map((status) => (
                  <Column
                    key={status}
                    status={status}
                    tasks={(loaded ?? []).filter((t) => t.status === status)}
                    canDelete={(task) => canDeleteTask(user, task)}
                    onEdit={openForm}
                    onDelete={(task) => {
                      setMessage('');
                      setRemoval({ open: true, task });
                    }}
                  />
                ))}
              </div>
            </>
          ))}
      </div>

      <TaskFormDialog
        open={form.open}
        task={form.task}
        formKey={form.key}
        assignees={assignees}
        onClose={() => setForm((prev) => ({ ...prev, open: false }))}
        onSaved={(saved, created) => {
          setForm((prev) => ({ ...prev, open: false }));
          setMessage(created ? `کار «${saved.title}» ساخته شد.` : `تغییرات کار «${saved.title}» ذخیره شد.`);
          todos.reload();
        }}
        onMissing={taskGone}
      />
      <DeleteTaskDialog
        open={removal.open}
        task={removal.task}
        onClose={() => setRemoval((prev) => ({ ...prev, open: false }))}
        onDeleted={(deleted) => {
          setRemoval((prev) => ({ ...prev, open: false }));
          setMessage(`کار «${deleted.title}» حذف شد.`);
          todos.reload();
        }}
        onMissing={taskGone}
      />
    </div>
  );
}

type ColumnProps = {
  status: TodoStatus;
  tasks: Todo[];
  canDelete: (task: Todo) => boolean;
  onEdit: (task: Todo) => void;
  onDelete: (task: Todo) => void;
};

function Column({ status, tasks, canDelete, onEdit, onDelete }: ColumnProps) {
  const headingId = `column-${status}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-xl bg-neutral-100 p-3">
      <h2 id={headingId} className="flex items-center gap-2 px-1 text-sm font-semibold text-neutral-900">
        <span aria-hidden="true" className={clsx('size-2 rounded-full', STATUS_STYLES[status].dot)} />
        {STATUS_LABELS[status]}
        <span className="rounded-full bg-white px-2 text-xs font-medium text-neutral-700">
          <span className="sr-only">تعداد: </span>
          {formatNumber(tasks.length)}
        </span>
      </h2>
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-600">
          کاری در این ستون نیست.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} canDelete={canDelete(task)} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BoardSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        در حال بارگذاری کارها…
      </p>
      <div aria-hidden="true" className="grid animate-pulse gap-4 md:grid-cols-3">
        {STATUSES.map((status) => (
          <div key={status} className="flex flex-col gap-3 rounded-xl bg-neutral-100 p-3">
            <div className="h-5 w-28 rounded-lg bg-neutral-200" />
            {[0, 1].map((i) => (
              <div key={i} className="h-24 rounded-xl border border-neutral-200 bg-white" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * People for the assignee filter. Owners and managers: the active users. Members cannot
 * list users, so they get themselves. A user id in the URL that is not in the list (a
 * disabled user) keeps a label, taken from a loaded task when possible.
 */
function filterPeople(
  user: { id: string; name: string; role: string },
  users: UserRef[],
  selected: string | null,
  tasks: Todo[] | null,
): SelectOption<string>[] {
  const list = user.role === 'member' || users.length === 0 ? [{ id: user.id, name: user.name }] : users;
  const options = list.map((person) => ({
    value: person.id,
    label: person.id === user.id ? `${person.name} (من)` : person.name,
  }));
  if (selected && selected !== UNASSIGNED && !options.some((option) => option.value === selected)) {
    const known = tasks?.find((t) => t.assignee?.id === selected)?.assignee;
    options.push({ value: selected, label: known?.name ?? 'فرد انتخاب‌شده' });
  }
  return options;
}
