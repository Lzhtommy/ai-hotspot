/**
 * Route-group layout for the reader section — Phase 4 FEED-07 + Phase 5 Plan 05-05.
 *
 * Wraps all (reader) routes in the full shell:
 *   - ReaderShell (Client): two-column grid + SidebarMobileDrawer + Sidebar
 *   - LoginPromptModal (Client): mounted once; opened via custom event 'open-login-modal'
 *
 * This is an RSC layout. The client boundary is delegated to ReaderShell.
 *
 * Phase 5 Plan 05-05: calls `await auth()` at this RSC boundary and prop-drills
 * the session through ReaderShell → Sidebar → UserChip. UserChip never calls
 * useSession() (per CLAUDE.md §11 + RESEARCH §Anti-Patterns).
 *
 * Consumed by:
 *   - src/app/(reader)/page.tsx
 *   - src/app/(reader)/all/page.tsx
 *   - src/app/(reader)/favorites/page.tsx
 *   - src/app/(reader)/items/[id]/page.tsx
 */

import { ReaderShell } from '@/components/layout/reader-shell';
import { LoginPromptModal } from '@/components/feed/login-prompt-modal';
import { PipelineStatusCard } from '@/components/layout/pipeline-status-card';
import { auth } from '@/lib/auth';

export default async function ReaderLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // PipelineStatusCard is async (queries the DB). It must be rendered on the
  // server and passed into ReaderShell (a Client Component) as a ReactNode —
  // rendering it as a JSX descendant of ReaderShell would pull it into the
  // client tree and break hydration of the entire sidebar (including
  // UserChip's 登录 onClick handler).
  return (
    <ReaderShell session={session} pipelineStatus={<PipelineStatusCard />}>
      {children}
      <LoginPromptModal />
    </ReaderShell>
  );
}
