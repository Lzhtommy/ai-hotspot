/**
 * /admin/sources/[id]/edit — Phase 6 Plan 06-02 (ADMIN-04).
 *
 * Loads a single source by id and renders SourceForm in edit mode. If the
 * id is malformed or the source does not exist (or has been soft-deleted),
 * we 404 — admins should never be editing a row that is not in the list.
 *
 * The gate is inherited from src/app/admin/layout.tsx; this page does not
 * re-call requireAdmin(). Per-action guards live in the Server Actions
 * behind the form (Layer 3 of the defense-in-depth model).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSourceByIdForAdmin } from '@/lib/admin/sources-repo';
import { SourceForm } from '@/components/admin/source-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminSourceEditPage({ params }: PageProps) {
  const { id: idRaw } = await params;
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const source = await getSourceByIdForAdmin(id);
  if (!source) notFound();

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
          编辑信源:{source.name}
        </h1>
      </header>

      <SourceForm mode="edit" source={source} />
    </div>
  );
}
