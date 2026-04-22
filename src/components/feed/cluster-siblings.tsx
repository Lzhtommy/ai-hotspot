/**
 * Expanded cluster siblings list — Phase 4 FEED-03, D-17 step 7.
 *
 * RSC component. Renders a bordered list of cluster-mate sources when the
 * ClusterTrigger is expanded. The wrapper div uses id="cluster-siblings-{clusterId}"
 * so ClusterTrigger's aria-controls wires to it.
 *
 * Each sibling row: SourceDot(14px) + title (linked to /items/{id}) + meta line
 * ({source_name} · {time HH:mm Asia/Shanghai} · 热度 {score}) + external-link.
 *
 * Port of .design/feed-ui/project/src/feed_card.jsx ClusterSiblings (lines 7–72).
 *
 * Consumed by:
 *   - src/components/feed/cluster-section.tsx
 */

import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { SourceDot } from '@/components/layout/source-dot';
import { Icon } from '@/components/layout/icon';
import type { FeedListItem } from '@/lib/feed/get-feed';
import { HotnessBar } from './hotness-bar';

const TZ = 'Asia/Shanghai';

interface ClusterSiblingsProps {
  clusterId: string;
  siblings: FeedListItem[];
}

/**
 * Bordered list of cluster sibling items. Hidden until ClusterTrigger expands.
 * id="cluster-siblings-{clusterId}" pairs with aria-controls on ClusterTrigger.
 */
export function ClusterSiblings({ clusterId, siblings }: ClusterSiblingsProps) {
  if (!siblings || siblings.length === 0) return null;

  return (
    <div
      id={`cluster-siblings-${clusterId}`}
      style={{
        // marginTop: 12px — off scale, from feed_card.jsx L14
        marginTop: 12,
        // left border line per feed_card.jsx L15
        paddingLeft: 12,
        borderLeft: '2px solid var(--line-weak)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {siblings.map((sibling) => {
        // Format time in Asia/Shanghai
        let timeStr = '';
        try {
          // publishedAt is a string ISO in FeedListItem — parse to Date for formatting
          timeStr = formatInTimeZone(new Date(sibling.publishedAt), TZ, 'HH:mm');
        } catch {
          timeStr = '';
        }

        return (
          <div
            key={sibling.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              paddingRight: 8,
            }}
          >
            <SourceDot sourceId={sibling.sourceId} nameHint={sibling.sourceName} size={14} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title linked to item detail — 12.5px/500 from feed_card.jsx L36–42 */}
              <Link
                href={`/items/${sibling.id}`}
                style={{
                  fontSize: 12.5,
                  color: 'var(--ink-900)',
                  fontWeight: 500,
                  lineHeight: 1.45,
                  letterSpacing: '-0.003em',
                  textDecoration: 'none',
                  display: 'block',
                }}
              >
                {sibling.titleZh ?? sibling.title}
              </Link>
              {/* Meta line: source · time · 热度 N — from feed_card.jsx L44–65 */}
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--fg-3)',
                  marginTop: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <span>{sibling.sourceName}</span>
                <span
                  style={{
                    width: 2,
                    height: 2,
                    borderRadius: '50%',
                    background: 'var(--fg-4)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)' }}>{timeStr}</span>
                <span
                  style={{
                    width: 2,
                    height: 2,
                    borderRadius: '50%',
                    background: 'var(--fg-4)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)' }}>热度 {sibling.score}</span>
                <HotnessBar score={sibling.score} maxWidth={40} />
              </div>
            </div>
            {/* External-link button — opens sibling URL in new tab */}
            <a
              href={sibling.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`打开原文: ${sibling.titleZh ?? sibling.title}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                opacity: 0.5,
                marginTop: 2,
                flexShrink: 0,
              }}
            >
              <Icon name="external-link" size={12} />
            </a>
          </div>
        );
      })}
    </div>
  );
}
