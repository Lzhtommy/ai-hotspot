/**
 * Sidebar — Phase 4 FEED-06, sidebar.jsx lines 99–302.
 *
 * 224px fixed desktop navigation sidebar (RSC). Contains:
 *   - Brand chip (AI Hotspot flame SVG + title + subtitle)
 *   - SidebarSearch (client; ⌘K focus shortcut, debounced /api/search)
 *   - Reader nav section (精选 / 全部 AI 动态 / 低粉爆文 V2 / 收藏)
 *   - Admin nav section (role-gated on session.user.role === 'admin' — wires to
 *     /admin/{sources,users,costs,dead-letter} per Phase 6)
 *   - PipelineStatusCard (live RSC DB query)
 *   - UserChip (opens login modal)
 *
 * Width = 224px per sidebar.jsx line 102 (off 4pt scale — design exact).
 * Consumed inside SidebarMobileDrawer for responsive behavior.
 *
 * Consumed by:
 *   - src/components/layout/sidebar-mobile-drawer.tsx (wraps for responsive)
 *   - src/app/(reader)/layout.tsx
 */

import type { ReactNode } from 'react';
import type { Session } from 'next-auth';
import { NavRow } from './nav-row';
import { SectionLabel } from './section-label';
import { SidebarSearch } from './sidebar-search';
import { UserChip, type UserChipSessionUser } from './user-chip';

// Reader nav per CONTEXT D-09 / sidebar.jsx lines 5–10
const NAV_READER = [
  { id: 'featured', icon: 'sparkles' as const, label: '精选', href: '/' },
  { id: 'all', icon: 'inbox' as const, label: '全部 AI 动态', href: '/all' },
  {
    id: 'buzz',
    icon: 'arrow-up-right' as const,
    label: '低粉爆文',
    disabled: true,
    chip: 'V2' as const,
    title: '即将开放',
  },
  { id: 'favorites', icon: 'star' as const, label: '收藏', href: '/favorites' },
];

// Quick 260424-g2y: aligned with admin-nav.tsx; gated on role==='admin'.
const NAV_ADMIN = [
  { id: 'sources', icon: 'globe' as const, label: '信源', href: '/admin/sources' },
  { id: 'users', icon: 'users' as const, label: '用户', href: '/admin/users' },
  { id: 'costs', icon: 'settings' as const, label: '成本', href: '/admin/costs' },
  { id: 'dead-letter', icon: 'alert-circle' as const, label: '死信', href: '/admin/dead-letter' },
];

interface SidebarProps {
  /** Current pathname — used to derive active NavRow. Pass from layout RSC. */
  pathname: string;
  /**
   * Phase 5 Plan 05-05: pre-fetched Auth.js session from the RSC layout
   * (`await auth()` in src/app/(reader)/layout.tsx). Forwarded to UserChip
   * so it never needs useSession() (CLAUDE.md §11 + RESEARCH §Anti-Patterns).
   */
  session: Session | null;
  /**
   * RSC-rendered <PipelineStatusCard /> passed down from the layout. Must be
   * produced on the server side — Sidebar is reachable through the
   * ReaderShell client boundary, so rendering an async RSC here directly would
   * break hydration of the entire sidebar (and block UserChip's onClick).
   */
  pipelineStatus: ReactNode;
}

