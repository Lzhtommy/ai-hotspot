/**
 * FROZEN enrichment schema — Phase 3 LLM-03..07, LLM-10.
 *
 * WARNING: Changing the fields or bounds invalidates the Anthropic prompt
 * cache (RESEARCH.md §Pitfall 2). Any schema change = new phase sub-plan.
 */
import { z } from 'zod';

export const EnrichmentSchema = z.object({
  title_zh: z.string().min(1).max(200),
  summary_zh: z.string().min(10).max(800),
  score: z.number().int().min(0).max(100),
  recommendation: z.string().min(2).max(80),
  tags: z.array(z.string()).min(1).max(5),
});

export type Enrichment = z.infer<typeof EnrichmentSchema>;
