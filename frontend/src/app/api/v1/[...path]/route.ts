import type { NextRequest } from 'next/server';

/**
 * THE proxy to NestJS (plan §4.1). The browser only calls /api/v1/*; the backend URL
 * stays on the server. Forwards method, path, query, body, Cookie, Content-Type and the
 * client IP. Returns status, body, Content-Type and every Set-Cookie header unchanged.
 */

const PREFIX = '/api/v1';
const TIMEOUT_MS = 10_000;
// The backend accepts 256 KB; anything far above that is refused before it is buffered.
const MAX_BODY_BYTES = 512 * 1024;

function errorResponse(statusCode: number, error: string, message: string): Response {
  return Response.json(
    { statusCode, error, message, details: [] },
    { status: statusCode, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** CSRF backstop: a state-changing request must come from this app's own pages. */
function isForeignOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (origin !== null) {
    try {
      return new URL(origin).host !== req.headers.get('host');
    } catch {
      return true; // "null" or garbage
    }
  }
  // No Origin header: browsers still send Sec-Fetch-Site, so a cross-site request is caught.
  // Neither header means a non-browser client, which cannot carry a victim's cookies.
  const site = req.headers.get('sec-fetch-site');
  return site !== null && site !== 'same-origin';
}

async function forward(req: NextRequest): Promise<Response> {
  if (req.method !== 'GET' && isForeignOrigin(req)) {
    return errorResponse(403, 'Forbidden', 'Cross-origin request rejected');
  }

  const backend = process.env.BACKEND_URL;
  if (!backend) {
    console.error('[api proxy] BACKEND_URL is not set');
    return errorResponse(502, 'Bad Gateway', 'Backend unavailable');
  }

  const headers = new Headers();
  for (const name of ['cookie', 'content-type']) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  // server.mjs overwrites this with the socket address, so any client-sent value is gone.
  const clientIp = req.headers.get('x-forwarded-for');
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET') {
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return errorResponse(413, 'Payload Too Large', 'Request body too large');
    }
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > MAX_BODY_BYTES) {
      return errorResponse(413, 'Payload Too Large', 'Request body too large');
    }
    if (bytes.byteLength > 0) body = bytes;
  }

  const target = backend.replace(/\/+$/, '') + req.nextUrl.pathname.slice(PREFIX.length) + req.nextUrl.search;

  let upstream: Response;
  let payload: ArrayBuffer;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    payload = await upstream.arrayBuffer();
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    console.error(`[api proxy] ${req.method} ${req.nextUrl.pathname}: ${timedOut ? 'timeout' : 'unreachable'}`);
    return timedOut
      ? errorResponse(504, 'Gateway Timeout', 'Backend did not respond in time')
      : errorResponse(502, 'Bad Gateway', 'Backend unavailable');
  }

  const out = new Headers({ 'Cache-Control': 'no-store' });
  const contentType = upstream.headers.get('content-type');
  if (contentType) out.set('content-type', contentType);
  // Login and refresh set two cookies (access on /, refresh on /api/v1/auth); keep each one intact.
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', cookie);

  const noBody = upstream.status === 204 || upstream.status === 304;
  return new Response(noBody ? null : payload, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
