/**
 * NavRow — Phase 4 FEED-06, sidebar.jsx lines 19–82.
 *
 * A 30px-high sidebar nav row with icon, label, optional badge count, and
 * optional V2 chip. Disabled rows (v2 gated or admin-locked) render with
 * reduced opacity and cursor-not-allowed. Active rows get surface-1 background.
 *
 * RSC-safe — no client state. Hover effect is pure CSS :hover.
 *
 * Consumed by:
 *   - src/components/layout/sidebar.tsx
 */

import Link from 'next/link';
import { Icon, type IconName } from './icon';

export interface NavRowProps {
  label: string;
  icon: IconName;
  href?: string;
  disabled?: boolean;
  chip?: 'V2' | null;
  title?: string;
  active?: boolean;
  count?: number;
}

export function NavRow({ label, icon, href, disabled, chip, title, active, count }: NavRowProps) {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 30,
    padding: '0 10px',
    // sidebar.jsx line 34: active → surface-1; hover handled in CSS via :hover class
    background: active ? 'var(--surface-1)' : 'transparent',
    color: disabled ? 'var(--fg-4)' : active ? 'var(--ink-900)' : 'var(--ink-700)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    letterSpacing: '-0.003em',
    opacity: disabled ? 0.55 : 1,
    textDecoration: 'none',
    transition: 'background 120ms var(--ease)',
  };

  const content = (
    <>
      <Icon name={icon} size={15} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {chip && (
          // V2 chip — sidebar.jsx lines 52–67
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              background: 'transparent',
              color: 'var(--fg-4)',
              border: '1px solid var(--line-weak)',
              borderRadius: 3,
              letterSpacing: '0.04em',
            }}
          >
            {chip}
          </span>
        )}
        {count != null && (
          // Badge count — sidebar.jsx lines 68–78
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: active ? 'var(--ink-700)' : 'var(--fg-4)',
            }}
          >
            {count}
          </span>
        )}
      </span>
    </>
  );

  if (disabled) {
    return (
      <div
        role="button"
        aria-disabled="true"
        title={title}
        style={rowStyle}
        tabIndex={-1}
      >
        {content}
      </div>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        title={title}
        className="nav-row-hover"
        style={rowStyle}
      >
        {content}
      </Link>
    );
  }

  // Fallback (no href, not disabled — shouldn't happen in practice)
  return (
    <div role="button" title={title} style={rowStyle}>
      {content}
    </div>
  );
}
