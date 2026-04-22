// ============================================================================
// FeedCard — the core item card
// Variants: comfortable (default), compact, spacious
// Shows: source, title, 中文摘要, tags, hotness, 推荐理由, cluster count
// ============================================================================

const ClusterSiblings = ({ siblings, expanded }) => {
  if (!siblings || !siblings.length) return null;
  return (
    <div
      style={{
        marginTop: 12,
        paddingLeft: 12,
        borderLeft: '2px solid var(--line-weak)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {siblings.map((s) => {
        const src = window.SOURCES[s.source];
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              paddingRight: 8,
            }}
          >
            <SourceDot sourceId={s.source} size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--ink-900)',
                  fontWeight: 500,
                  lineHeight: 1.45,
                  letterSpacing: '-0.003em',
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--fg-3)',
                  marginTop: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{src.name}</span>
                <span
                  style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--fg-4)' }}
                />
                <span>{s.time}</span>
                <span
                  style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--fg-4)' }}
                />
                <span style={{ fontFamily: 'var(--font-mono)' }}>热度 {s.score}</span>
              </div>
            </div>
            <Icon name="external-link" size={12} style={{ opacity: 0.5, marginTop: 2 }} />
          </div>
        );
      })}
    </div>
  );
};

const ClusterTrigger = ({ count, expanded, onToggle }) => (
  <button
    onClick={onToggle}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: 'transparent',
      border: '1px dashed var(--line)',
      borderRadius: 6,
      padding: '6px 10px',
      fontSize: 12,
      fontFamily: 'inherit',
      color: 'var(--fg-2)',
      cursor: 'pointer',
      marginTop: 10,
      letterSpacing: 0,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--surface-1)';
      e.currentTarget.style.borderStyle = 'solid';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderStyle = 'dashed';
    }}
  >
    {/* stacked source dots */}
    <span style={{ display: 'inline-flex' }}>
      {[0, 1, 2].slice(0, Math.min(3, count)).map((_, i) => (
        <span
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: ['#D4911C', '#2558B5', '#E4572E'][i],
            marginLeft: i === 0 ? 0 : -4,
            border: '1.5px solid var(--surface-0)',
          }}
        />
      ))}
    </span>
    <span>
      另有 <b style={{ color: 'var(--ink-900)', fontWeight: 600 }}>{count}</b> 个源也报道了此事件
    </span>
    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} />
  </button>
);

const FeedCard = ({
  item,
  density = 'comfortable',
  badgeStyle = 'numeric',
  onFavorite,
  favorited,
  liked,
  disliked,
  onLike,
  onDislike,
  scoreVisible = true,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const src = window.SOURCES[item.source];

  const paddingMap = {
    compact: {
      card: '14px 16px',
      titleMargin: 4,
      summaryMargin: 8,
      fs: { title: 14, summary: 13 },
    },
    comfortable: {
      card: '18px 22px',
      titleMargin: 6,
      summaryMargin: 10,
      fs: { title: 15.5, summary: 14 },
    },
    spacious: {
      card: '24px 28px',
      titleMargin: 8,
      summaryMargin: 12,
      fs: { title: 17, summary: 14.5 },
    },
  };
  const p = paddingMap[density];

  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--line-weak)',
        borderRadius: 10,
        padding: p.card,
        transition: 'border-color 120ms var(--ease), box-shadow 120ms var(--ease)',
        borderColor: hover ? 'var(--line)' : 'var(--line-weak)',
        boxShadow: hover ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {/* Top row: source + meta + score */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: p.titleMargin + 4 }}
      >
        <SourceDot sourceId={item.source} size={18} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-700)', fontWeight: 500 }}>{src.name}</span>
        <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          {item.time}
        </span>
        {src.kind === 'official' && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--fg-3)',
              border: '1px solid var(--line-weak)',
              padding: '1px 5px',
              borderRadius: 3,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            官方
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {scoreVisible &&
            (badgeStyle === 'bar' ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <HotnessBar score={item.score} />
                <span
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-900)' }}
                >
                  {item.score}
                </span>
              </div>
            ) : badgeStyle === 'flame' ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: item.score >= 80 ? 'var(--accent-600)' : 'var(--fg-2)',
                  fontWeight: 600,
                }}
              >
                {item.score >= 80 && <span>🔥</span>}
                {item.score}
              </span>
            ) : (
              <ScoreBadge score={item.score} variant="full" />
            ))}
        </div>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: p.fs.title,
          fontWeight: 600,
          color: 'var(--ink-900)',
          letterSpacing: '-0.01em',
          lineHeight: 1.35,
          margin: 0,
          marginBottom: p.summaryMargin,
        }}
      >
        {item.title}
      </h3>

      {/* Summary */}
      <p
        style={{
          fontSize: p.fs.summary,
          lineHeight: 1.6,
          color: 'var(--ink-700)',
          margin: 0,
          letterSpacing: 0,
          textWrap: 'pretty',
        }}
      >
        {item.summary}
      </p>

      {/* 推荐理由 — amber-indented callout, only for primary items */}
      {item.reason && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: 'var(--accent-50)',
            borderLeft: '2px solid var(--accent-500)',
            borderRadius: '0 6px 6px 0',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--accent-700)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0l2 5 6 1-4.5 4 1 6L8 13l-4.5 3 1-6L0 6l6-1z" />
            </svg>
            Claude 推荐理由
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-800)',
              lineHeight: 1.55,
              letterSpacing: 0,
            }}
          >
            {item.reason}
          </div>
        </div>
      )}

      {/* Tags */}
      <div
        style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}
      >
        {item.tags.map((t) => (
          <Tag key={t} id={t} />
        ))}
      </div>

      {/* Cluster trigger */}
      {item._cluster_siblings && item._cluster_siblings.length > 0 && (
        <>
          <ClusterTrigger
            count={item._cluster_siblings.length}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
          />
          {expanded && <ClusterSiblings siblings={item._cluster_siblings} expanded={expanded} />}
        </>
      )}

      {/* Actions */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--line-weak)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <IconButton
          icon="star"
          active={favorited}
          tone="accent"
          title="收藏"
          onClick={onFavorite}
        />
        <IconButton icon="check" active={liked} tone="accent" title="Like" onClick={onLike} />
        <IconButton icon="x" active={disliked} tone="danger" title="Dislike" onClick={onDislike} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{src.url}</span>
          <IconButton icon="external-link" size={28} title="打开原文" />
        </div>
      </div>
    </article>
  );
};

Object.assign(window, { FeedCard, ClusterSiblings, ClusterTrigger });
