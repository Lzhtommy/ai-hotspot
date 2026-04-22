/**
 * Eyebrow label component — Phase 4 FEED-03, UI-SPEC Typography.
 *
 * 10px uppercase tracked text for section labels and the "Claude 推荐理由" header.
 * Default color: --fg-3; accent variant: --accent-700 (for 推荐理由 eyebrow).
 *
 * Port of .design/feed-ui/project/src/primitives.jsx Eyebrow (lines 284–296).
 *
 * Consumed by:
 *   - src/components/feed/feed-card.tsx (推荐理由 amber callout eyebrow)
 *   - src/components/layout/sidebar.tsx (section labels — via SectionLabel wrapper)
 */

interface EyebrowProps {
  children: React.ReactNode;
  /** 'accent' renders --accent-700. Default: --fg-3 */
  variant?: 'default' | 'accent';
  className?: string;
}

/**
 * Uppercase micro-label. Font size 10px with 0.1em letter-spacing
 * matching primitives.jsx L285–295. Weight 600.
 */
export function Eyebrow({ children, variant = 'default', className }: EyebrowProps) {
  const color = variant === 'accent' ? 'var(--accent-700)' : 'var(--fg-3)';

  return (
    <div
      className={className}
      style={{
        fontSize: 10, // primitives.jsx L285 — 10px eyebrow
        fontWeight: 600,
        color,
        letterSpacing: '0.1em', // primitives.jsx L292 tr-eyebrow
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}
