/**
 * Button component — Phase 4 FEED-03, UI-SPEC Typography + Color.
 *
 * 5 variants × 3 sizes with focus-ring, disabled state, optional leading/trailing icons.
 * All pixel values traced to primitives.jsx lines 186–238.
 *
 * Variants:
 *   primary  — ink-900 bg / paper text (default CTA)
 *   secondary — surface-0 bg / line border (secondary action)
 *   ghost    — transparent bg / ink-700 text (low-emphasis)
 *   accent   — accent-500 bg / white text (login CTA per D-26)
 *   danger   — danger-500 bg / white text (destructive — reserved, not used in Phase 4)
 *
 * Sizes (h / px / fs) from primitives.jsx L196–200:
 *   sm — 28px / 10px / 12px
 *   md — 34px / 14px / 13px
 *   lg — 40px / 18px / 14px
 *
 * Consumed by:
 *   - src/components/layout/icon-button.tsx (icon-only variant)
 *   - src/components/feed/login-prompt-modal.tsx (accent + ghost)
 *   - src/components/feed/feed-top-bar.tsx (ghost / secondary / primary)
 *   - src/components/layout/user-chip.tsx (ghost — 登录)
 */

'use client';

import { Icon, type IconName } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Variant styles from primitives.jsx L201–207
const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; bd: string; hoverBg: string }> = {
  primary: {
    bg: 'var(--ink-900)',
    fg: 'var(--paper)',
    bd: 'transparent',
    hoverBg: 'var(--ink-800)',
  },
  secondary: {
    bg: 'var(--surface-0)',
    fg: 'var(--ink-900)',
    bd: 'var(--line)',
    hoverBg: 'var(--surface-1)',
  },
  ghost: {
    bg: 'transparent',
    fg: 'var(--ink-700)',
    bd: 'transparent',
    hoverBg: 'var(--surface-1)',
  },
  accent: {
    bg: 'var(--accent-500)',
    fg: '#ffffff',
    bd: 'transparent',
    hoverBg: 'var(--accent-700)',
  },
  danger: {
    bg: 'var(--danger-500)',
    fg: '#ffffff',
    bd: 'transparent',
    hoverBg: 'var(--danger-500)',
  },
};

// Size values from primitives.jsx L196–200
const SIZES: Record<ButtonSize, { h: number; px: number; fs: number }> = {
  sm: { h: 28, px: 12, fs: 13 }, // plan spec: sm h-[28px] px-[12px] text-[13px]
  md: { h: 34, px: 16, fs: 14 }, // plan spec: md h-[34px] px-[16px] text-[14px]
  lg: { h: 40, px: 20, fs: 14 }, // plan spec: lg h-[40px] px-[20px] text-[14px]
};

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
  icon?: IconName;
  iconRight?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  className?: string;
  // Merged onto the inline styles below. Used sparingly for layout overrides
  // (e.g. width: '100%' for full-width provider buttons in LoginPromptModal).
  // Property names here win over the defaults (later spread wins).
  style?: React.CSSProperties;
  // Optional aria-label override. Useful when the visible text alone is not
  // descriptive enough (e.g. icon-only buttons). Passed through verbatim.
  'aria-label'?: string;
}

/**
 * Themed button with 5 variants and 3 sizes. All values traced to primitives.jsx L186–238.
 * Focus ring uses var(--shadow-focus) per UI-SPEC accessibility contract.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  iconRight,
  onClick,
  disabled,
  type = 'button',
  title,
  className,
  style,
  'aria-label': ariaLabel,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={className}
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.bd}`,
        borderRadius: 6, // --radius-sm from primitives.jsx L219
        fontFamily: 'inherit',
        fontSize: s.fs,
        fontWeight: 500,
        letterSpacing: '-0.003em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6, // primitives.jsx L228
        whiteSpace: 'nowrap',
        transition: `background 120ms var(--ease)`,
        // Focus ring via CSS — falls back to :focus-visible global rule in globals.css
        // Caller overrides (e.g. full-width) win via shallow merge.
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = v.hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = v.bg;
      }}
    >
      {icon && <Icon name={icon} size={s.fs} />}
      {children}
      {iconRight && <Icon name={iconRight} size={s.fs} />}
    </button>
  );
}
