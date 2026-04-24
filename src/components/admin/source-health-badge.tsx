/**
 * SourceHealthBadge — Phase 6 Plan 06-02 (ADMIN-06).
 *
 * Colored dot + Chinese label rendered in every row of the admin sources
 * table. Consumes the pure `computeSourceHealth(...)` classifier from
 * `src/lib/admin/sources-repo.ts` so the badge color and the threshold
 * logic stay in lock-step.
 *
 * Server Component (no client JS) — it only renders based on its props and
 * has no event handlers.
 *
 * Consumed by:
 *   - src/components/admin/sources-table.tsx
 */
import { computeSourceHealth } from '@/lib/admin/sources-repo';

interface SourceHealthBadgeProps {
  consecutiveEmptyCount: number;
  consecutiveErrorCount: number;
}

/**
 * Map health state → (label, color). Colors reuse the project's CSS variables
 * so the admin UI picks up theme changes without code edits.
 * - red   → --danger (matches feed-card danger tone)
 * - yellow → a warning amber; the project does not have a canonical warn var
 *            so inline hex is used (sparingly, scoped to this badge)
 * - green → --accent (matches the terminal-green brand)
 */
const HEALTH_STYLES: Record<
  'green' | 'yellow' | 'red',
  { label: string; dot: string; fg: string }
> = {
  green: { label: '健康', dot: 'var(--accent, #10b981)', fg: 'var(--ink-700)' },
  yellow: { label: '警告', dot: '#f59e0b', fg: 'var(--ink-700)' },
  red: { label: '异常', dot: 'var(--danger, #ef4444)', fg: 'var(--danger, #ef4444)' },
};

export function SourceHealthBadge({
  consecutiveEmptyCount,
  consecutiveErrorCount,
}: SourceHealthBadgeProps) {
  const state = computeSourceHealth({ consecutiveEmptyCount, consecutiveErrorCount });
  const style = HEALTH_STYLES[state];

  return (
    <span
      role="status"
      aria-label={`信源健康状态:${style.label}`}
      data-health={state}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: style.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: style.dot,
          flexShrink: 0,
        }}
      />
      {style.label}
    </span>
  );
}
