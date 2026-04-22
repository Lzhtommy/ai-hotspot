/**
 * Source monogram dot — Phase 4 FEED-03, D-07.
 *
 * Renders a colored square with a 1–2 char initial representing a source.
 * Color and initial come from the static source-palette map. Decorative by
 * design — the source name text sits adjacent in DOM and provides the label.
 *
 * Port of .design/feed-ui/project/src/primitives.jsx SourceDot (lines 18–44).
 * Adapted from window.SOURCES[] lookup to getSourcePalette() import.
 *
 * Consumed by:
 *   - src/components/feed/feed-card.tsx (top meta row)
 *   - src/components/feed/cluster-siblings.tsx
 */

import { getSourcePalette } from '@/lib/feed/source-palette';

interface SourceDotProps {
  sourceId: number;
  /** Fallback name used to derive the initial when sourceId is unknown */
  nameHint?: string;
  /** Pixel size for width + height. Default: 18 (from primitives.jsx L19) */
  size?: number;
}

/**
 * Colored square monogram for a data source.
 * aria-hidden="true" — the adjacent source name text provides accessibility label.
 */
export function SourceDot({ sourceId, nameHint, size = 18 }: SourceDotProps) {
  const palette = getSourcePalette(sourceId, nameHint);
  // Font size: Math.max(9, size * 0.55) from primitives.jsx L34
  const fontSize = Math.max(9, Math.round(size * 0.55));

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 4, // --radius-xs from tokens
        background: palette.color,
        color: '#fff',
        fontSize,
        fontWeight: 600,
        flexShrink: 0,
        fontFamily: 'var(--font-sans)',
        letterSpacing: 0,
        lineHeight: 1,
      }}
    >
      {palette.initial}
    </span>
  );
}
