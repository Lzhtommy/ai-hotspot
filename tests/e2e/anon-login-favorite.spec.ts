/**
 * E2E — Plan 05-09 Task 3 | REQ-AUTH-05, REQ-FAV-01
 *
 * Full anon → sign-in → favorite user journey. Real OAuth cannot round-trip
 * in CI so this test substitutes a seeded session for the sign-in step.
 *
 * Flow:
 *   1. Visit / as anonymous.
 *   2. Click the first feed-card's 收藏 (star) button.
 *   3. LoginPromptModal opens (UI contract — Phase 4 D-26).
 *   4. Dismiss the modal (simulating the user completing sign-in out-of-band).
 *   5. Seed a session cookie and reload — the page now renders as authenticated.
 *   6. Click 收藏 again on the first card.
 *   7. Assert the `favorites` table has a row for (seeded userId, any itemId).
 *
 * Requires at runtime:
 *   - Dev server on http://localhost:3000 with at least one published item
 *     visible on / (otherwise the 收藏 button won't exist)
 *   - DATABASE_URL → non-prod Neon branch with Plan 05-01 tables migrated
 */
import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { seedSession } from '../helpers/seed-session';
import { makeTestDb } from '../helpers/test-db';
import { favorites } from '@/lib/db/schema';

test.describe.configure({ mode: 'serial' });

test.describe('FAV-01: anonymous 收藏 → modal → seeded sign-in → favorite persists', () => {
  test('first-click opens modal; after seeded sign-in, re-click persists a favorites row', async ({
    page,
    context,
  }) => {
    await page.goto('/');

    // Guard: if the feed has no published items, this test cannot run.
    const anyStar = page.getByRole('button', { name: /^(收藏|已收藏)$/ });
    const starCount = await anyStar.count();
    test.skip(
      starCount === 0,
      'No feed items on / — seed published items or run Phase 2/3 pipeline first',
    );

    // 1. Anonymous click opens the modal.
    await anyStar.first().click();
    // The login-modal-heading id is set on the <h2> inside <dialog>.
    await expect(page.locator('#login-modal-heading')).toBeVisible({ timeout: 5_000 });

    // 2. Dismiss the modal — simulates the user navigating away to complete OAuth.
    await page.getByRole('button', { name: '稍后再说' }).click();

    // 3. Seed a session for the user that "just signed in".
    const seeded = await seedSession({ name: 'Fav Tester' });
    try {
      await context.addCookies([seeded.cookie]);
      await page.reload();

      // Authenticated UserChip should appear now.
      await expect(page.getByRole('button', { name: /Fav Tester/ })).toBeVisible({
        timeout: 10_000,
      });

      // 4. Click 收藏 again on the first card. The server action writes the favorites row.
      const starAgain = page.getByRole('button', { name: /^(收藏|已收藏)$/ }).first();
      await starAgain.click();

      // 5. The DB is the source of truth — poll briefly for eventual consistency.
      const db = makeTestDb();
      let rows: { userId: string }[] = [];
      for (let i = 0; i < 10; i++) {
        rows = await db
          .select({ userId: favorites.userId })
          .from(favorites)
          .where(eq(favorites.userId, seeded.userId));
        if (rows.length >= 1) break;
        await page.waitForTimeout(300);
      }
      expect(rows.length).toBeGreaterThanOrEqual(1);

      // 6. Cleanup the favorites row before seeded.cleanup() (which removes the user).
      await db.delete(favorites).where(eq(favorites.userId, seeded.userId));
    } finally {
      await seeded.cleanup();
    }
  });
});
