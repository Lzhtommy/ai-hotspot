/**
 * /admin/sources — Phase 6 Plan 06-02 (ADMIN-02).
 *
 * Admin sources list page. Rendered as a dynamic RSC — the admin gate
 * upstream (src/app/admin/layout.tsx → requireAdmin()) is the
 * authoritative role check; this page only queries data.
 *
 * `force-dynamic` because:
 *   - The payload is admin-only; it must never be cached at any tier.
 *   - Mutations in adjacent pages (create/edit/delete) call
 *     `revalidatePath('/admin/sources')`, and `force-dynamic` guarantees
 *     the next navigation re-executes this RSC.
 */
import Link from 'next/link';
import { listSourcesForAdmin } from '@/lib/admin/sources-repo';
import { SourcesTable } from '@/components/admin/sources-table';

export const dynamic = 'force-dynamic';

export default async function AdminSourcesPage() {
  const rows = await listSourcesForAdmin();

  return (
    <div>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--ink-900)',
              letterSpacing: '-0.01em',
            }}
          >
            信源管理
          </h1>
          <p
            style={{
              margin: 0,
              marginTop: 4,
              fontSize: 13,
              color: 'var(--fg-3)',
            }}
          >
            共 {rows.length} 个在用信源。软删除的信源不会出现在此列表中。
          </p>
        </div>
        <Link
          href="/admin/sources/new"
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--surface-0)',
            background: 'var(--accent, #10b981)',
            border: 'none',
            borderRadius: 6,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          + 新建信源
        </Link>
      </header>

      <SourcesTable rows={rows} />
    </div>
  );
}
