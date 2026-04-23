'use client';
/**
 * FavoritesEmpty — Phase 4 D-16; fixed in Phase 5 Plan 05-04 (PATTERNS
 * §Shared Pattern D — dispatch consistency).
 *
 * Client island for the anonymous favorites empty state. Dispatches
 * 'open-login-modal' custom event ON document (not window) — the
 * LoginPromptModal listener binds to document.addEventListener, matching
 * the three other call sites (feed-card-actions.tsx, user-chip.tsx).
 * Without this fix, clicking the 登录 CTA on this empty-state page would
 * silently fail to open the modal.
 *
 * Must be a Client Component because EmptyState's onClick prop requires a
 * client-side event handler.
 *
 * Consumed by:
 *   - src/app/(reader)/favorites/page.tsx
 */

import { EmptyState } from '@/components/feed/empty-state';

export function FavoritesEmpty() {
  return (
    <EmptyState
      title="登录后可查看收藏"
      body="登录账号后,你收藏的动态会出现在这里。"
      cta={{
        label: '登录',
        variant: 'accent',
        onClick: () => document.dispatchEvent(new CustomEvent('open-login-modal')),
      }}
    />
  );
}
