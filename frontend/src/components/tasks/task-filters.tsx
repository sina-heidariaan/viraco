'use client';

import { XMarkIcon } from '@heroicons/react/20/solid';
import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';
import { STATUSES, STATUS_LABELS } from '@/lib/labels';
import { UNASSIGNED, type TodoStatus } from '@/types/api';

/** Board filters as they live in the URL (plan §8.5): `?status=&assigneeId=`. */
export type TaskFilters = {
  status: TodoStatus | null;
  /** A user id, `unassigned`, or null for everyone. */
  assigneeId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

/** Unknown values in a hand-edited URL are ignored instead of sent to the API. */
export function parseFilters(params: URLSearchParams): TaskFilters {
  const status = params.get('status');
  const assigneeId = params.get('assigneeId');
  return {
    status: STATUSES.includes(status as TodoStatus) ? (status as TodoStatus) : null,
    assigneeId: assigneeId && (assigneeId === UNASSIGNED || isUuid(assigneeId)) ? assigneeId : null,
  };
}

/** `?status=…&assigneeId=…`, or '' when no filter is set. */
export function filtersToQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const hasFilters = (filters: TaskFilters) => filters.status !== null || filters.assigneeId !== null;

const ALL = 'all';

type TaskFiltersBarProps = {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  /** People to filter by, already including the current user. */
  people: SelectOption<string>[];
};

export function TaskFiltersBar({ filters, onChange, people }: TaskFiltersBarProps) {
  const statusOptions: SelectOption<string>[] = [
    { value: ALL, label: 'همهٔ وضعیت‌ها' },
    ...STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
  ];
  const assigneeOptions: SelectOption<string>[] = [
    { value: ALL, label: 'همهٔ افراد' },
    { value: UNASSIGNED, label: 'بدون مسئول' },
    ...people,
  ];

  return (
    <div role="group" aria-label="فیلتر کارها" className="flex flex-wrap items-end gap-3">
      <Select
        label="وضعیت"
        className="w-full sm:w-48"
        value={filters.status ?? ALL}
        options={statusOptions}
        onChange={(value) => onChange({ ...filters, status: value === ALL ? null : (value as TodoStatus) })}
      />
      <Select
        label="مسئول"
        className="w-full sm:w-56"
        value={filters.assigneeId ?? ALL}
        options={assigneeOptions}
        onChange={(value) => onChange({ ...filters, assigneeId: value === ALL ? null : value })}
      />
      {hasFilters(filters) && (
        <Button variant="ghost" onClick={() => onChange({ status: null, assigneeId: null })}>
          <XMarkIcon aria-hidden="true" className="size-5" />
          پاک کردن فیلترها
        </Button>
      )}
    </div>
  );
}
