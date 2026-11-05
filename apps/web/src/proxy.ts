import { NextResponse, type NextRequest } from 'next/server';

import { loginUrlFor } from '@/lib/auth/next-path';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';

// Pages anyone may open. `/dev` only exists outside production (it answers 404 there).
const PUBLIC_PREFIXES = ['/login', '/careers', '/dev'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * An optimistic check: no session cookie, no page. It only saves a round trip, it is
 * not a permission check. The API decides what a signed-in user may see, and an
 * expired or forged cookie is rejected there (401 sends the user back to login).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname) || request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(
    new URL(loginUrlFor(`${pathname}${search}`), request.url),
  );
}

export const config = {
  // Not /api (the Route Handler forwards it, and the proxy would buffer upload
  // bodies), not Next's own assets, not files in /public.
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};
