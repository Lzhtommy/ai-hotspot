/**
 * Source visual identity map — Phase 4 FEED-03, D-07.
 *
 * Maps sources.id → { color hex, initial 1–2 char }. Used by <SourceDot>.
 * Phase 4 ships as a static map matching seeded Phase 2 sources; Phase 6 may
 * migrate to a sources.palette JSON column when the source list grows beyond ~20.
 *
 * Consumed by:
 *   - src/components/layout/source-dot.tsx
 */

export interface SourcePalette {
  color: string;
  initial: string;
}

// NOTE: keys MUST match drizzle/seed-sources.ts seeded sources.id values.
// Canary sources seeded in Phase 2 (3 rows): Anthropic Blog, Hacker News AI, buzzing.cc.
// IDs are bigserial — the first 3 inserts produce ids 1, 2, 3 unless the sequence was
// already bumped by prior runs. If seeded ids differ, update these keys.
// When Phase 6 adds a source, append a row here (until the column migration lands).
const PALETTE: Record<number, SourcePalette> = {
  // Anthropic Blog (#C5846A warm amber-terracotta; initial 'An')
  1: { color: '#C5846A', initial: 'An' },
  // Hacker News AI (#FF6600 HN orange; initial 'HN')
  2: { color: '#FF6600', initial: 'HN' },
  // buzzing.cc (#6C63FF indigo; initial 'Bz')
  3: { color: '#6C63FF', initial: 'Bz' },
  // Common additional sources pre-registered for easy extension:
  // OpenAI
  4: { color: '#10A37F', initial: 'OA' },
  // DeepMind / Google
  5: { color: '#4285F4', initial: 'GM' },
  // Hugging Face
  6: { color: '#FF9D00', initial: 'HF' },
  // X / Twitter
  7: { color: '#1D9BF0', initial: 'X' },
  // Reddit
  8: { color: '#FF4500', initial: 'Rd' },
};

const FALLBACK: SourcePalette = { color: '#807a6d', initial: '源' };

/**
 * Returns the palette entry for a given source id.
 * Falls back to a neutral gray monogram — using nameHint's first char if supplied —
 * so unknown sources always render something rather than nothing.
 */
export function getSourcePalette(
  sourceId: number | null | undefined,
  nameHint?: string,
): SourcePalette {
  if (sourceId != null && PALETTE[sourceId]) return PALETTE[sourceId];
  if (nameHint && nameHint.length > 0) {
    return { color: FALLBACK.color, initial: nameHint.slice(0, 2).toUpperCase() };
  }
  return FALLBACK;
}
