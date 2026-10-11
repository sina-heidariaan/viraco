'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ApiError, api, describeError, fieldErrors } from '@/lib/api-client';
import type { AuthUser } from '@/types/api';

type Field = 'email' | 'password';

/** Persian text for server field errors; the backend sends English validator messages. */
const SERVER_FIELD_MESSAGES: Record<Field, string> = {
  email: 'یک ایمیل معتبر وارد کنید.',
  password: 'رمز عبور معتبر نیست.',
};

/**
 * Only paths on this site, so ?next= cannot send the user somewhere else. The URL parser
 * applies the browser's own rules (it drops tabs and newlines, reads `\` as `/`), so
 * prefix checks cannot be fooled. Runs during render on the server too: no `window`.
 */
function safeNext(raw: string | null): string {
  const base = 'http://local';
  try {
    const url = new URL(raw ?? '', base);
    // `/.//evil.com` parses to the path `//evil.com`, which the browser reads as a host.
    if (!raw || url.origin !== base || url.pathname.startsWith('//') || url.pathname.startsWith('/login')) {
      return '/tasks';
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return '/tasks';
  }
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The redirect lands here when the access cookie has expired. If the refresh cookie is
  // still valid, api() restores the session and the user goes straight back.
  useEffect(() => {
    let active = true;
    api<AuthUser>('/auth/me', { redirectOnUnauthorized: false }).then(
      () => {
        if (active) router.replace(next);
      },
      () => {
        if (active) setChecking(false);
      },
    );
    return () => {
      active = false;
    };
  }, [router, next]);

  function showFieldErrors(found: Partial<Record<Field, string>>): boolean {
    setErrors(found);
    const first = (['email', 'password'] as const).find((f) => found[f]);
    if (first) (first === 'email' ? emailRef : passwordRef).current?.focus();
    return first !== undefined;
  }

  function clearError(field: Field) {
    if (!errors[field]) return;
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest[field];
      return rest;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    setFormError(null);
    const missing: Partial<Record<Field, string>> = {};
    if (!email) missing.email = 'ایمیل را وارد کنید.';
    if (!password) missing.password = 'رمز عبور را وارد کنید.';
    if (showFieldErrors(missing)) return;

    setPending(true);
    try {
      await api<AuthUser>('/auth/login', { method: 'POST', json: { email, password } });
      router.replace(next); // stays pending until the next page renders
    } catch (err) {
      const { fields, otherError } = fieldErrors(err, SERVER_FIELD_MESSAGES);
      if (!showFieldErrors(fields) || otherError) {
        // One sentence for wrong email, wrong password and disabled account alike (plan §5.2).
        setFormError(
          otherError ??
            (err instanceof ApiError && err.status === 401 ? 'ایمیل یا رمز عبور درست نیست.' : describeError(err)),
        );
      }
      setPending(false);
    }
  }

  if (checking) {
    return (
      <p role="status" className="py-10 text-center text-sm text-neutral-600">
        در حال بررسی ورود…
      </p>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      {/* Always in the DOM so screen readers announce the message when it appears. */}
      <div role="alert">
        {formError && (
          <p className="mb-5 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
            {formError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <TextField
          ref={emailRef}
          label="ایمیل"
          name="email"
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.email}
          onChange={() => clearError('email')}
        />
        <TextField
          ref={passwordRef}
          label="رمز عبور"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          error={errors.password}
          onChange={() => clearError('password')}
        />
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? 'در حال ورود…' : 'ورود'}
        </Button>
      </div>
    </form>
  );
}
