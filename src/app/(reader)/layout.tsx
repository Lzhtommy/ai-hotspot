/**
 * Route-group layout for the reader section — Phase 4 FEED-07.
 *
 * Wraps all (reader) routes in the full shell:
 *   - ReaderShell (Client): two-column grid + SidebarMobileDrawer + Sidebar
 *   - LoginPromptModal (Client): mounted once; opened via custom event 'open-login-modal'
 *
 * This is an RSC layout. The client boundary is delegated to ReaderShell.
 *
 * Consumed by:
 *   - src/app/(reader)/page.tsx
 *   - src/app/(reader)/all/page.tsx
 *   - src/app/(reader)/favorites/page.tsx
 *   - src/app/(reader)/items/[id]/page.tsx
 */

import { ReaderShell } from '@/components/layout/reader-shell';
import { LoginPromptModal } from '@/components/feed/login-prompt-modal';

export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <ReaderShell>
      {children}
      <LoginPromptModal />
    </ReaderShell>
  );
}
