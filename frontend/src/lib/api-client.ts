import type { ApiErrorBody, FieldError } from '@/types/api';

/**
 * Browser fetch to the Next.js proxy (/api/v1) — never to the backend directly.
 * On a 401 it refreshes the session once, retries once, and otherwise goes to /login.
 */

const API_PREFIX = '/api/v1';

/** A 401 from these means "no session / wrong password", never "access token expired". */
const NO_REFRESH = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }

  get details(): FieldError[] {
    return this.body.details;
  }
}

export interface ApiOptions extends Omit<RequestInit, 'body' | 'credentials'> {
  /** Sent as the JSON body. */
  json?: unknown;
  /** Go to /login when the session cannot be restored. Default true. */
  redirectOnUnauthorized?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, redirectOnUnauthorized = true, ...init } = options;
  const headers = new Headers(init.headers);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  const send = () =>
    request(API_PREFIX + path, {
      ...init,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
    });

  let res = await send();
  if (res.status === 401 && !NO_REFRESH.has(path.split('?')[0])) {
    if (await refreshSession()) res = await send();
    if (res.status === 401 && redirectOnUnauthorized) goToLogin();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

let refreshing: Promise<boolean> | null = null;

/**
 * One refresh at a time. Parallel 401s in this tab share one promise, and a Web Lock
 * queues other tabs: two refreshes with the same token look like a stolen token to the
 * backend, which then revokes every session. A queued tab sends the rotated cookie.
 * Resolves false when the session is gone; throws when the backend is unreachable.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= exclusive(async () => {
    const res = await request(`${API_PREFIX}/auth/refresh`, { method: 'POST' });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403) return false;
    throw await toApiError(res);
  }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  // navigator.locks exists only in secure contexts (HTTPS, localhost, 127.0.0.1).
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('taskboard-auth-refresh', task)
    : task();
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, credentials: 'same-origin' });
  } catch {
    // The Next.js server itself is unreachable (offline, stopped).
    throw new ApiError(0, { statusCode: 0, error: 'Network Error', message: 'Network error', details: [] });
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (typeof body.message === 'string') {
      return new ApiError(res.status, {
        statusCode: res.status,
        error: body.error ?? res.statusText,
        message: body.message,
        details: Array.isArray(body.details) ? body.details : [],
      });
    }
  } catch {
    // Not JSON; fall through to a generic body.
  }
  return new ApiError(res.status, { statusCode: res.status, error: res.statusText, message: res.statusText, details: [] });
}

function goToLogin(): void {
  const here = window.location.pathname + window.location.search;
  // Not a React module, so no router; a full navigation also drops the old user's state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(here)}`);
}

/** A Persian sentence for errors that are not field errors. */
export function describeError(err: unknown): string {
  const status = err instanceof ApiError ? err.status : -1;
  if (status === 0) return 'اتصال برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.';
  if (status === 429) return 'تلاش‌ها بیش از حد مجاز بود. یک دقیقه صبر کنید و دوباره تلاش کنید.';
  if (status === 502) return 'سرور در دسترس نیست. کمی بعد دوباره تلاش کنید.';
  if (status === 504) return 'پاسخ سرور بیش از حد طول کشید. دوباره تلاش کنید.';
  if (status === 403) return 'اجازهٔ انجام این کار را ندارید.';
  return 'مشکلی پیش آمد. دوباره تلاش کنید.';
}

/**
 * Field errors from a 400 `details` list, keyed by field, with the Persian sentence from
 * `messages`. Only the fields in `messages` are kept, because the form shows nothing for
 * the others; when any other field was rejected, `otherError` is a form-level sentence.
 */
export function fieldErrors(
  err: unknown,
  messages: Record<string, string>,
): { fields: Record<string, string>; otherError: string | null } {
  const fields: Record<string, string> = {};
  let other = false;
  if (!(err instanceof ApiError) || err.status !== 400) return { fields, otherError: null };
  for (const { field } of err.details) {
    if (Object.hasOwn(messages, field)) fields[field] = messages[field];
    else other = true;
  }
  return { fields, otherError: other ? 'اطلاعات فرم پذیرفته نشد. دوباره تلاش کنید.' : null };
}
