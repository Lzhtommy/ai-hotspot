/**
 * UsersTable — Phase 6 Plan 06-03 (ADMIN-07).
 *
 * Server Component. Renders the seven-column admin user list:
 *   邮箱 / 姓名 / 角色 / 提供商 / 注册时间 / 状态 / 操作
 *
 * Operations cell is delegated to UserBanButton (Client Component) for the
 * useTransition + confirm() interaction. When the row represents the current
 * admin (id === currentAdminId) OR another admin (role === 'admin'), the
 * ban button is hidden — admins can only ban regular users from this UI. An
 * SQL escape hatch exists for admin-on-admin moderation if it's ever needed
 * (threat T-6-34).
 *
 * Visual language matches admin-shell / feed sidebar (inline-style, CSS
 * variables only — no Tailwind, no shadcn wrapper).
 */
import type { UserAdminRow } from '@/lib/admin/users-repo';
import { UserBanButton } from './user-ban-button';
import { UserRoleSelect } from './user-role-select';

interface UsersTableProps {
  rows: UserAdminRow[];
  /** Current signed-in admin's id — used to hide the ban button on their own row. */
  currentAdminId: string;
}

function formatDate(d: Date): string {
  // Chinese-locale short date: 2026-04-23 09:55
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da} ${h}:${mi}`;
}

function ProvidersCell({ providers }: { providers: string[] }) {
  if (providers.length === 0) {
    return (
      <span style={{ fontSize: 12, color: 'var(--fg-3)' }} title="仅通过邮箱链接登录">
        邮箱
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {providers.map((p) => (
        <span
          key={p}
          style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--surface-1)',
            color: 'var(--ink-700)',
            border: '1px solid var(--line-weak)',
          }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function StatusCell({ row }: { row: UserAdminRow }) {
  if (row.isBanned) {
    return (
      <span
        style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 4,
          background: 'rgba(220, 38, 38, 0.12)',
          color: '#dc2626',
          border: '1px solid rgba(220, 38, 38, 0.3)',
        }}
      >
        封禁
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 4,
        background: 'var(--surface-1)',
        color: 'var(--ink-700)',
        border: '1px solid var(--line-weak)',
      }}
    >
      正常
    </span>
  );
}

export function UsersTable({ rows, currentAdminId }: UsersTableProps) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--fg-3)',
          fontSize: 13,
          border: '1px dashed var(--line-weak)',
          borderRadius: 8,
        }}
      >
        暂无用户。
      </div>
    );
  }

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--fg-3)',
    textTransform: 'none',
    letterSpacing: '0.02em',
    borderBottom: '1px solid var(--line-weak)',
    background: 'var(--paper)',
  };
  const td: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 12.5,
    color: 'var(--ink-900)',
    borderBottom: '1px solid var(--line-weak)',
    verticalAlign: 'middle',
  };

  return (
    <div
      style={{
        border: '1px solid var(--line-weak)',
        borderRadius: 8,
        overflow: 'auto',
        background: 'var(--paper)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr>
            <th style={th}>邮箱</th>
            <th style={th}>姓名</th>
            <th style={th}>角色</th>
            <th style={th}>提供商</th>
            <th style={th}>注册时间</th>
            <th style={th}>状态</th>
            <th style={{ ...th, textAlign: 'right' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelf = row.id === currentAdminId;
            const isOtherAdmin = !isSelf && row.role === 'admin';
            return (
              <tr key={row.id}>
                <td style={{ ...td, fontFamily: 'var(--font-mono, monospace)' }}>{row.email}</td>
                <td style={td}>{row.name ?? '—'}</td>
                <td style={td}>
                  <UserRoleSelect userId={row.id} currentRole={row.role} disabled={isSelf} />
                </td>
                <td style={td}>
                  <ProvidersCell providers={row.providers} />
                </td>
                <td style={{ ...td, color: 'var(--fg-3)', fontSize: 12 }}>
                  {formatDate(row.createdAt)}
                </td>
                <td style={td}>
                  <StatusCell row={row} />
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {isSelf ? (
                    <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>当前管理员</span>
                  ) : isOtherAdmin ? (
                    <span
                      style={{ fontSize: 11, color: 'var(--fg-3)' }}
                      title="无法通过 UI 操作其他管理员"
                    >
                      —
                    </span>
                  ) : (
                    <UserBanButton userId={row.id} isBanned={row.isBanned} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
