import { schedules, batch } from '@trigger.dev/sdk';
import { sql } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { processItem } from './process-item';
import { refreshClusters } from './refresh-clusters';
import { buildDebounceOpts } from '@/lib/cluster/refresh';

const BATCH_SIZE = 20; // RESEARCH.md Open Q #5 — 20 items per tick at */5 cron = 240/hour ceiling

/**
 * LLM-pipeline scheduled poller — Phase 3 LLM-01, CLUST-06.
 *
 * Cron: `*\/5 * * * *` (every 5 minutes, UTC). Backslash is an escaping
 * artifact of TypeScript JSDoc — the actual cron string has no backslash.
 *
 * Topology:
 *   1. Atomic claim: UPDATE items SET status='processing' WHERE id IN (
 *        SELECT id FROM items WHERE status='pending' ORDER BY ingested_at
 *        LIMIT 20 FOR UPDATE SKIP LOCKED
 *      ) RETURNING id.
 *      FOR UPDATE SKIP LOCKED (RESEARCH.md Pitfall 7) prevents double
 *      pickup if two pollers ever overlap.
 *   2. Fan out via batch.triggerAndWait → one process-item run per claimed id.
 *      Queue 'llm-pipeline' + concurrency 4 (declared on process-item task — W4).
 *   3. If >=1 child published, enqueue refresh-clusters with debounce
 *      (key='refresh-clusters', delay='60s') so bursts coalesce into one
 *      bookkeeping run 60s after last enqueue (CLUST-06).
 *      Assumption A8 verified: TriggerOptions.debounce exists in
 *      @trigger.dev/core@4.4.4 types — Path A taken.
 *
 * LLM-11: retry budget lives on the process-item task (maxAttempts=3).
 * Terminal errors (ZodError, malformed LLM response) are handled inside
 * runProcessItem — children return { status: 'dead_letter' } rather than
 * throw, so batch.triggerAndWait sees them as `ok: true` with a dead-letter
 * output. Successes are tallied the same way.
 *
 * LLM-13: OTel startOtel is called at each process-item's module load;
 * flushOtel in its finally. This scheduler does not need its own OTel wiring.
 *
 * T-03-18: FOR UPDATE SKIP LOCKED ensures at-most-once pickup across
 * parallel pollers. T-03-19: debounce enqueue error log emits only err.name.
 * T-03-20: BATCH_SIZE=20 + cron every-5-min caps throughput at 240 items/hour.
 *
 * Consumed by:
 *   - Trigger.dev scheduler (automatic, every 5 min)
 *   - Trigger.dev dashboard manual-trigger for catch-up runs
 */

export interface ClaimPendingItemsDeps {
  db?: typeof realDb;
  batchSize?: number;
}

/**
 * Pure exported helper for unit testing — claims up to batchSize 'pending'
 * items atomically via UPDATE ... FOR UPDATE SKIP LOCKED RETURNING id.
 * Uses injected db or falls back to the real singleton (B2 testability).
 */
export async function claimPendingItems(deps: ClaimPendingItemsDeps = {}): Promise<string[]> {
  const d = deps.db ?? realDb;
  const size = deps.batchSize ?? BATCH_SIZE;
  const claimed = (await d.execute(sql`
    UPDATE items SET status = 'processing'
    WHERE id IN (
      SELECT id FROM items
      WHERE status = 'pending'
      ORDER BY ingested_at ASC
      LIMIT ${size}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  return claimed.rows.map((r) => r.id);
}

export const processPending = schedules.task({
  id: 'process-pending',
  cron: '*/5 * * * *',
  run: async (payload) => {
    // STEP 1 — atomic claim (delegates to pure helper)
    const ids = await claimPendingItems();

    if (ids.length === 0) {
      return {
        scheduledAt: payload.timestamp,
        claimed: 0,
        successes: 0,
        deadLetters: 0,
        failures: 0,
      };
    }

    // STEP 2 — fan out via batch.triggerAndWait (one process-item run per claimed id)
    const batchItems = ids.map((id) => ({
      id: 'process-item' as const,
      payload: { itemId: id },
    }));
    const result = await batch.triggerAndWait<typeof processItem>(batchItems);

    let successes = 0;
    let deadLetters = 0;
    let failures = 0;
    let anyPublished = false;

    for (const run of result.runs) {
      if (!run.ok) {
        failures += 1;
        continue;
      }
      if (run.output?.status === 'published') {
        successes += 1;
        anyPublished = true;
      } else if (run.output?.status === 'dead_letter') {
        deadLetters += 1;
      }
    }

    // STEP 3 — debounced refresh-clusters enqueue (only when at least one item published).
    // Dead-letters and failures don't mutate clusters so no refresh needed.
    // A8: Trigger.dev v4 TriggerOptions.debounce confirmed — Path A.
    if (anyPublished) {
      const opts = buildDebounceOpts();
      try {
        await refreshClusters.trigger(undefined, { debounce: opts });
      } catch (err) {
        // T-03-19: log only err.name — never err.message (may contain URLs/keys).
        // Debounce enqueue failure is non-fatal — next scheduler tick re-enqueues.
        console.error(
          `refresh-clusters debounce enqueue failed: ${err instanceof Error ? err.name : 'unknown'}`,
        );
      }
    }

    return {
      scheduledAt: payload.timestamp,
      claimed: ids.length,
      successes,
      deadLetters,
      failures,
    };
  },
});
