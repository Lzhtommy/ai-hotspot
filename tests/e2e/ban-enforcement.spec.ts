/**
 * E2E — Plan 05-09 Task 3 | REQ-AUTH-07 | Threat T-5-03
 *
 * Ban-enforcement regression test for the D-05 Layer 1 contract: flipping
 * `users.is_banned` to true must clear the authenticated session on the
 * next page request.
 *
 * Flow:
 *   1. Seed a live session for a fresh test user.
 *   2. Visit / — assert the authenticated UserChip renders.
 *   3. UPDATE users SET is_banned=true via direct SQL.
 *   4. Reload / — assert the anonymous 登录 chip reappears (Auth.js session
 *      callback returned null on refresh, clearing the cookie state).
 *
 * This is the E2E counterpart to tests/integration/ban-enforcement.test.ts
 * (which exercises the pure callback). Together they verify both layers of
 * the two-layer ban-enforcement model (D-05).
 *
 * Requires at runtime:
 *   - Dev server on http://localhost:3000
 *   - DATABASE_URL → non-prod Neon branch
 */
import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { seedSession } from '../helpers/seed-session';
import { makeTestDb } from '../helpers/test-db';
import { users } from '@/lib/db/schema';

test.describe('T-5-03 / AUTH-07 — banning a user clears their session on next request', () => {
  test('seeded user sees authenticated UI; after is_banned=true + reload, anonymous UI returns', async ({
    page,
    context,
  }) => {
    const seeded = await seedSession({ name: 'Ban Target' });
    const db = makeTestDb();
    try {
      await context.addCookies([seeded.cookie]);
      await page.goto('/');

      // Authenticated: the UserChip exposes the display name as a button.
      await expect(page.getByRole('button', { name: /Ban Target/ })).toBeVisible({
        timeout: 10_000,
      });

      // Flip the ban bit via direct SQL.
      await db.update(users).set({ isBanned: true }).where(eq(users.id, seeded.userId));

      // Reload — Auth.js session callback reads users.is_banned on every
      // refresh under database-strategy sessions, returns null when banned,
      // and the UI falls back to the anonymous 登录 chip.
      await page.reload();

      await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible({
        timeout: 10_000,
      });

      // The authenticated chip must be gone.
      await expect(page.getByRole('button', { name: /Ban Target/ })).toHaveCount(0);
    } finally {
      await seeded.cleanup();
    }
  });
});
