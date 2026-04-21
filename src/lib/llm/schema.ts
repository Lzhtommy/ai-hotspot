/**
 * FROZEN enrichment schema — Phase 3 LLM-03..07, LLM-10.
 *
 * WARNING: Changing the fields or bounds invalidates the Anthropic prompt
 * cache (RESEARCH.md §Pitfall 2). Any schema change = new phase sub-plan.
 *
 * Uses zod/v4 subpath (bundled inside zod@3.25+) because @anthropic-ai/sdk@0.90
 * zodOutputFormat helper calls z.toJSONSchema() which is a v4-only API. Both
 * zod v3 and v4 APIs are available in zod@3.25 — v4 via the 'zod/v4' subpath.
 */
import { z } from 'zod/v4';

export const EnrichmentSchema = z.object({
  title_zh: z.string().min(1).max(200),
  summary_zh: z.string().min(10).max(800),
  score: z.number().int().min(0).max(100),
  recommendation: z.string().min(2).max(80),
  tags: z.array(z.string()).min(1).max(5),
});

export type Enrichment = z.infer<typeof EnrichmentSchema>;
