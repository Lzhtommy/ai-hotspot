/**
 * /admin/dead-letter — Phase 6 Plan 06-05 (OPS-03).
 *
 * RSC list of items currently in `status='dead_letter'`. The page is a thin
 * fetch-and-render; the interactive elements (retry button, bulk retry) are
 * Client-Component islands in `dead-letter-table.tsx` / `retry-button.tsx`.
 *
 * Gate: inherited from src/app/admin/layout.tsx — requireAdmin() runs there,
 * so any code that executes in this module has already passed the admin
 * check. The Server Actions re-verify via assertAdmin() (Layer 3).
 *
 * `dynamic = 'force-dynamic'` is inherited from the admin layout but we
 * re-state it here so that future refactors that hoist the page outside the
 * admin group cannot accidentally serve stale (cached) dead-letter rows.
 */
import { listDeadLetterItems } from '@/lib/admin/dead-letter-repo';
import { DeadLetterTable } from '@/components/admin/dead-letter-table';

export const dynamic = 'force-dynamic';

const DEAD_LETTER_LIMIT = 100;

export default async function AdminDeadLetterPage() {
  const rows = await listDeadLetterItems({ limit: DEAD_LETTER_LIMIT });
  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          死信队列
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--fg-3)',
          }}
        >
          LLM 处理失败项 · 最多显示 {DEAD_LETTER_LIMIT} 条 · 共 {rows.length} 条
        </p>
      </header>
      <DeadLetterTable rows={rows} />
    </div>
  );
}
