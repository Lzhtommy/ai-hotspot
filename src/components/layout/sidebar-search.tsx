'use client';
/**
 * SidebarSearch — Quick 260424-ogp.
 *
 * Client Component that replaces the sidebar's previous disabled search stub
 * with a real input wired to GET /api/search.
 *
 * Behaviour:
 *   - ⌘K (macOS) / Ctrl+K (others) anywhere in the document focuses the
 *     input. The global keydown listener is installed once on mount.
 *   - Typing debounces 250ms then calls /api/search?q=<term>. Requests are
 *     aborted via AbortController when superseded or on blur.
 *   - Queries shorter than 2 characters (after trim) close the dropdown
 *     without hitting the API (mirrors src/lib/search/search-items.ts guard).
 *   - Escape clears the input, hides the dropdown, and blurs the field.
 *   - Results render as an absolutely-positioned dropdown below the input,
 *     each row is an anchor to /items/{id} so the mobile drawer's default
 *     click-outside behaviour still works.
 *
 * Visual: matches the old stub's geometry (30px height, 12.5px text,
 * --surface-1 background, ⌘K kbd on the right) so sidebar.tsx does not need
 * further padding adjustments.
 *
 * Consumed by:
 *   - src/components/layout/sidebar.tsx
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icon';

type SearchHit = {
  id: string;
  title: string;
  titleZh: string | null;
  summaryZh: string | null;
  publishedAt: string;
  sourceName: string | null;
};

const DEBOUNCE_MS = 250;
const MIN_LENGTH = 2;

export function SidebarSearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ⌘K / Ctrl+K global focus shortcut.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Debounced fetch when query changes.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_LENGTH) {
      setHits(null);
      setOpen(false);
      setLoading(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as { items?: SearchHit[] };
          return body.items ?? [];
        })
        .then((items) => {
          setHits(items);
          setOpen(true);
          setLoading(false);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          // Silent UI failure — sidebar is not the place to surface API errors.
          setHits([]);
          setOpen(true);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setHits(null);
      setOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  const handleBlur = useCallback(() => {
    // Small delay so a click on a dropdown link registers before we unmount
    // the dropdown. Matches common "combobox" patterns.
    setTimeout(() => setOpen(false), 120);
  }, []);

  const handleFocus = useCallback(() => {
    if (hits && hits.length > 0) setOpen(true);
  }, [hits]);

  const showDropdown = open && query.trim().length >= MIN_LENGTH;

  return (
    <div style={{ position: 'relative', marginBottom: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 30, // sidebar.jsx line 176 — off 4pt scale, design exact
          padding: '0 10px',
          background: 'var(--surface-1)',
          borderRadius: 6,
          color: 'var(--fg-3)',
          fontSize: 12.5,
          cursor: 'text',
        }}
        role="search"
        aria-label="搜索动态"
      >
        <Icon name="search" size={13} />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="搜索动态…"
          aria-label="搜索动态"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--ink-900)',
            fontSize: 12.5,
            fontFamily: 'inherit',
            padding: 0,
          }}
        />
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
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          ⌘K
        </kbd>
      </div>

      {showDropdown && (
        <div
          role="listbox"
          aria-label="搜索结果"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 50,
            background: 'var(--paper)',
            border: '1px solid var(--line-weak)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {loading && (hits == null || hits.length === 0) ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fg-3)' }}>搜索中…</div>
          ) : hits && hits.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fg-3)' }}>
              未找到相关动态
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 4 }}>
              {(hits ?? []).map((hit) => {
                const displayTitle = hit.titleZh || hit.title;
                return (
                  <li key={hit.id}>
                    <Link
                      href={`/items/${hit.id}`}
                      style={{
                        display: 'block',
                        padding: '8px 10px',
                        borderRadius: 4,
                        textDecoration: 'none',
                        color: 'var(--ink-900)',
                        fontSize: 12.5,
                        lineHeight: 1.4,
                      }}
                      role="option"
                      aria-selected="false"
                    >
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayTitle}
                      </div>
                      {hit.sourceName && (
                        <div
                          style={{
                            fontSize: 10.5,
                            color: 'var(--fg-3)',
                            marginTop: 2,
                          }}
                        >
                          {hit.sourceName}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
