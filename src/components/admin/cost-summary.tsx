/**
 * CostSummary — Phase 6 Plan 06-04 (ADMIN-09).
 *
 * RSC, pure-presentation. Renders the top-line 30-day rollup:
 *   - 总花费 (USD, 4-decimal)
 *   - 运行次数
 *   - 总令牌 (Intl.NumberFormat zh-CN)
 *   - 缓存命中率 (percent, 1 decimal)
 *
 * Below the four stat cards sits a per-model breakdown row — one chip per
 * model (e.g. claude-haiku-4-5-20251001 $0.0031 · 42 次). If no rows were
 * returned, the breakdown row is omitted; the four stats still render as
 * zeros so the layout doesn't jump.
 *
 * Styling follows the admin inline-style convention (see admin-shell.tsx,
 * pipeline-status-card.tsx) — no Tailwind / no shadcn/ui Table (not
 * installed in v1). Chinese copy throughout.
 *
 * Consumed by:
 *   - src/app/admin/costs/page.tsx
 */
import type { CostsSummary } from '@/lib/admin/costs-repo';

const tokenFmt = new Intl.NumberFormat('zh-CN');

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: '1 1 160px',
        padding: 14,
        borderRadius: 10,
        border: '1px solid var(--line-weak)',
        background: 'var(--paper)',
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: 'var(--fg-3)',
          marginBottom: 6,
          letterSpacing: '-0.005em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--ink-900)',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function CostSummary({ summary }: { summary: CostsSummary }) {
  return (
    <section
      aria-labelledby="cost-summary-heading"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <h2
        id="cost-summary-heading"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        总览
      </h2>

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <StatCard label="总花费 (USD)" value={fmtUsd(summary.totalUsd)} />
        <StatCard label="运行次数" value={tokenFmt.format(summary.totalRuns)} />
        <StatCard label="总令牌" value={tokenFmt.format(summary.totalTokens)} />
        <StatCard label="缓存命中率" value={fmtPct(summary.cacheHitRatio)} />
      </div>

      {summary.modelBreakdown.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
          aria-label="按模型拆分"
        >
          {summary.modelBreakdown.map((m) => (
            <span
              key={m.model}
              style={{
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 999,
                border: '1px solid var(--line-weak)',
                background: 'var(--surface-1)',
                color: 'var(--ink-700)',
                whiteSpace: 'nowrap',
              }}
              title={m.model}
            >
              <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{m.model}</span>
              <span style={{ margin: '0 6px', color: 'var(--fg-3)' }}>·</span>
              {fmtUsd(m.usd)}
              <span style={{ margin: '0 6px', color: 'var(--fg-3)' }}>·</span>
              {tokenFmt.format(m.runs)} 次
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
