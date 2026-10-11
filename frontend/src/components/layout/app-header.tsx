'use client';

import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, describeError } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/labels';
import type { AuthUser } from '@/types/api';

export function AppHeader({ user }: { user: AuthUser }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setPending(true);
    setError(null);
    try {
      await api<void>('/auth/logout', { method: 'POST' });
      // A full navigation drops all in-memory state of the signed-in user.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    } catch (err) {
      // Cookies are only cleared when the backend answers, so do not pretend it worked.
      setError(describeError(err));
      setPending(false);
    }
  }

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/tasks"
          className="shrink-0 rounded-lg text-base font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
        >
          تخته کارها
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <bdi dir="auto" className="block truncate font-medium text-neutral-900">
              {user.name}
            </bdi>
            <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700 ring-1 ring-accent-200 ring-inset">
              <span className="sr-only">نقش: </span>
              {ROLE_LABELS[user.role]}
            </span>
          </p>
          <Button variant="secondary" onClick={logout} disabled={pending} className="shrink-0">
            <ArrowRightStartOnRectangleIcon aria-hidden="true" className="size-5 text-neutral-500 rtl:-scale-x-100" />
            {pending ? 'در حال خروج…' : 'خروج'}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mx-auto max-w-6xl px-4 pb-3 text-sm text-danger-700 sm:px-6">
          {error}
        </p>
      )}
    </header>
  );
}
