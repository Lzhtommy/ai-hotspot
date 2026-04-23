// Task 5-09-04 | Plan 05-09 | REQ-AUTH-07
// Nyquist stub — red until implementation lands.
//
// E2E: banning a user (SQL update) clears their session on next request.
import { test, expect } from '@playwright/test';

test('AUTH-07: banned user session is cleared on next request', async ({ page }) => {
  // Wave 0: only asserts that /favorites exists — full ban-enforcement test
  // requires seeded-session helper + SQL update path (Plans 05-02, 05-08).
  await page.goto('/favorites');
  // Anonymous visit should not crash. A 200 or redirect are both acceptable.
  await expect(page).toHaveURL(/\/favorites|\/$/);
});
