/**
 * FeedTabs — Phase 4 FEED-06, feed_views.jsx lines 64–93.
 *
 * RSC tab navigation bar with 3 tabs driven by pathname prop.
 * Uses next/link for navigation — no client state needed; active tab
 * is purely derived from the pathname passed by the RSC page.
 *
 * Tab labels (UI-SPEC Copywriting Contract):
 *   精选 / 全部动态 / 收藏
 *   Note: "全部动态" in tabs vs. "全部 AI 动态" in H1 — both correct per design.
 *
 * Consumed by:
 *   - src/components/feed/feed-top-bar.tsx
 */

import Link from 'next/link';

interface FeedTabsProps {
  /** Current route pathname — used to derive active tab */
  pathname: string;
  /** Optional item counts to display next to tab labels */
  counts?: {
    featured?: number;
    all?: number;
    favorites?: number;
  };
}

export function FeedTabs({ pathname, counts }: FeedTabsProps) {
  const tabs = [
    {
      label: '精选',
      href: '/',
      // feed_views.jsx line 65: active when pathname === '/'
      active: pathname === '/',
      count: counts?.featured,
    },
    {
      label: '全部动态', // UI-SPEC: "全部动态" in tabs (not "全部 AI 动态")
      href: '/all',
      active: pathname.startsWith('/all'),
      count: counts?.all,
    },
    {
      label: '收藏',
      href: '/favorites',
      active: pathname.startsWith('/favorites'),
      count: counts?.favorites,
    },
  ];

  return (
    // feed_views.jsx line 67: bottom border on nav row, tabs sit above the line
    <nav
      style={{
        display: 'flex',
        gap: 24,
        marginTop: 14,
        borderBottom: '1px solid var(--line-weak)',
      }}
      aria-label="内容分类"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          // Active tab: ink-900 text + 2px bottom border
          // Inactive tab: fg-3 text, hover → ink-900
          style={{
            paddingBottom: 10,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '-0.003em',
            textDecoration: 'none',
            borderBottom: t.active ? '2px solid var(--ink-900)' : '2px solid transparent',
            color: t.active ? 'var(--ink-900)' : 'var(--fg-3)',
            transition: 'color 120ms var(--ease)',
          }}
          aria-current={t.active ? 'page' : undefined}
        >
          {t.count != null ? `${t.label} (${t.count})` : t.label}
        </Link>
      ))}
    </nav>
  );
}
