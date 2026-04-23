'use client';
/**
 * AdminNav — Phase 6 Plan 06-00.
 *
 * Sidebar nav for the /admin route group. Four entries point at the sub-routes
 * landed by later Phase 6 plans:
 *   - 信源   → /admin/sources        (Plan 06-02)
 *   - 用户   → /admin/users          (Plan 06-03)
 *   - 成本   → /admin/costs          (Plan 06-04)
 *   - 死信   → /admin/dead-letter    (Plan 06-05)
 *
 * Client Component because we call `usePathname()` to derive the active row.
 * Visual language mirrors the reader-side Sidebar (NavRow conventions) so the
 * admin shell feels native to the app rather than a bolted-on backend UI.
 *
 * Consumed by:
 *   - src/components/admin/admin-shell.tsx
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/layout/icon';

interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
}

// Order matches the plan's acceptance criterion (信源, 用户, 成本, 死信).
// The literal paths are grep-checked by the plan's acceptance rule.
const ADMIN_NAV: readonly AdminNavItem[] = [
  { id: 'sources', label: '信源', href: '/admin/sources', icon: 'globe' },
  { id: 'users', label: '用户', href: '/admin/users', icon: 'users' },
  { id: 'costs', label: '成本', href: '/admin/costs', icon: 'settings' },
  { id: 'dead-letter', label: '死信', href: '/admin/dead-letter', icon: 'alert-circle' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="管理后台导航" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {ADMIN_NAV.map((item) => {
        // Active when the current path starts with the nav entry — so
        // /admin/sources/123 still highlights 信源.
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 32,
              padding: '0 10px',
              borderRadius: 6,
              background: active ? 'var(--surface-1)' : 'transparent',
              color: active ? 'var(--ink-900)' : 'var(--ink-700)',
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              letterSpacing: '-0.003em',
              textDecoration: 'none',
              transition: 'background 120ms var(--ease)',
            }}
          >
            <Icon name={item.icon} size={15} />
            <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
