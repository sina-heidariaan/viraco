'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useCurrentUser } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogActions } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Select, type SelectOption } from '@/components/ui/select';
import { ApiError, api, describeError, fieldErrors } from '@/lib/api-client';
import { formatDay } from '@/lib/format';
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '@/lib/labels';
import { canChangeAssignee } from '@/lib/permissions';
import { EMPTY_DOC, docByteSize, normalizeDoc } from '@/lib/tiptap-extensions';
import {
  TODO_LIMITS,
  type CreateTodoBody,
  type TiptapDoc,
  type Todo,
  type TodoPriority,
  type TodoStatus,
  type UpdateTodoBody,
  type UserRef,
} from '@/types/api';
import { DescriptionEditor } from './description-editor';

export type AssigneeList = {
  /** Active users from GET /users/options (owner, manager); empty for members. */
  users: UserRef[];
  /** False while loading or after a failure; then only "nobody" and the current value are offered. */
  loaded: boolean;
};

type TaskFormDialogProps = {
  open: boolean;
  /** null = create a new task. */
  task: Todo | null;
  /** Changes on every open, so the form starts fresh. */
  formKey: number;
  assignees: AssigneeList;
  onClose: () => void;
  onSaved: (task: Todo, created: boolean) => void;
  /** The task is gone or no longer visible (404). */
  onMissing: () => void;
};

export function TaskFormDialog({ open, task, formKey, assignees, onClose, onSaved, onMissing }: TaskFormDialogProps) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      // A request in flight finishes first; closing mid-save would hide its result.
      onClose={() => {
        if (!pending) onClose();
      }}
      title={task ? 'ویرایش کار' : 'کار جدید'}
      size="lg"
    >
      <TaskForm
        key={formKey}
        task={task}
        assignees={assignees}
        pending={pending}
        setPending={setPending}
        onCancel={onClose}
        onSaved={onSaved}
        onMissing={onMissing}
      />
    </Dialog>
  );
}

type Field = 'title' | 'status' | 'priority' | 'dueDate' | 'assigneeId' | 'description';

/** Persian text for server field errors; the backend sends English validator messages. */
const SERVER_FIELD_MESSAGES: Record<Field, string> = {
  title: `عنوان را وارد کنید (حداکثر ${TODO_LIMITS.titleMax.toLocaleString('fa-IR')} نویسه).`,
  status: 'یک وضعیت معتبر انتخاب کنید.',
  priority: 'یک اولویت معتبر انتخاب کنید.',
  dueDate: 'یک تاریخ معتبر انتخاب کنید.',
  assigneeId: 'این فرد را نمی‌توان مسئول کرد؛ شاید غیرفعال شده باشد. فرد دیگری انتخاب کنید.',
  description: 'توضیحات قالبی دارد که پذیرفته نمی‌شود، یا بیش از ۱۰۰ کیلوبایت است.',
};

/** Select value for "no assignee". Not a uuid, so it cannot collide with a user id. */
const NOBODY = 'nobody';

type TaskFormProps = {
  task: Todo | null;
  assignees: AssigneeList;
  pending: boolean;
  setPending: (pending: boolean) => void;
  onCancel: () => void;
  onSaved: (task: Todo, created: boolean) => void;
  onMissing: () => void;
};

