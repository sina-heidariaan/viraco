'use client';

import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';
import { ApiError, describeError } from '@/lib/api-client';
import { formatDateTime, formatDay } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import type { Todo } from '@/types/api';
import { DescriptionView } from './description-view';
import { PriorityBadge, StatusBadge } from './task-badges';
import { isUuid } from './task-filters';

const LINK_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-accent-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600';

function BackLink() {
  return (
    <Link href="/tasks" className={LINK_CLASS}>
      <ArrowLeftIcon aria-hidden="true" className="size-4 rtl:rotate-180" />
      بازگشت به کارها
    </Link>
  );
}

/** Read-only task page. A task the user cannot see looks exactly like a missing one (AS5). */
export function TaskDetail({ id }: { id: string }) {
  const validId = isUuid(id);
  const { state, retry } = useApiQuery<Todo>(validId ? `/todos/${id}` : null);

  const notFound =
    !validId || (state.status === 'error' && state.error instanceof ApiError && [400, 404].includes(state.error.status));

  if (notFound) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <StatePanel title="این کار پیدا نشد.">
          ممکن است حذف شده باشد یا به آن دسترسی نداشته باشید.
        </StatePanel>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <StatePanel
          role="alert"
          tone="danger"
          title="این کار بارگذاری نشد."
          action={<Button onClick={retry}>تلاش دوباره</Button>}
        >
          {describeError(state.error)}
        </StatePanel>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <p role="status" className="sr-only">
          در حال بارگذاری کار…
        </p>
        <div aria-hidden="true" className="animate-pulse rounded-xl border border-neutral-200 bg-white p-6">
          <div className="h-7 w-2/3 rounded-lg bg-neutral-200" />
          <div className="mt-4 h-5 w-40 rounded-lg bg-neutral-100" />
          <div className="mt-6 h-32 rounded-lg bg-neutral-100" />
        </div>
      </div>
    );
  }

  const task = state.data;
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <article className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
        <h1 className="text-xl font-semibold break-words text-neutral-900">
          <bdi dir="auto">{task.title}</bdi>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <span className="text-xs text-neutral-700">
            اولویت: <PriorityBadge priority={task.priority} />
          </span>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Detail term="مسئول">
            {task.assignee ? <bdi dir="auto">{task.assignee.name}</bdi> : 'بدون مسئول'}
          </Detail>
          <Detail term="سازنده">
            <bdi dir="auto">{task.createdBy.name}</bdi>
          </Detail>
          <Detail term="موعد">
            {task.dueDate ? <time dateTime={task.dueDate}>{formatDay(task.dueDate)}</time> : 'بدون موعد'}
          </Detail>
          <Detail term="آخرین تغییر">
            <time dateTime={task.updatedAt}>{formatDateTime(task.updatedAt)}</time>
          </Detail>
        </dl>

        <section aria-labelledby="description-heading" className="mt-8 border-t border-neutral-200 pt-6">
          <h2 id="description-heading" className="text-base font-semibold text-neutral-900">
            توضیحات
          </h2>
          <div className="mt-3">
            <DescriptionView doc={task.description} />
          </div>
        </section>
      </article>
    </div>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-neutral-600">{term}</dt>
      <dd className="mt-0.5 font-medium text-neutral-900">{children}</dd>
    </div>
  );
}
