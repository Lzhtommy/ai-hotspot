/**
 * FEED-06: Accessibility — / has no serious or critical axe violations (WCAG 2.1 AA).
 *
 * Uses @axe-core/playwright to run axe against the rendered DOM and filters
 * for impact=serious or impact=critical.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('FEED-06 a11y: / has no serious axe violations (WCAG 2.1 AA)', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
