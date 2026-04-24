'use client';

/**
 * UserBanButton — Phase 6 Plan 06-03 (ADMIN-08).
 *
 * Client Component: renders 封禁 when the user is active, 解封 when banned.
 * Clicking opens a native confirm() with Chinese copy, then dispatches the
 * server action inside useTransition so the row's "loading" state shows
 * the disabled button until revalidatePath re-renders the parent RSC.
 *
 * Error handling:
 *   - { ok: false, error: 'SELF_BAN' }             → alert("不能封禁自己")
 *   - { ok: false, error: 'UNAUTHENTICATED' }      → alert("请重新登录")
 *   - { ok: false, error: 'FORBIDDEN' | 'VALIDATION' | 'NOT_FOUND' | 'INTERNAL' }
 *                                                  → alert("操作失败,请重试")
 *
 * The parent UsersTable hides this button for admin-on-admin rows, so the
 * SELF_BAN case is the only UI path where a self-targeted click could reach
 * the server; the core still guards it server-side.
 */
import { useTransition } from 'react';
import { banUserAction, unbanUserAction } from '@/server/actions/admin-users';

interface UserBanButtonProps {
  userId: string;
  isBanned: boolean;
}

export function UserBanButton({ userId, isBanned }: UserBanButtonProps) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    const confirmCopy = isBanned
      ? '确认解封此用户?解封后该用户需重新登录。'
      : '确认封禁此用户?会立即清除其登录状态。';
    if (!window.confirm(confirmCopy)) return;

    startTransition(async () => {
      const action = isBanned ? unbanUserAction : banUserAction;
      const result = await action({ targetUserId: userId });
      if (!result.ok) {
        if (result.error === 'SELF_BAN') {
          window.alert('不能封禁自己');
        } else if (result.error === 'UNAUTHENTICATED') {
          window.alert('请重新登录');
        } else {
          window.alert('操作失败,请重试');
        }
      }
    });
  };

  const label = isBanned ? '解封' : '封禁';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      style={{
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 5,
        border: isBanned ? '1px solid var(--line-weak)' : '1px solid rgba(220, 38, 38, 0.3)',
        background: isBanned ? 'var(--surface-1)' : 'rgba(220, 38, 38, 0.08)',
        color: isBanned ? 'var(--ink-700)' : '#dc2626',
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
        transition: 'background 120ms var(--ease), opacity 120ms var(--ease)',
      }}
    >
      {pending ? '…' : label}
    </button>
  );
}
