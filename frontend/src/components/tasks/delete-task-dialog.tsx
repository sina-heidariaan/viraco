'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogActions } from '@/components/ui/dialog';
import { ApiError, api, describeError } from '@/lib/api-client';
import type { Todo } from '@/types/api';

type DeleteTaskDialogProps = {
  open: boolean;
  task: Todo | null;
  onClose: () => void;
  onDeleted: (task: Todo) => void;
  /** The task was already gone or is no longer visible (404). */
  onMissing: () => void;
};

/** Names the task and says the delete is permanent; the confirm button says the verb. */
export function DeleteTaskDialog({ open, task, onClose, onDeleted, onMissing }: DeleteTaskDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!task || pending) return;
    setPending(true);
    setError(null);
    try {
      await api<void>(`/todos/${task.id}`, { method: 'DELETE' });
      setPending(false);
      onDeleted(task);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 404) onMissing();
      else setError(describeError(err));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="حذف کار"
      description={
        <>
          کار «<bdi dir="auto">{task?.title}</bdi>» برای همیشه حذف می‌شود. این کار برگشت‌پذیر نیست.
        </>
      }
    >
      <div role="alert">
        {error && (
          <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">{error}</p>
        )}
      </div>
      <DialogActions>
        <Button variant="danger" disabled={pending} onClick={confirm}>
          {pending ? 'در حال حذف…' : 'حذف کار'}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={close}>
          انصراف
        </Button>
      </DialogActions>
    </Dialog>
  );
}
