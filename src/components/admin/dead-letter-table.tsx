'use client';

/**
 * DeadLetterTable — Phase 6 Plan 06-05 (OPS-03).
 *
 * Client Component (needed only for the bulk-retry button and confirm
 * dialog). The rows themselves are static; per-row retry interactivity
 * lives in <RetryButton>, which we render as a child island.
 *
 * Columns (all Chinese):
 *   - 标题    — with hyperlink to items.url
 *   - 信源    — sources.name (may be null)
 *   - 失败原因 — truncated to 80 chars; full value in `title` attr for hover
 *   - 重试次数
 *   - 处理时间 — relative via date-fns (formatDistanceToNow)
 *   - 操作    — <RetryButton/>
 *
 * Bulk retry: "批量重试 (最多 20)" above the table. Double-confirm via
 * window.confirm (no modal is worth the complexity for an admin-only page);
 * single rate-limit credit for the whole bulk call.
 *
 * Consumed by: src/app/admin/dead-letter/page.tsx
 */
import { useState, useTransition } from 'react';
import type { DeadLetterRow } from '@/lib/admin/dead-letter-repo';
import { retryAllAction } from '@/server/actions/admin-dead-letter';
import { RetryButton } from './retry-button';

interface DeadLetterTableProps {
  rows: DeadLetterRow[];
}

const BULK_LIMIT = 20;
const FAILURE_REASON_MAX = 80;

function truncate(s: string | null, max: number): string {
  if (!s) return '—';
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function relativeTime(d: Date | null): string {
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const absSec = Math.round(Math.abs(diffMs) / 1000);
  if (absSec < 60) return diffMs >= 0 ? `${absSec} 秒前` : `${absSec} 秒后`;
  const min = Math.round(absSec / 60);
  if (min < 60) return diffMs >= 0 ? `${min} 分钟前` : `${min} 分钟后`;
  const hr = Math.round(min / 60);
  if (hr < 24) return diffMs >= 0 ? `${hr} 小时前` : `${hr} 小时后`;
  const day = Math.round(hr / 24);
  return diffMs >= 0 ? `${day} 天前` : `${day} 天后`;
}

const BULK_CONFIRM_MSG = `将重新入队最近 ${BULK_LIMIT} 条死信,确认继续吗?`;
const BULK_RATE_LIMITED_MSG = '触发速率限制,请稍后再试 (60 秒内最多 20 次)';
const BULK_AUTH_ERROR_MSG = '权限不足,请重新登录';
const BULK_GENERIC_ERROR_MSG = '批量重试失败,请稍后重试';

export function DeadLetterTable({ rows }: DeadLetterTableProps) {
  const [isPending, startTransition] = useTransition();
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const handleBulk = () => {
    if (!window.confirm(BULK_CONFIRM_MSG)) return;
    setBulkMessage(null);
    startTransition(async () => {
      const res = await retryAllAction();
      if (res.ok) {
        setBulkMessage(`已重新入队 ${res.count} 条`);
        return;
      }
      switch (res.error) {
        case 'RATE_LIMITED':
          setBulkMessage(BULK_RATE_LIMITED_MSG);
          break;
        case 'UNAUTHENTICATED':
        case 'FORBIDDEN':
          setBulkMessage(BULK_AUTH_ERROR_MSG);
          break;
        default:
          setBulkMessage(BULK_GENERIC_ERROR_MSG);
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--fg-3)',
          fontSize: 13,
          border: '1px solid var(--line-weak)',
          borderRadius: 10,
          background: 'var(--paper)',
        }}
      >
        当前没有死信队列项。
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button
          type="button"
          onClick={handleBulk}
          disabled={isPending}
          aria-busy={isPending}
          style={{
            fontSize: 12.5,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--line-weak)',
            background: 'var(--surface-1)',
            color: 'var(--ink-900)',
            cursor: isPending ? 'progress' : 'pointer',
          }}
        >
          {isPending ? '批量重试中…' : `批量重试 (最多 ${BULK_LIMIT})`}
        </button>
        {bulkMessage && (
          <span
            role="status"
            aria-live="polite"
            style={{ fontSize: 12, color: 'var(--fg-3)' }}
          >
            {bulkMessage}
          </span>
        )}
      </div>

      <div
        style={{
          overflowX: 'auto',
          border: '1px solid var(--line-weak)',
          borderRadius: 10,
          background: 'var(--paper)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            color: 'var(--ink-900)',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', background: 'var(--surface-1)' }}>
              <th style={thStyle}>标题</th>
              <th style={thStyle}>信源</th>
              <th style={thStyle}>失败原因</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>重试次数</th>
              <th style={thStyle}>处理时间</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid var(--line-weak)' }}>
                <td style={tdStyle}>
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--ink-900)', textDecoration: 'underline' }}
                  >
                    {row.title}
                  </a>
                </td>
                <td style={tdStyle}>{row.sourceName ?? '—'}</td>
                <td style={tdStyle}>
                  <span title={row.failureReason ?? undefined}>
                    {truncate(row.failureReason, FAILURE_REASON_MAX)}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {row.retryCount}
                </td>
                <td style={tdStyle}>{relativeTime(row.processedAt ?? row.ingestedAt)}</td>
                <td style={tdStyle}>
                  <RetryButton itemId={row.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--fg-3)',
  letterSpacing: '0.02em',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
  lineHeight: 1.5,
};
