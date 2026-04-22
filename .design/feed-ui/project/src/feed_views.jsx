// ============================================================================
// Feed views — Timeline, Featured, Favorites, All
// ============================================================================

// Top bar for reader views: tabs + filters + refresh
const FeedTopBar = ({
  view,
  onViewChange,
  itemCount,
  lastSync,
  activeTags,
  onToggleTag,
  onClearTags,
}) => (
  <div
    style={{
      background: 'var(--paper)',
      borderBottom: '1px solid var(--line-weak)',
      padding: '18px 32px 0',
      position: 'sticky',
      top: 0,
      zIndex: 20,
      backdropFilter: 'blur(8px) saturate(140%)',
      WebkitBackdropFilter: 'blur(8px) saturate(140%)',
      background: 'color-mix(in oklab, var(--paper) 92%, transparent)',
    }}
  >
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
    >
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.015em',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {view === 'featured' ? '精选' : view === 'favorites' ? '收藏' : '全部 AI 动态'}
        </h1>
        <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 3 }}>
          {view === 'featured' && `由 Claude 按策略筛选的高热度内容 · ${itemCount} 条`}
          {view === 'all' && `按时间倒序 · 共 ${itemCount} 条 · 上次同步 ${lastSync} 分钟前`}
          {view === 'favorites' && `你收藏的 ${itemCount} 条内容`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Button variant="ghost" size="sm" icon="filter">
          过滤
        </Button>
        <Button variant="secondary" size="sm" icon="download">
          导出
        </Button>
        <Button variant="primary" size="sm" icon="loader">
          手动同步
        </Button>
      </div>
    </div>

    {/* View tabs */}
    <div style={{ display: 'flex', gap: 2, marginTop: 16 }}>
      {[
        { id: 'featured', label: '精选', count: 28 },
        { id: 'all', label: '全部动态', count: 184 },
        { id: 'favorites', label: '收藏', count: 42 },
      ].map((t) => (
        <div
          key={t.id}
          onClick={() => onViewChange(t.id)}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 500,
            color: view === t.id ? 'var(--ink-900)' : 'var(--fg-3)',
            borderBottom: `2px solid ${view === t.id ? 'var(--ink-900)' : 'transparent'}`,
            marginBottom: -1,
            cursor: 'pointer',
            letterSpacing: '-0.003em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {t.label}
          <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {t.count}
          </span>
        </div>
      ))}
    </div>

    {/* Active tag filters */}
    {activeTags && activeTags.length > 0 && (
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          padding: '12px 0',
          borderTop: '1px solid var(--line-weak)',
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>过滤:</span>
        {activeTags.map((t) => (
          <Tag key={t} id={t} active onClick={() => onToggleTag(t)} />
        ))}
        <button
          onClick={onClearTags}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--fg-3)',
            fontSize: 12,
            cursor: 'pointer',
            padding: '4px 6px',
          }}
        >
          清除
        </button>
      </div>
    )}
  </div>
);

// Group items into hour buckets (reference layout)
const groupByHour = (items) => {
  const groups = {};
  items.forEach((it) => {
    // Use YYYY-MM-DDTHH
    const key = it.iso.slice(0, 13);
    (groups[key] = groups[key] || []).push(it);
  });
  // Sort: newest first
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((k) => ({ key: k, items: groups[k].sort((a, b) => b.score - a.score) }));
};

const hourLabel = (key) => {
  // key = YYYY-MM-DDTHH
  const [date, hour] = key.split('T');
  const [y, m, d] = date.split('-');
  const today = '2026-04-20';
  const yesterday = '2026-04-19';
  const h = parseInt(hour, 10);
  const hh = `${String(h).padStart(2, '0')}:00`;
  let day = `${parseInt(m)}月${parseInt(d)}日`;
  if (date === today) day = '今天';
  else if (date === yesterday) day = '昨天';
  return { day, time: hh };
};

