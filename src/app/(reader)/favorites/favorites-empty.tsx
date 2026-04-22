'use client';
/**
 * FavoritesEmpty — Phase 4 D-16.
 *
 * Client island for the anonymous favorites empty state. Dispatches
 * 'open-login-modal' custom event (listened by LoginPromptModal in layout)
 * when the 登录 CTA is clicked.
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
        onClick: () => window.dispatchEvent(new CustomEvent('open-login-modal')),
      }}
    />
  );
}
