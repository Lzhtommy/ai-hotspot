/**
 * FEED-12: Tag filter on /all writes ?tags= to the URL.
 *
 * The FilterPopover opens on clicking the 过滤 button. Clicking a tag inside the
 * popover should update the URL via nuqs (shallow:false) and trigger a re-render.
 */
import { test, expect } from '@playwright/test';

test('FEED-12: clicking a tag filter writes ?tags= to URL', async ({ page }) => {
  await page.goto('/all');
  // Open the filter popover
  await page.getByRole('button', { name: '过滤' }).click();
  // Look for the filter dialog
  const popover = page.getByRole('dialog').filter({ hasText: '筛选' });
  // Find any tag buttons inside the popover
  const firstTag = popover.getByRole('button').first();
  const hasAny = await firstTag.count();
  test.skip(hasAny === 0, 'No tags available in DB — skipping filter URL test');
  await firstTag.click();
  await expect(page).toHaveURL(/tags=/);
});
