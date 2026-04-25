'use client';

/**
 * FeedTabs — Phase 4 FEED-06, feed_views.jsx lines 64–93.
 *
 * Tab navigation bar with 3 tabs driven by pathname prop.
 * Active tab is purely derived from the pathname passed by the RSC parent.
 *
 * Tab labels (UI-SPEC Copywriting Contract):
 *   精选 / 全部动态 / 收藏
 *   Note: "全部动态" in tabs vs. "全部 AI 动态" in H1 — both correct per design.
 *
 * Quick task 260425-kg7 (anonymous favorites tab unification):
 *   - When `isAuthenticated` is false (or omitted — the default), the 收藏
 *     tab is still a next/link <a href="/favorites"> visually identical to the
 *     other tabs, but its onClick calls `e.preventDefault()` and dispatches
 *     `open-login-modal` on `document` instead. Same DOM element type as the
 *     other tabs → no visual drift from `<button>` user-agent defaults.
 *     Mirrors the D-26 seam used by feed-card-actions; LoginPromptModal mounted
 *     in (reader)/layout.tsx handles the prompt.
 *   - When `isAuthenticated` is true, the 收藏 tab is a normal next/link
 *     <a href="/favorites"> — behaviour fully unchanged.
 *   - 精选 and 全部动态 are always Links regardless of auth state.
 *   - The server `redirect('/')` in /favorites remains as the deep-link
 *     fallback for users who paste the URL directly (or middle-click).
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
  /**
   * Quick 260425-kg7: when true, the 收藏 tab is a Link to /favorites; when
   * false/undefined the 收藏 tab is a button that opens LoginPromptModal via
   * the document-level `open-login-modal` event. Default is false (anonymous-
   * safe): RSC parents that haven't been updated to thread the prop fall into
   * the modal path rather than the broken redirect-bounce.
   */
  isAuthenticated?: boolean;
}

function openLoginModal() {
  // Phase 4 D-26 seam — LoginPromptModal listens for this on `document`.
  // Same implementation as feed-card-actions.tsx (intentionally duplicated
  // to keep this Client Component import-light).
  document.dispatchEvent(new CustomEvent('open-login-modal'));
}

export function FeedTabs({ pathname, counts, isAuthenticated = false }: FeedTabsProps) {
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
      {tabs.map((t) => {
        // Shared style — single const so Link and button branches cannot drift.
        const tabStyle: React.CSSProperties = {
          paddingBottom: 10,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '-0.003em',
          textDecoration: 'none',
          borderBottom: t.active ? '2px solid var(--ink-900)' : '2px solid transparent',
          color: t.active ? 'var(--ink-900)' : 'var(--fg-3)',
          transition: 'color 120ms var(--ease)',
        };
        const ariaCurrent = t.active ? ('page' as const) : undefined;
        const label = t.count != null ? `${t.label} (${t.count})` : t.label;

        // 收藏 tab when anonymous (260425-kg7): same <Link> DOM as the others
        // (visual parity), but onClick prevents navigation and dispatches the
        // open-login-modal event. Middle-click / cmd-click still resolves to
        // /favorites and hits the server redirect — that's the intentional
        // deep-link fallback.
        const isAnonymousFavorites = t.href === '/favorites' && !isAuthenticated;
        const onClick = isAnonymousFavorites
          ? (e: React.MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault();
              openLoginModal();
            }
          : undefined;

        return (
          <Link
            key={t.href}
            href={t.href}
            style={tabStyle}
            aria-current={ariaCurrent}
            onClick={onClick}
            data-anonymous-favorites={isAnonymousFavorites ? 'true' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
