/**
 * Horizontal or vertical divider — Phase 4 FEED-03.
 *
 * 1px hairline in var(--line-weak). Horizontal by default (full-width).
 * Port of .design/feed-ui/project/src/primitives.jsx Divider (lines 275–282).
 *
 * Consumed by:
 *   - src/components/feed/feed-card.tsx (above action bar)
 *   - src/components/layout/sidebar.tsx (section separators)
 */

interface DividerProps {
  /** Renders a 1px × 16px vertical bar when true. Default: false (horizontal) */
  vertical?: boolean;
  /** Margin around the divider in px. Default: 12 from primitives.jsx L276 */
  space?: number;
  className?: string;
}

/**
 * Renders a 1px hairline divider. Horizontal fills full width;
 * vertical is 16px tall. Space controls the margin on the perpendicular axis.
 */
export function Divider({ vertical, space = 12, className }: DividerProps) {
  if (vertical) {
    return (
      <div
        className={className}
        style={{
          width: 1,
          height: 16, // primitives.jsx L276
          background: 'var(--line-weak)',
          margin: `0 ${space / 2}px`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      className={className}
      style={{
        height: 1,
        background: 'var(--line-weak)',
        margin: `${space}px 0`, // primitives.jsx L281
      }}
    />
  );
}
