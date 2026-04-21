/**
 * External LLM SDK singletons — Phase 3 (LLM-03..07, CLUST-01).
 *
 * Module-scope instantiation mirrors src/lib/db/client.ts — env var non-null
 * assertion is safe because (a) Trigger.dev Cloud has these set (Phase 1 D-07),
 * (b) vitest.setup.ts pre-populates dummy values for module-load-time safety.
 *
 * Consumed by: src/lib/llm/enrich.ts, src/lib/llm/embed.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { VoyageAIClient } from 'voyageai';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
export const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! });
