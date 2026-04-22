/**
 * SectionLabel — Phase 4 FEED-06, sidebar.jsx lines 84–97.
 *
 * Renders a 10px uppercase tracked section header used above nav groups
 * in the sidebar (动态 / 管理).
 *
 * Consumed by:
 *   - src/components/layout/sidebar.tsx
 */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 10px 6px',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--fg-3)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}
