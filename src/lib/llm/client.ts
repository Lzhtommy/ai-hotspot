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

export const voyage = {
  async embed(params: VoyageEmbedParams): Promise<VoyageEmbedResponse> {
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
    if (!res.ok) {
      const err = new Error(`VoyageAPI ${res.status}`);
      err.name = 'VoyageAPIError';
      throw err;
    }
    return (await res.json()) as VoyageEmbedResponse;
  },
};
