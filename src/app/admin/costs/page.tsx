/**
 * /admin/costs — Phase 6 Plan 06-04 (ADMIN-09).
 *
 * Admin-only LLM cost dashboard. Renders a 30-day rollup of pipeline_runs
 * token usage + estimated USD cost, grouped by (day × model). Complements
 * the Langfuse cost trace view (OPS-02) by surfacing the numbers Claude
 * already persisted in the DB — a single admin page is enough for daily
 * budget review.
 *
 * Gate: inherited from src/app/admin/layout.tsx (requireAdmin) and
 * src/middleware.ts (edge cookie filter). This page does not repeat the
 * check — Phase 6 Plan 06-00 established the three-layer model. The
 * layout redirects non-admins to /admin/access-denied BEFORE this RSC
 * is reached, so no cost data ever hits a non-admin response body
 * (T-6-40).
 *
 * Cache: force-dynamic + revalidate=0 because cost data is admin-specific
 * and mutation-heavy (one new row per LLM call). Stale caching would hide
 * budget overruns.
 *
 * The two reads (getDailyCosts, getCostsSummary) fan out in parallel via
 * Promise.all. Each issues a single indexed GROUP BY against pipeline_runs
 * — no N+1 (T-6-41).
 */
import { getDailyCosts, getCostsSummary } from '@/lib/admin/costs-repo';
import { CostTable } from '@/components/admin/cost-table';
import { CostSummary } from '@/components/admin/cost-summary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WINDOW_DAYS = 30;

export default async function AdminCostsPage() {
  const [daily, summary] = await Promise.all([
    getDailyCosts({ days: WINDOW_DAYS }),
    getCostsSummary({ days: WINDOW_DAYS }),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--ink-900)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          LLM 成本
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--fg-3)',
          }}
        >
          最近 {WINDOW_DAYS} 天 · Claude 令牌用量与估算花费(来源:pipeline_runs)
        </p>
      </header>

      <CostSummary summary={summary} />
      <CostTable rows={daily} />
    </div>
  );
}
