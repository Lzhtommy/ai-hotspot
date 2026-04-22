/**
 * Hotness bar — Phase 4 FEED-03, D-17 cluster sibling meta.
 *
 * Decorative 3px-tall horizontal bar; fill width proportional to score.
 * aria-hidden because it is used decoratively inside sibling meta rows
 * where the score number already provides the value.
 *
 * Port of .design/feed-ui/project/src/primitives.jsx HotnessBar (lines 167–184).
 *
 * Consumed by:
 *   - src/components/feed/cluster-siblings.tsx (sibling meta row)
 */

interface HotnessBarProps {
  score: number;
  /** Max bar width in pixels. Default: 60 */
  maxWidth?: number;
}

/**
 * 3px-tall decorative progress bar representing hotness score.
 * Purely visual; aria-hidden.
 */
export function HotnessBar({ score, maxWidth = 60 }: HotnessBarProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: maxWidth,
        // height: 3px — off 4pt scale, preserved verbatim from primitives.jsx L171
        height: 3,
        background: 'var(--surface-1)',
        borderRadius: 999,
        overflow: 'hidden',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: 'block',
          width: `${clampedScore}%`,
          height: '100%',
          background: 'var(--accent-500)',
          borderRadius: 999,
        }}
      />
    </span>
  );
}
