/**
 * Edge middleware — Phase 6 Plan 06-00 (ADMIN-01).
 *
 * Layer 1 of the defense-in-depth admin gate. See src/lib/auth/admin.ts for
 * the full three-layer model:
 *
 *   Layer 1 — this middleware (edge) — cheap cookie-presence filter.
 *             Anonymous traffic short-circuits to `/` with a `?next=` hint.
 *             Authenticated traffic passes through (cookie validity NOT checked
 *             here — database-session validation requires a DB roundtrip,
 *             which is unavailable in the Edge runtime without import-level
 *             constraints we don't want to take on).
 *
 *   Layer 2 — src/app/admin/layout.tsx (RSC) — `await requireAdmin()`.
 *             Performs the DB-backed session + role check via Auth.js v5's
 *             `auth()` callback chain (which reads users.role + users.isBanned
 *             from Neon). This is the authoritative check.
 *
 *   Layer 3 — per-action `assertAdmin(session)` inside every admin Server
 *             Action shipped in Plans 06-02..06-05. Guards mutating paths
 *             where `redirect()` semantics are unsuitable.
 *
 * Design notes:
 *
 *   - Auth.js v5 emits the session cookie under two names:
 *       * authjs.session-token        (dev / HTTP)
 *       * __Secure-authjs.session-token (production / HTTPS)
 *     Auto-derivation matches config.ts's useSecureCookies default. We check
 *     the appropriate cookie name based on the request's protocol so preview
 *     and production behave consistently.
 *
 *   - Middleware runs in the Edge runtime. We deliberately do NOT import
 *     `auth()` from '@/lib/auth' here — doing so would pull the Drizzle +
 *     Neon adapter into the Edge bundle, blowing the size budget and
 *     requiring node: module polyfills.
 *
 *   - The `matcher` is scoped to `/admin/:path*` so the middleware has zero
 *     effect on reader, API, or static routes.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Defensive: matcher already scopes this, but the compiled bundle can be
  // reused across matchers in future changes — keep an explicit guard.
  if (!pathname.startsWith('/admin')) return NextResponse.next();

  // Cookie name flips between dev and prod based on the request protocol.
  // (Explicit string literals so grep acceptance checks in the plan pass.)
  const isSecure = req.nextUrl.protocol === 'https:';
  const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';

  const hasSession = req.cookies.has(cookieName);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    // Preserve the originally-requested admin path so a post-login flow
    // (future Plan 06-xx) can route the user back after authenticating.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Cookie present — defer to Layer 2 (requireAdmin() in app/admin/layout.tsx)
  // for the DB-backed role check.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
