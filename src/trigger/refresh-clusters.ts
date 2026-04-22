import { task } from '@trigger.dev/sdk';
import { runRefreshClusters, type RefreshClustersResult } from '@/lib/cluster/refresh';
import { invalidateFeedCache } from '@/lib/feed/cache-invalidate';

/**
 * Debounced cluster bookkeeping — Phase 3 CLUST-05, CLUST-06, CLUST-07.
 *
 * Enqueued by src/trigger/process-pending.ts with a debounce of 60s and
 * key 'refresh-clusters' — coalesces a burst of new items into one refresh
 * run 60s after the last trigger (trailing-edge coalesce, RESEARCH.md
 * §Cluster-refresh flow). Assumption A8 verified: Trigger.dev v4 TriggerOptions
 * includes `debounce?: { key: string; delay: string }` — Path A confirmed.
 *
 * maxDuration=180s: budget for iterating every dirty cluster (<= 200 at
 * v1 scale) + AVG(embedding) per cluster. Far above expected p95.
 *
 * No OTel needed here — no Anthropic or Voyage calls are made.
 *
 * Phase 4 extension (FEED-10): after a successful cluster refresh where at least
 * one cluster was updated, flush the Redis feed:* cache and trigger ISR revalidation
 * via /api/revalidate. Errors are swallowed — a cache flush failure must never cause
 * the cluster refresh task to fail.
 *
 * Consumed by:
 *   - src/trigger/process-pending.ts (post-fan-out, with debounce: { key: 'refresh-clusters', delay: '60s' })
 *   - Trigger.dev dashboard manual-run for debugging
 */
export const refreshClusters = task({
  id: 'refresh-clusters',
  maxDuration: 180,
  run: async (): Promise<RefreshClustersResult> => {
    const result = await runRefreshClusters();
    if (result.updated > 0) {
      try {
        await invalidateFeedCache();
      } catch (e) {
        // Never fail the cluster refresh for an invalidation failure
        console.warn(
          '[refresh-clusters] invalidateFeedCache failed:',
          e instanceof Error ? e.message : 'unknown',
        );
      }
    }
    return result;
  },
});
