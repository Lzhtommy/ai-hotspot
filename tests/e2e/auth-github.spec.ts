/**
 * E2E — Plan 05-09 Task 2 | REQ-AUTH-01, REQ-AUTH-02 | Threat T-5-11
 *
 * Real GitHub OAuth cannot round-trip in CI (GitHub blocks scripted logins).
 * Instead, this spec seeds a session to simulate a post-OAuth state and
 * asserts the authenticated UI contract:
 *   1. A seeded session cookie makes UserChip render the authenticated
 *      branch (user name visible, 登录 chip gone).
 *   2. Clicking 退出登录 inside UserChip's popover clears the session and
 *      the anonymous 登录 chip returns.
 *
 * Real GitHub OAuth verification is a manual step documented in 05-UAT.md
 * and Plan 05-10's docs/auth-providers.md runbook.
 *
 * Requires at runtime:
 *   - `pnpm dev` (or a matching server) on http://localhost:3000
 *   - DATABASE_URL pointing at a non-prod Neon branch (makeTestDb guard)
 *   - users / sessions / accounts tables migrated (Plan 05-01)
 */
import { test, expect } from '@playwright/test';
import { seedSession } from '../helpers/seed-session';

test.describe('AUTH-01/02 GitHub OAuth — seeded session simulates authenticated state', () => {
  test('seeded session cookie renders authenticated UserChip', async ({ page, context }) => {
    const seeded = await seedSession({ name: 'GitHub User' });
    try {
      await context.addCookies([seeded.cookie]);
      await page.goto('/');

      // The authenticated UserChip exposes the (possibly truncated) display name
      // as the popover trigger's accessible text. `GitHub User` is under 8 chars
      // so it survives truncation verbatim.
      await expect(page.getByRole('button', { name: /GitHub User/ })).toBeVisible({
        timeout: 10_000,
      });

      // The anonymous 登录 chip must NOT appear when authenticated.
      await expect(page.getByRole('button', { name: '登录', exact: true })).toHaveCount(0);
    } finally {
      await seeded.cleanup();
    }
  });

  test('signOut menu item clears session and returns to anonymous UI', async ({
    page,
    context,
  }) => {
    const seeded = await seedSession({ name: 'SignOut User' });
    try {
      await context.addCookies([seeded.cookie]);
      await page.goto('/');

      // Open the UserChip popover.
      const chip = page.getByRole('button', { name: /SignOut User/ });
      await expect(chip).toBeVisible({ timeout: 10_000 });
      await chip.click();

      // Trigger signOut via the 退出登录 menu item.
      await page.getByRole('menuitem', { name: '退出登录' }).click();

      // After signOut completes, UserChip falls back to the anonymous 登录 chip.
      await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      // cleanup() is idempotent: if signOut already removed the session row,
      // the DELETE is a no-op. User row is still present and gets cleaned.
      await seeded.cleanup();
    }
  });
});
