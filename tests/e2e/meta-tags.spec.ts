/**
 * FEED-09: Assert /items/[id] emits OpenGraph meta tags with absolute URLs.
 *
 * WeChat share-card rendering requires og:title, og:description, og:image (absolute URL),
 * and og:url (absolute URL). This spec verifies the HTML output via a raw HTTP GET,
 * not a browser navigation, so it catches SSR output independently of JS execution.
 */
import { test, expect, request } from '@playwright/test';
import { getSamplePublishedItemId } from './fixtures/items';

test('FEED-09: /items/[id] emits og:title, og:description, og:image with absolute URL', async ({
  baseURL,
}) => {
  const id = await getSamplePublishedItemId();
  test.skip(!id, 'No published items in DB — skipping OG meta tag test');

  const ctx = await request.newContext();
  const res = await ctx.get(`${baseURL}/items/${id}`);
  expect(res.status()).toBe(200);
  const html = await res.text();

  expect(html).toMatch(/<meta[^>]+property="og:title"[^>]+content="[^"]+"/);
  expect(html).toMatch(/<meta[^>]+property="og:description"[^>]+content="[^"]*"/);
  // og:image must be an absolute URL (http/https)
  expect(html).toMatch(
    /<meta[^>]+property="og:image"[^>]+content="https?:\/\/[^"]+opengraph-image[^"]*"/,
  );
  expect(html).toMatch(/<meta[^>]+property="og:url"[^>]+content="https?:\/\/[^"]+"/);
});
