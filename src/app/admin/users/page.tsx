/**
 * /admin/users — Phase 6 Plan 06-03 (ADMIN-07, ADMIN-08).
 *
 * RSC list page rendering every user for admin moderation. The parent
 * `src/app/admin/layout.tsx` already gated access via `requireAdmin()`;
 * this page re-reads the session ONLY to get the current admin's id so
 * the ban button can self-ban-guard at the UI layer.
 *
 * `force-dynamic` because:
 *   - The row list mutates on every ban/unban (revalidatePath fires it
 *     from the Server Action, but force-dynamic makes that explicit).
 *   - Caching this at any tier would risk leaking one admin's view to
 *     another request.
 *
 * Chinese-only copy per CLAUDE.md §UI language.
 */
import { auth } from '@/lib/auth';
import { listUsersForAdmin } from '@/lib/admin/users-repo';
import { UsersTable } from '@/components/admin/users-table';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const [rows, session] = await Promise.all([listUsersForAdmin(), auth()]);
  const currentAdminId = session?.user?.id ?? '';

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          用户管理
        </h1>
        <p style={{ marginTop: 6, fontSize: 12.5, color: 'var(--fg-3)' }}>
          共 {rows.length} 个用户。封禁会立即清除其登录状态。
        </p>
      </header>

      <UsersTable rows={rows} currentAdminId={currentAdminId} />
    </div>
  );
}
