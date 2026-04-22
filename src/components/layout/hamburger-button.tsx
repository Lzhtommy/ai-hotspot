'use client';
/**
 * HamburgerButton — Phase 4 FEED-07 responsive mobile menu toggle.
 *
 * Client island that reads useSidebarDrawer context and renders a ☰ button
 * on mobile (<lg). Hidden on desktop via CSS (lg:hidden).
 *
 * Consumed by:
 *   - src/components/feed/feed-top-bar.tsx (mobile top-bar)
 */

import { useSidebarDrawer } from './sidebar-mobile-drawer';

export function HamburgerButton() {
  const { toggle } = useSidebarDrawer();
  return (
    <button
      type="button"
      aria-label="打开菜单"
      title="打开菜单"
      onClick={toggle}
      className="lg:hidden"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 6,
        border: '1px solid var(--line)',
        background: 'transparent',
        cursor: 'pointer',
        color: 'var(--ink-900)',
        flexShrink: 0,
      }}
    >
      {/* ☰ hamburger icon — three horizontal bars */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}
