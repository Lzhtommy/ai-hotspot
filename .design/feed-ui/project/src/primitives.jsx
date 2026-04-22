// ============================================================================
// AI Hotspot — primitives
// Shared atoms: Icon, SourceDot, Badge, Tag, ScoreBadge, Button, IconButton,
// HotnessBar, SourceChip, TooltipLink
// ============================================================================

const Icon = ({ name, size = 16, style, className }) => (
  <img
    src={`ds/icons/${name}.svg`}
    width={size}
    height={size}
    alt=""
    className={`icon-invert ${className || ''}`}
    style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
  />
);

// Source visual identity — a round colored monogram, no emoji
const SourceDot = ({ sourceId, size = 18 }) => {
  const s = window.SOURCES[sourceId];
  if (!s) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 4,
        background: s.color,
        color: '#fff',
        fontSize: Math.max(9, size * 0.55),
        fontWeight: 600,
        flexShrink: 0,
        fontFamily: 'var(--font-sans)',
        letterSpacing: 0,
        lineHeight: 1,
      }}
    >
      {s.initial}
    </span>
  );
};

const SourceChip = ({ sourceId, muted }) => {
  const s = window.SOURCES[sourceId];
  if (!s) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: muted ? 'var(--fg-3)' : 'var(--fg-2)',
        fontWeight: 500,
      }}
    >
      <SourceDot sourceId={sourceId} size={14} />
      <span>{s.name}</span>
    </span>
  );
};

const Tag = ({ id, onClick, active }) => {
  const t = window.TAGS[id];
  if (!t) return null;
  const tones = {
    accent: { bg: 'var(--accent-50)', fg: 'var(--accent-700)', bd: 'var(--accent-100)' },
    success: { bg: 'var(--success-50)', fg: 'var(--success-500)', bd: 'transparent' },
    info: { bg: 'var(--info-50)', fg: 'var(--info-500)', bd: 'transparent' },
    danger: { bg: 'var(--danger-50)', fg: 'var(--danger-500)', bd: 'transparent' },
    neutral: { bg: 'var(--surface-1)', fg: 'var(--ink-700)', bd: 'var(--line-weak)' },
  }[t.tone] || { bg: 'var(--surface-1)', fg: 'var(--ink-700)', bd: 'var(--line-weak)' };
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        padding: '0 8px',
        background: active ? 'var(--ink-900)' : tones.bg,
        color: active ? 'var(--paper)' : tones.fg,
        border: `1px solid ${active ? 'var(--ink-900)' : tones.bd}`,
        borderRadius: 4,
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: 0,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {t.label}
    </span>
  );
};

// Hotness badge — numeric + mini bar. 80+ gets a "热" marker.
const ScoreBadge = ({ score, variant = 'full' }) => {
  const isHot = score >= 80;
  const isWarm = score >= 60;
  const barColor = isHot ? 'var(--accent-500)' : isWarm ? 'var(--accent-300)' : 'var(--ink-400)';
  if (variant === 'compact') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink-900)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: 0,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: barColor }} />
        {score}
      </span>
    );
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 3,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          {score}
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-3)', lineHeight: 1 }}>/100</span>
      </div>
      {isHot && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--accent-700)',
            background: 'var(--accent-50)',
            border: '1px solid var(--accent-100)',
            padding: '1px 5px',
            borderRadius: 3,
            letterSpacing: '0.02em',
          }}
        >
          HOT
        </span>
      )}
    </div>
  );
};

const HotnessBar = ({ score, width = 64 }) => {
  const isHot = score >= 80;
  const isWarm = score >= 60;
  const fill = isHot ? 'var(--accent-500)' : isWarm ? 'var(--accent-300)' : 'var(--ink-400)';
  return (
    <div
      style={{
        width,
        height: 3,
        borderRadius: 999,
        background: 'var(--surface-2)',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: `${score}%`, height: '100%', background: fill }} />
    </div>
  );
};

const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  iconRight,
  onClick,
  disabled,
  style,
}) => {
  const sizes = {
    sm: { h: 28, px: 10, fs: 12 },
    md: { h: 34, px: 14, fs: 13 },
    lg: { h: 40, px: 18, fs: 14 },
  }[size];
  const variants = {
    primary: { bg: 'var(--ink-900)', fg: 'var(--paper)', bd: 'transparent' },
    secondary: { bg: 'var(--surface-0)', fg: 'var(--ink-900)', bd: 'var(--line)' },
    ghost: { bg: 'transparent', fg: 'var(--ink-700)', bd: 'transparent' },
    accent: { bg: 'var(--accent-500)', fg: '#fff', bd: 'transparent' },
    danger: { bg: 'var(--danger-500)', fg: '#fff', bd: 'transparent' },
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: sizes.h,
        padding: `0 ${sizes.px}px`,
        background: variants.bg,
        color: variants.fg,
        border: `1px solid ${variants.bd}`,
        borderRadius: 6,
        fontFamily: 'inherit',
        fontSize: sizes.fs,
        fontWeight: 500,
        letterSpacing: '-0.003em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        transition: 'background 120ms var(--ease)',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={sizes.fs} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sizes.fs} />}
    </button>
  );
};

const IconButton = ({ icon, size = 30, onClick, title, active, tone = 'neutral' }) => {
  const [hover, setHover] = React.useState(false);
  const fg = active
    ? tone === 'danger'
      ? 'var(--danger-500)'
      : tone === 'accent'
        ? 'var(--accent-600)'
        : 'var(--ink-900)'
    : 'var(--ink-700)';
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size,
        height: size,
        padding: 0,
        background: hover ? 'var(--surface-1)' : 'transparent',
        border: '1px solid transparent',
        borderRadius: 6,
        cursor: 'pointer',
        color: fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 120ms var(--ease)',
      }}
    >
      <Icon name={icon} size={15} />
    </button>
  );
};

const Divider = ({ vertical, space = 12 }) =>
  vertical ? (
    <div
      style={{ width: 1, height: 16, background: 'var(--line-weak)', margin: `0 ${space / 2}px` }}
    />
  ) : (
    <div style={{ height: 1, background: 'var(--line-weak)', margin: `${space}px 0` }} />
  );

const Eyebrow = ({ children, color }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 600,
      color: color || 'var(--fg-3)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

Object.assign(window, {
  Icon,
  SourceDot,
  SourceChip,
  Tag,
  ScoreBadge,
  HotnessBar,
  Button,
  IconButton,
  Divider,
  Eyebrow,
});
