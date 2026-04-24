'use client';
/**
 * AdminShell — Phase 6 Plan 06-00.
 *
 * Client wrapper for the /admin route group. Two-column on desktop
 * (224px sidebar + flex main), single-column with a hamburger-toggled drawer
 * on mobile. Visual language tracks the reader-side ReaderShell so the admin
 * UI feels part of the same product rather than an adjacent backend app.
 *
 * Chrome layers:
 *   - Left rail (desktop) / drawer (mobile): brand chip + AdminNav
 *   - Header: page title (passed via children) + admin identity chip
 *   - Main: children (layout passes the rendered admin page in)
 *
 * Client Component because:
 *   - useState drives the mobile drawer open/close
 *   - AdminNav (child) uses usePathname() for active-link highlighting
 *
 * Consumed by:
 *   - src/app/admin/layout.tsx
 */

import { useState } from 'react';
import Link from 'next/link';
import { AdminNav } from './admin-nav';

interface AdminShellProps {
  children: React.ReactNode;
  /** Display name for the signed-in admin. Rendered in the top-right chip. */
  userName: string;
}

export function AdminShell({ children, userName }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        color: 'var(--ink-900)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 52,
          padding: '0 16px',
          borderBottom: '1px solid var(--line-weak)',
          background: 'var(--paper)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Mobile hamburger — desktop hides via media-query-free inline style swap */}
        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label={drawerOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={drawerOpen}
          className="admin-shell-hamburger"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            border: '1px solid var(--line-weak)',
            background: 'transparent',
            color: 'var(--ink-700)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
            {drawerOpen ? '×' : '☰'}
          </span>
        </button>

        <Link
          href="/admin"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink-900)',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          管理后台
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/"
            style={{
              fontSize: 12.5,
              color: 'var(--fg-3)',
              textDecoration: 'none',
            }}
          >
            ← 返回首页
          </Link>
          <span
            aria-label="当前管理员"
            style={{
              fontSize: 12.5,
              color: 'var(--ink-700)',
              padding: '4px 10px',
              background: 'var(--surface-1)',
              borderRadius: 6,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {userName}
          </span>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="admin-shell-body">
        {/* Desktop sidebar */}
        <aside
          className="admin-shell-sidebar"
          style={{
            width: 224,
            flexShrink: 0,
            background: 'var(--paper)',
            borderRight: '1px solid var(--line-weak)',
            padding: '14px 12px',
            minHeight: 'calc(100vh - 52px)',
            boxSizing: 'border-box',
          }}
        >
          <AdminNav />
        </aside>

        {/* Mobile drawer — rendered only when open. Backdrop click closes. */}
        {drawerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="管理后台导航"
            className="admin-shell-drawer"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDrawerOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: '52px 0 0 0',
              background: 'rgba(0, 0, 0, 0.35)',
              zIndex: 20,
              display: 'flex',
            }}
          >
            <div
              style={{
                width: 260,
                background: 'var(--paper)',
                borderRight: '1px solid var(--line-weak)',
                padding: '14px 12px',
                boxSizing: 'border-box',
                overflowY: 'auto',
              }}
              onClick={() => setDrawerOpen(false)}
            >
              <AdminNav />
            </div>
          </div>
        )}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '24px 24px 40px',
          }}
        >
          {children}
        </main>
      </div>

      {/*
        Minimal responsive rules. We avoid Tailwind here to stay consistent
        with the reader-side inline-style convention (see sidebar.tsx).
      */}
      <style>{`
        .admin-shell-body {
          display: flex;
          flex-direction: row;
        }
        @media (max-width: 768px) {
          .admin-shell-sidebar {
            display: none;
          }
        }
        @media (min-width: 769px) {
          .admin-shell-hamburger {
            display: none !important;
          }
          .admin-shell-drawer {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
