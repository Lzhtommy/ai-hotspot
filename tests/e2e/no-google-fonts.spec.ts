/**
 * FEED-08: Assert zero requests to fonts.googleapis.com and fonts.gstatic.com
 * across the main feed pages and item detail page.
 *
 * This is a network-level assertion — if any stylesheet or script attempts to
 * load from Google Fonts CDN, the test fails.
 */
import { test, expect } from '@playwright/test';
import { getSamplePublishedItemId } from './fixtures/items';

const BANNED = [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/];

for (const path of ['/', '/all']) {
  test(`FEED-08: no Google Fonts request on ${path}`, async ({ page }) => {
    const violations: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (BANNED.some((re) => re.test(url))) violations.push(url);
    });
    await page.goto(path, { waitUntil: 'networkidle' });
    expect(violations, `Forbidden font requests on ${path}: ${violations.join(', ')}`).toEqual([]);
  });
}

test('FEED-08: no Google Fonts request on /items/[id]', async ({ page }) => {
  const id = await getSamplePublishedItemId();
  test.skip(!id, 'no published items available — skipping /items/[id] font test');
  const violations: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (BANNED.some((re) => re.test(url))) violations.push(url);
  });
  await page.goto(`/items/${id}`, { waitUntil: 'networkidle' });
  expect(violations, `Forbidden font requests on /items/${id}: ${violations.join(', ')}`).toEqual(
    [],
  );
});
