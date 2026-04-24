'use client';

/**
 * RetryButton — Phase 6 Plan 06-05 (OPS-03).
 *
 * Single-item retry button for a dead-letter row. Calls the
 * `retryItemAction` server action inside a `useTransition` so the rest of
 * the table stays interactive while the action is in flight; surfaces
 * Chinese copy for every server-side error code.
 *
 * Consumed by: src/components/admin/dead-letter-table.tsx
 */
import { useState, useTransition } from 'react';
import { retryItemAction } from '@/server/actions/admin-dead-letter';

interface RetryButtonProps {
  itemId: string;
}

const RATE_LIMITED_MSG = '触发速率限制,请稍后再试 (60 秒内最多 20 次)';
const GENERIC_ERROR_MSG = '重试失败,请稍后重试';
const AUTH_ERROR_MSG = '权限不足,请重新登录';

export function RetryButton({ itemId }: RetryButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await retryItemAction({ itemId });
      if (res.ok) {
        // Either we transitioned a row to pending or another admin already
        // did — either way the row should disappear after revalidatePath.
        setDone(true);
        return;
      }
      switch (res.error) {
        case 'RATE_LIMITED':
          setError(RATE_LIMITED_MSG);
          break;
        case 'UNAUTHENTICATED':
        case 'FORBIDDEN':
          setError(AUTH_ERROR_MSG);
          break;
        case 'VALIDATION':
        case 'INTERNAL':
        default:
          setError(GENERIC_ERROR_MSG);
      }
    });
  };

  if (done) {
    return (
      <span style={{ fontSize: 12, color: 'var(--fg-3)' }} aria-live="polite">
        已重新入队
      </span>
    );
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
        style={{
          fontSize: 12.5,
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid var(--line-weak)',
          background: 'var(--surface-1)',
          color: 'var(--ink-900)',
          cursor: isPending ? 'progress' : 'pointer',
          transition: 'background 120ms var(--ease)',
        }}
      >
        {isPending ? '重试中…' : '重试'}
      </button>
      {error && (
        <span
          role="alert"
          style={{ fontSize: 11, color: 'var(--danger)', maxWidth: 180 }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
