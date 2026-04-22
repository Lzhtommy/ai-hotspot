// ============================================================================
// Sidebar — AI Hotspot navigation
// ============================================================================

const NAV_READER = [
  { id: 'featured', icon: 'sparkles', label: '精选', badge: 28 },
  { id: 'all', icon: 'inbox', label: '全部 AI 动态', badge: 184 },
  { id: 'buzz', icon: 'arrow-up-right', label: '低粉爆文', badge: null, v2: true },
  { id: 'favorites', icon: 'star', label: '收藏', badge: 42 },
];
const NAV_ADMIN = [
  { id: 'sources', icon: 'globe', label: '信源' },
  { id: 'submissions', icon: 'send', label: '信源提报', badge: 3, v2: true },
  { id: 'strategies', icon: 'filter', label: '策略' },
  { id: 'users', icon: 'users', label: '用户' },
  { id: 'backend', icon: 'settings', label: '后台' },
];

const NavRow = ({ item, active, onClick }) => {
  const [hover, setHover] = React.useState(false);
  const disabled = item.v2;
  return (
    <div
      onClick={disabled ? null : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={disabled ? '将在 v2 上线' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 30,
        padding: '0 10px',
        background: active
          ? 'var(--surface-1)'
          : hover && !disabled
            ? 'var(--surface-1)'
            : 'transparent',
        color: disabled ? 'var(--fg-4)' : active ? 'var(--ink-900)' : 'var(--ink-700)',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        letterSpacing: '-0.003em',
        opacity: disabled ? 0.55 : 1,
        position: 'relative',
      }}
    >
      <Icon name={item.icon} size={15} />
      <span>{item.label}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {item.v2 && (
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
            V2
          </span>
        )}
        {item.badge != null && (
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: active ? 'var(--ink-700)' : 'var(--fg-4)',
            }}
          >
            {item.badge}
          </span>
        )}
      </span>
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <div
    style={{
      padding: '14px 10px 6px',
      fontSize: 10,
      fontWeight: 600,
      color: 'var(--fg-3)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const Sidebar = ({ current, onNavigate, user }) => (
  <aside
    style={{
      width: 224,
      flexShrink: 0,
      background: 'var(--paper)',
      borderRight: '1px solid var(--line-weak)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '14px 12px',
      boxSizing: 'border-box',
    }}
  >
    {/* Brand */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 6px 14px',
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          background: 'var(--accent-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--font-sans)',
          letterSpacing: '-0.02em',
        }}
      >
        {/* A stylized heat/peak glyph */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1.5C8 1.5 5 4 5 7c0 1.2.7 2.2 1.7 2.7-.4-.5-.6-1.1-.6-1.8 0-1.4 1-2.5 1.9-3.4 1 1 1.9 2.2 1.9 3.6 0 .7-.2 1.3-.6 1.8 1-.5 1.7-1.5 1.7-2.7C11 4 8 1.5 8 1.5z"
            fill="#fff"
          />
          <path
            d="M4 10c0 2.2 1.8 4 4 4s4-1.8 4-4c0-.9-.3-1.7-.8-2.4-.3 1.4-1.3 2.6-2.6 3.1.2-.3.4-.8.4-1.3 0-1.1-1-2.2-1-2.2S7 8.3 7 9.4c0 .5.2 1 .4 1.3-1.3-.5-2.3-1.7-2.6-3.1C4.3 8.3 4 9.1 4 10z"
            fill="#fff"
            opacity="0.7"
          />
        </svg>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
            fontFamily: 'var(--font-sans)',
          }}
        >
          AI Hotspot
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', letterSpacing: 0 }}>
          中文 AI 动态聚合
        </div>
      </div>
    </div>

    {/* Search */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 30,
        padding: '0 10px',
        marginBottom: 4,
        background: 'var(--surface-1)',
        borderRadius: 6,
        color: 'var(--fg-4)',
        fontSize: 12.5,
        cursor: 'text',
      }}
    >
      <Icon name="search" size={13} />
      <span>搜索动态…</span>
      <kbd
        style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          padding: '0 4px',
          background: 'var(--surface-0)',
          border: '1px solid var(--line-weak)',
          borderRadius: 3,
          color: 'var(--fg-3)',
        }}
      >
        ⌘K
      </kbd>
    </div>

    <SectionLabel>动态</SectionLabel>
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {NAV_READER.map((item) => (
        <NavRow
          key={item.id}
          item={item}
          active={current === item.id}
          onClick={() => onNavigate(item.id)}
        />
      ))}
    </nav>

    <SectionLabel>管理</SectionLabel>
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {NAV_ADMIN.map((item) => (
        <NavRow
          key={item.id}
          item={item}
          active={current === item.id}
          onClick={() => onNavigate(item.id)}
        />
      ))}
    </nav>

    <div style={{ marginTop: 'auto' }}>
      {/* Pipeline status */}
      <div
        style={{
          padding: 12,
          marginBottom: 10,
          background: 'var(--surface-0)',
          border: '1px solid var(--line-weak)',
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--success-500)',
            }}
          />
          <span style={{ fontWeight: 500, color: 'var(--ink-900)' }}>聚合进行中</span>
        </div>
        <div style={{ color: 'var(--fg-3)', fontSize: 11, lineHeight: 1.5 }}>
          19 个信源 · 上次同步 12 分钟前
        </div>
        <div
          style={{
            marginTop: 8,
            height: 3,
            background: 'var(--surface-2)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '68%', height: '100%', background: 'var(--accent-500)' }} />
        </div>
      </div>

      {/* User */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 6px',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'var(--ink-800)',
            color: 'var(--paper)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0,
          }}
        >
          CL
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-900)' }}>陈立</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>chen.li@example.cn</div>
        </div>
        <Icon name="more-horizontal" size={14} />
      </div>
    </div>
  </aside>
);

Object.assign(window, { Sidebar, NAV_READER, NAV_ADMIN });
