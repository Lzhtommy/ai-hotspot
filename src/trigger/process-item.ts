import { task } from '@trigger.dev/sdk';
import { runProcessItem, type ProcessItemResult } from '@/lib/llm/process-item-core';
import { startOtel, flushOtel } from '@/lib/llm/otel';
import { withSentry } from './sentry-wrapper';

// OTel bootstrap at module load — idempotent (RESEARCH.md §Pitfall 6).
// Must occur before any Anthropic client instantiation in this process.
startOtel();

/**
 * Per-item LLM-pipeline worker — Phase 3 LLM-01, LLM-11, LLM-13.
 *
 * Thin adapter over src/lib/llm/process-item-core.ts. Responsibilities:
 *   - Ensure OTel is running (startOtel at module load).
 *   - Invoke runProcessItem with the payload itemId.
 *   - In finally{}, call flushOtel() so Langfuse spans reach the dashboard
 *     before the Trigger.dev runtime recycles the worker process (Pitfall 6).
 *
 * Retries: maxAttempts=3 (inherited from trigger.config.ts retries block).
 * LLM-11 terminal conditions (ZodError, EnrichError 'parse'/'schema',
 * EmbedError malformed) are handled INSIDE runProcessItem — the core sets
 * status='dead_letter' and RETURNS (no throw). Non-terminal thrown errors
 * re-throw here and Trigger.dev retries. When retries are exhausted,
 * process-item-core (on the next invocation) sees retryCount >= 3 and
 * flips status='dead_letter' itself.
 *
 * maxDuration=120s: budget is ~15s extract + ~30s Haiku + ~3s Voyage +
 * ~5s cluster transaction + padding.
 *
 * queue.name='llm-pipeline', concurrencyLimit=4: declared inline on the task
 * per W4 locked decision (LLM-01 concurrency contract — code-owned, reproducible
 * across deploys). Prevents Haiku rate-limit burst during fan-out waves.
 *
 * Consumed by:
 *   - src/trigger/process-pending.ts (batch.triggerAndWait fan-out)
 *   - Trigger.dev dashboard manual-run for debugging a single item
 */
export const processItem = task({
  id: 'process-item',
  maxDuration: 120,
  queue: { name: 'llm-pipeline', concurrencyLimit: 4 }, // W4 — locked per LLM-01 contract
  run: async (payload: { itemId: string }): Promise<ProcessItemResult> => {
    // Phase 6 OPS-01 — withSentry wraps the run body so any exception that
    // escapes runProcessItem is captured to Sentry (tagged task=process-item)
    // BEFORE the throw propagates back to Trigger.dev's retry machinery.
    // Sentry.flush(2000) inside the wrapper guarantees the event reaches the
    // collector before the worker recycles. OTel flush still runs in finally{}
    // — Sentry (error capture) and Langfuse/OTel (LLM traces) are orthogonal.
    return await withSentry('process-item', async () => {
      try {
        return await runProcessItem({ itemId: BigInt(payload.itemId) });
      } finally {
        await flushOtel();
      }
    });
  },
});
