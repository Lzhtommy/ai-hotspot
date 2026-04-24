'use client';

/**
 * SourceRowActions — Phase 6 Plan 06-02 (ADMIN-04, ADMIN-05).
 *
 * Per-row inline buttons for the /admin/sources table:
 *   - 编辑   navigates to /admin/sources/[id]/edit
 *   - 停用 / 启用   flips is_active via toggleActiveAction
 *   - 删除   calls softDeleteSourceAction behind a window.confirm guard
 *
 * Destructive-action guard: `window.confirm('确认删除该信源?这会将其从轮询
 * 中移除,已入库的文章保留。')` — keeps destructive operations two clicks
 * away per the ADMIN-05 data-loss mitigation (T-6-25). No hard delete; the
 * confirm copy explicitly tells the admin historical items remain.
 *
 * Client Component because:
 *   - onClick handlers drive mutations
 *   - useTransition gives a non-blocking "saving…" affordance without
 *     freezing the parent table.
 *
 * Consumed by:
 *   - src/components/admin/sources-table.tsx
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  softDeleteSourceAction,
  toggleActiveAction,
} from '@/server/actions/admin-sources';

interface SourceRowActionsProps {
  sourceId: number;
  isActive: boolean;
  name: string;
}

export function SourceRowActions({ sourceId, isActive, name }: SourceRowActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle() {
    const nextActive = !isActive;
    startTransition(async () => {
      const result = await toggleActiveAction(sourceId, nextActive);
      if (!result.ok) {
        // Minimal error surface — a row-level toast system is out of scope
        // for Plan 06-02; fall back to alert() so the admin is not silently
        // left with a stale UI.
        window.alert('操作失败,请刷新后重试。');
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    const confirmed = window.confirm(
      `确认删除信源「${name}」?这会将其从轮询中移除,已入库的文章保留。`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await softDeleteSourceAction(sourceId);
      if (!result.ok) {
        window.alert('删除失败,请刷新后重试。');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      <Link
        href={`/admin/sources/${sourceId}/edit`}
        style={{ ...linkButtonStyle, color: 'var(--ink-700)' }}
        aria-label={`编辑信源 ${name}`}
      >
        编辑
      </Link>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        style={{ ...secondaryButtonStyle, opacity: pending ? 0.6 : 1 }}
        aria-label={`${isActive ? '停用' : '启用'}信源 ${name}`}
      >
        {isActive ? '停用' : '启用'}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        style={{ ...dangerButtonStyle, opacity: pending ? 0.6 : 1 }}
        aria-label={`删除信源 ${name}`}
      >
        删除
      </button>
    </div>
  );
}

const linkButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid var(--line-weak)',
  borderRadius: 5,
  background: 'transparent',
  textDecoration: 'none',
  cursor: 'pointer',
  lineHeight: '20px',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid var(--line-weak)',
  borderRadius: 5,
  background: 'transparent',
  color: 'var(--ink-700)',
  cursor: 'pointer',
  lineHeight: '20px',
};

const dangerButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid rgba(239, 68, 68, 0.4)',
  borderRadius: 5,
  background: 'transparent',
  color: 'var(--danger, #ef4444)',
  cursor: 'pointer',
  lineHeight: '20px',
};
