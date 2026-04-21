/**
 * LLM pricing constants + cost computation — Phase 3 LLM-12, CLUST-01.
 *
 * Haiku 4.5 + Voyage voyage-3.5 pricing — CLAUDE.md §7 + RESEARCH.md §Sources.
 * USD per million tokens (MTok).
 */

// Haiku 4.5 pricing (CLAUDE.md §7)
const HAIKU_INPUT_PER_MTOK = 1.0;
const HAIKU_OUTPUT_PER_MTOK = 5.0;
const HAIKU_CACHE_READ_PER_MTOK = 0.1; // 10% of input
const HAIKU_CACHE_WRITE_5M_PER_MTOK = 1.25; // 125% of input, 5-min TTL

// Voyage voyage-3.5 pricing (RESEARCH.md §Sources)
const VOYAGE_35_PER_MTOK = 0.06;

export function computeHaikuCostUsd(u: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}): number {
  const inputUsd = (u.input_tokens / 1_000_000) * HAIKU_INPUT_PER_MTOK;
  const outputUsd = (u.output_tokens / 1_000_000) * HAIKU_OUTPUT_PER_MTOK;
  const cacheReadUsd = (u.cache_read_input_tokens / 1_000_000) * HAIKU_CACHE_READ_PER_MTOK;
  const cacheWriteUsd =
    (u.cache_creation_input_tokens / 1_000_000) * HAIKU_CACHE_WRITE_5M_PER_MTOK;
  return inputUsd + outputUsd + cacheReadUsd + cacheWriteUsd;
}

export function computeVoyageCostUsd(tokens: number): number {
  return (tokens / 1_000_000) * VOYAGE_35_PER_MTOK;
}
