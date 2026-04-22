/**
 * FEED-07: Responsive layout — sidebar collapses on mobile (375×812), visible on desktop (1440×900).
 *
 * Desktop: sidebar nav is visible in-flow.
 * Mobile: hamburger button is visible; sidebar nav may be off-canvas (CSS transform,
 *         not display:none — Playwright's toBeVisible checks the bounding box intersection
 *         with the viewport; elements with translateX(-100%) return false for isVisible).
 */
import { test, expect } from '@playwright/test';

test.describe('FEED-07 Responsive', () => {
  test('desktop 1440x900 shows sidebar navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  });

  test('mobile 375x812 shows hamburger button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Hamburger menu toggle button must be present on mobile
    await expect(page.getByRole('button', { name: '打开菜单' })).toBeVisible();
  });
});
