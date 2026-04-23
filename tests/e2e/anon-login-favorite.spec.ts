// Task 5-09-03 | Plan 05-09 | REQ-AUTH-05, REQ-FAV-01
// Nyquist stub — red until implementation lands.
//
// E2E: anon click 收藏 → login modal opens → sign in → modal closes →
// user clicks 收藏 again → favorite persists on /favorites page.
import { test, expect } from '@playwright/test';

test('FAV-01: anonymous click → login → favorite persists', async ({ page }) => {
  await page.goto('/');
  // First feed-card's 收藏 icon triggers the login modal.
  const starBtn = page.getByRole('button', { name: /收藏/ }).first();
  await expect(starBtn).toBeVisible();
  await starBtn.click();

  // Modal open.
  await expect(page.getByRole('dialog', { name: /登录/ })).toBeVisible();

  // Assertion stops here for Wave 0 — the full round-trip requires a seeded
  // session + /favorites page (Plans 05-02..08).
});
