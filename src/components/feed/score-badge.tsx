/**
 * Score badge component — Phase 4 FEED-03, D-17 step 1, D-19.
 *
 * Renders a numeric hotness score in the 0–100 range.
 * When score >= 80, adds a "HOT" amber chip per UI-SPEC (D-19).
 *
 * Port of .design/feed-ui/project/src/primitives.jsx ScoreBadge full variant
 * (lines 101–165).
 *
 * Consumed by:
 *   - src/components/feed/feed-card.tsx (top meta row)
 */

interface ScoreBadgeProps {
  score: number;
}

/**
 * Numeric score badge. HOT chip renders when score >= 80.
 * aria-label="热度评分 {score}/100" per UI-SPEC Accessibility Contract.
 */
export function ScoreBadge({ score }: ScoreBadgeProps) {
  const hot = score >= 80;
  return (
    <div
      role="img"
      aria-label={`热度评分 ${score}/100`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
      }}
    >
      {/* Score number — 18px mono 600 from primitives.jsx L112 */}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--ink-900)',
          lineHeight: 1,
        }}
      >
        {score}
      </span>
      {/* /100 — 10px fg-3 from primitives.jsx L121 */}
      <span
        style={{
          fontSize: 10,
          color: 'var(--fg-3)',
          lineHeight: 1,
        }}
      >
        /100
      </span>
      {hot && (
        /* HOT chip — accent-50 bg, accent-700 text, accent-100 border, pill shape
           from primitives.jsx L129–145; UI-SPEC D-19 */
        <span
          aria-hidden="true"
          style={{
            marginLeft: 4,
            padding: '1px 6px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            background: 'var(--accent-50)',
            color: 'var(--accent-700)',
            border: '1px solid var(--accent-100)',
            lineHeight: 1.5,
          }}
        >
          HOT
        </span>
      )}
    </div>
  );
}
