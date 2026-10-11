import { NextResponse, type NextRequest } from 'next/server';

/**
 * UX only: a visitor without an access cookie goes to /login instead of seeing an empty
 * shell. NestJS still checks every request (plan §3.2). Next.js 16 renamed the
 * `middleware` file convention to `proxy`; this is that file.
 *
 * The refresh cookie is scoped to /api/v1/auth and never reaches pages, so an expired
 * access cookie also lands on /login — which restores the session silently if it can.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has('access_token')) return NextResponse.next();

  const login = new URL('/login', request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== '/') login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the API proxy, the login page, Next internals and static files.
  matcher: ['/((?!api/|login|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
};