export function Sidebar({ pathname, session, pipelineStatus }: SidebarProps) {
  // Map Auth.js Session.user (name/email/image optional) onto UserChip's
  // stricter SessionUser (id + email required). When id/email are missing
  // we treat the session as anonymous so UserChip renders the 登录 chip.
  const userChipSession: { user: UserChipSessionUser } | null =
    session?.user?.id && session.user.email
      ? {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name ?? null,
            image: session.user.image ?? null,
            role: (session.user as { role?: string }).role,
          },
        }
      : null;
  // Quick 260424-g2y: role-gate the 管理 section. Same cast pattern as line 88.
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  // Quick 260425-kg7 follow-up: anonymous click on 收藏 dispatches open-login-modal
  // (mirrors FeedTabs + feed-card-actions D-26 seam) instead of bouncing through
  // the server redirect at /favorites. Sidebar is RSC, so we forward a boolean
  // flag — the click handler is attached inside NavRow (Client Component).
  const isAuthenticated = !!session?.user?.id;
  return (
    <aside
      style={{
        width: 224, // sidebar.jsx line 102 — off 4pt scale, design exact
        flexShrink: 0,
        background: 'var(--paper)',
        borderRight: '1px solid var(--line-weak)',
        height: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 12px',
        boxSizing: 'border-box',
      }}
    >
      {/* Brand chip — sidebar.jsx lines 113–167 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 6px 14px',
        }}
      >
        {/* 26×26 amber square with flame SVG — sidebar.jsx lines 122–150 */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: 'var(--accent-500)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {/* Flame/heat glyph from sidebar.jsx lines 139–149 */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 1.5C8 1.5 5 4 5 7c0 1.2.7 2.2 1.7 2.7-.4-.5-.6-1.1-.6-1.8 0-1.4 1-2.5 1.9-3.4 1 1 1.9 2.2 1.9 3.6 0 .7-.2 1.3-.6 1.8 1-.5 1.7-1.5 1.7-2.7C11 4 8 1.5 8 1.5z"
              fill="#fff"
            />
            <path
              d="M4 10c0 2.2 1.8 4 4 4s4-1.8 4-4c0-.9-.3-1.7-.8-2.4-.3 1.4-1.3 2.6-2.6 3.1.2-.3.4-.8.4-1.3 0-1.1-1-2.2-1-2.2S7 8.3 7 9.4c0 .5.2 1 .4 1.3-1.3-.5-2.3-1.7-2.6-3.1C4.3 8.3 4 9.1 4 10z"
              fill="#fff"
              opacity="0.7"
            />
          </svg>
        </div>

        {/* Title + subtitle — sidebar.jsx lines 151–166 */}
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* UI-SPEC Copywriting: "AI Hotspot" sidebar.jsx line 161 */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink-900)',
              letterSpacing: '-0.01em',
              fontFamily: 'var(--font-sans)',
            }}
          >
            AI Hotspot
          </div>
          {/* UI-SPEC Copywriting: "中文 AI 动态聚合" sidebar.jsx line 163 */}
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', letterSpacing: 0 }}>
            中文 AI 动态聚合
          </div>
        </div>
      </div>

      {/* Search — Quick 260424-ogp. Client component replaces the previous
          disabled stub; keeps geometry/colors identical and adds:
            - ⌘K focus shortcut (global keydown)
            - 250ms-debounced fetch to /api/search
            - Absolute-positioned dropdown with up to 10 hits */}
      <SidebarSearch />

      {/* Reader nav — sidebar.jsx lines 203–213 */}
      {/* UI-SPEC Copywriting: SectionLabel "动态" */}
      <SectionLabel>动态</SectionLabel>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-label="主导航">
        {NAV_READER.map((item) => (
          <NavRow
            key={item.id}
            label={item.label}
            icon={item.icon}
            href={'href' in item ? item.href : undefined}
            disabled={'disabled' in item ? item.disabled : undefined}
            chip={'chip' in item ? item.chip : undefined}
            title={'title' in item ? item.title : undefined}
            active={
              item.id === 'featured'
                ? pathname === '/'
                : item.id === 'all'
                  ? pathname.startsWith('/all')
                  : item.id === 'favorites'
                    ? pathname.startsWith('/favorites')
                    : false
            }
            // Quick 260425-kg7 follow-up: anonymous click on 收藏 opens login
            // modal instead of navigating into the /favorites server redirect.
            loginModalIntercept={item.id === 'favorites' && !isAuthenticated}
          />
        ))}
      </nav>

      {/* Admin nav — Quick 260424-g2y: role-gated, wires to real /admin routes (Phase 6) */}
      {/* UI-SPEC Copywriting: SectionLabel "管理" */}
      {isAdmin && (
        <>
          <SectionLabel>管理</SectionLabel>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-label="管理导航">
            {NAV_ADMIN.map((item) => {
              // Active rule matches admin-nav.tsx — /admin/sources/123 still highlights 信源.
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavRow
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  href={item.href}
                  active={active}
                />
              );
            })}
          </nav>
        </>
      )}

      {/* Bottom section: PipelineStatusCard + UserChip — sidebar.jsx lines 227–300 */}
      <div style={{ marginTop: 'auto' }}>
        {pipelineStatus}
        <UserChip session={userChipSession} />
      </div>
    </aside>
  );
}
