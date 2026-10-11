'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, api, describeError } from '@/lib/api-client';
import type { AuthUser } from '@/types/api';
import { AppHeader } from './app-header';

const CurrentUserContext = createContext<AuthUser | null>(null);

/** The signed-in user. Only for showing or hiding UI; NestJS enforces every rule. */
export function useCurrentUser(): AuthUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser must be used inside <AppShell>');
  return user;
}

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; user: AuthUser };

/** Loads GET /auth/me once, then renders the header and the page. */
export function AppShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api<AuthUser>('/auth/me').then(
      (user) => {
        if (active) setState({ status: 'ready', user });
      },
      (err: unknown) => {
        // On 401 api() is already navigating to /login; keep the skeleton until it does.
        if (active && !(err instanceof ApiError && err.status === 401)) {
          setState({ status: 'error', message: describeError(err) });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state.status === 'loading') return <ShellSkeleton />;

  if (state.status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div role="alert" className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm text-neutral-800">{state.message}</p>
          <Button
            className="mt-4"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            تلاش دوباره
          </Button>
        </div>
      </main>
    );
  }

  return (
    <CurrentUserContext.Provider value={state.user}>
      <AppHeader user={state.user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </CurrentUserContext.Provider>
  );
}

function ShellSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        در حال بارگذاری…
      </p>
      <div aria-hidden="true" className="animate-pulse">
        <div className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <div className="h-5 w-24 rounded-lg bg-neutral-200" />
            <div className="h-9 w-40 rounded-lg bg-neutral-200" />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="h-7 w-32 rounded-lg bg-neutral-200" />
          <div className="mt-6 h-48 rounded-xl bg-neutral-100" />
        </div>
      </div>
    </>
  );
}
