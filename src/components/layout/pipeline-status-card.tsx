/**
 * PipelineStatusCard — Phase 4 FEED-06, sidebar.jsx lines 229–264.
 *
 * RSC component that queries the sources table live (per-request, no cache).
 * Shows active source count + last-sync elapsed time in a compact card with
 * a 3px progress bar at 68% fill.
 *
 * Security: try/catch logs only error.message (not the connection string).
 * No user input reaches SQL — the query is a COUNT + MAX with no parameters.
 *
 * Consumed by:
 *   - src/components/layout/sidebar.tsx
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export async function PipelineStatusCard() {
  let active_count = 0;
  let minutes: number | null = null;

  try {
    const result = (await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE is_active)::int AS active_count,
             MAX(last_fetched_at) AS last_fetched
      FROM sources
    `)) as unknown as { rows: { active_count: number; last_fetched: string | null }[] };
    const row = result.rows[0] ?? { active_count: 0, last_fetched: null };
    active_count = row.active_count;
    minutes =
      row.last_fetched
        ? Math.floor((Date.now() - new Date(row.last_fetched).getTime()) / 60000)
        : null;
  } catch (e) {
    // T-04-02-01: log only error.message to avoid leaking DB connection strings
    console.warn('[pipeline-status]', e instanceof Error ? e.message : 'unknown');
  }

  const label =
    minutes == null ? '—' : minutes < 1 ? '刚刚' : `${minutes} 分钟前`;

  return (
    <div
      style={{
        margin: '0 12px 10px',
        padding: 12,
        background: 'var(--surface-0)',
        border: '1px solid var(--line-weak)',
        borderRadius: 8,
        fontSize: 12,
      }}
    >
      {/* Header row — sidebar.jsx lines 239–249 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {/* 6px success-500 dot per UI-SPEC Color (success reserved only for this dot) */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--success-500)',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        <span style={{ fontWeight: 500, color: 'var(--ink-900)', fontSize: 13 }}>聚合进行中</span>
      </div>

      {/* Meta line — sidebar.jsx line 251; format per UI-SPEC Copywriting Contract */}
      <div style={{ color: 'var(--fg-3)', fontSize: 11, lineHeight: 1.5 }}>
        {active_count} 个信源 · 上次同步 {label}
      </div>

      {/* 3px progress bar at 68% fill — sidebar.jsx lines 253–263 */}
      <div
        style={{
          marginTop: 8,
          height: 3,
          background: 'var(--surface-2)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{ width: '68%', height: '100%', background: 'var(--accent-500)' }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
