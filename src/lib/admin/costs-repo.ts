/**
 * Admin costs repo — Phase 6 Plan 06-04 (ADMIN-09).
 *
 * Pure read-side aggregation over `pipeline_runs`. Two functions:
 *
 *   - getDailyCosts({ days })  — one row per (day × model) for the last N days
 *   - getCostsSummary({ days }) — top-line totals + per-model breakdown
 *
 * Both are filtered to `status = 'ok'` so failed runs never inflate the
 * reported cost. Ordering is `date DESC, model ASC` for stable admin-UI
 * rendering. Dates are UTC; if a future requirement asks for CJT display
 * we'll add a timezone parameter rather than baking Asia/Shanghai into
 * the data layer.
 *
 * Hot-path note: the pipeline_runs table carries a DESC index on
 * created_at (`pipeline_runs_created_at_idx`, Phase 3), so the 30-day
 * range filter is index-backed. GROUP BY (day, model) aggregates in a
 * single pass — no N+1.
 *
 * SQL injection: `opts.days` is typed as `number` and cast `::int` in
 * the template. The rest of the query is a static drizzle `sql` literal.
 *
 * Consumed by:
 *   - src/app/admin/costs/page.tsx
 *   - tests/unit/admin-costs.test.ts
 */
import { sql } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';

export interface DailyCostRow {
  /** UTC day key, 'YYYY-MM-DD'. */
  date: string;
  model: string;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  runs: number;
  /** cache_read / (cache_read + input); 0 when denominator is 0. Range [0,1]. */
  cacheHitRatio: number;
}

export interface CostsSummary {
  totalUsd: number;
  totalRuns: number;
  totalTokens: number;
  cacheHitRatio: number;
  modelBreakdown: Array<{ model: string; usd: number; runs: number }>;
}

/** Narrow shape of `db.execute` we rely on — lets tests inject a plain mock. */
type ExecDb = {
  execute: (query: unknown) => Promise<unknown>;
};

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function getDailyCosts(
  opts: { days: number },
  deps: { db?: ExecDb } = {},
): Promise<DailyCostRow[]> {
  const d: ExecDb = (deps.db ?? (realDb as unknown as ExecDb));
  const result = (await d.execute(sql`
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
      model,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(cache_read_tokens), 0)::bigint AS cache_read_tokens,
      COALESCE(SUM(cache_write_tokens), 0)::bigint AS cache_write_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::numeric(14, 6) AS estimated_cost_usd,
      COUNT(*)::bigint AS runs
    FROM pipeline_runs
    WHERE status = 'ok'
      AND created_at >= NOW() - (${opts.days}::int * INTERVAL '1 day')
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2 ASC
  `)) as { rows: Array<Record<string, unknown>> };

  const rows = result?.rows ?? [];
  return rows.map((r) => {
    const input = toNumber(r.input_tokens);
    const cacheRead = toNumber(r.cache_read_tokens);
    const denom = input + cacheRead;
    return {
      date: String(r.date),
      model: String(r.model),
      inputTokens: input,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: toNumber(r.cache_write_tokens),
      outputTokens: toNumber(r.output_tokens),
      estimatedCostUsd: toNumber(r.estimated_cost_usd),
      runs: toNumber(r.runs),
      cacheHitRatio: denom > 0 ? cacheRead / denom : 0,
    };
  });
}

export async function getCostsSummary(
  opts: { days: number },
  deps: { db?: ExecDb } = {},
): Promise<CostsSummary> {
  const daily = await getDailyCosts(opts, deps);
  let totalUsd = 0;
  let totalRuns = 0;
  let totalTokens = 0;
  let totalCacheRead = 0;
  let totalInput = 0;
  const byModel = new Map<string, { usd: number; runs: number }>();

  for (const r of daily) {
    totalUsd += r.estimatedCostUsd;
    totalRuns += r.runs;
    totalTokens += r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens + r.outputTokens;
    totalCacheRead += r.cacheReadTokens;
    totalInput += r.inputTokens;

    const cur = byModel.get(r.model) ?? { usd: 0, runs: 0 };
    cur.usd += r.estimatedCostUsd;
    cur.runs += r.runs;
    byModel.set(r.model, cur);
  }

  const cacheDenom = totalInput + totalCacheRead;
  const cacheHitRatio = cacheDenom > 0 ? totalCacheRead / cacheDenom : 0;
  const modelBreakdown = Array.from(byModel.entries()).map(([model, v]) => ({
    model,
    ...v,
  }));

  return { totalUsd, totalRuns, totalTokens, cacheHitRatio, modelBreakdown };
}