function TaskForm({ task, assignees, pending, setPending, onCancel, onSaved, onMissing }: TaskFormProps) {
  const user = useCurrentUser();
  const [title, setTitle] = useState(task?.title ?? '');
  const [status, setStatus] = useState<TodoStatus>(task?.status ?? 'todo');
  const [priority, setPriority] = useState<TodoPriority>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.id ?? NOBODY);
  const description = useRef<TiptapDoc | null>(null); // null = untouched
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const assigneeEditable = canChangeAssignee(user, task);
  const assigneeOptions = buildAssigneeOptions(user, task, assignees);

  function clearError(field: Field) {
    if (!errors[field]) return;
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest[field];
      return rest;
    });
  }

  function showErrors(found: Partial<Record<Field, string>>): boolean {
    setErrors(found);
    if (found.title) titleRef.current?.focus();
    return Object.keys(found).length > 0;
  }

  function validate(): Partial<Record<Field, string>> {
    const found: Partial<Record<Field, string>> = {};
    const trimmed = title.trim();
    if (!trimmed) found.title = 'عنوان کار را وارد کنید.';
    else if (trimmed.length > TODO_LIMITS.titleMax) found.title = SERVER_FIELD_MESSAGES.title;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) found.dueDate = SERVER_FIELD_MESSAGES.dueDate;
    if (description.current && docByteSize(normalizeDoc(description.current)) > TODO_LIMITS.descriptionMaxBytes) {
      found.description = 'توضیحات بیش از ۱۰۰ کیلوبایت است. آن را کوتاه‌تر کنید.';
    }
    return found;
  }

  /** Create: every field. Edit: only what changed, so a parallel edit of another field survives. */
  function buildBody(): CreateTodoBody | UpdateTodoBody | null {
    const next: CreateTodoBody = {
      title: title.trim(),
      status,
      priority,
      dueDate: dueDate || null,
      assigneeId: assigneeId === NOBODY ? null : assigneeId,
    };
    if (description.current) next.description = normalizeDoc(description.current);
    if (!task) return { ...next, description: next.description ?? EMPTY_DOC };

    const body: UpdateTodoBody = {};
    if (next.title !== task.title) body.title = next.title;
    if (next.status !== task.status) body.status = next.status;
    if (next.priority !== task.priority) body.priority = next.priority;
    if (next.dueDate !== task.dueDate) body.dueDate = next.dueDate;
    if (next.assigneeId !== (task.assignee?.id ?? null)) body.assigneeId = next.assigneeId;
    if (next.description && JSON.stringify(next.description) !== JSON.stringify(normalizeDoc(task.description))) {
      body.description = next.description;
    }
    return Object.keys(body).length > 0 ? body : null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    if (showErrors(validate())) return;

    const body = buildBody();
    if (!body) {
      onCancel(); // nothing changed
      return;
    }
    setPending(true);
    try {
      const saved = task
        ? await api<Todo>(`/todos/${task.id}`, { method: 'PATCH', json: body })
        : await api<Todo>('/todos', { method: 'POST', json: body });
      setPending(false);
      onSaved(saved, !task);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 404) {
        onMissing();
        return;
      }
      const { fields, otherError } = fieldErrors(err, SERVER_FIELD_MESSAGES);
      if (!showErrors(fields) || otherError) setFormError(otherError ?? describeError(err));
    }
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <div role="alert">
        {formError && (
          <p className="mb-5 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
            {formError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <TextField
          ref={titleRef}
          label="عنوان"
          name="title"
          dir="auto"
          autoComplete="off"
          maxLength={TODO_LIMITS.titleMax}
          value={title}
          error={errors.title}
          onChange={(event) => {
            setTitle(event.target.value);
            clearError('title');
          }}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="وضعیت"
            value={status}
            options={STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
            error={errors.status}
            onChange={(value) => {
              setStatus(value);
              clearError('status');
            }}
          />
          <Select
            label="اولویت"
            value={priority}
            options={PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))}
            error={errors.priority}
            onChange={(value) => {
              setPriority(value);
              clearError('priority');
            }}
          />
          <TextField
            label="موعد (اختیاری)"
            name="dueDate"
            type="date"
            // The native picker shows Gregorian digits; the Jalali date is shown under it.
            dir="ltr"
            value={dueDate}
            error={errors.dueDate}
            hint={dueDate ? `به تاریخ شمسی: ${formatDay(dueDate)}` : 'بدون موعد'}
            onChange={(event) => {
              setDueDate(event.target.value);
              clearError('dueDate');
            }}
          />
          <Select
            label="مسئول"
            value={assigneeId}
            options={assigneeOptions}
            disabled={!assigneeEditable}
            error={errors.assigneeId}
            hint={
              !assigneeEditable
                ? 'مسئول را فقط سازندهٔ کار می‌تواند تغییر دهد.'
                : user.role === 'member'
                  ? 'می‌توانید کار را به خودتان بدهید یا بدون مسئول بگذارید.'
                  : !assignees.loaded
                    ? 'فهرست افراد بارگذاری نشد؛ فقط گزینه‌های فعلی در دسترس است.'
                    : undefined
            }
            onChange={(value) => {
              setAssigneeId(value);
              clearError('assigneeId');
            }}
          />
        </div>
        <DescriptionEditor
          label="توضیحات (اختیاری)"
          initial={task?.description ?? EMPTY_DOC}
          error={errors.description}
          onChange={(doc) => {
            description.current = doc;
            clearError('description');
          }}
        />
      </div>
      <DialogActions>
        <Button type="submit" disabled={pending}>
          {pending ? 'در حال ذخیره…' : task ? 'ذخیرهٔ تغییرات' : 'ساخت کار'}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
          انصراف
        </Button>
      </DialogActions>
    </form>
  );
}

/**
 * Members may pick only themselves or nobody (plan §5.1). Owners and managers pick from
 * the active users. The current assignee always stays selectable, even if they were
 * disabled since (a disabled user keeps existing assignments, plan §6.1).
 */
function buildAssigneeOptions(
  user: { id: string; name: string; role: string },
  task: Todo | null,
  assignees: AssigneeList,
): SelectOption<string>[] {
  const people: UserRef[] = user.role === 'member' ? [{ id: user.id, name: user.name }] : [...assignees.users];
  const current = task?.assignee;
  const currentMissing = current && !people.some((person) => person.id === current.id);
  const options: SelectOption<string>[] = [
    { value: NOBODY, label: 'بدون مسئول' },
    ...people.map((person) => ({ value: person.id, label: person.id === user.id ? `${person.name} (من)` : person.name })),
  ];
  if (current && currentMissing) {
    const inactive = user.role !== 'member' && assignees.loaded;
    options.push({ value: current.id, label: inactive ? `${current.name} (غیرفعال)` : current.name });
  }
  return options;
}
