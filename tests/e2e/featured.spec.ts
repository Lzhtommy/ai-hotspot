/**
 * FEED-01: / (精选) renders the featured feed page with heading and at least
 * one card or the empty-state.
 */
import { test, expect } from '@playwright/test';

test('FEED-01: / renders 精选 top bar + at least one card OR empty-state', async ({ page }) => {
  await page.goto('/');
  // Page heading must be visible
  await expect(page.getByRole('heading', { level: 1, name: '精选' })).toBeVisible();
  // Either at least one FeedCard link OR the empty state heading
  const card = page.getByRole('link', { name: /.+/ }).first();
  const empty = page.getByRole('heading', { name: '暂无精选动态' });
  await expect(card.or(empty)).toBeVisible();
});
