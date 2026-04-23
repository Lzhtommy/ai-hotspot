'use client';
/**
 * UserChip — Phase 5 AUTH-06, AUTH-08, CONTEXT D-18.
 *
 * Three-state render:
 *   1. Anonymous (session=null): ghost 登录 chip that dispatches 'open-login-modal'.
 *   2. Authenticated with image: 32px next/image avatar + truncated name + chevron.
 *   3. Authenticated without image (magic-link users): amber monogram
 *      (--accent-100 bg / --accent-700 text) + truncated name + chevron.
 *
 * Clicking the authenticated chip opens a popover containing a "退出登录" menu
 * item. The menu item is a form with action={signOutAction} (server action from
 * @/server/actions/auth created in Plan 05-04). onSubmit calls the server action
 * directly so Vitest (React 18.3) can fire the handler — same pattern as
 * LoginPromptModal forms per Plan 05-04 Decisions §form onSubmit.
 *
 * Session shape is consumed as a prop from the RSC parent (ReaderShell / layout)
 * per RESEARCH §Anti-Patterns — never useSession() in this component.
 *
 * Consumed by:
 *   - src/components/layout/sidebar.tsx
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from './button';
import { Icon } from './icon';
import { signOutAction } from '@/server/actions/auth';

export interface UserChipSessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role?: string;
}

export interface UserChipProps {
  /**
   * Next-Auth session object passed from RSC parent (null when anonymous).
   * Never derive this via useSession() — always prop-drill from an `await auth()`
   * caller at the RSC boundary (see CLAUDE.md §11 + RESEARCH §Anti-Patterns).
   */
  session: { user: UserChipSessionUser } | null;
}

/** Truncate display name to 8 chars with ellipsis, falling back to email local-part. */
function truncateName(name: string | null, email: string): string {
  const raw = (name && name.trim()) || email.split('@')[0] || 'User';
  return raw.length > 8 ? raw.slice(0, 8) + '…' : raw;
}

/** First character (uppercased for Latin) used in the monogram fallback. */
function initialOf(name: string | null, email: string): string {
  const raw = (name && name.trim()) || email.split('@')[0] || 'U';
  const ch = raw.charAt(0);
  // Uppercase Latin chars; CJK characters are unaffected by toLocaleUpperCase.
  return ch.toLocaleUpperCase();
}

export function UserChip({ session }: UserChipProps) {
  // --- Anonymous branch — PRESERVED from Phase 4 stub, unchanged ---
  if (!session?.user) {
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

  // --- Authenticated branch ---
  return <AuthenticatedChip user={session.user} />;
}

/**
 * Split out to a child component so useState/useEffect are not conditionally
 * called (avoids hooks-order lint / rules-of-hooks violation).
 */
function AuthenticatedChip({ user }: { user: UserChipSessionUser }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = truncateName(user.name, user.email);
  const initial = initialOf(user.name, user.email);

  // Click-outside + Escape close
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const avatar = user.image ? (
    <Image
      src={user.image}
      alt={user.name ?? '用户头像'}
      width={32}
      height={32}
      style={{ borderRadius: '50%', flexShrink: 0 }}
    />
  ) : (
    // Monogram fallback — UI-SPEC §UserChip Monogram (accent-100 / accent-700).
    <span
      role="img"
      aria-label={initial}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'var(--accent-100)',
        color: 'var(--accent-700)',
        fontWeight: 600,
        fontSize: 14,
        fontFamily: 'var(--font-sans)',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );

  return (
    <div ref={containerRef} style={{ margin: '0 12px 12px', position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '6px 8px',
          borderRadius: 8,
          background: open ? 'var(--surface-1)' : 'transparent',
          border: '1px solid var(--line-weak)',
          color: 'var(--ink-900)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'background 120ms var(--ease)',
        }}
      >
        {avatar}
        <span
          style={{
            flex: 1,
            textAlign: 'left',
            fontSize: 13,
            color: 'var(--ink-900)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: 160,
            background: 'var(--surface-0)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <form
            onSubmit={(e) => {
              // Per Plan 05-04 Decisions: React 18.3 does not support
              // function-valued <form action={fn}> outside Next.js's compiler
              // transform (Vitest receives raw JSX). Call the server action
              // explicitly via onSubmit — semantics identical in production.
              e.preventDefault();
              void signOutAction();
              setOpen(false);
            }}
          >
            <button
              type="submit"
              role="menuitem"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                minHeight: 40,
                padding: '0 12px',
                background: 'transparent',
                border: 0,
                fontFamily: 'inherit',
                fontSize: 13,
                color: 'var(--ink-900)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Icon name="log-out" size={16} />
              退出登录
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
