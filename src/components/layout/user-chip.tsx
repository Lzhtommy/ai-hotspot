'use client';
/**
 * UserChip — Phase 4 FEED-06, CONTEXT D-12.
 *
 * Anonymous-state login chip rendered at the bottom of the sidebar.
 * Clicking dispatches a custom DOM event that LoginPromptModal listens for.
 * No state — the handler is a single inline dispatch.
 *
 * Phase 5 replaces this with an authenticated user avatar + dropdown.
 *
 * Consumed by:
 *   - src/components/layout/sidebar.tsx
 */

import { Button } from './button';

export function UserChip() {
  return (
    <div style={{ margin: '0 12px 12px' }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => document.dispatchEvent(new CustomEvent('open-login-modal'))}
      >
        登录
      </Button>
    </div>
  );
}
