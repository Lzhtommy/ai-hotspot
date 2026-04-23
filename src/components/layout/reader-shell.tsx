'use client';
/**
 * ReaderShell — Phase 4 FEED-07 + Phase 5 Plan 05-05.
 *
 * Thin Client wrapper that bridges the RSC route-group layout with the
 * components that require `usePathname()` (Sidebar, SidebarMobileDrawer).
 *
 * Renders the two-column desktop grid (224px sidebar + flex main) and
 * the mobile single-column layout, delegating sidebar state to
 * SidebarMobileDrawer.
 *
 * Phase 5 Plan 05-05: receives `session` prop from the RSC layout.tsx
 * (where `await auth()` is called) and forwards it to Sidebar → UserChip.
 * This preserves the RSC → Client prop-drill convention and keeps UserChip
 * free of useSession() calls per CLAUDE.md §11 + RESEARCH §Anti-Patterns.
 *
 * Consumed by:
 *   - src/app/(reader)/layout.tsx
 */

import type { Session } from 'next-auth';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { SidebarMobileDrawer, SidebarDrawerPanel } from './sidebar-mobile-drawer';

interface ReaderShellProps {
  children: React.ReactNode;
  /** Pre-fetched Auth.js session from the RSC layout. null when anonymous. */
  session: Session | null;
}

export function ReaderShell({ children, session }: ReaderShellProps) {
  const pathname = usePathname();

  return (
    // SidebarMobileDrawer is the context provider — wraps everything so
    // HamburgerButton (inside main) can reach the toggle via useSidebarDrawer.
    <SidebarMobileDrawer>
      <div className="min-h-full lg:grid lg:grid-cols-[224px_1fr]">
        {/* SidebarDrawerPanel is the animated off-canvas panel for mobile */}
        <SidebarDrawerPanel>
          <Sidebar pathname={pathname} session={session} />
        </SidebarDrawerPanel>
        <main className="min-w-0">{children}</main>
      </div>
    </SidebarMobileDrawer>
  );
}
