'use client';

import { NoSymbolIcon, PencilIcon, CheckCircleIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { ActionMenu, type MenuAction } from '@/components/ui/menu';
import { ROLE_LABELS } from '@/lib/labels';
import type { User } from '@/types/api';

type UsersTableProps = {
  users: User[];
  currentUserId: string;
  onEdit: (user: User) => void;
  onDisable: (user: User) => void;
  onEnable: (user: User) => void;
  /** Id of the user whose enable request is in flight. */
  busyId: string | null;
};

export function UsersTable({ users, currentUserId, onEdit, onDisable, onEnable, busyId }: UsersTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">فهرست کاربران</caption>
        <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              نام
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              ایمیل
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              نقش
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              وضعیت
            </th>
            <th scope="col" className="w-14 px-2 py-3">
              <span className="sr-only">گزینه‌ها</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {users.map((user) => {
            const actions: MenuAction[] = [{ label: 'ویرایش', icon: PencilIcon, onSelect: () => onEdit(user) }];
            if (busyId !== user.id) {
              actions.push(
                user.isActive
                  ? { label: 'غیرفعال کردن', icon: NoSymbolIcon, danger: true, onSelect: () => onDisable(user) }
                  : { label: 'فعال کردن', icon: CheckCircleIcon, onSelect: () => onEnable(user) },
              );
            }
            return (
              <tr key={user.id} className={clsx(!user.isActive && 'bg-neutral-50')}>
                <td className="px-4 py-3 font-medium text-neutral-900">
                  <bdi dir="auto">{user.name}</bdi>
                  {user.id === currentUserId && <span className="ms-2 text-xs font-normal text-neutral-600">(شما)</span>}
                </td>
                <td className="px-4 py-3 text-neutral-800">
                  <bdi dir="ltr">{user.email}</bdi>
                </td>
                <td className="px-4 py-3 text-neutral-800">{ROLE_LABELS[user.role]}</td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                      user.isActive ? 'bg-done-50 text-done-800 ring-done-200' : 'bg-neutral-100 text-neutral-700 ring-neutral-300',
                    )}
                  >
                    <span aria-hidden="true" className={clsx('size-1.5 rounded-full', user.isActive ? 'bg-done-500' : 'bg-neutral-400')} />
                    {busyId === user.id ? 'در حال فعال‌سازی…' : user.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <ActionMenu label={`گزینه‌های کاربر «${user.name}»`} actions={actions} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
