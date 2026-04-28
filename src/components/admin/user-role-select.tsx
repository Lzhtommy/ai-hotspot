'use client';

import { useTransition, useState } from 'react';
import { changeUserRoleAction } from '@/server/actions/admin-users';

interface UserRoleSelectProps {
  userId: string;
  currentRole: 'user' | 'admin';
  disabled?: boolean;
}

export function UserRoleSelect({ userId, currentRole, disabled }: UserRoleSelectProps) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentRole);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as 'user' | 'admin';
    if (newRole === value) return;

    const prev = value;
    setValue(newRole);

    startTransition(async () => {
      const result = await changeUserRoleAction({ targetUserId: userId, newRole });
      if (!result.ok) {
        setValue(prev);
        if (result.error === 'SELF_ROLE_CHANGE') {
          window.alert('不能修改自己的角色');
        } else if (result.error === 'UNAUTHENTICATED') {
          window.alert('请重新登录');
        } else {
          window.alert('操作失败,请重试');
        }
      }
    });
  };

  const isAdmin = value === 'admin';

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled || pending}
      style={{
        fontSize: 11,
        padding: '2px 6px',
        borderRadius: 4,
        background: isAdmin ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-1)',
        color: isAdmin ? '#10b981' : 'var(--ink-700)',
        border: isAdmin ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--line-weak)',
        cursor: disabled || pending ? 'not-allowed' : 'pointer',
        opacity: disabled || pending ? 0.6 : 1,
        transition: 'background 120ms var(--ease), opacity 120ms var(--ease)',
        appearance: 'auto',
        outline: 'none',
      }}
    >
      <option value="user">用户</option>
      <option value="admin">管理员</option>
    </select>
  );
}
