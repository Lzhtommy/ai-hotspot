'use client';

/**
 * Cluster expand/collapse button — Phase 4 FEED-03, D-17 step 6.
 *
 * Client Component because it toggles sibling list visibility.
 * Renders a dashed-border button with:
 *   - 3 stacked colored squares (verbatim design colors #D4911C / #2558B5 / #E4572E)
 *   - Label: "另有 {N} 个源也报道了此事件" ({N} bolded)
 *   - Chevron icon that flips chevron-down ↔ chevron-up based on expanded state
 *
 * aria-expanded + aria-controls link to <ClusterSiblings id="cluster-siblings-{clusterId}">.
 *
 * Port of .design/feed-ui/project/src/feed_card.jsx ClusterTrigger (lines 74–122).
 *
 * Consumed by:
 *   - src/components/feed/cluster-section.tsx
 */

import { Icon } from '@/components/layout/icon';

interface ClusterTriggerProps {
  clusterId: string;
  memberCount: number;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Dashed-border toggle button revealing cluster sibling sources.
 * Exact Chinese copy: "另有 N 个源也报道了此事件" (UI-SPEC Copywriting Contract).
 */
export function ClusterTrigger({
  clusterId,
  memberCount,
  expanded,
  onToggle,
}: ClusterTriggerProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={`cluster-siblings-${clusterId}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'transparent',
        // dashed border per feed_card.jsx L80
        border: '1px dashed var(--line)',
        borderRadius: 6,
        // padding: 6px 10px — off 4pt scale, preserved verbatim from feed_card.jsx L82
        padding: '6px 10px',
        fontSize: 12,
        fontFamily: 'inherit',
        color: 'var(--fg-2)',
        cursor: 'pointer',
        // marginTop: 10px — off scale, per feed_card.jsx L88
        marginTop: 10,
        letterSpacing: 0,
        width: '100%',
        textAlign: 'left',
        transition: 'background 120ms var(--ease)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-1)';
        (e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed';
      }}
    >
      {/* Stacked colored squares — 3 hardcoded design swatches (UI-SPEC cluster-trigger resolution)
          Colors: #D4911C (amber), #2558B5 (blue), #E4572E (terracotta)
          from feed_card.jsx L103–115 */}
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        {[0, 1, 2].slice(0, Math.min(3, memberCount)).map((_, i) => (
          <span
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: (['#D4911C', '#2558B5', '#E4572E'] as const)[i],
              marginLeft: i === 0 ? 0 : -4,
              border: '1.5px solid var(--surface-0)',
            }}
          />
        ))}
      </span>
      <span>
        另有 <b style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{memberCount}</b>{' '}
        个源也报道了此事件
      </span>
      <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} />
    </button>
  );
}
