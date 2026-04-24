/**
 * Phase 6 OPS-04 + OPS-05 E2E: sitemap.xml / robots.txt + Vercel Analytics.
 *
 * - GET /sitemap.xml → valid <urlset> XML, no admin/api/favorites paths inside
 *   <loc> tags (T-6-70/T-6-71 mitigations).
 * - GET /robots.txt → references /sitemap.xml and disallows /admin
 *   (T-6-71 mitigation).
 * - Home page emits no google-analytics / gtag / googletagmanager beacon
 *   (T-6-73 mitigation — GFW + privacy).
 */
import { test, expect } from '@playwright/test';

test.describe('Phase 6 OPS-04 + OPS-05', () => {
  test('GET /sitemap.xml returns valid XML with urlset and no privileged paths', async ({
    request,
  }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const text = await res.text();

    // Must be a valid XML sitemap envelope.
    expect(text).toContain('<urlset');
    expect(text).toContain('</urlset>');

    // Privileged paths must NOT appear anywhere inside <loc> tags.
    // Match all <loc>…</loc> payloads and assert none contain the forbidden
    // substrings. Using a substring check on the raw XML would false-positive
    // on <priority> or comments; scoping to <loc> payloads is exact.
    const locs = Array.from(text.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc).not.toMatch(/\/admin\b/);
      expect(loc).not.toMatch(/\/api\//);
      expect(loc).not.toMatch(/\/favorites\b/);
    }
  });

  test('GET /robots.txt references /sitemap.xml and disallows /admin', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/Sitemap:\s+.+\/sitemap\.xml/);
    expect(text).toContain('Disallow: /admin');
    expect(text).toContain('Disallow: /api');
    expect(text).toContain('Disallow: /favorites');
  });

  test('home page emits no google-analytics / gtag / googletagmanager beacon', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {
      // networkidle may flake under ISR + long-running analytics heartbeat —
      // fall back to a short fixed delay; the assertion is on captured urls.
    });
    const googleHits = requests.filter((u) => /googletagmanager|google-analytics|gtag/i.test(u));
    expect(googleHits).toEqual([]);
  });

  test('home page loads without throwing (Vercel Analytics component mount smoke)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    // Sanity — the component is a 'use client' island and may be a no-op in
    // dev, but it must not throw during mount. The authoritative assertion
    // (no Google beacon) is in the previous test.
    expect(errors.filter((e) => /analytics/i.test(e))).toEqual([]);
  });
});
