import { task } from '@trigger.dev/sdk';
import { runFetchSource, type FetchSourceResult } from '@/lib/ingest/fetch-source-core';

/**
 * Per-source fetch worker — Phase 2 D-01, D-03, D-06..D-10, D-14.
 *
 * Fan-out child of `ingest-hourly`. One Trigger.dev run per active source.
 *
 *   1. fetchRSSHub(rssUrl) → Response (60s warmup + timeout budget per Phase 1 D-05)
 *   2. parseRSS → RssEntry[]
 *   3. normalize + fingerprint + ON CONFLICT DO NOTHING insert
 *   4. update sources row per D-08 counter semantics
 *
 * maxDuration = 90s: 60s RSSHub cold-start (D-05) + 30s parse/dedup/insert (D-03).
 *
 * Satisfies: INGEST-01 (polling), INGEST-04 (pending status), INGEST-06 (counters),
 * INGEST-07 (per-source isolation via separate Trigger.dev run), INGEST-08 (idempotency
 * via url_fingerprint UNIQUE).
 *
 * Consumed by:
 *   - src/trigger/ingest-hourly.ts — batch.triggerAndWait fan-out
 *   - Trigger.dev dashboard manual-run for debugging a single source
 */
export const fetchSource = task({
  id: 'fetch-source',
  maxDuration: 90,
  run: async (payload: { sourceId: number; rssUrl: string }): Promise<FetchSourceResult> => {
    return runFetchSource({ sourceId: payload.sourceId, rssUrl: payload.rssUrl });
  },
});
