/**
 * Two-layer feed cache invalidator — Phase 4 FEED-10.
 *
 * Flushes all `feed:*` keys from Upstash Redis AND POSTs to /api/revalidate
 * so Next.js ISR drops its cached HTML for `/` and `/all`. Called from the
 * Trigger.dev refresh-clusters task after each debounced cluster refresh.
 *
 * Security notes:
 *   - REVALIDATE_SECRET is sent as a header, never in the URL or logged
 *   - Fetch timeout: 10s via AbortSignal.timeout to avoid blocking the task indefinitely
 *   - All errors are swallowed — the cluster refresh must not fail due to cache side-effects
 *
 * Consumed by:
 *   - src/trigger/refresh-clusters.ts
 */
import { redis as realRedis } from '@/lib/redis/client';

export interface InvalidateDeps {
  redis?: typeof realRedis;
  fetch?: typeof globalThis.fetch;
}

/**
 * Invalidate the feed cache in two layers:
 *   1. Flush all `feed:*` keys from Upstash Redis (SCAN cursor loop + batch DEL)
 *   2. POST to /api/revalidate to trigger Next.js ISR revalidation for `/` and `/all`
 *
 * All errors are caught and logged — never thrown.
 */
export async function invalidateFeedCache(deps?: InvalidateDeps): Promise<void> {
  const redis = deps?.redis ?? realRedis;
  const fetchFn = deps?.fetch ?? globalThis.fetch;

  // Step 1: Flush Redis feed:* keys via SCAN cursor loop (Pitfall 7: never use KEYS in prod)
  try {
    let cursor: number = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: 'feed:*', count: 200 });
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      cursor = Number(nextCursor);
    } while (cursor !== 0);
  } catch (e) {
    console.warn(
      '[cache-invalidate] redis SCAN/DEL failed:',
      e instanceof Error ? e.message : 'unknown',
    );
  }

  // Step 2: POST to /api/revalidate for ISR HTML invalidation
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!siteUrl || !secret) {
    console.warn(
      '[cache-invalidate] missing NEXT_PUBLIC_SITE_URL or REVALIDATE_SECRET; ISR flush skipped',
    );
    return;
  }

  try {
    const res = await fetchFn(`${siteUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ paths: ['/', '/all'] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn('[cache-invalidate] /api/revalidate returned', res.status);
    }
  } catch (e) {
    console.warn(
      '[cache-invalidate] /api/revalidate POST failed:',
      e instanceof Error ? e.message : 'unknown',
    );
  }
}
