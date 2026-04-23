'use client';

/**
 * Login prompt modal — Phase 4 FEED-03, D-26; extended by Phase 5 Plan 05-04
 * (AUTH-02, AUTH-03, AUTH-04, VOTE-04) to wire three real providers:
 *   - GitHub OAuth (accent, primary)
 *   - Email magic link (accent; Resend transport; inline 检查邮箱 success)
 *   - Google OAuth (secondary; separated by 其他方式 divider)
 *
 * Client Component listening for 'open-login-modal' custom event on document.
 * Uses native <dialog> element for:
 *   - Built-in focus trap (showModal() automatically traps focus)
 *   - Escape key to close (native browser behavior)
 *   - Backdrop scrim via ::backdrop pseudo-element
 *   - aria-labelledby linking to h2 heading
 *
 * Content per UI-SPEC §LoginPromptModal (locked top-to-bottom order):
 *   1. Heading    登录以继续
 *   2. Body       登录后才可以收藏、点赞或屏蔽动态。
 *   3. GitHub     使用 GitHub 登录           (accent, full-width, form → signInGithubAction)
 *   4. Email      邮箱 + 你的邮箱地址 + 发送登录链接 (accent, full-width, form → signInResendAction)
 *   5. Divider    其他方式
 *   6. Google     使用 Google 登录           (secondary, full-width, form → signInGoogleAction)
 *   7. Dismiss    稍后再说                    (ghost, right-aligned)
 *
 * Closes on: Escape (native), backdrop click, 稍后再说 button.
 *
 * Consumed by:
 *   - src/app/(reader)/layout.tsx (rendered once at layout level)
 *   - Opened via UserChip, FeedCardActions, FavoritesEmpty dispatching
 *     'open-login-modal' event on document.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/layout/button';
import { signInGithubAction, signInGoogleAction, signInResendAction } from '@/server/actions/auth';

/**
 * Canonical GitHub mark (octocat "G"). 16×16 inline SVG, currentColor fill,
 * aria-hidden so the Chinese label reads cleanly to screen readers.
 */
function GithubMarkSvg() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={{ marginRight: 8, flexShrink: 0 }}
    >
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

/**
 * Canonical Google "G" multicolor mark. 16×16 inline SVG (colors baked in;
 * not currentColor — Google's brand guidance preserves the four-color G).
 */
function GoogleMarkSvg() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      style={{ marginRight: 8, flexShrink: 0 }}
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.1 0-9.5-3.2-11.2-7.8l-6.5 5C9.5 39.6 16.2 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.6l6.2 5.2C41.6 35.8 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5Z"
      />
    </svg>
  );
}

/**
 * Small green dot used beside the 检查邮箱 success copy. Matches
 * --success-500 per UI-SPEC §Color.
 */
function SuccessDot() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--success-500)',
        marginRight: 8,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Email magic-link form. Internal subcomponent so the idle/success/error
 * state toggle stays scoped to the email surface without re-rendering the
 * whole modal.
 */
function EmailMagicLinkForm() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<'idle' | 'success' | 'error'>('idle');

  // Use onSubmit (not action={fn}) so the handler is invoked in both Next.js
  // runtime (client-side RSC submit) AND the Vitest/jsdom test environment.
  // React 18.3 does NOT support function-valued `action` on <form>; it only
  // works through the Next.js App Router compiler transform. Calling the
  // server action from an onSubmit handler preserves the server-action
  // semantics (fetch POST under the hood) while remaining testable.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await signInResendAction(formData);
      if ('success' in result && result.success) {
        setState('success');
      } else {
        setState('error');
      }
    });
  }

  if (state === 'success') {
    return (
      <div
        role="status"
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 6,
          border: '1px solid var(--line-weak)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.4,
            color: 'var(--ink-900)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <SuccessDot />
          链接已发送，请检查邮箱。
        </p>
        <p
          style={{
            margin: 0,
            marginLeft: 16,
            fontSize: 12,
            lineHeight: 1.4,
            color: 'var(--ink-500)',
          }}
        >
          链接 10 分钟内有效。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <label
        htmlFor="login-email"
        style={{
          display: 'block',
          marginBottom: 4,
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--ink-900)',
        }}
      >
        邮箱
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="你的邮箱地址"
        required
        disabled={pending}
        style={{
          width: '100%',
          height: 40,
          padding: '0 14px',
          borderRadius: 6,
          border: '1px solid var(--line)',
          background: 'var(--surface-0)',
          color: 'var(--ink-900)',
          fontFamily: 'inherit',
          fontSize: 14,
          marginBottom: 8,
          boxSizing: 'border-box',
        }}
      />
      <Button
        type="submit"
        variant="accent"
        size="lg"
        disabled={pending}
        aria-label="发送登录链接"
        style={{ width: '100%' }}
      >
        {pending ? '正在发送…' : '发送登录链接'}
      </Button>
      {state === 'error' && (
        <p
          role="alert"
          style={{
            margin: 0,
            marginTop: 8,
            fontSize: 14,
            lineHeight: 1.4,
            color: 'var(--danger-500)',
          }}
        >
          发送失败，请检查邮箱格式后重试。
        </p>
      )}
    </form>
  );
}

export function LoginPromptModal() {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Listen for open-login-modal custom event dispatched by FeedCardActions /
    // UserChip / FavoritesEmpty. Guard showModal existence for safety on
    // environments where the <dialog> API is absent (jsdom without polyfill).
    const open = () => {
      if (el.open) return;
      if (typeof el.showModal === 'function') {
        el.showModal();
      } else {
        el.setAttribute('open', '');
      }
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
        {/* 1. Heading — 16px/600 ink-900 per UI-SPEC */}
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

        {/* 2. Body copy — 14px/1.5 ink-700 per UI-SPEC */}
        <p
          style={{
            marginTop: 12,
            marginBottom: 20,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--ink-700)',
          }}
        >
          登录后才可以收藏、点赞或屏蔽动态。
        </p>

        {/* Provider stack — locked top-to-bottom order per UI-SPEC §LoginPromptModal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 3. GitHub (accent, full-width) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void signInGithubAction();
            }}
            style={{ width: '100%' }}
          >
            <Button
              type="submit"
              variant="accent"
              size="lg"
              aria-label="使用 GitHub 登录"
              style={{ width: '100%' }}
            >
              <GithubMarkSvg />
              使用 GitHub 登录
            </Button>
          </form>

          {/* 4. Email magic-link form (idle → success | error) */}
          <EmailMagicLinkForm />

          {/* 5. Divider — 其他方式 */}
          <div
            role="separator"
            aria-orientation="horizontal"
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '4px 0',
            }}
          >
            <hr
              style={{
                flex: 1,
                border: 0,
                borderTop: '1px solid var(--line-weak)',
                margin: 0,
              }}
            />
            <span
              style={{
                padding: '0 12px',
                fontSize: 12,
                color: 'var(--ink-500)',
              }}
            >
              其他方式
            </span>
            <hr
              style={{
                flex: 1,
                border: 0,
                borderTop: '1px solid var(--line-weak)',
                margin: 0,
              }}
            />
          </div>

          {/* 6. Google (secondary, full-width) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void signInGoogleAction();
            }}
            style={{ width: '100%' }}
          >
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              aria-label="使用 Google 登录"
              style={{ width: '100%' }}
            >
              <GoogleMarkSvg />
              使用 Google 登录
            </Button>
          </form>
        </div>

        {/* 7. Dismiss — ghost, right-aligned */}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="ghost" size="md" onClick={close}>
            稍后再说
          </Button>
        </div>
      </div>
    </dialog>
  );
}
