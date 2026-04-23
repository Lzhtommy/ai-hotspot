/**
 * Session helpers — Phase 5 AUTH-07.
 *
 * Thin wrappers around `auth()` for consistent null-checking in RSC pages
 * and server actions. Mirrors the ergonomics of Next.js's built-in helpers
 * while keeping the `@/lib/auth` barrel as the single source of truth.
 *
 * Consumed by:
 *   - src/app/(reader)/favorites/page.tsx (Plan 05-08 — auth-gated RSC)
 *   - src/server/actions/** (Plan 05-06 — server-action auth guards)
 */
import { redirect } from 'next/navigation';
import { auth } from './index';

/**
 * Returns the current session (or null if unauthenticated). Safe to call
 * from any RSC or server action — `auth()` returns null rather than throwing
 * when the session cookie is missing / expired / cleared by the callback.
 */
export async function getSession() {
  return auth();
}

/**
 * Enforces an authenticated session. Redirects to `redirectTo` (default '/')
 * when no session is present. Returns the live session on success.
 */
export async function requireSession(redirectTo = '/') {
  const session = await auth();
  if (!session?.user?.id) redirect(redirectTo);
  return session;
}
