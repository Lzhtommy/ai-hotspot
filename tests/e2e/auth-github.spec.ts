// Task 5-09-01 | Plan 05-09 | REQ-AUTH-01, REQ-AUTH-02 | Threat T-5-11
// Nyquist stub — red until implementation lands.
//
// E2E: GitHub OAuth sign-in completes on localhost via the preview-proxy
// simulation path (AUTH_REDIRECT_PROXY_URL).
import { test, expect } from '@playwright/test';

test('AUTH-01/02: GitHub OAuth sign-in flow reaches authenticated state', async ({ page }) => {
  await page.goto('/');
  // Open login modal via 登录 chip. This will fail at Wave 0 because the
  // GitHub button doesn't wire signIn('github') yet.
  await page.getByRole('button', { name: '登录' }).first().click();

  // Click the GitHub provider button in the modal.
  await expect(page.getByRole('button', { name: /GitHub/i })).toBeVisible();
  // Full OAuth round-trip requires a stubbed provider; in Wave 0 we simply
  // assert the button click initiates a navigation to /api/auth/signin/github.
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/auth/signin/github')),
    page.getByRole('button', { name: /GitHub/i }).click(),
  ]);
  expect(req.url()).toContain('/api/auth/signin/github');
});
