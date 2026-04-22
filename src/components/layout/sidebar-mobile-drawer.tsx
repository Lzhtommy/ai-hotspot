'use client';
/**
 * SidebarMobileDrawer — Phase 4 FEED-07, UI-SPEC Responsive Contract.
 *
 * Client wrapper that provides responsive drawer behavior for the Sidebar:
 *   - Desktop (≥1024px): Sidebar renders as a sticky left column
 *   - Mobile (<1024px): Sidebar slides in from the left as a fixed overlay
 *
 * Owns isOpen state and exposes SidebarDrawerContext so the FeedTopBar
 * hamburger button can call toggle() without prop-drilling.
 *
 * Auto-closes on route change via usePathname effect.
 *
 * Consumed by:
 *   - src/app/(reader)/layout.tsx (wraps <Sidebar>)
 *   - src/components/feed/feed-top-bar.tsx (reads useSidebarDrawer for toggle)
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface SidebarDrawerCtx {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarDrawerContext = createContext<SidebarDrawerCtx | null>(null);

export function useSidebarDrawer(): SidebarDrawerCtx {
  const c = useContext(SidebarDrawerContext);
  if (!c) throw new Error('useSidebarDrawer must be called inside a SidebarMobileDrawer');
  return c;
}

export function SidebarMobileDrawer({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const ctx: SidebarDrawerCtx = {
    isOpen,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
  };

  return (
    <SidebarDrawerContext.Provider value={ctx}>
      {/*
        Desktop: sticky top-0 (sidebar stays in viewport while scrolling).
        Mobile: fixed off-screen left; translates to 0 when isOpen.
        Transition 180ms per UI-SPEC prefers-reduced-motion (globals.css reduces to 0ms).
      */}
      <div
        className={[
          // Desktop: render inline, no overlay
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-0 lg:flex-shrink-0',
          // Mobile: fixed drawer — slides in/out
          'fixed inset-y-0 left-0 z-40 transition-transform duration-[180ms]',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop always visible regardless of isOpen
          'lg:!translate-x-0 lg:!position-[unset]',
        ].join(' ')}
        aria-label="主导航"
      >
        {children}
      </div>

      {/* Backdrop — visible only on mobile when drawer is open */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30"
          style={{ background: 'var(--paper)', opacity: 0.4 }}
          onClick={ctx.close}
          aria-hidden="true"
        />
      )}
    </SidebarDrawerContext.Provider>
  );
}