// Main timeline view
const Timeline = ({
  items,
  density,
  badgeStyle,
  favorites,
  likes,
  dislikes,
  onFavorite,
  onLike,
  onDislike,
}) => {
  const groups = groupByHour(items);
  return (
    <div style={{ padding: '24px 32px 80px', maxWidth: 920, margin: '0 auto' }}>
      {groups.map((g, gi) => {
        const { day, time } = hourLabel(g.key);
        return (
          <section key={g.key} style={{ marginBottom: gi === groups.length - 1 ? 0 : 28 }}>
            {/* Time rail header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 14,
                paddingBottom: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--fg-3)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {day}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--ink-900)',
                    letterSpacing: 0,
                  }}
                >
                  {time}
                </span>
              </div>
              <div style={{ flex: 1, height: 1, background: 'var(--line-weak)' }} />
              <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
                {g.items.length} 条
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {g.items.map((it) => (
                <FeedCard
                  key={it.id}
                  item={it}
                  density={density}
                  badgeStyle={badgeStyle}
                  favorited={favorites.has(it.id)}
                  liked={likes.has(it.id)}
                  disliked={dislikes.has(it.id)}
                  onFavorite={() => onFavorite(it.id)}
                  onLike={() => onLike(it.id)}
                  onDislike={() => onDislike(it.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

// Featured view header — shows active strategies
const FeaturedStrategyBar = () => (
  <div
    style={{
      padding: '14px 32px',
      background: 'var(--surface-1)',
      borderBottom: '1px solid var(--line-weak)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 12,
      color: 'var(--fg-2)',
      flexWrap: 'wrap',
    }}
  >
    <span style={{ fontWeight: 500, color: 'var(--ink-900)' }}>当前生效策略:</span>
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        background: 'var(--surface-0)',
        border: '1px solid var(--line-weak)',
        borderRadius: 3,
      }}
    >
      <span
        style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success-500)' }}
      />
      模型发布优先{' '}
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>×1.5</span>
    </span>
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        background: 'var(--surface-0)',
        border: '1px solid var(--line-weak)',
        borderRadius: 3,
      }}
    >
      <span
        style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success-500)' }}
      />
      Anthropic 加权
    </span>
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        background: 'var(--surface-0)',
        border: '1px solid var(--line-weak)',
        borderRadius: 3,
      }}
    >
      <span
        style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success-500)' }}
      />
      论文优先级提升{' '}
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>×1.3</span>
    </span>
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        background: 'var(--surface-0)',
        border: '1px solid var(--line-weak)',
        borderRadius: 3,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--danger-500)' }} />
      降低营销稿权重{' '}
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>×0.6</span>
    </span>
    <span style={{ marginLeft: 'auto', color: 'var(--fg-3)' }}>
      <a href="#" style={{ color: 'inherit', textDecorationColor: 'var(--ink-300)' }}>
        查看全部策略 →
      </a>
    </span>
  </div>
);

const FeedView = ({
  view,
  onViewChange,
  density,
  badgeStyle,
  favorites,
  likes,
  dislikes,
  onFavorite,
  onLike,
  onDislike,
}) => {
  const allItems = window.FEED.filter((it) => it._primary);

  let items = allItems;
  if (view === 'featured') {
    items = allItems.filter((it) => it.score >= 70).sort((a, b) => b.score - a.score);
  } else if (view === 'favorites') {
    items = allItems.filter((it) => favorites.has(it.id));
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }} className="scroll">
      <FeedTopBar view={view} onViewChange={onViewChange} itemCount={items.length} lastSync={12} />
      {view === 'featured' && <FeaturedStrategyBar />}
      {items.length === 0 && view === 'favorites' ? (
        <EmptyState
          title="还没有收藏"
          body="在任意动态卡片上点击星标,收藏的内容会出现在这里。"
          cta="去看全部动态"
          ctaAction={() => onViewChange('all')}
        />
      ) : (
        <Timeline
          items={items}
          density={density}
          badgeStyle={badgeStyle}
          favorites={favorites}
          likes={likes}
          dislikes={dislikes}
          onFavorite={onFavorite}
          onLike={onLike}
          onDislike={onDislike}
        />
      )}
    </div>
  );
};

const EmptyState = ({ title, body, cta, ctaAction }) => (
  <div
    style={{
      padding: '96px 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
    }}
  >
    <div
      style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}
    >
      {title}
    </div>
    <div style={{ fontSize: 14, color: 'var(--fg-3)', marginTop: 6, maxWidth: 360 }}>{body}</div>
    {cta && (
      <div style={{ marginTop: 20 }}>
        <Button variant="primary" size="md" onClick={ctaAction}>
          {cta}
        </Button>
      </div>
    )}
  </div>
);

Object.assign(window, {
  FeedView,
  Timeline,
  FeedTopBar,
  FeaturedStrategyBar,
  EmptyState,
  hourLabel,
  groupByHour,
});
