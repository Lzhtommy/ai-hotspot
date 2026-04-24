/**
 * Admin users repository — Phase 6 Plan 06-03 (ADMIN-07, ADMIN-08).
 *
 * Pure data layer for the /admin/users surface. Three public operations:
 *
 *   - listUsersForAdmin(): returns every user with email/role/ban state plus
 *     the set of OAuth providers derived from a LEFT JOIN on `accounts`.
 *     Users registered via Resend (magic-link only) have no accounts rows
 *     and get `providers: []` — the UI renders that as "邮箱 (magic-link)".
 *
 *   - banUserCore({ targetUserId, adminUserId }): runs a SINGLE db transaction
 *     that (1) flips is_banned=true + writes audit columns, then (2) deletes
 *     every row from the `sessions` table for that user. Auth.js v5 uses a
 *     database session strategy — clearing the sessions row makes the user's
 *     cookie resolve to `null` on the very next request, which is what the
 *     Phase 6 success criterion "banning a user revokes their session" requires
 *     (is_banned alone only takes effect on the next session refresh). The
 *     transaction ensures no half-banned state (T-6-33).
 *
 *   - unbanUserCore({ targetUserId }): clears is_banned + banned_at + banned_by.
 *     Does NOT restore the deleted sessions rows — an unbanned user must sign
 *     in again. This is deliberate: re-creating sessions server-side without
 *     the user's cookie would be meaningless, and the explicit sign-in step
 *     also gives the user a chance to see any post-ban UI they missed.
 *
 * Both `core` variants accept an optional injected `db` for unit tests — the
 * real client is `@/lib/db/client#db` under neon-serverless Pool, which supports
 * `db.transaction(tx => ...)` (verified fix 5be492b from Plan 03-05).
 *
 * Consumed by:
 *   - src/server/actions/admin-users.ts       (assertAdmin + revalidatePath)
 *   - src/app/admin/users/page.tsx            (list rendering)
 *   - tests/unit/admin-users.test.ts
 *   - tests/integration/ban-revokes-sessions.test.ts
 *
 * Threat coverage:
 *   - T-6-30  SelfBanError prevents admin self-lockout.
 *   - T-6-32  Session revocation atomic with is_banned flip.
 *   - T-6-33  db.transaction() rollback on either failure — no half-banned state.
 */
import { and, eq, sql as dsql } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { users, sessions } from '@/lib/db/schema';

export class SelfBanError extends Error {
  constructor() {
    super('SELF_BAN');
    this.name = 'SelfBanError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('NOT_FOUND');
    this.name = 'UserNotFoundError';
  }
}

/**
 * Thrown when banUserCore is invoked on a user whose `is_banned` is already
 * true. The UsersTable UI hides the ban button on banned rows (it shows
 * 解封 instead) — but a hand-crafted POST or a race between two admins could
 * still re-invoke the ban path. Short-circuiting preserves the original
 * `banned_at` / `banned_by` audit record rather than overwriting it with the
 * second admin's id. See 06-REVIEW WR-05.
 */
export class AlreadyBannedError extends Error {
  constructor() {
    super('ALREADY_BANNED');
    this.name = 'AlreadyBannedError';
  }
}

export interface UserAdminRow {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  isBanned: boolean;
  bannedAt: Date | null;
  bannedBy: string | null;
  createdAt: Date;
  /** OAuth providers aggregated from `accounts`; empty for magic-link-only users. */
  providers: string[];
}

type DbLike = typeof realDb;

/**
 * Returns every user row — sorted newest-first — with the OAuth providers
 * aggregated from `accounts` via `array_agg(...) FILTER (WHERE ... IS NOT NULL)`.
 * Using FILTER instead of a plain array_agg keeps the result `[]` (not `[null]`)
 * for users with zero linked accounts, which matches the UI's expectation.
 */
