'use client';

/**
 * Filter popover — Phase 4 FEED-12, D-22.
 *
 * Client Component rendering a "过滤" button that opens an inline popover.
 * Tag and source filters are written to URL via nuqs with shallow:false,
 * which forces a full RSC re-render when filters change (required for FEED-12).
 *
 * nuqs parseAsArrayOf / parseAsString coerce invalid input to [] / '' respectively,
 * satisfying T-04-04-03 (URL fuzzing mitigation).
 *
 * Hand-rolled popover (no @radix-ui/react-popover) per RESEARCH.md Pattern 5:
 * native details/summary or manual open/close state is sufficient for v1.
 * The popover is keyboard-accessible: 过滤 button with aria-expanded + aria-controls,
 * tag/source chips are <button> elements with aria-pressed.
 *
 * Copywriting per UI-SPEC:
 *   Button label:    过滤
 *   Popover heading: 筛选
 *   Sections:        标签 / 信源
 *   Clear link:      清除
 *
 * Consumed by:
 *   - src/components/feed/feed-top-bar.tsx (on view==='all')
 */

import { useState } from 'react';
import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs';
import { Tag } from '@/components/layout/tag';

interface FilterPopoverProps {
  availableTags: string[];
  availableSources: Array<{ id: number; name: string }>;
}

/**
 * Filter button + inline popover writing tag+source URL params via nuqs.
 * shallow:false forces RSC re-render on filter change (FEED-12).
 */
export function FilterPopover({ availableTags, availableSources }: FilterPopoverProps) {
  const [open, setOpen] = useState(false);

  // nuqs URL state — shallow:false triggers RSC re-render on change per D-22
  const [tags, setTags] = useQueryState(
    'tags',
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: false }),
  );
  const [source, setSource] = useQueryState(
    'source',
    parseAsString.withDefault('').withOptions({ shallow: false }),
  );

  const toggleTag = (t: string) =>
    setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);

  const clear = () => {
    void setTags([]);
    void setSource('');
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* 过滤 trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="filter-popover-panel"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 12px',
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--ink-700)',
          cursor: 'pointer',
          transition: 'background 120ms var(--ease)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        过滤
      </button>

      {/* Popover panel — shown when open */}
      {open && (
        <div
          id="filter-popover-panel"
          role="dialog"
          aria-label="筛选"
          style={{
            position: 'absolute',
            left: 0,
            marginTop: 8,
            zIndex: 20,
            width: 320,
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--surface-0)',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
            padding: 16,
          }}
        >
          {/* Header row: 筛选 + 清除 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
              筛选
            </h3>
            <button
              type="button"
              onClick={clear}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 4px',
                fontSize: 12,
                color: 'var(--fg-3)',
                cursor: 'pointer',
              }}
            >
              清除
            </button>
          </div>

          {/* 标签 section */}
          {availableTags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--fg-3)',
                  marginBottom: 8,
                }}
              >
                标签
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {availableTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tags.includes(t)}
                    onClick={() => toggleTag(t)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <Tag label={t} active={tags.includes(t)} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 信源 section */}
          {availableSources.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--fg-3)',
                  marginBottom: 8,
                }}
              >
                信源
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {/* "全部信源" resets source filter */}
                <button
                  type="button"
                  aria-pressed={source === ''}
                  onClick={() => void setSource('')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <Tag label="全部信源" active={source === ''} />
                </button>
                {availableSources.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={source === String(s.id)}
                    onClick={() => void setSource(String(s.id))}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <Tag label={s.name} active={source === String(s.id)} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
