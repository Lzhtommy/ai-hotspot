/**
 * External LLM SDK singletons — Phase 3 (LLM-03..07, CLUST-01).
 *
 * Module-scope instantiation mirrors src/lib/db/client.ts — env var non-null
 * assertion is safe because (a) Trigger.dev Cloud has these set (Phase 1 D-07),
 * (b) vitest.setup.ts pre-populates dummy values for module-load-time safety.
 *
 * Voyage client is a hand-rolled fetch wrapper rather than the `voyageai`
 * SDK because voyageai@0.2.1 ships broken ESM (extensionless directory
 * re-exports) that Trigger.dev's esbuild bundler and Node's strict ESM
 * loader both reject. Surface matches the SDK's `.embed()` signature so
 * callers and tests remain unchanged.
 *
 * In-process rate limit: Voyage's free tier is 3 RPM (~20s between calls).
 * A serialized promise-chain ensures requests are spaced ≥VOYAGE_INTERVAL_MS
 * apart within a single Node process. 429 responses honor Retry-After and
 * queue behind the next available slot. Cross-process coordination (e.g.
 * multiple Trigger.dev replicas) would need Redis-based limiting.
 *
 * Consumed by: src/lib/llm/enrich.ts, src/lib/llm/embed.ts
 */
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface VoyageEmbedParams {
  input: string[];
  model: string;
  inputType: 'document' | 'query';
}

export interface VoyageEmbedResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

// Voyage free-tier limit; override via env for paid tier.
const VOYAGE_RPM = Number(process.env.VOYAGE_RPM ?? 3);
const VOYAGE_INTERVAL_MS = Math.ceil(60_000 / VOYAGE_RPM);
const VOYAGE_429_MAX_RETRIES = 2;

let lastVoyageCallAt = 0;
let voyageChain: Promise<void> = Promise.resolve();

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Serialize callers and enforce ≥VOYAGE_INTERVAL_MS between Voyage API calls.
 * Chains onto a module-scope Promise so bursts queue FIFO instead of racing
 * on the `since`-the-last-call check.
 */
function acquireVoyageSlot(): Promise<void> {
  const next = voyageChain.then(async () => {
    const since = Date.now() - lastVoyageCallAt;
    if (since < VOYAGE_INTERVAL_MS) {
      await sleep(VOYAGE_INTERVAL_MS - since);
    }
    lastVoyageCallAt = Date.now();
  });
  voyageChain = next.catch(() => undefined);
  return next;
}

async function voyageFetch(params: VoyageEmbedParams): Promise<VoyageEmbedResponse> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: params.input,
      model: params.model,
      input_type: params.inputType,
    }),
  });
  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : VOYAGE_INTERVAL_MS;
    const err = new Error(`VoyageAPI 429`);
    err.name = 'VoyageRateLimitError';
    (err as Error & { retryAfterMs: number }).retryAfterMs = retryAfterMs;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`VoyageAPI ${res.status}`);
    err.name = 'VoyageAPIError';
    throw err;
  }
  return (await res.json()) as VoyageEmbedResponse;
}

export const voyage = {
  async embed(params: VoyageEmbedParams): Promise<VoyageEmbedResponse> {
    for (let attempt = 0; attempt <= VOYAGE_429_MAX_RETRIES; attempt++) {
      await acquireVoyageSlot();
      try {
        return await voyageFetch(params);
      } catch (err) {
        if (
          err instanceof Error &&
          err.name === 'VoyageRateLimitError' &&
          attempt < VOYAGE_429_MAX_RETRIES
        ) {
          const retryAfterMs =
            (err as Error & { retryAfterMs?: number }).retryAfterMs ?? VOYAGE_INTERVAL_MS;
          // Server told us to wait — sleep, then go back through the slot
          // limiter so we never preempt queued callers.
          await sleep(retryAfterMs);
          continue;
        }
        throw err;
      }
    }
    // Exhausted retries on 429 — rethrow a final rate-limit error.
    const err = new Error(`VoyageAPI 429 (exhausted ${VOYAGE_429_MAX_RETRIES} retries)`);
    err.name = 'VoyageRateLimitError';
    throw err;
  },
};
