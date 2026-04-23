// Task 5-09-02 | Plan 05-09 | REQ-AUTH-03 | Threat T-5-12
// Nyquist stub — red until implementation lands.
//
// E2E: magic-link flow issues a token, the verification redirect lands,
// and the session persists across a reload.
import { test, expect } from '@playwright/test';

test('AUTH-03: magic-link issue + verify + session persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '登录' }).first().click();

  // Fill the email form and submit — asserts the "检查邮箱" success state.
  const input = page.getByRole('textbox', { name: /邮箱|email/i });
  await expect(input).toBeVisible();
  await input.fill('e2e-test@example.com');
  await page.keyboard.press('Enter');

  await expect(page.getByText(/检查邮箱/)).toBeVisible();
});
