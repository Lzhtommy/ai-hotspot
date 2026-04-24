/**
 * SourcesTable — Phase 6 Plan 06-02 (ADMIN-02, ADMIN-06).
 *
 * Admin-sources list view. Desktop: classic table. Mobile (≤768px): each
 * row collapses into a card so the full row fits in a narrow viewport
 * without horizontal scroll.
 *
 * Server Component — the table itself is static HTML; the only
 * interactive bits are the per-row action buttons, which are encapsulated
 * inside `<SourceRowActions>` (Client Component).
 *
 * Columns (desktop):
 *   状态 | 名称 | URL | 语言 | 权重 | 分类 | 启用 | 上次抓取 | 连续空/错 | 操作
 *
 * Empty state: "暂无信源" with a link to /admin/sources/new — an admin
 * opening the page for the first time should not stare at a blank grid.
 *
 * Consumed by:
 *   - src/app/admin/sources/page.tsx
 */
import Link from 'next/link';
import type { SourceAdminRow } from '@/lib/admin/sources-repo';
import { SourceHealthBadge } from './source-health-badge';
import { SourceRowActions } from './source-row-actions';

interface SourcesTableProps {
  rows: readonly SourceAdminRow[];
}

/**
 * Format a Date or null as a compact relative-ish label in Chinese.
 * Examples: "2 分钟前", "3 小时前", "2026-04-20 14:00".
 * Falls back to "从未" for null.
 */
function formatLastFetched(date: Date | null): string {
  if (!date) return '从未';
  const now = Date.now();
  const ms = now - date.getTime();
  if (ms < 0) return date.toISOString().slice(0, 16).replace('T', ' ');
  const min = Math.floor(ms / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

export function SourcesTable({ rows }: SourcesTableProps) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: '48px 20px',
          textAlign: 'center',
          color: 'var(--fg-3)',
          fontSize: 13,
          border: '1px dashed var(--line-weak)',
          borderRadius: 10,
          background: 'var(--paper)',
        }}
      >
        <p style={{ margin: 0, marginBottom: 10 }}>暂无信源</p>
        <Link
          href="/admin/sources/new"
          style={{
            color: 'var(--accent, #10b981)',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          + 新建第一个信源
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="sources-table-desktop">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12.5,
            background: 'var(--paper)',
            border: '1px solid var(--line-weak)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'var(--surface-1)',
                color: 'var(--ink-700)',
                fontWeight: 500,
                textAlign: 'left',
              }}
            >
              <Th>状态</Th>
              <Th>名称</Th>
              <Th>URL</Th>
              <Th>语言</Th>
              <Th>权重</Th>
              <Th>分类</Th>
              <Th>启用</Th>
              <Th>上次抓取</Th>
              <Th>连续空 / 错</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  borderTop: '1px solid var(--line-weak)',
                  color: 'var(--ink-900)',
                }}
              >
                <Td>
                  <SourceHealthBadge
                    consecutiveEmptyCount={row.consecutiveEmptyCount}
                    consecutiveErrorCount={row.consecutiveErrorCount}
                  />
                </Td>
                <Td>
                  <span style={{ fontWeight: 500 }}>{row.name}</span>
                </Td>
                <Td>
                  <code
                    title={row.rssUrl}
                    style={{
                      fontSize: 11.5,
                      fontFamily: 'var(--font-mono, ui-monospace)',
                      color: 'var(--fg-3)',
                    }}
                  >
                    {truncateUrl(row.rssUrl)}
                  </code>
                </Td>
                <Td>{row.language === 'zh' ? '中' : '英'}</Td>
                <Td>{row.weight}</Td>
                <Td>
                  <span style={{ color: 'var(--fg-3)' }}>
                    {row.category ?? '—'}
                  </span>
                </Td>
                <Td>
                  <span
                    style={{
                      color: row.isActive ? 'var(--accent, #10b981)' : 'var(--fg-3)',
                    }}
                  >
                    {row.isActive ? '是' : '否'}
                  </span>
                </Td>
                <Td>
                  <span style={{ color: 'var(--fg-3)' }}>
                    {formatLastFetched(row.lastFetchedAt)}
                  </span>
                </Td>
                <Td>
                  <span style={{ color: 'var(--fg-3)' }}>
                    {row.consecutiveEmptyCount} / {row.consecutiveErrorCount}
                  </span>
                </Td>
                <Td>
                  <SourceRowActions
                    sourceId={row.id}
                    isActive={row.isActive}
                    name={row.name}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sources-table-mobile" style={{ display: 'none', gap: 12 }}>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              padding: 14,
              background: 'var(--paper)',
              border: '1px solid var(--line-weak)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{row.name}</div>
              <SourceHealthBadge
                consecutiveEmptyCount={row.consecutiveEmptyCount}
                consecutiveErrorCount={row.consecutiveErrorCount}
              />
            </div>
            <code
              style={{
                fontSize: 11.5,
                color: 'var(--fg-3)',
                wordBreak: 'break-all',
              }}
            >
              {row.rssUrl}
            </code>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                fontSize: 12,
                color: 'var(--ink-700)',
              }}
            >
              <div>
                <span style={{ color: 'var(--fg-3)' }}>权重</span> {row.weight}
              </div>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>语言</span>{' '}
                {row.language === 'zh' ? '中' : '英'}
              </div>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>分类</span>{' '}
                {row.category ?? '—'}
              </div>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>启用</span>{' '}
                {row.isActive ? '是' : '否'}
              </div>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>上次抓取</span>{' '}
                {formatLastFetched(row.lastFetchedAt)}
              </div>
              <div>
                <span style={{ color: 'var(--fg-3)' }}>连续空/错</span>{' '}
                {row.consecutiveEmptyCount} / {row.consecutiveErrorCount}
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              <SourceRowActions
                sourceId={row.id}
                isActive={row.isActive}
                name={row.name}
              />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sources-table-desktop { display: none !important; }
          .sources-table-mobile { display: flex !important; flex-direction: column; }
        }
      `}</style>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Table cell primitives — minor padding/alignment helpers.
// ──────────────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: '10px 12px', fontWeight: 500, borderBottom: 0 }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>{children}</td>;
}
