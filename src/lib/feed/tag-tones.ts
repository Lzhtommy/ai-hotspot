/**
 * Tag display-tone mapping — Phase 4 FEED-03, UI-SPEC Copywriting Contract.
 *
 * Maps a tag string to one of 5 tone variants (accent/success/info/danger/neutral).
 * Unknown tags fall back to neutral. This mapping ships in code; Phase 6 may
 * migrate it to a tags DB column when the tag vocabulary grows.
 *
 * Consumed by:
 *   - src/components/layout/tag.tsx
 *   - src/components/feed/feed-card.tsx
 */

export type TagTone = 'accent' | 'success' | 'info' | 'danger' | 'neutral';

// Authoritative mapping per UI-SPEC Tag→tone table.
// accent  = headline news, model releases
// info    = research, organizational attribution
// success = community-positive (open-source releases)
// danger  = negative-signal (controversy, safety incidents)
// neutral = default for everything else (Agent, 编码, RAG, 推理, 多模态, …)
const TONE_MAP: Record<string, TagTone> = {
  // accent — headline releases
  '模型发布': 'accent',
  '新产品': 'accent',

  // info — organizational + research
  Anthropic: 'info',
  OpenAI: 'info',
  DeepMind: 'info',
  Google: 'info',
  Meta: 'info',
  Microsoft: 'info',
  论文: 'info',
  研究: 'info',
  Benchmark: 'info',
  API: 'info',

  // success — community-positive
  开源: 'success',
  Release: 'success',

  // danger — negative-signal
  争议: 'danger',
  安全事件: 'danger',
  回滚: 'danger',
  Deprecated: 'danger',
  撤回: 'danger',
};

/**
 * Returns the display tone for a tag label string.
 * Unknown tags return 'neutral' — the safe fallback rendering.
 */
export function getTagTone(tag: string): TagTone {
  return TONE_MAP[tag] ?? 'neutral';
}
