/**
 * E2E — Plan 05-09 Task 2 | REQ-AUTH-03 | Threat T-5-12
 *
 * Real magic-link deliverability (Resend → mailbox) cannot be asserted in
 * CI. This spec asserts the in-product slice that IS automatable:
 *   - Opening the modal, filling the email field, submitting the form,
 *     and reaching either the success-state (链接已发送) OR the graceful
 *     failure inline message (发送失败) depending on whether RESEND_API_KEY
 *     is wired in the running dev server's env.
 *
 * Real deliverability verification lives in 05-UAT.md + docs/auth-providers.md
 * (Plan 05-10 runbook) — trigger the link from a real inbox and confirm
 * arrival + sign-in.
 *
 * Requires at runtime:
 *   - `pnpm dev` on http://localhost:3000
 *   - DATABASE_URL pointing at a non-prod Neon branch (for seedSession helper)
 *   - verification_tokens table migrated (Plan 05-01)
 */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.describe('AUTH-03 Magic link — form submit reaches success or inline-error state', () => {
  test('submitting email opens success "链接已发送" OR fails gracefully with 发送失败', async ({
    page,
  }) => {
    const email = `ml-${randomUUID().slice(0, 8)}@test.local`;

    await page.goto('/');

    // The 登录 chip sits in the sidebar; exact match avoids catching the
    // 使用 GitHub 登录 / 使用 Google 登录 buttons inside the modal.
    await page.getByRole('button', { name: '登录', exact: true }).first().click();

    // Modal's email field — its label is 邮箱 (see login-prompt-modal.tsx).
    const emailInput = page.getByLabel('邮箱');
    await expect(emailInput).toBeVisible({ timeout: 5_000 });
    await emailInput.fill(email);

    // Submit via the primary button. The server action (signInResendAction)
    // calls Auth.js signIn('resend', ...); in dev without RESEND_API_KEY this
    // path throws and the modal transitions to state='error' → 发送失败 copy.
    // With a valid Resend setup, the happy path shows the 链接已发送 status.
    await page.getByRole('button', { name: '发送登录链接' }).click();

    // Wait for either the success status region or the inline error alert.
    const success = page.getByRole('status').filter({ hasText: '链接已发送' });
    const failure = page.getByRole('alert').filter({ hasText: '发送失败' });

    await expect(success.or(failure)).toBeVisible({ timeout: 15_000 });
  });
});
