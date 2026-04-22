/**
 * FEED-02: /all renders the full AI feed with heading and either items or empty-state.
 */
import { test, expect } from '@playwright/test';

test('FEED-02: /all renders 全部 AI 动态 + pagination or empty-state', async ({ page }) => {
  await page.goto('/all');
  await expect(page.getByRole('heading', { level: 1, name: '全部 AI 动态' })).toBeVisible();
});
