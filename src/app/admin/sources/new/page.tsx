/**
 * /admin/sources/new — Phase 6 Plan 06-02 (ADMIN-03).
 *
 * Admin create-source page. Pure render wrapper around SourceForm in
 * create mode — the form submits via createSourceAction (Server Action),
 * which gates on assertAdmin() and redirects to /admin/sources on success.
 */
import Link from 'next/link';
import { SourceForm } from '@/components/admin/source-form';

export const dynamic = 'force-dynamic';

export default function AdminSourceNewPage() {
  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <Link
          href="/admin/sources"
          style={{
            fontSize: 12.5,
            color: 'var(--fg-3)',
            textDecoration: 'none',
          }}
        >
          ← 返回信源列表
        </Link>
        <h1
          style={{
            margin: 0,
            marginTop: 8,
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
          }}
        >
          新建信源
        </h1>
      </header>

      <SourceForm mode="create" />
    </div>
  );
}
