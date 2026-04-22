/**
 * FEED-07: Responsive layout — sidebar collapses on mobile (375×812), visible on desktop (1440×900).
 *
 * The sidebar renders with aria-label="主导航". On desktop it should be visible in-flow;
 * on mobile it should be off-canvas (hidden / not-visible) with a hamburger button visible.
 */
import { test, expect } from '@playwright/test';

test.describe('FEED-07 Responsive', () => {
  test('desktop 1440x900 shows sidebar navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  });

  test('mobile 375x812 collapses sidebar off-canvas', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Sidebar should be off-canvas initially; hamburger must be present
    await expect(page.getByRole('navigation', { name: '主导航' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '打开菜单' })).toBeVisible();
  });
});
