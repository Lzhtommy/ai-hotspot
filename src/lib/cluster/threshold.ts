/**
 * Cluster threshold — Phase 3 CLUST-04.
 *
 * Reads settings.value where key='cluster_threshold' as a float. Falls back
 * to DEFAULT_THRESHOLD (0.82 per RESEARCH.md §Pattern 2) when row missing
 * or value non-parseable.
 *
 * Admin-adjustable without redeploy — a future admin UI (Phase 6) updates
 * the row; this function reads the current value on every call (no caching
 * in v1 — the DB hit is cheap and called once per process-item run).
 *
 * Consumed by:
 *   - src/lib/cluster/join-or-create.ts
 */
import { eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';

export const DEFAULT_THRESHOLD = 0.82;

export async function getClusterThreshold(deps?: { db?: typeof realDb }): Promise<number> {
  const db = deps?.db ?? realDb;
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'cluster_threshold'));
  if (rows.length === 0) return DEFAULT_THRESHOLD;
  const parsed = parseFloat(rows[0].value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_THRESHOLD;
}
