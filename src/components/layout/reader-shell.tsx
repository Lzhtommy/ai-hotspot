'use client';
/**
 * ReaderShell — Phase 4 FEED-07.
 *
 * Thin Client wrapper that bridges the RSC route-group layout with the
 * components that require `usePathname()` (Sidebar, SidebarMobileDrawer).
 *
 * Renders the two-column desktop grid (224px sidebar + flex main) and
 * the mobile single-column layout, delegating sidebar state to
 * SidebarMobileDrawer.
 *
 * Consumed by:
 *   - src/app/(reader)/layout.tsx
 */

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { SidebarMobileDrawer, SidebarDrawerPanel } from './sidebar-mobile-drawer';

export function ReaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    // SidebarMobileDrawer is the context provider — wraps everything so
    // HamburgerButton (inside main) can reach the toggle via useSidebarDrawer.
    <SidebarMobileDrawer>
      <div className="min-h-full lg:grid lg:grid-cols-[224px_1fr]">
        {/* SidebarDrawerPanel is the animated off-canvas panel for mobile */}
        <SidebarDrawerPanel>
          <Sidebar pathname={pathname} />
        </SidebarDrawerPanel>
        <main className="min-w-0">{children}</main>
      </div>
    </SidebarMobileDrawer>
  );
}
