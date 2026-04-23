/**
 * Admin gate helpers — Phase 6 Plan 06-00 (ADMIN-01).
 *
 * `requireAdmin()` is the RSC/route-handler boundary check used by
 * `src/app/admin/layout.tsx` (and any future admin-only route that needs
 * its own direct guard). It consults `auth()` (DB-backed under our
 * database-session strategy), then:
 *
 *   - redirect('/')                       if the request is anonymous
 *   - redirect('/admin/access-denied')    if authenticated but role !== 'admin'
 *   - returns the typed AdminSession      if the user is an admin
 *
 * `assertAdmin(session)` is the Server-Action counterpart — Server Actions
 * cannot use `redirect()` to gate writes cleanly (the redirect throws a
 * sentinel that swallows the action result), so mutating admin Server
 * Actions should fetch `session` once (via `auth()` or `getSession()`),
 * then call `assertAdmin(session)` which throws a structured
 * `AdminAuthError` on unauthorized paths.
 *
 * Both helpers are the Layer 2 / Layer 3 of the defense-in-depth gate
 * described in the plan's threat model (T-6-01, T-6-02). Layer 1 is
 * `src/middleware.ts`, which only cheaply filters anonymous traffic at
 * the edge based on session-cookie presence.
 *
 * Consumed by:
 *   - src/app/admin/layout.tsx                       (requireAdmin)
 *   - src/app/admin/**                               (future sub-routes)
 *   - src/server/actions/admin/**                    (future Server Actions → assertAdmin)
 *   - tests/unit/admin-gate.test.ts
 */
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth } from './index';

/**
 * Narrowed session shape where `user.role === 'admin'` is proven.
 * `assertAdmin(session)` is declared as an assertion function so callers
 * can treat `session` as `AdminSession` after the call without a cast.
 */
export type AdminSession = Session & {
  user: NonNullable<Session['user']> & { id: string; role: 'admin' };
};

function roleOf(user: unknown): string | undefined {
  if (!user || typeof user !== 'object') return undefined;
  const r = (user as { role?: unknown }).role;
  return typeof r === 'string' ? r : undefined;
}

/**
 * RSC / page-level gate. Intended for `layout.tsx` and route-level
 * Components. Callers that live inside Server Actions or API route
 * handlers (where `redirect()` semantics are awkward) should instead
 * call `assertAdmin(session)` on an already-fetched session object.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  if (roleOf(session.user) !== 'admin') redirect('/admin/access-denied');
  return session as AdminSession;
}

/**
 * Structured error thrown by `assertAdmin`. Two discriminants:
 *   - 'UNAUTHENTICATED' — no session (or session without user id)
 *   - 'FORBIDDEN'       — session present, but user is not an admin
 *
 * Callers that want to translate these into HTTP-style responses can
 * switch on `err.code`; Server Actions should catch this error and
 * surface `{ ok: false, error: 'UNAUTHENTICATED' | 'FORBIDDEN' }`
 * instead of leaking the thrown instance to the client boundary.
 */
export class AdminAuthError extends Error {
  public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';

  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(code);
    this.name = 'AdminAuthError';
    this.code = code;
  }
}

/**
 * Server-Action gate. Asserts that `session` represents an authenticated
 * admin; throws `AdminAuthError` otherwise. Declared as an assertion
 * function so that `session` narrows to `AdminSession` after the call.
 */
export function assertAdmin(session: Session | null): asserts session is AdminSession {
  if (!session?.user?.id) throw new AdminAuthError('UNAUTHENTICATED');
  if (roleOf(session.user) !== 'admin') throw new AdminAuthError('FORBIDDEN');
}
