'use client';

/**
 * Icon-only button with hover state — Phase 4 FEED-03, UI-SPEC Accessibility.
 *
 * Client Component because it owns hover state via useState.
 * All interactive instances require BOTH `title` (tooltip) and `aria-label` (screen reader)
 * per UI-SPEC accessibility contract — enforced at the TypeScript level.
 *
 * Tones (active-state color only):
 *   accent  → accent-500 (star/like icon)
 *   danger  → danger-500 (dislike icon per D-17 step 8)
 *   neutral → ink-900    (default)
 *
 * Port of .design/feed-ui/project/src/primitives.jsx IconButton (lines 240–273).
 *
 * Consumed by:
 *   - src/components/feed/feed-card-actions.tsx (star/check/x/external-link)
 *   - src/components/layout/sidebar.tsx (mobile menu toggle)
 */

import { useState } from 'react';
import { Icon, type IconName } from './icon';

export type IconButtonTone = 'accent' | 'danger' | 'neutral';

// Active-state fg colors per primitives.jsx L242–248
const ACTIVE_FG: Record<IconButtonTone, string> = {
  accent: 'var(--accent-500)',
  danger: 'var(--danger-500)',
  neutral: 'var(--ink-900)',
};

interface IconButtonProps {
  icon: IconName;
  /** Square size in px. Default: 30 from primitives.jsx L240 */
  size?: number;
  active?: boolean;
  tone?: IconButtonTone;
  /** Required — shown as tooltip text */
  title: string;
  /** Required — screen reader label (mirrors title) */
  'aria-label': string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Icon-only button. Default 30×30px with hover bg-surface-1 transition.
 * Active state changes icon color via the tone prop.
 */
export function IconButton({
  icon,
  size = 30, // primitives.jsx L240
  active = false,
  tone = 'neutral',
  title,
  'aria-label': ariaLabel,
  onClick,
  disabled,
  className,
}: IconButtonProps) {
  const [hover, setHover] = useState(false);

  const fgColor = active ? ACTIVE_FG[tone] : 'var(--ink-700)';
  const bgColor = hover && !disabled ? 'var(--surface-1)' : 'transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      title={title}
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size,
        height: size,
        padding: 0,
        background: bgColor,
        border: '1px solid transparent',
        borderRadius: 6, // --radius-sm
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        color: fgColor,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 120ms var(--ease)',
      }}
    >
      {/* Icon size 15px from primitives.jsx L270 */}
      <Icon name={icon} size={15} />
    </button>
  );
}
