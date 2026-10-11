'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from './api-client';

export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T };

/**
 * GET `path` through api() when it changes. `reload()` refetches and keeps the current
 * data on screen until the answer arrives (after a save); `retry()` shows loading again
 * (after an error). `path = null` means "do not fetch".
 */
export function useApiQuery<T>(path: string | null) {
  const [result, setResult] = useState<{ path: string; state: QueryState<T> } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let active = true;
    api<T>(path).then(
      (data) => {
        if (active) setResult({ path, state: { status: 'ready', data } });
      },
      (error: unknown) => {
        // On 401 api() is already navigating to /login; keep what is on screen until it does.
        if (active && !(error instanceof ApiError && error.status === 401)) {
          setResult({ path, state: { status: 'error', error } });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const retry = useCallback(() => {
    setResult(null);
    setVersion((v) => v + 1);
  }, []);

  const state: QueryState<T> = result && result.path === path ? result.state : { status: 'loading' };
  return { state, reload, retry };
}
