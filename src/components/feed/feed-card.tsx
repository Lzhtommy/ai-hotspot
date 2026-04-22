/**
 * FeedCard — centerpiece card component — Phase 4 FEED-03, D-17.
 *
 * RSC outer component implementing all 8 anatomy steps:
 *   1. Top meta row: SourceDot + source name + time + optional 官方 chip + ScoreBadge
 *   2. Title (h3) wrapped in Link to /items/{id}
 *   3. Summary paragraph
 *   4. 推荐理由 amber callout (conditional on recommendation)
 *   5. Tags row
 *   6+7. ClusterSection (conditional on clusterMemberCount > 1)
 *   8. FeedCardActions client island
 *
 * Card title (step 2) is wrapped in <Link href="/items/{id}"> — NOT the whole card
 * (avoids nested-interactive-elements since card contains buttons/links).
 *
 * Port of .design/feed-ui/project/src/feed_card.jsx FeedCard (lines 124–352).
 *
 * Consumed by:
 *   - src/components/feed/timeline.tsx
 *   - src/app/(reader)/page.tsx (via Timeline)
 */

import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { SourceDot } from '@/components/layout/source-dot';
import { Tag } from '@/components/layout/tag';
import { ScoreBadge } from './score-badge';
import { ClusterSection } from './cluster-section';
import { FeedCardActions } from './feed-card-actions';
import type { FeedListItem } from '@/lib/feed/get-feed';

const TZ = 'Asia/Shanghai';

interface FeedCardProps {
  item: FeedListItem;
  /** Pre-fetched cluster sibling items (passed from getFeed join) */
  siblings?: FeedListItem[];
}

/**
 * Full-density FeedCard RSC implementing D-17 eight-step anatomy.
 * All pixel values traced to feed_card.jsx source lines.
 */
export function FeedCard({ item, siblings }: FeedCardProps) {
  // Format published time in Asia/Shanghai per D-21
  let timeStr = '';
  try {
    timeStr = formatInTimeZone(new Date(item.publishedAt), TZ, 'HH:mm');
  } catch {
    timeStr = '';
  }

  const isOfficial = item.sourceKind === 'official';
  const hasCluster = item.clusterMemberCount > 1 && item.clusterId != null;

  return (
    <article
      style={{
        // bg-surface-0, border line-weak, radius 8px — feed_card.jsx L163–174
        background: 'var(--surface-0)',
        border: '1px solid var(--line-weak)',
        borderRadius: 8,
        // py-[18px] px-[22px] — comfortable density D-18, feed_card.jsx L150
        padding: '18px 22px',
        position: 'relative',
      }}
    >
      {/* ——— Step 1: Top meta row ——— */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          // mb-[10px] — off scale from feed_card.jsx L178
          marginBottom: 10,
        }}
      >
        {/* 18px SourceDot per D-17 step 1 */}
        <SourceDot sourceId={item.sourceId} nameHint={item.sourceName} size={18} />

        {/* Source name — 12.5px/500 ink-700 from feed_card.jsx L181 */}
        <span
          style={{
            fontSize: 12.5,
            color: 'var(--ink-700)',
            fontWeight: 500,
          }}
        >
          {item.sourceName}
        </span>

        {/* Middot divider — fg-4 from feed_card.jsx L183 */}
        <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>·</span>

        {/* Time — 12px mono fg-3 from feed_card.jsx L184–186 */}
        <span
          style={{
            fontSize: 12,
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {timeStr}
        </span>

        {/* 官方 mini-chip — when sourceKind === 'official' from feed_card.jsx L186–199 */}
        {isOfficial && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--fg-3)',
              border: '1px solid var(--line-weak)',
              padding: '1px 5px',
              borderRadius: 3,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            官方
          </span>
        )}

        {/* Right-push + ScoreBadge */}
        <div style={{ marginLeft: 'auto' }}>
          <ScoreBadge score={item.score} />
        </div>
      </div>

      {/* ——— Step 2: Title wrapped in Link — NOT whole card (a11y contract) ——— */}
      <h3
        style={{
          margin: 0,
          // mb-[10px] — off scale from feed_card.jsx L243–244
          marginBottom: 10,
        }}
      >
        <Link
          href={`/items/${item.id}`}
          style={{
            // text-[15.5px] — fractional off-scale, preserved verbatim per UI-SPEC
            fontSize: 15.5,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
            textDecoration: 'none',
            display: 'block',
          }}
        >
          {item.titleZh ?? item.title}
        </Link>
      </h3>

      {/* ——— Step 3: Summary ——— */}
      {item.summaryZh && (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--ink-700)',
            // text-wrap: pretty — from feed_card.jsx L256
            textWrap: 'pretty' as React.CSSProperties['textWrap'],
          }}
        >
          {item.summaryZh}
        </p>
      )}

      {/* ——— Step 4: 推荐理由 amber callout (conditional) ——— */}
      {item.recommendation && (
        <div
          style={{
            // mt-[14px] — off scale from feed_card.jsx L263–266
            marginTop: 14,
            padding: '10px 14px',
            background: 'var(--accent-50)',
            borderLeft: '2px solid var(--accent-500)',
            borderRadius: '0 6px 6px 0',
          }}
        >
          {/* Eyebrow: ★ Claude 推荐理由 — from feed_card.jsx L275–291 */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--accent-700)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {/* 5-point star glyph from feed_card.jsx L286–288 */}
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0l2 5 6 1-4.5 4 1 6L8 13l-4.5 3 1-6L0 6l6-1z" />
            </svg>
            Claude 推荐理由
          </div>
          {/* Recommendation body — 13px/1.55 ink-800 from feed_card.jsx L293–299 */}
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-800)',
              lineHeight: 1.55,
            }}
          >
            {item.recommendation}
          </div>
        </div>
      )}

      {/* ——— Step 5: Tags row ——— */}
      {item.tags && item.tags.length > 0 && (
        <div
          style={{
            // mt-[12px] — off scale from feed_card.jsx L305
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 5,
            alignItems: 'center',
          }}
        >
          {item.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>
      )}

      {/* ——— Steps 6+7: Cluster section (conditional) ——— */}
      {hasCluster && (
        <ClusterSection
          clusterId={item.clusterId!}
          memberCount={item.clusterMemberCount}
          siblings={siblings}
        />
      )}

      {/* ——— Step 8: Action bar (always rendered) ——— */}
      <FeedCardActions itemId={item.id} url={item.url} sourceUrl={null} />
    </article>
  );
}