export async function listUsersForAdmin(deps: { db?: DbLike } = {}): Promise<UserAdminRow[]> {
  const d = deps.db ?? realDb;
  // Raw SQL (not drizzle-select) because the accounts column is quoted
  // camelCase ("userId") per Auth.js adapter convention — drizzle's query
  // builder LEFT JOIN on that is awkward. The execute() shape matches the
  // claimPendingItems pattern in src/trigger/process-pending.ts (neon Pool
  // returns { rows: [...] }).
  const result = (await d.execute(dsql`
    SELECT u.id, u.email, u.name, u.role, u.is_banned, u.banned_at, u.banned_by, u.created_at,
           COALESCE(
             array_agg(DISTINCT a.provider) FILTER (WHERE a.provider IS NOT NULL),
             ARRAY[]::text[]
           ) AS providers
    FROM users u
    LEFT JOIN accounts a ON a."userId" = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `)) as unknown as { rows: Array<Record<string, unknown>> };

  return result.rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
    name: (r.name as string | null) ?? null,
    role: r.role as 'user' | 'admin',
    isBanned: Boolean(r.is_banned),
    bannedAt:
      r.banned_at == null
        ? null
        : r.banned_at instanceof Date
          ? r.banned_at
          : new Date(r.banned_at as string),
    bannedBy: (r.banned_by as string | null) ?? null,
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at as string),
    providers: Array.isArray(r.providers) ? (r.providers as string[]) : [],
  }));
}

/**
 * Atomically bans a user AND revokes every live session. Throws:
 *   - SelfBanError       if targetUserId === adminUserId
 *   - UserNotFoundError  if the target row does not exist (the UPDATE returns zero)
 *
 * The two writes happen inside a single db.transaction — if either side
 * throws, neither write persists (RDBMS atomicity).
 */
export async function banUserCore(
  input: { targetUserId: string; adminUserId: string },
  deps: { db?: DbLike } = {},
): Promise<void> {
  // Self-ban guard: checked BEFORE opening the transaction so an admin
  // mistakenly clicking their own row never racks up a DB round-trip.
  if (input.targetUserId === input.adminUserId) {
    throw new SelfBanError();
  }

  const d = deps.db ?? realDb;
  await d.transaction(async (tx) => {
    // STEP 1 — flip is_banned and write audit columns. The WHERE clause
    // includes `is_banned = false` so a second admin re-banning an already-
    // banned user matches zero rows (rather than overwriting the original
    // banned_at / banned_by audit with the re-banning admin's id). The
    // surrounding transaction + AlreadyBannedError thrown below makes this
    // distinguishable from "target user doesn't exist". See 06-REVIEW WR-05.
    const updated = await tx
      .update(users)
      .set({
        isBanned: true,
        bannedAt: new Date(),
        bannedBy: input.adminUserId,
      })
      .where(and(eq(users.id, input.targetUserId), eq(users.isBanned, false)))
      .returning({ id: users.id });

    if (updated.length === 0) {
      // Disambiguate the two zero-row causes so callers can surface the right
      // error copy: "already banned" vs "user not found".
      const existing = await tx
        .select({ isBanned: users.isBanned })
        .from(users)
        .where(eq(users.id, input.targetUserId))
        .limit(1);
      // Throwing inside the transaction aborts it — the DELETE never runs.
      if (existing.length === 0) throw new UserNotFoundError();
      throw new AlreadyBannedError();
    }

    // STEP 2 — revoke every active session (T-6-32). Auth.js v5 DB-session
    // strategy: no row → session() callback gets no user → returns null →
    // the user's cookie is treated as anonymous on the next request.
    await tx.delete(sessions).where(eq(sessions.userId, input.targetUserId));
  });
}

/**
 * Clears the three ban columns. Does NOT restore previously-deleted sessions
 * — the user must sign in again. Idempotent: running on an already-unbanned
 * user is a harmless no-op UPDATE.
 */
export async function unbanUserCore(
  input: { targetUserId: string },
  deps: { db?: DbLike } = {},
): Promise<void> {
  const d = deps.db ?? realDb;
  await d
    .update(users)
    .set({
      isBanned: false,
      bannedAt: null,
      bannedBy: null,
    })
    .where(eq(users.id, input.targetUserId));
}
