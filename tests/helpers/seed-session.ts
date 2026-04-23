/**
 * seed-session — Phase 5 Plan 05-09.
 *
 * Inserts a `users` row + a `sessions` row on the active Neon branch and
 * returns a Playwright-compatible cookie shape for authenticated E2E flows.
 *
 * Usage:
 *   const seeded = await seedSession({ name: 'Alice' });
 *   try {
 *     await context.addCookies([seeded.cookie]);
 *     // ...test against authenticated UI...
 *   } finally {
 *     await seeded.cleanup();
 *   }
 *
 * Threat mitigations:
 *   T-5-E2E-01 (accidental prod writes) — makeTestDb() fail-closes when
 *   DATABASE_URL looks like a production branch (see tests/helpers/db.ts).
 *
 * Consumed by:
 *   - tests/e2e/*.spec.ts (Playwright storageState / context.addCookies)
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
// Import directly from the Vitest-free module so Playwright specs can load
// this helper without `tests/helpers/db.ts`'s `import { vi } from 'vitest'`
// pulling the Vitest runtime into the Playwright worker (which fails with
// "Vitest cannot be imported in a CommonJS module").
import { makeTestDb } from './test-db';
import * as schema from '@/lib/db/schema';

export interface SeededSession {
  sessionToken: string;
  userId: string;
  email: string;
  /**
   * Cookie entry compatible with Playwright's `BrowserContext.addCookies`.
   */
  cookie: {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Lax' | 'Strict' | 'None';
  };
  cleanup: () => Promise<void>;
}

export interface SeedSessionOptions {
  email?: string;
  name?: string;
  isBanned?: boolean;
  role?: 'user' | 'admin';
  /** ms until expiry. Default: 30 days. */
  ttlMs?: number;
  /** Base URL used to derive cookie domain + secure flag. Default: http://localhost:3000. */
  baseUrl?: string;
}

/**
 * Seeds a user + session row on the active Neon test branch and returns
 * the cookie + cleanup. Cookie name follows Auth.js v5 convention:
 *   - `authjs.session-token`            (http — dev / localhost)
 *   - `__Secure-authjs.session-token`   (https — preview / prod)
 */
export async function seedSession(options: SeedSessionOptions = {}): Promise<SeededSession> {
  const db = makeTestDb();
  const email = options.email ?? `e2e-${randomUUID().slice(0, 8)}@test.local`;

  const [userRow] = await db
    .insert(schema.users)
    .values({
      email,
      name: options.name ?? 'E2E User',
      role: options.role ?? 'user',
      isBanned: options.isBanned ?? false,
    })
    .returning({ id: schema.users.id });

  if (!userRow?.id) {
    throw new Error('seedSession: failed to insert users row');
  }
  const userId = userRow.id;

  const sessionToken = randomUUID();
  const ttl = options.ttlMs ?? 30 * 24 * 60 * 60 * 1000;
  const expires = new Date(Date.now() + ttl);

  await db.insert(schema.sessions).values({ sessionToken, userId, expires });

  const baseUrl = options.baseUrl ?? process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const parsed = new URL(baseUrl);
  const isSecure = parsed.protocol === 'https:';

  return {
    sessionToken,
    userId,
    email,
    cookie: {
      name: isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token',
      value: sessionToken,
      domain: parsed.hostname,
      path: '/',
      expires: Math.floor(expires.getTime() / 1000),
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
    },
    cleanup: async () => {
      await db.delete(schema.sessions).where(eq(schema.sessions.sessionToken, sessionToken));
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    },
  };
}
