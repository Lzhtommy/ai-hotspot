/**
 * Skeleton card — Phase 4 FEED-03, UI-SPEC Loading State.
 *
 * RSC Suspense fallback for FeedCard. Renders a gray-shimmer placeholder
 * matching FeedCard's comfortable-density layout heights:
 *   - Top meta row: 18px
 *   - Title: 22px
 *   - Summary: 56px (two lines ~28px each with 1.6 line-height)
 *   - Tags row: 20px
 *
 * Uses Tailwind animate-pulse for shimmer per UI-SPEC.
 * No text content — pure visual placeholder.
 *
 * Consumed by:
 *   - src/app/(reader)/loading.tsx (6 skeleton cards)
 */

/**
 * Gray-shimmer skeleton card matching FeedCard layout heights.
 */
export function SkeletonCard() {
  return (
    <article
      aria-hidden="true"
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--line-weak)',
        borderRadius: 8,
        // py-[18px] px-[22px] — comfortable density per D-18
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }}
    >
      {/* Top meta row — 18px from UI-SPEC Loading State */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Source dot */}
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: 'var(--surface-1)',
            flexShrink: 0,
          }}
        />
        {/* Source name */}
        <span
          style={{
            width: 80,
            height: 12,
            borderRadius: 4,
            background: 'var(--surface-1)',
          }}
        />
        {/* Score badge area */}
        <span
          style={{
            marginLeft: 'auto',
            width: 48,
            height: 18,
            borderRadius: 4,
            background: 'var(--surface-1)',
          }}
        />
      </div>

      {/* Title — 22px from UI-SPEC Loading State */}
      <span
        style={{
          width: '85%',
          height: 22,
          borderRadius: 4,
          background: 'var(--surface-1)',
        }}
      />

      {/* Summary — 56px from UI-SPEC Loading State (approx 2 lines) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{ width: '100%', height: 14, borderRadius: 4, background: 'var(--surface-1)' }}
        />
        <span
          style={{ width: '75%', height: 14, borderRadius: 4, background: 'var(--surface-1)' }}
        />
        <span
          style={{ width: '90%', height: 14, borderRadius: 4, background: 'var(--surface-1)' }}
        />
      </div>

      {/* Tags row — 20px from UI-SPEC Loading State */}
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ width: 56, height: 20, borderRadius: 4, background: 'var(--surface-1)' }} />
        <span style={{ width: 48, height: 20, borderRadius: 4, background: 'var(--surface-1)' }} />
        <span style={{ width: 64, height: 20, borderRadius: 4, background: 'var(--surface-1)' }} />
      </div>
    </article>
  );
}
