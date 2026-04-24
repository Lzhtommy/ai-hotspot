import { schedules, batch } from '@trigger.dev/sdk';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { fetchSource } from './fetch-source';

/**
 * Hourly ingestion scheduler — Phase 2 D-01, D-02, D-10, INGEST-01, INGEST-07, INGEST-08.
 *
 * Cron: `0 * * * *` (top of every hour, UTC).
 *
 * Topology:
 *   1. Enumerate sources where is_active = true.
 *   2. Fan out via batch.triggerAndWait → one child `fetch-source` run per source.
 *   3. Aggregate per-source results; return a run-level summary for Trigger.dev logs.
 *
 * INGEST-07 source isolation is structural — each child has its own Trigger.dev run,
 * its own 90s timeout (D-03), its own retry budget. A failing child surfaces as a
 * `failure` entry in `batch.triggerAndWait`'s return array; siblings are unaffected.
 *
 * INGEST-08 idempotency: driven by `items.url_fingerprint` UNIQUE — re-running this
 * cron within the same hour inserts zero new items (D-10).
 *
 * LLM pipeline handoff (INGEST-04, D-17): fetch-source writes items with status='pending';
 * Phase 3 decides how to pull from that queue. This task does not call Phase 3.
 *
 * The `run` function takes only `payload` (no `ctx`). TaskOptions.run is typed as
 * `(payload, params) => Promise<...>` in @trigger.dev/core@4.4.4 (tasks.d.ts:213),
 * but TS function-parameter contravariance accepts a handler that ignores the
 * second param — the matching JSDoc example at tasks.d.ts:201 uses exactly this
 * single-arg form. Avoids `{ ctx }` destructuring that triggers unused-locals errors.
 *
 * Consumed by:
 *   - Trigger.dev scheduler (automatic, hourly)
 *   - Trigger.dev dashboard manual-run for on-demand ingestion
 */
export const ingestHourly = schedules.task({
  id: 'ingest-hourly',
  cron: '0 * * * *',
  run: async (payload) => {
    // Phase 6 Plan 06-02 (ADMIN-05): skip soft-deleted sources. A source
    // with `deleted_at IS NOT NULL` is removed from the admin UI and MUST
    // NOT be polled — items previously ingested from it remain in the feed
    // but no new fetches occur. `is_active = false` is the admin's manual
    // disable toggle (per-source pause without loss of data); both filters
    // coexist so either channel independently takes a source out of rotation.
    const active = await db
      .select({ id: sources.id, rssUrl: sources.rssUrl })
      .from(sources)
      .where(and(eq(sources.isActive, true), isNull(sources.deletedAt)));

    if (active.length === 0) {
      return {
        scheduledAt: payload.timestamp,
        sourceCount: 0,
        successes: 0,
        failures: 0,
        newItemsTotal: 0,
      };
    }

    // Trigger.dev v4: batch.triggerAndWait takes an Array<{ id, payload }>
    // directly (no separate task-id positional arg as in v3). Each item binds
    // to a task by its string `id`. Verified against @trigger.dev/sdk@4.4.4
    // shared.d.ts:232 (batchTriggerByIdAndWait) — the v4 fix for the v3 API
    // shape documented in this plan's research findings.
    const batchItems = active.map((s) => ({
      id: 'fetch-source' as const,
      payload: { sourceId: s.id, rssUrl: s.rssUrl },
    }));

    const result = await batch.triggerAndWait<typeof fetchSource>(batchItems);

    let successes = 0;
    let failures = 0;
    let newItemsTotal = 0;

    for (const run of result.runs) {
      if (run.ok) {
        successes += 1;
        newItemsTotal += run.output?.newCount ?? 0;
      } else {
        // D-02: aggregate only — per-source error detail lives in the child run's logs.
        failures += 1;
      }
    }

    return {
      scheduledAt: payload.timestamp,
      sourceCount: active.length,
      successes,
      failures,
      newItemsTotal,
    };
  },
});
