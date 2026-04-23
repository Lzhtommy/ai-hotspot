/**
 * FeedTopBar — Phase 4 FEED-06, feed_views.jsx lines 6–127.
 *
 * Sticky top bar (RSC) with:
 *   - H1 view title (精选 / 全部 AI 动态 / 收藏)
 *   - Subtitle with count + last-sync info
 *   - FeedTabs navigation
 *   - Action buttons: 过滤 (ghost), 导出 (secondary, disabled), 手动同步 (primary, disabled)
 *
 * backdrop-blur applied per design; semi-transparent paper background.
 * Padding: 18px 32px 0 on desktop, 16px on mobile (UI-SPEC Responsive Contract).
 *
 * Button states per UI-SPEC:
 *   - 过滤: enabled only on view==='all' (visual only — onClick wired in Plan 05 client island)
 *   - 导出: disabled, title="Phase 6 开放" per CONTEXT D-22
 *   - 手动同步: disabled, title="Phase 6 开放" per CONTEXT D-22
 *
 * Consumed by:
 *   - src/app/(reader)/page.tsx (view="featured")
 *   - src/app/(reader)/all/page.tsx (view="all")
 *   - src/app/(reader)/favorites/page.tsx (view="favorites")
 */

import { Button } from '@/components/layout/button';
import { HamburgerButton } from '@/components/layout/hamburger-button';
import { FeedTabs } from './feed-tabs';

export interface FeedTopBarProps {
  view: 'featured' | 'all' | 'favorites';
  /** Displayed item count (used in subtitles) */
  count?: number;
  /** Total unfiltered count (used in 'all' subtitle) */
  totalCount?: number;
  /** Minutes since last sync — null when unknown */
  lastSyncMinutes?: number | null;
  /** Current route pathname — passed through to FeedTabs */
  pathname: string;
  /** Optional per-tab counts for FeedTabs */
  counts?: {
    featured?: number;
    all?: number;
    favorites?: number;
  };
  /**
   * Phase 5 Plan 05-08: optional subtitle override. When provided, replaces the
   * default per-view subtitle. Used by /favorites authenticated branch to
   * render `共 N 条` (with favorites) or `还没有收藏` (empty) per UI-SPEC
   * §/favorites page.
   */
  subtitle?: string;
}

export function FeedTopBar({
  view,
  count = 0,
  totalCount,
  lastSyncMinutes,
  pathname,
  counts,
  subtitle: subtitleOverride,
}: FeedTopBarProps) {
  // Sync label — same format as sidebar pipeline card (UI-SPEC Copywriting Contract)
  const syncLabel =
    lastSyncMinutes == null ? '—' : lastSyncMinutes < 1 ? '刚刚' : `${lastSyncMinutes} 分钟前`;

  // H1 per view — feed_views.jsx line 42; UI-SPEC Copywriting
  const h1 = view === 'featured' ? '精选' : view === 'all' ? '全部 AI 动态' : '收藏';

  // Subtitle per view — feed_views.jsx lines 45–47; UI-SPEC Copywriting.
  // When caller passes `subtitle`, it wins (Plan 05-08 /favorites authenticated subtitle).
  const subtitle =
    subtitleOverride ??
    (view === 'featured'
      ? `由 Claude 按策略筛选的高热度内容 · ${count} 条`
      : view === 'all'
        ? `按时间倒序 · 共 ${totalCount ?? count} 条 · 上次同步 ${syncLabel}`
        : '登录后可查看收藏');

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        // Padding: 18px 32px 0 — off 4pt scale (design exact, feed_views.jsx line 171)
        padding: '18px 32px 0',
        backdropFilter: 'blur(12px)',
        background: 'color-mix(in oklab, var(--paper) 92%, transparent)',
      }}
      // Mobile: reduce padding to 16px
      className="max-sm:!px-4"
    >
      {/* Title row + action buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        {/* Hamburger button — mobile only (<lg); opens sidebar drawer */}
        <HamburgerButton />
        <div>
          {/* Page H1 — 22px/600 per UI-SPEC Typography */}
          <h1
            style={{
              margin: 0,
              fontSize: 22, // UI-SPEC: page heading 22px/600/-0.015em
              fontWeight: 600,
              letterSpacing: '-0.015em',
              lineHeight: 1.2,
              color: 'var(--ink-900)',
            }}
          >
            {h1}
          </h1>
          {/* Subtitle — 12.5px/500 per UI-SPEC Typography (caption) */}
          <div
            style={{
              marginTop: 4,
              fontSize: 12.5, // fractional — preserved from design
              color: 'var(--fg-3)',
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Action buttons — feed_views.jsx lines 52–57 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* 导出 — disabled, Phase 6 开放 — feed_views.jsx line 54; CONTEXT D-22 */}
          <Button variant="secondary" size="md" disabled title="Phase 6 开放">
            <span className="max-sm:hidden">导出</span>
          </Button>

          {/* 手动同步 — disabled, Phase 6 开放 — feed_views.jsx line 57; CONTEXT D-22 */}
          <Button variant="primary" size="md" disabled title="Phase 6 开放">
            <span className="max-sm:hidden">手动同步</span>
          </Button>
        </div>
      </div>

      {/* Tab navigation — rendered below title/buttons */}
      <FeedTabs pathname={pathname} counts={counts} />
    </div>
  );
}
