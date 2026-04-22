/**
 * FEED-01: / (精选) renders the featured feed page with heading and at least
 * one card or the empty-state.
 */
import { test, expect } from '@playwright/test';

test('FEED-01: / renders 精选 top bar + at least one card OR empty-state', async ({ page }) => {
  await page.goto('/');
  // Page heading must be visible
  await expect(page.getByRole('heading', { level: 1, name: '精选' })).toBeVisible();
  // Scope card link search to <main> so sidebar nav links don't match
  const main = page.getByRole('main');
  const card = main.getByRole('link', { name: /.+/ }).first();
  const empty = page.getByRole('heading', { name: '暂无精选动态' });
  // Either a content link OR the empty state heading must be visible
  const cardCount = await card.count();
  const emptyCount = await empty.count();
  if (emptyCount > 0) {
    await expect(empty).toBeVisible();
  } else {
    expect(cardCount).toBeGreaterThan(0);
  }
});
