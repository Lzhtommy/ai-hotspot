/**
 * Timeline component — Phase 4 FEED-05, D-20, D-21.
 *
 * RSC component consuming groupByHour output.
 * Renders hour-bucket group headers (今天/昨天/M月D日 + HH:00 + divider + N 条)
 * followed by a column of FeedCard components.
 *
 * Group header spec (D-20 + feed_views.jsx L178–213):
 *   [day label 11px/600 fg-3 uppercase] [HH:00 mono 15px/600 ink-900] [divider] [N 条 mono fg-4]
 *
 * Group spacing: mb-[28px] — off 4pt scale, preserved verbatim per UI-SPEC exception row 6.
 *
 * Port of .design/feed-ui/project/src/feed_views.jsx Timeline (lines 158–237).
 *
 * Consumed by:
 *   - src/app/(reader)/page.tsx
 *   - src/app/(reader)/all/page.tsx
 */

import { groupByHour } from '@/lib/feed/group-by-hour';
import { FeedCard } from './feed-card';
import type { FeedListItem } from '@/lib/feed/get-feed';
import type { FeedItem } from '@/lib/feed/group-by-hour';

interface TimelineProps {
  items: FeedListItem[];
  /** Optional: pre-fetched siblings keyed by clusterId */
  clusterSiblings?: Record<string, FeedListItem[]>;
  /** Anchor for relative day labels (今天/昨天). Defaults to now. */
  now?: Date;
}

/**
 * Hour-grouped timeline of FeedCard items.
 * Group headers show day+hour label + item count in 条.
 */
export function Timeline({ items, clusterSiblings, now }: TimelineProps) {
  // groupByHour expects FeedItem[] — cast via type alias (FeedListItem is a superset)
  const groups = groupByHour(items as unknown as FeedItem[], now);

  if (groups.length === 0) return null;

  return (
    <div
      style={{
        // padding: 24px 32px 80px, max-width 920px — from feed_views.jsx L171
        padding: '24px 32px 80px',
        maxWidth: 920,
        margin: '0 auto',
      }}
    >
      {groups.map((group, groupIndex) => (
        <section
          key={group.bucketKey}
          style={{
            // mb-[28px] — off 4pt scale, preserved per UI-SPEC Spacing exceptions row 6
            marginBottom: groupIndex === groups.length - 1 ? 0 : 28,
          }}
        >
          {/* Group header — day + hour + divider + count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 14,
              paddingBottom: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {/* Day label — 11px/600 fg-3 uppercase from feed_views.jsx L190–197 */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--fg-3)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {group.dayLabel}
              </span>
              {/* Hour label — HH:00 mono 15px/600 ink-900 from feed_views.jsx L199–205 */}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--ink-900)',
                  letterSpacing: 0,
                }}
              >
                {group.hourLabel}
              </span>
            </div>
            {/* Divider rule */}
            <div
              aria-hidden="true"
              style={{ flex: 1, height: 1, background: 'var(--line-weak)' }}
            />
            {/* N 条 — mono fg-4 from feed_views.jsx L211–213 */}
            <span
              style={{
                fontSize: 11,
                color: 'var(--fg-4)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {group.items.length} 条
            </span>
          </div>

          {/* FeedCard column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {group.items.map((item) => {
              const feedItem = item as unknown as FeedListItem;
              const siblings = feedItem.clusterId
                ? clusterSiblings?.[feedItem.clusterId]
                : undefined;
              return <FeedCard key={feedItem.id} item={feedItem} siblings={siblings} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
