/**
 * seed-session — Phase 5 Wave 0.
 *
 * Inserts a row into the Auth.js `sessions` table on the active Neon branch
 * and returns the sessionToken + userId + a Playwright storageState cookie shape.
 *
 * IMPORTANT: This helper depends on Plan 05-01 having created the `sessions`
 * adapter table. In Wave 0 the table does not yet exist; callers should catch
 * the resulting DB error and skip. See 05-PATTERNS.md §14 (no-analog / fresh).
 *
 * Consumed by:
 *   - tests/e2e/*.spec.ts (via Playwright storageState)
 *   - tests/integration/ban-enforcement.test.ts (cookie-level assertions)
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { makeTestDb } from './db';

export interface SeededSession {
  sessionToken: string;
  userId: string;
  /**
   * Playwright storageState cookie entry for `authjs.session-token`.
   * Pass directly into `browser.newContext({ storageState: { cookies: [cookie], origins: [] } })`.
   */
  cookie: {
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Lax' | 'Strict' | 'None';
    expires: number;
  };
}

export interface SeedSessionOptions {
  userId: string;
  /** ms until expiry. Default: 30 days. */
  ttlMs?: number;
  /** Cookie domain. Default: 'localhost'. */
  domain?: string;
}

/**
 * Inserts a `sessions` row for the given user and returns the cookie shape.
 *
 * Requires:
 *   - DATABASE_URL set to a non-prod Neon branch
 *   - `sessions` adapter table exists (Plan 05-01)
 *   - `users` row with id === options.userId already present
 */
export async function seedSession(options: SeedSessionOptions): Promise<SeededSession> {
  const db = makeTestDb();
  const sessionToken = randomUUID();
  const ttl = options.ttlMs ?? 30 * 24 * 60 * 60 * 1000;
  const expires = new Date(Date.now() + ttl);

  // Raw SQL insert — avoids importing the schema symbol, which would fail
  // at Wave 0 because the sessions table isn't in schema.ts yet.
  // The sessions adapter table lands in Plan 05-01; calls to this helper
  // before that plan runs will fail at the DB layer (expected; tests skip).
  await db.execute(
    sql`INSERT INTO sessions ("sessionToken", "userId", expires)
        VALUES (${sessionToken}, ${options.userId}, ${expires})`,
  );

  return {
    sessionToken,
    userId: options.userId,
    cookie: {
      name: 'authjs.session-token',
      value: sessionToken,
      domain: options.domain ?? 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      expires: Math.floor(expires.getTime() / 1000),
    },
  };
}
