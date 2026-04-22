/**
 * Sidebar — Phase 4 FEED-06, sidebar.jsx lines 99–302.
 *
 * 224px fixed desktop navigation sidebar (RSC). Contains:
 *   - Brand chip (AI Hotspot flame SVG + title + subtitle)
 *   - Search stub (disabled input + ⌘K kbd — visual only)
 *   - Reader nav section (精选 / 全部 AI 动态 / 低粉爆文 V2 / 收藏)
 *   - Admin nav section (all disabled with 即将开放 tooltip)
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

import { Icon } from './icon';
import { NavRow } from './nav-row';
import { SectionLabel } from './section-label';
import { PipelineStatusCard } from './pipeline-status-card';
import { UserChip } from './user-chip';

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

// Admin nav per CONTEXT D-10 / sidebar.jsx lines 11–17 (all disabled in Phase 4)
const NAV_ADMIN = [
  { id: 'sources', icon: 'globe' as const, label: '信源', disabled: true, title: '即将开放' },
  {
    id: 'submissions',
    icon: 'send' as const,
    label: '信源提报',
    disabled: true,
    chip: 'V2' as const,
    title: '即将开放',
  },
  { id: 'strategies', icon: 'filter' as const, label: '策略', disabled: true, title: '即将开放' },
  { id: 'users', icon: 'users' as const, label: '用户', disabled: true, title: '即将开放' },
  { id: 'backend', icon: 'settings' as const, label: '后台', disabled: true, title: '即将开放' },
];

interface SidebarProps {
  /** Current pathname — used to derive active NavRow. Pass from layout RSC. */
  pathname: string;
}

export async function Sidebar({ pathname }: SidebarProps) {
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

      {/* Search stub — sidebar.jsx lines 169–201 (visual only, no handler) */}
      {/* T-04-02-03: disabled <input> — no form submission, no event handler */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 30, // sidebar.jsx line 176 — off 4pt scale
          padding: '0 10px',
          marginBottom: 4,
          background: 'var(--surface-1)',
          borderRadius: 6,
          color: 'var(--fg-3)', // --fg-3 = --ink-600 (#5c584f) — meets WCAG AA 4.5:1 on --surface-1
          fontSize: 12.5, // sidebar.jsx line 183 — fractional
          cursor: 'text',
        }}
        role="search"
        aria-label="搜索动态"
      >
        <Icon name="search" size={13} />
        {/* UI-SPEC Copywriting: "搜索动态…" + "⌘K" — sidebar.jsx line 186 */}
        <span style={{ flex: 1, color: 'var(--fg-3)' }}>搜索动态…</span>
        <kbd
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            padding: '0 4px',
            background: 'var(--surface-0)',
            border: '1px solid var(--line-weak)',
            borderRadius: 3,
            color: 'var(--fg-3)',
          }}
        >
          ⌘K
        </kbd>
      </div>

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
          />
        ))}
      </nav>

      {/* Admin nav — sidebar.jsx lines 215–225 */}
      {/* UI-SPEC Copywriting: SectionLabel "管理" */}
      <SectionLabel>管理</SectionLabel>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-label="管理导航">
        {NAV_ADMIN.map((item) => (
          <NavRow
            key={item.id}
            label={item.label}
            icon={item.icon}
            disabled={item.disabled}
            chip={'chip' in item ? item.chip : undefined}
            title={item.title}
            active={false}
          />
        ))}
      </nav>

      {/* Bottom section: PipelineStatusCard + UserChip — sidebar.jsx lines 227–300 */}
      <div style={{ marginTop: 'auto' }}>
        <PipelineStatusCard />
        <UserChip />
      </div>
    </aside>
  );
}
