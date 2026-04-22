// ============================================================================
// App — root component, state, routing
// ============================================================================

const { useState, useEffect, useRef } = React;

const LS_KEY = 'ai-hotspot-state-v1';

const loadPersisted = () => {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return {
      view: s.view || 'featured',
      favorites: new Set(s.favorites || ['deepseek-v4', 'anthropic-mcp-2']),
      likes: new Set(s.likes || ['claude-45-anthropic']),
      dislikes: new Set(s.dislikes || []),
    };
  } catch (e) {
    return {
      view: 'featured',
      favorites: new Set(['deepseek-v4', 'anthropic-mcp-2']),
      likes: new Set(['claude-45-anthropic']),
      dislikes: new Set(),
    };
  }
};

// Tweaks defaults — wrapped in EDITMODE markers for the tweaks host
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  theme: 'light',
  density: 'comfortable',
  badgeStyle: 'numeric',
  showReason: true,
}; /*EDITMODE-END*/

const App = () => {
  const persisted = loadPersisted();
  const [view, setView] = useState(persisted.view);
  const [favorites, setFavorites] = useState(persisted.favorites);
  const [likes, setLikes] = useState(persisted.likes);
  const [dislikes, setDislikes] = useState(persisted.dislikes);

  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // Persist
  useEffect(() => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        view,
        favorites: [...favorites],
        likes: [...likes],
        dislikes: [...dislikes],
      }),
    );
  }, [view, favorites, likes, dislikes]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
  }, [tweaks.theme]);

  // Edit-mode protocol
  useEffect(() => {
    const handler = (e) => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode') setTweaksOpen(true);
      if (d.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateTweaks = (next) => {
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: next }, '*');
  };

  const toggleSet = (set, id, setter) => {
    const ns = new Set(set);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    setter(ns);
  };
  const onFavorite = (id) => toggleSet(favorites, id, setFavorites);
  const onLike = (id) => {
    toggleSet(likes, id, setLikes);
    if (dislikes.has(id)) {
      const nd = new Set(dislikes);
      nd.delete(id);
      setDislikes(nd);
    }
  };
  const onDislike = (id) => {
    toggleSet(dislikes, id, setDislikes);
    if (likes.has(id)) {
      const nl = new Set(likes);
      nl.delete(id);
      setLikes(nl);
    }
  };

  const readerViews = ['featured', 'all', 'favorites'];
  const isReader = readerViews.includes(view);

  let main;
  if (isReader) {
    main = (
      <FeedView
        view={view}
        onViewChange={setView}
        density={tweaks.density}
        badgeStyle={tweaks.badgeStyle}
        showReason={tweaks.showReason}
        favorites={favorites}
        likes={likes}
        dislikes={dislikes}
        onFavorite={onFavorite}
        onLike={onLike}
        onDislike={onDislike}
      />
    );
  } else if (view === 'sources') {
    main = <SourcesAdmin />;
  } else if (view === 'strategies') {
    main = <StrategiesAdmin />;
  } else if (view === 'users') {
    main = <UsersAdmin />;
  } else if (view === 'backend') {
    main = <BackendAdmin />;
  } else {
    main = <EmptyState title="将在 v2 上线" body="该功能目前在 v1 范围外。" />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-app)' }}>
      <Sidebar current={view} onNavigate={setView} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>{main}</main>
      <TweaksPanel
        open={tweaksOpen}
        state={tweaks}
        setState={updateTweaks}
        onClose={() => setTweaksOpen(false)}
      />
    </div>
  );
};

// Patch FeedCard to respect showReason tweak via a wrapper
const OriginalFeedCard = window.FeedCard;
window.FeedCard = (props) => {
  const item = props.showReason === false ? { ...props.item, reason: null } : props.item;
  return <OriginalFeedCard {...props} item={item} />;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
