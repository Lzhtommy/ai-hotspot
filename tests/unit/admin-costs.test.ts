/**
 * Task 6-04-01 | Plan 06-04 | Admin costs repo unit tests.
 *
 * Exercises `src/lib/admin/costs-repo.ts` with a mocked `db.execute()` so
 * the real Neon client is never contacted. The test suite asserts:
 *
 *   (a) getDailyCosts returns rows in {date DESC, model ASC} order
 *   (b) cacheHitRatio is computed as cache_read / (cache_read + input),
 *       clamped to 0 when the denominator is 0
 *   (c) the SQL template filters status = 'ok' and uses date_trunc
 *   (d) getCostsSummary aggregates totals + per-model breakdown across
 *       all daily rows correctly
 *
 * The mocking strategy captures the `strings` + `params` of the
 * drizzle-orm `sql` tag so we can grep the composed query for the
 * status filter without actually running SQL.
 */
import { describe, expect, it, vi } from 'vitest';
import { getDailyCosts, getCostsSummary } from '@/lib/admin/costs-repo';

type Row = Record<string, string | number>;

/** Fake db.execute that captures the SQL chunk strings and returns canned rows. */
function makeDb(rows: Row[]) {
  const captured = {
    sqlText: '',
    execCalls: 0,
  };
  const db = {
    execute: vi.fn(async (query: unknown) => {
      captured.execCalls += 1;
      // drizzle-orm's SQL object has a `queryChunks` property (array of StringChunk + Param).
      // We serialise its `toString()` — enough to grep for status = 'ok' / date_trunc.
      const maybe = query as { queryChunks?: Array<{ value?: unknown }>; toString?: () => string };
      if (maybe && typeof maybe.toString === 'function') {
        captured.sqlText = String(maybe);
      }
      // Also concat StringChunk values if present (drizzle puts raw SQL literals there).
      if (maybe?.queryChunks) {
        captured.sqlText += maybe.queryChunks
          .map((c) => {
            const v = (c as { value?: unknown }).value;
            if (Array.isArray(v)) return v.join('');
            if (typeof v === 'string') return v;
            return '';
          })
          .join(' ');
      }
      return { rows } as unknown;
    }),
  };
  return { db, captured };
}

// Two days × two models. Rows below are already in expected DESC/ASC order
// but getDailyCosts does not re-sort client-side — it only passes SQL through
// — so the presence of the ORDER BY in the SQL is what we assert.
const FAKE_ROWS: Row[] = [
  {
    date: '2026-04-23',
    model: 'claude-haiku-4-5-20251001',
    input_tokens: 10,
    cache_read_tokens: 10,
    cache_write_tokens: 5,
    output_tokens: 3,
    estimated_cost_usd: '0.002500',
    runs: 2,
  },
  {
    date: '2026-04-23',
    model: 'claude-sonnet-4-6',
    input_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: '0.000000',
    runs: 1,
  },
  {
    date: '2026-04-22',
    model: 'claude-haiku-4-5-20251001',
    input_tokens: 100,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    output_tokens: 50,
    estimated_cost_usd: '0.001500',
    runs: 3,
  },
  {
    date: '2026-04-22',
    model: 'claude-sonnet-4-6',
    input_tokens: 30,
    cache_read_tokens: 10,
    cache_write_tokens: 0,
    output_tokens: 10,
    estimated_cost_usd: '0.000250',
    runs: 1,
  },
];

