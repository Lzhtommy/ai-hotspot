/**
 * Admin route-group layout — Phase 6 Plan 06-00 (ADMIN-01).
 *
 * Layer 2 of the defense-in-depth admin gate (see src/lib/auth/admin.ts and
 * src/middleware.ts for the full three-layer model). `requireAdmin()` is
 * the authoritative DB-backed role check — middleware is a cheap edge
 * filter, and per-action `assertAdmin()` guards are Layer 3.
 *
 * Every route under /admin inherits this gate. Sub-plans (06-02..06-05)
 * MUST NOT redeclare the check — they rely on the layout being reached only
 * after `requireAdmin()` has returned.
 *
 * `dynamic = 'force-dynamic'` because:
 *   - The payload is user- and role-specific; caching it at any tier would
 *     leak admin chrome to anonymous visitors.
 *   - Admin data (sources, users, costs) is mutation-heavy and must not
 *     be served stale.
 *
 * Consumed by:
 *   - src/app/admin/page.tsx
 *   - src/app/admin/sources/**        (Plan 06-02)
 *   - src/app/admin/users/**          (Plan 06-03)
 *   - src/app/admin/costs/**          (Plan 06-04)
 *   - src/app/admin/dead-letter/**    (Plan 06-05)
 */
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/admin';
import { AdminShell } from '@/components/admin/admin-shell';

// Admin data is always user-specific and role-gated. Never cache.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Loop-guard for /admin/access-denied. `requireAdmin()` redirects non-admin
  // users to that page, but the page ITSELF lives under /admin/* and therefore
  // re-enters this layout. Without this guard the redirect fires on every
  // request to /admin/access-denied, creating an infinite loop in the browser.
  //
  // The `x-pathname` header is set by src/middleware.ts on every /admin/*
  // request so the RSC layer can route on the incoming URL without the
  // (currently experimental) App-Router pathname APIs.
  const h = await headers();
  const pathname = h.get('x-pathname') ?? '';
  const isAccessDenied = pathname === '/admin/access-denied';

  if (isAccessDenied) {
    // Skip the admin gate on the access-denied page. We still attempt to read
    // the session so the shell can render the admin's name when an actual
    // admin stumbles in, but we do NOT redirect. Anonymous users hitting the
    // page directly are allowed through by middleware (which only bounces
    // anonymous traffic for non-access-denied admin paths); render an
    // anonymous-flavored shell for them.
    const session = await auth();
    const userName = session?.user?.name ?? session?.user?.email ?? '访客';
    return <AdminShell userName={userName}>{children}</AdminShell>;
  }

  const session = await requireAdmin();
  const userName = session.user.name ?? session.user.email ?? '管理员';
  return <AdminShell userName={userName}>{children}</AdminShell>;
}
