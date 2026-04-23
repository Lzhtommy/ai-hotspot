/**
 * Auth guard — Phase 5 AUTH-07, D-05 Layer 2.
 *
 * Pure deps-injected function: caller supplies the Auth.js session (from `auth()`)
 * and optionally a db override. With database session strategy the session is
 * fresh on every request, but we defensively re-read `users.is_banned` here to
 * close the short window between a ban being flipped and the stale session
 * cookie expiring (belt-and-suspenders per CONTEXT §D-05).
 *
 * Throws `AuthError` with a `code` discriminant:
 *   - 'UNAUTHENTICATED'  → no session / no user.id           (client opens login modal)
 *   - 'FORBIDDEN'        → user row missing or is_banned=true (client shows generic error)
 *
 * Consumed by:
 *   - src/server/actions/favorites.ts
 *   - src/server/actions/votes.ts
 *   - tests/integration/server-action-auth-guard.test.ts
 */
import { eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import type { Session } from 'next-auth';

export type AuthErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN';

export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthError';
    this.code = code;
  }
}

export interface RequireLiveUserDeps {
  db?: typeof realDb;
}

/**
 * Resolves a session to a live user id, or throws `AuthError`.
 *
 * Pure (modulo the DB read) — no next/cache, no auth() call, no revalidatePath.
 * Server-action adapters are responsible for wrapping this in `'use server'`
 * and injecting the live `auth()` result.
 */
export async function requireLiveUserCore(
  session: Session | null,
  deps?: RequireLiveUserDeps,
): Promise<string> {
  const userId = session?.user?.id;
  if (!userId) {
    throw new AuthError('UNAUTHENTICATED');
  }

  const dbx = deps?.db ?? realDb;
  const rows = await dbx
    .select({ isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, userId));
  const row = rows[0];
  if (!row || row.isBanned) {
    throw new AuthError('FORBIDDEN');
  }
  return userId;
}
