'use client';

/**
 * Login prompt modal — Phase 4 FEED-03, D-26.
 *
 * Client Component listening for 'open-login-modal' custom event on document.
 * Uses native <dialog> element for:
 *   - Built-in focus trap (showModal() automatically traps focus)
 *   - Escape key to close (native browser behavior)
 *   - Backdrop scrim via ::backdrop pseudo-element
 *   - aria-labelledby linking to h2 heading
 *
 * Content per UI-SPEC Copywriting Contract:
 *   Heading: 登录以继续
 *   Body: 登录后才可以收藏、点赞或屏蔽动态。
 *   Primary CTA: 登录 (accent — no-op in Phase 4; Phase 5 wires auth)
 *   Secondary CTA: 稍后再说 (ghost — closes modal)
 *
 * Closes on: Escape (native), backdrop click, 稍后再说 button.
 *
 * Consumed by:
 *   - src/app/(reader)/layout.tsx (rendered once at layout level)
 *   - Opened via UserChip, FeedCardActions dispatching 'open-login-modal' event
 */

import { useEffect, useRef } from 'react';
import { Button } from '@/components/layout/button';

export function LoginPromptModal() {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Listen for open-login-modal custom event dispatched by FeedCardActions / UserChip
    const open = () => {
      if (!el.open) el.showModal();
    };
    document.addEventListener('open-login-modal', open);
    return () => document.removeEventListener('open-login-modal', open);
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      aria-labelledby="login-modal-heading"
      // Escape is handled natively by <dialog>; we also intercept to call close() for
      // any additional cleanup (restore focus handled by native dialog).
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }}
      // Backdrop click: target is the dialog element itself when clicking outside content
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      style={{
        padding: 0,
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: 'var(--surface-0)',
        maxWidth: 400,
        width: '90vw',
        // Remove default UA margin (center via fixed pos from showModal)
        margin: 'auto',
      }}
    >
      <div style={{ padding: 24 }}>
        {/* Heading — 16px/600 ink-900 per UI-SPEC */}
        <h2
          id="login-modal-heading"
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--ink-900)',
            lineHeight: 1.3,
          }}
        >
          登录以继续
        </h2>

        {/* Body copy — 14px/1.5 ink-700 per UI-SPEC */}
        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--ink-700)',
          }}
        >
          登录后才可以收藏、点赞或屏蔽动态。
        </p>

        {/* CTAs */}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {/* Secondary: 稍后再说 — ghost, closes modal */}
          <Button variant="ghost" size="md" onClick={close}>
            稍后再说
          </Button>
          {/* Primary: 登录 — accent, no-op in Phase 4; Phase 5 wires auth providers.
              Native <dialog> showModal() places initial focus on the first focusable element. */}
          <Button variant="accent" size="md">
            登录
          </Button>
        </div>
      </div>
    </dialog>
  );
}
