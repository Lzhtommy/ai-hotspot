'use client';
/**
 * FavoritesEmpty — Phase 4 D-16; extended in Phase 5 Plan 05-08 for the
 * authenticated-with-zero-favorites branch (per CONTEXT D-15 Option A +
 * UI-SPEC §/favorites page authenticated empty state).
 *
 * Two render paths:
 *   - `authenticated={true}`  → 还没有收藏的动态 + body + CTA 去看看精选 (Link /)
 *   - `authenticated={false}` → (Phase 4 anonymous copy preserved)
 *     登录后可查看收藏 + 登录 CTA dispatching 'open-login-modal' on document
 *
 * In practice the anonymous branch is a fallback only: Plan 05-08 redirects
 * unauthenticated visitors at the RSC boundary before FavoritesEmpty renders.
 * The branch is kept for future flexibility (e.g., switching D-15 to option B).
 *
 * The `open-login-modal` dispatch targets `document` (not `window`) to match
 * the LoginPromptModal listener — see Plan 05-04 Task 3 PATTERNS §Shared D.
 *
 * Must be a Client Component because the anonymous branch needs an onClick
 * handler for the modal-dispatch seam.
 *
 * Consumed by:
 *   - src/app/(reader)/favorites/page.tsx
 */

import { EmptyState } from '@/components/feed/empty-state';

interface FavoritesEmptyProps {
  /** When true, render the authenticated-zero-favorites empty state. Defaults to false (anonymous). */
  authenticated?: boolean;
}

export function FavoritesEmpty({ authenticated = false }: FavoritesEmptyProps = {}) {
  if (authenticated) {
    return (
      <EmptyState
        title="还没有收藏的动态"
        body="点击动态上的星标即可收藏，随时回顾。"
        cta={{
          label: '去看看精选',
          variant: 'accent',
          // href routes to /; wrapped Link so router handles prefetch + SPA nav.
          // EmptyState accepts `href` on the cta to render a <Link> internally.
          href: '/',
        }}
      />
    );
  }

  // Anonymous branch — preserved from Phase 4 / Plan 05-04 Task 3.
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
