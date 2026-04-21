import { task } from '@trigger.dev/sdk';
import { runRefreshClusters, type RefreshClustersResult } from '@/lib/cluster/refresh';

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
 * Consumed by:
 *   - src/trigger/process-pending.ts (post-fan-out, with debounce: { key: 'refresh-clusters', delay: '60s' })
 *   - Trigger.dev dashboard manual-run for debugging
 */
export const refreshClusters = task({
  id: 'refresh-clusters',
  maxDuration: 180,
  run: async (): Promise<RefreshClustersResult> => runRefreshClusters(),
});
