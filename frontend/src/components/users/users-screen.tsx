'use client';

import { UserPlusIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useState } from 'react';
import { useCurrentUser } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogActions } from '@/components/ui/dialog';
import { StatePanel } from '@/components/ui/state-panel';
import { ApiError, api, describeError } from '@/lib/api-client';
import { canManageUsers } from '@/lib/permissions';
import { useApiQuery } from '@/lib/use-api-query';
import type { User } from '@/types/api';
import { UserFormDialog } from './user-form-dialog';
import { UsersTable } from './users-table';

const LAST_OWNER_DISABLE = 'این کاربر آخرین مالک فعال است و نمی‌توان او را غیرفعال کرد.';

/** Owner-only user management. Other roles see the forbidden state; GET /users is 403 for them anyway. */
export function UsersScreen() {
  const me = useCurrentUser();
  const allowed = canManageUsers(me);
  const users = useApiQuery<User[]>(allowed ? '/users' : null);

  const [message, setMessage] = useState('');
  const [form, setForm] = useState<{ open: boolean; user: User | null; key: number }>({ open: false, user: null, key: 0 });
  const [disabling, setDisabling] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [enablingId, setEnablingId] = useState<string | null>(null);

  const forbidden =
    !allowed || (users.state.status === 'error' && users.state.error instanceof ApiError && users.state.error.status === 403);

  if (forbidden) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-neutral-900">کاربران</h1>
        <StatePanel
          title="به این صفحه دسترسی ندارید."
          action={
            <Link
              href="/tasks"
              className="rounded-lg text-sm font-medium text-accent-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              رفتن به کارها
            </Link>
          }
        >
          فقط مالک می‌تواند کاربران را ببیند و مدیریت کند.
        </StatePanel>
      </div>
    );
  }

  async function enable(user: User) {
    setMessage('');
    setEnablingId(user.id);
    try {
      await api<User>(`/users/${user.id}`, { method: 'PATCH', json: { isActive: true } });
      setMessage(`«${user.name}» فعال شد و می‌تواند وارد شود.`);
      users.reload();
    } catch (err) {
      setMessage(`«${user.name}» فعال نشد. ${describeError(err)}`);
    } finally {
      setEnablingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">کاربران</h1>
        <Button
          onClick={() => {
            setMessage('');
            setForm((prev) => ({ open: true, user: null, key: prev.key + 1 }));
          }}
        >
          <UserPlusIcon aria-hidden="true" className="size-5" />
          کاربر جدید
        </Button>
      </div>

      <p role="status" className="mt-4 text-sm text-neutral-800 empty:hidden">
        {message}
      </p>

      <div className="mt-5">
        {users.state.status === 'loading' && <TableSkeleton />}
        {users.state.status === 'error' && (
          <StatePanel
            role="alert"
            tone="danger"
            title="فهرست کاربران بارگذاری نشد."
            action={<Button onClick={users.retry}>تلاش دوباره</Button>}
          >
            {describeError(users.state.error)}
          </StatePanel>
        )}
        {users.state.status === 'ready' &&
          (users.state.data.length === 0 ? (
            <StatePanel title="هنوز کاربری ثبت نشده" />
          ) : (
            <UsersTable
              users={users.state.data}
              currentUserId={me.id}
              busyId={enablingId}
              onEdit={(user) => {
                setMessage('');
                setForm((prev) => ({ open: true, user, key: prev.key + 1 }));
              }}
              onDisable={(user) => {
                setMessage('');
                setDisabling({ open: true, user });
              }}
              onEnable={enable}
            />
          ))}
      </div>

      <UserFormDialog
        open={form.open}
        user={form.user}
        formKey={form.key}
        onClose={() => setForm((prev) => ({ ...prev, open: false }))}
        onSaved={(saved, created) => {
          setForm((prev) => ({ ...prev, open: false }));
          setMessage(created ? `کاربر «${saved.name}» ساخته شد.` : `تغییرات «${saved.name}» ذخیره شد.`);
          users.reload();
        }}
      />
      <DisableUserDialog
        open={disabling.open}
        user={disabling.user}
        isSelf={disabling.user?.id === me.id}
        onClose={() => setDisabling((prev) => ({ ...prev, open: false }))}
        onDone={(user) => {
          setDisabling((prev) => ({ ...prev, open: false }));
          setMessage(`«${user.name}» غیرفعال شد.`);
          // Disabling yourself ends your own session: this reload gets a 401 and goes to /login.
          users.reload();
        }}
      />
    </div>
  );
}

type DisableUserDialogProps = {
  open: boolean;
  user: User | null;
  isSelf: boolean;
  onClose: () => void;
  onDone: (user: User) => void;
};

function DisableUserDialog({ open, user, isSelf, onClose, onDone }: DisableUserDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!user || pending) return;
    setPending(true);
    setError(null);
    try {
      await api<User>(`/users/${user.id}`, { method: 'PATCH', json: { isActive: false } });
      setPending(false);
      onDone(user);
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError && err.status === 409 ? LAST_OWNER_DISABLE : describeError(err));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="غیرفعال کردن کاربر"
      description={
        <>
          «<bdi dir="auto">{user?.name}</bdi>» دیگر نمی‌تواند وارد شود و همین حالا از همهٔ دستگاه‌ها خارج می‌شود.
          کارهایش حذف نمی‌شوند و هر وقت بخواهید می‌توانید دوباره فعالش کنید.
          {isSelf && <strong className="mt-2 block text-danger-800">این حساب خودتان است؛ بلافاصله از برنامه خارج می‌شوید.</strong>}
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
          {pending ? 'در حال غیرفعال کردن…' : 'غیرفعال کردن'}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={close}>
          انصراف
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TableSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        در حال بارگذاری کاربران…
      </p>
      <div aria-hidden="true" className="animate-pulse overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="h-11 border-b border-neutral-200 bg-neutral-50" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-6 border-b border-neutral-100 px-4 py-4 last:border-0">
            <div className="h-4 w-32 rounded bg-neutral-200" />
            <div className="h-4 w-44 rounded bg-neutral-100" />
            <div className="h-4 w-16 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </>
  );
}
