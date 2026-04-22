// ============================================================================
// Tweaks panel — in-design controls
// ============================================================================

const TweaksPanel = ({ open, state, setState, onClose }) => {
  if (!open) return null;

  const Row = ({ label, children }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px solid var(--line-weak)',
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );

  const Segmented = ({ value, options, onChange }) => (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--surface-1)',
        border: '1px solid var(--line-weak)',
        borderRadius: 6,
        padding: 2,
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            height: 24,
            padding: '0 10px',
            background: value === o.value ? 'var(--surface-0)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            fontSize: 11.5,
            fontFamily: 'inherit',
            color: value === o.value ? 'var(--ink-900)' : 'var(--fg-3)',
            fontWeight: value === o.value ? 500 : 400,
            cursor: 'pointer',
            boxShadow: value === o.value ? 'var(--shadow-sm)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="tweaks-panel open" style={{ width: 320 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>Tweaks</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>实时调整设计变量</div>
        </div>
        <IconButton icon="x" size={28} onClick={onClose} />
      </div>
      <div style={{ paddingTop: 4 }}>
        <Row label="主题">
          <Segmented
            value={state.theme}
            options={[
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
            ]}
            onChange={(v) => setState({ ...state, theme: v })}
          />
        </Row>
        <Row label="卡片密度">
          <Segmented
            value={state.density}
            options={[
              { value: 'compact', label: '紧凑' },
              { value: 'comfortable', label: '标准' },
              { value: 'spacious', label: '宽松' },
            ]}
            onChange={(v) => setState({ ...state, density: v })}
          />
        </Row>
        <Row label="热度标识">
          <Segmented
            value={state.badgeStyle}
            options={[
              { value: 'numeric', label: '数字' },
              { value: 'bar', label: '进度条' },
              { value: 'flame', label: '火焰' },
            ]}
            onChange={(v) => setState({ ...state, badgeStyle: v })}
          />
        </Row>
        <Row label="显示 Claude 推荐理由">
          <Segmented
            value={state.showReason ? 'on' : 'off'}
            options={[
              { value: 'on', label: '开' },
              { value: 'off', label: '关' },
            ]}
            onChange={(v) => setState({ ...state, showReason: v === 'on' })}
          />
        </Row>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-4)', paddingTop: 10, lineHeight: 1.5 }}>
        切换"深色"会以 Testify 暖色调转换为夜间模式。此处不使用参考截图的绿色,以保持品牌一致。
      </div>
    </div>
  );
};

Object.assign(window, { TweaksPanel });
