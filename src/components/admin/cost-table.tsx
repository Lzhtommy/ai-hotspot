/**
 * CostTable — Phase 6 Plan 06-04 (ADMIN-09).
 *
 * RSC, pure-presentation. Renders the daily-by-model cost breakdown as a
 * native <table>. Each row is one (day × model) aggregate from
 * pipeline_runs, ordered by date DESC then model ASC (ordering done in
 * SQL — this component does not re-sort).
 *
 * Columns:
 *   日期 · 模型 · 输入令牌 · 缓存读取 · 缓存写入 · 输出令牌 · 估算花费 · 运行次数 · 缓存命中率
 *
 * Empty state renders a single centered cell with the message
 * "近 30 天无 LLM 运行记录". The heading chrome + column layout is
 * still visible so the admin understands where data would appear once
 * the pipeline starts writing rows.
 *
 * Styling follows the admin inline-style convention — no shadcn/ui
 * Table (not installed in v1). Chinese copy throughout.
 *
 * Consumed by:
 *   - src/app/admin/costs/page.tsx
 */
import type { DailyCostRow } from '@/lib/admin/costs-repo';

const tokenFmt = new Intl.NumberFormat('zh-CN');

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

const HEADERS: ReadonlyArray<{ key: string; label: string; align?: 'left' | 'right' }> = [
  { key: 'date', label: '日期', align: 'left' },
  { key: 'model', label: '模型', align: 'left' },
  { key: 'input', label: '输入令牌', align: 'right' },
  { key: 'cacheRead', label: '缓存读取', align: 'right' },
  { key: 'cacheWrite', label: '缓存写入', align: 'right' },
  { key: 'output', label: '输出令牌', align: 'right' },
  { key: 'cost', label: '估算花费 (USD)', align: 'right' },
  { key: 'runs', label: '运行次数', align: 'right' },
  { key: 'ratio', label: '缓存命中率', align: 'right' },
];

const cellBase: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  borderBottom: '1px solid var(--line-weak)',
  color: 'var(--ink-900)',
  whiteSpace: 'nowrap',
};

const numCell: React.CSSProperties = {
  ...cellBase,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
};

export function CostTable({ rows }: { rows: DailyCostRow[] }) {
  return (
    <section aria-labelledby="cost-table-heading">
      <h2
        id="cost-table-heading"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ink-900)',
          margin: '0 0 10px',
          letterSpacing: '-0.005em',
        }}
      >
        按日 × 模型 明细
      </h2>

      <div
        style={{
          border: '1px solid var(--line-weak)',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'var(--paper)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 880,
            }}
          >
            <thead>
              <tr style={{ background: 'var(--surface-1)' }}>
                {HEADERS.map((h) => (
                  <th
                    key={h.key}
                    scope="col"
                    style={{
                      ...cellBase,
                      textAlign: h.align ?? 'left',
                      color: 'var(--fg-3)',
                      fontWeight: 500,
                      fontSize: 12,
                      borderBottom: '1px solid var(--line-weak)',
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={HEADERS.length}
                    style={{
                      ...cellBase,
                      textAlign: 'center',
                      color: 'var(--fg-3)',
                      padding: '24px 12px',
                      borderBottom: 'none',
                    }}
                  >
                    近 30 天无 LLM 运行记录
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={`${r.date}__${r.model}`}
                    style={{
                      // last row drops the bottom border so the card edge reads cleanly
                      borderBottom: i === rows.length - 1 ? 'none' : undefined,
                    }}
                  >
                    <td style={{ ...cellBase }}>{r.date}</td>
                    <td
                      style={{ ...cellBase, color: 'var(--ink-700)', fontSize: 12.5 }}
                      title={r.model}
                    >
                      {r.model}
                    </td>
                    <td style={numCell}>{tokenFmt.format(r.inputTokens)}</td>
                    <td style={numCell}>{tokenFmt.format(r.cacheReadTokens)}</td>
                    <td style={numCell}>{tokenFmt.format(r.cacheWriteTokens)}</td>
                    <td style={numCell}>{tokenFmt.format(r.outputTokens)}</td>
                    <td style={numCell}>{fmtUsd(r.estimatedCostUsd)}</td>
                    <td style={numCell}>{tokenFmt.format(r.runs)}</td>
                    <td style={numCell}>{fmtPct(r.cacheHitRatio)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
