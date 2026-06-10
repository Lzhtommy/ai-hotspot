/**
 * Tests for cache-invalidate — fetch swallowing and env guard.
 *
 * The fetch dependency is injected via the `deps` parameter — no network calls.
 */

import { describe, expect, it, vi, type Mock, beforeEach, afterEach } from 'vitest';
import { invalidateFeedCache } from './cache-invalidate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Successful fetch mock */
function makeOkFetch() {
  return vi.fn().mockResolvedValue({ ok: true, status: 200 });
}

const BASE_ENV = {
  NEXT_PUBLIC_SITE_URL: 'https://example.com',
  REVALIDATE_SECRET: 'test-secret-abc123',
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = BASE_ENV.NEXT_PUBLIC_SITE_URL;
  process.env.REVALIDATE_SECRET = BASE_ENV.REVALIDATE_SECRET;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.REVALIDATE_SECRET;
});

// ---------------------------------------------------------------------------
// Fetch behaviour
// ---------------------------------------------------------------------------

describe('invalidateFeedCache fetch behaviour', () => {
  it('calls fetch with x-revalidate-secret header matching env var', async () => {
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ fetch: fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = (fetchFn as Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/api/revalidate');
    expect((init.headers as Record<string, string>)['x-revalidate-secret']).toBe(
      'test-secret-abc123',
    );
  });

  it('swallows fetch errors — promise resolves even when fetch throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(invalidateFeedCache({ fetch: fetchFn })).resolves.toBeUndefined();
  });

  it('swallows non-ok fetch responses — promise resolves on 401 response', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 401 });

    await expect(invalidateFeedCache({ fetch: fetchFn })).resolves.toBeUndefined();
  });

  it('skips fetch when REVALIDATE_SECRET is missing', async () => {
    delete process.env.REVALIDATE_SECRET;
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ fetch: fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('skips fetch when NEXT_PUBLIC_SITE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ fetch: fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