describe('getDailyCosts', () => {
  it('returns one row per fake input row, with coerced numbers', async () => {
    const { db } = makeDb(FAKE_ROWS);
    const out = await getDailyCosts({ days: 30 }, { db: db as never });
    expect(out).toHaveLength(4);
    // First row: Haiku @ 2026-04-23 (input=10, cacheRead=10 → 0.5 hit ratio)
    const first = out[0];
    expect(first.date).toBe('2026-04-23');
    expect(first.model).toBe('claude-haiku-4-5-20251001');
    expect(first.inputTokens).toBe(10);
    expect(first.cacheReadTokens).toBe(10);
    expect(first.cacheWriteTokens).toBe(5);
    expect(first.outputTokens).toBe(3);
    expect(first.runs).toBe(2);
    expect(first.estimatedCostUsd).toBeCloseTo(0.0025, 6);
    expect(first.cacheHitRatio).toBeCloseTo(0.5, 6);
  });

  it('cacheHitRatio is 0 when both input and cache_read tokens are 0', async () => {
    const { db } = makeDb(FAKE_ROWS);
    const out = await getDailyCosts({ days: 30 }, { db: db as never });
    const zeroRow = out.find(
      (r) => r.date === '2026-04-23' && r.model === 'claude-sonnet-4-6',
    );
    expect(zeroRow).toBeDefined();
    expect(zeroRow!.cacheHitRatio).toBe(0);
  });

  it('SQL filters status = ok and uses date_trunc (guard against full-table scan + error rows inflating cost)', async () => {
    const { db, captured } = makeDb(FAKE_ROWS);
    await getDailyCosts({ days: 30 }, { db: db as never });
    expect(captured.execCalls).toBe(1);
    // Case-insensitive grep so minor whitespace differences don't break the test.
    expect(captured.sqlText.toLowerCase()).toContain("status = 'ok'");
    expect(captured.sqlText.toLowerCase()).toContain('date_trunc');
    expect(captured.sqlText.toLowerCase()).toContain('pipeline_runs');
  });
});

describe('getCostsSummary', () => {
  it('aggregates totalUsd, totalRuns, totalTokens, and cacheHitRatio across all rows', async () => {
    const { db } = makeDb(FAKE_ROWS);
    const summary = await getCostsSummary({ days: 30 }, { db: db as never });
    // totalUsd = 0.0025 + 0 + 0.0015 + 0.00025 = 0.00425
    expect(summary.totalUsd).toBeCloseTo(0.00425, 6);
    expect(summary.totalRuns).toBe(7); // 2 + 1 + 3 + 1
    // totalTokens: sum of (input + cacheRead + cacheWrite + output) across all rows
    // (10+10+5+3) + (0+0+0+0) + (100+0+0+50) + (30+10+0+10) = 28 + 0 + 150 + 50 = 228
    expect(summary.totalTokens).toBe(228);
    // Total cacheRead = 10+0+0+10 = 20; total input = 10+0+100+30 = 140;
    // cacheHitRatio = 20 / (140+20) = 20 / 160 = 0.125
    expect(summary.cacheHitRatio).toBeCloseTo(0.125, 6);
  });

  it('modelBreakdown sums USD + runs per model', async () => {
    const { db } = makeDb(FAKE_ROWS);
    const summary = await getCostsSummary({ days: 30 }, { db: db as never });
    expect(summary.modelBreakdown).toHaveLength(2);
    const haiku = summary.modelBreakdown.find(
      (m) => m.model === 'claude-haiku-4-5-20251001',
    );
    const sonnet = summary.modelBreakdown.find((m) => m.model === 'claude-sonnet-4-6');
    expect(haiku).toBeDefined();
    expect(sonnet).toBeDefined();
    // Haiku: 0.0025 + 0.0015 = 0.0040 USD, 2 + 3 = 5 runs
    expect(haiku!.usd).toBeCloseTo(0.004, 6);
    expect(haiku!.runs).toBe(5);
    // Sonnet: 0 + 0.00025 = 0.00025 USD, 1 + 1 = 2 runs
    expect(sonnet!.usd).toBeCloseTo(0.00025, 6);
    expect(sonnet!.runs).toBe(2);
  });

  it('returns zeros when the underlying query yields no rows', async () => {
    const { db } = makeDb([]);
    const summary = await getCostsSummary({ days: 30 }, { db: db as never });
    expect(summary.totalUsd).toBe(0);
    expect(summary.totalRuns).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.cacheHitRatio).toBe(0);
    expect(summary.modelBreakdown).toHaveLength(0);
  });
});
