/**
 * Tests for cache-invalidate — Redis SCAN cursor loop, fetch swallowing, env guard.
 *
 * All dependencies injected via the `deps` parameter — no network calls.
 */

import { describe, expect, it, vi, type Mock, beforeEach, afterEach } from 'vitest';
import { invalidateFeedCache } from './cache-invalidate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Upstash-compatible redis mock */
function makeRedisMock(pages: Array<[string | number, string[]]>) {
  let callIndex = 0;
  return {
    scan: vi.fn().mockImplementation(() => {
      const page = pages[callIndex++] ?? ['0', []];
      return Promise.resolve(page);
    }),
    del: vi.fn().mockResolvedValue(pages.reduce((acc, [, keys]) => acc + keys.length, 0)),
  };
}

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
// SCAN cursor loop termination
// ---------------------------------------------------------------------------

describe('invalidateFeedCache SCAN cursor loop', () => {
  it('terminates immediately when SCAN returns cursor 0 and no keys', async () => {
    const redis = makeRedisMock([['0', []]]);
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ redis: redis as never, fetch: fetchFn });

    expect(redis.scan).toHaveBeenCalledOnce();
    expect(redis.del).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('calls del once when SCAN returns cursor=0 with 3 keys on first page', async () => {
    const keys = ['feed:featured:page:1', 'feed:all:page:1:tags::source:all', 'feed:all:page:2:tags::source:all'];
    const redis = makeRedisMock([['0', keys]]);
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ redis: redis as never, fetch: fetchFn });

    expect(redis.scan).toHaveBeenCalledOnce();
    expect(redis.del).toHaveBeenCalledOnce();
    expect(redis.del).toHaveBeenCalledWith(...keys);
  });

  it('iterates twice when SCAN returns cursor=5 then cursor=0', async () => {
    const page1Keys = ['feed:featured:page:1', 'feed:featured:page:2'];
    const page2Keys = ['feed:all:page:1:tags::source:all'];
    const redis = makeRedisMock([
      ['5', page1Keys],
      ['0', page2Keys],
    ]);
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ redis: redis as never, fetch: fetchFn });

    expect(redis.scan).toHaveBeenCalledTimes(2);
    // First scan starts at cursor 0, second at cursor 5
    expect((redis.scan as Mock).mock.calls[0][0]).toBe(0);
    expect((redis.scan as Mock).mock.calls[1][0]).toBe(5);
    expect(redis.del).toHaveBeenCalledTimes(2);
  });

  it('does not call del when SCAN returns cursor=0 with empty keys on second page', async () => {
    const redis = makeRedisMock([
      ['3', ['feed:featured:page:1']],
      ['0', []], // second page empty
    ]);
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ redis: redis as never, fetch: fetchFn });

    expect(redis.del).toHaveBeenCalledTimes(1); // only first page had keys
  });
});

// ---------------------------------------------------------------------------
// Fetch behaviour
// ---------------------------------------------------------------------------

describe('invalidateFeedCache fetch behaviour', () => {
  it('calls fetch with x-revalidate-secret header matching env var', async () => {
    const redis = makeRedisMock([['0', []]]);
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ redis: redis as never, fetch: fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = (fetchFn as Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/api/revalidate');
    expect((init.headers as Record<string, string>)['x-revalidate-secret']).toBe(
      'test-secret-abc123',
    );
  });

  it('swallows fetch errors — promise resolves even when fetch throws', async () => {
    const redis = makeRedisMock([['0', []]]);
    const fetchFn = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      invalidateFeedCache({ redis: redis as never, fetch: fetchFn }),
    ).resolves.toBeUndefined();
  });

  it('swallows non-ok fetch responses — promise resolves on 401 response', async () => {
    const redis = makeRedisMock([['0', []]]);
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 401 });

    await expect(
      invalidateFeedCache({ redis: redis as never, fetch: fetchFn }),
    ).resolves.toBeUndefined();
  });

  it('skips fetch when REVALIDATE_SECRET is missing', async () => {
    delete process.env.REVALIDATE_SECRET;
    const redis = makeRedisMock([['0', []]]);
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ redis: redis as never, fetch: fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('skips fetch when NEXT_PUBLIC_SITE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const redis = makeRedisMock([['0', []]]);
    const fetchFn = makeOkFetch();

    await invalidateFeedCache({ redis: redis as never, fetch: fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Redis error resilience
// ---------------------------------------------------------------------------

describe('invalidateFeedCache redis error resilience', () => {
  it('swallows redis SCAN errors — promise resolves', async () => {
    const redis = {
      scan: vi.fn().mockRejectedValue(new Error('redis timeout')),
      del: vi.fn(),
    };
    const fetchFn = makeOkFetch();

    await expect(
      invalidateFeedCache({ redis: redis as never, fetch: fetchFn }),
    ).resolves.toBeUndefined();
  });
});
