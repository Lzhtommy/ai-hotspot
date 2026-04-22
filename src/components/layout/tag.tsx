/**
 * Tag chip component — Phase 4 FEED-03, UI-SPEC Copywriting Contract.
 *
 * Renders a 20px-high label chip with tone-driven bg/fg/border.
 * Five tones: accent (amber) / success (green) / info (blue) / danger (red) / neutral (gray).
 * The `active` prop inverts to ink-900 bg + paper fg (selected filter state).
 *
 * Port of .design/feed-ui/project/src/primitives.jsx Tag (lines 66–98).
 * Adapted from window.TAGS[] lookup to getTagTone() import.
 *
 * Consumed by:
 *   - src/components/feed/feed-card.tsx (tags row)
 *   - src/components/feed/filter-popover.tsx
 */

import { getTagTone, type TagTone } from '@/lib/feed/tag-tones';

// Tone→palette map. Matches primitives.jsx L69–75.
const TONE_PALETTE: Record<TagTone, { bg: string; fg: string; bd: string }> = {
  accent: { bg: 'var(--accent-50)', fg: 'var(--accent-700)', bd: 'var(--accent-100)' },
  success: { bg: 'var(--success-50)', fg: 'var(--success-500)', bd: 'transparent' },
  info: { bg: 'var(--info-50)', fg: 'var(--info-500)', bd: 'transparent' },
  danger: { bg: 'var(--danger-50)', fg: 'var(--danger-500)', bd: 'transparent' },
  neutral: { bg: 'var(--surface-1)', fg: 'var(--ink-700)', bd: 'var(--line-weak)' },
};

interface TagProps {
  label: string;
  /** Override the resolved tone; omit to use getTagTone(label) */
  tone?: TagTone;
  /** When true, renders ink-900 bg + paper fg (active filter chip) */
  active?: boolean;
  onClick?: () => void;
}

/**
 * Renders a tag chip. Tone is resolved from the label string via getTagTone()
 * unless explicitly overridden by the `tone` prop.
 */
export function Tag({ label, tone: toneOverride, active, onClick }: TagProps) {
  const tone = toneOverride ?? getTagTone(label);
  const palette = TONE_PALETTE[tone];

  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        // height: 20px from primitives.jsx L82 — off the 4pt scale, preserved verbatim
        height: 20,
        padding: '0 8px', // primitives.jsx L83
        background: active ? 'var(--ink-900)' : palette.bg,
        color: active ? 'var(--paper)' : palette.fg,
        border: `1px solid ${active ? 'var(--ink-900)' : palette.bd}`,
        borderRadius: 4, // --radius-xs
        // fontSize: 11.5px from primitives.jsx L89 — fractional, preserved verbatim
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: 0,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  );
}
