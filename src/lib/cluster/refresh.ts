/**
 * Cluster refresh — Phase 3 CLUST-05, CLUST-06 (via debounce helper), CLUST-07.
 *
 * Recomputes member_count / primary_item_id / earliest_seen_at / latest_seen_at
 * / centroid for every cluster touched since its last refresh.
 *
 * "Dirty cluster" heuristic: clusters.latest_seen_at < MAX(items.processed_at
 * WHERE items.cluster_id=c.id AND items.status='published'). Rebuilt as a
 * correlated join. At v1 scale (<10k clusters) this is cheap.
 *
 * CLUST-07 (stable primary): ORDER BY published_at ASC, id ASC LIMIT 1 —
 * ties in published_at (especially RSS-now-fallback items per D-13) broken
 * by items.id ASC for determinism.
 *
 * Centroid is advisory in v1 (RESEARCH.md Open Q #3) — nearest-neighbor
 * query in join-or-create.ts hits items.embedding, not clusters.centroid.
 * Populated here for v2 forward-compat.
 *
 * Consumed by:
 *   - src/trigger/refresh-clusters.ts (Plan 04)
 */
import { sql, eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { items, clusters } from '@/lib/db/schema';

export interface RefreshClustersResult {
  updated: number;
}

export async function runRefreshClusters(deps?: {
  db?: typeof realDb;
  now?: () => Date;
}): Promise<RefreshClustersResult> {
  const db = deps?.db ?? realDb;
  const now = deps?.now ?? (() => new Date());

  // 1. Enumerate dirty clusters — clusters whose latest_seen_at < MAX(items.processed_at)
  //    within the cluster's members.
  const dirty = (await db.execute(sql`
    SELECT c.id AS cluster_id
    FROM clusters c
    WHERE EXISTS (
      SELECT 1 FROM items i
      WHERE i.cluster_id = c.id
        AND i.status = 'published'
        AND i.processed_at IS NOT NULL
        AND (c.latest_seen_at IS NULL OR i.processed_at > c.latest_seen_at)
    )
  `)) as unknown as { rows: Array<{ cluster_id: string }> };

  let updated = 0;
  for (const { cluster_id: clusterIdStr } of dirty.rows) {
    const clusterId = BigInt(clusterIdStr);

    // 2. Aggregate per cluster
    const aggRes = (await db.execute(sql`
      SELECT COUNT(*)::int AS member_count,
             MIN(published_at) AS earliest_seen_at,
             MAX(published_at) AS latest_seen_at
      FROM items
      WHERE cluster_id = ${clusterId}
    `)) as unknown as {
      rows: Array<{ member_count: number; earliest_seen_at: string; latest_seen_at: string }>;
    };
    const agg = aggRes.rows[0];
    if (!agg || agg.member_count === 0) continue; // defensive

    // 3. Primary — earliest published_at, stable tiebreak on id (CLUST-07)
    const primRes = (await db.execute(sql`
      SELECT id FROM items WHERE cluster_id = ${clusterId}
      ORDER BY published_at ASC, id ASC
      LIMIT 1
    `)) as unknown as { rows: Array<{ id: string }> };
    if (primRes.rows.length === 0) continue;
    const newPrimaryId = BigInt(primRes.rows[0].id);

    // 4. Centroid via AVG(embedding)
    const centroidRes = (await db.execute(sql`
      SELECT AVG(embedding)::vector AS centroid
      FROM items
      WHERE cluster_id = ${clusterId} AND embedding IS NOT NULL
    `)) as unknown as { rows: Array<{ centroid: string | null }> };
    const centroidStr = centroidRes.rows[0]?.centroid;

    // 5. Update cluster row
    await db
      .update(clusters)
      .set({
        primaryItemId: newPrimaryId,
        memberCount: agg.member_count,
        earliestSeenAt: new Date(agg.earliest_seen_at),
        latestSeenAt: new Date(agg.latest_seen_at),
        updatedAt: now(),
      })
      .where(eq(clusters.id, clusterId));

    // 5b. Update centroid via raw SQL if available.
    // Use sql.param() to force parameterized binding — plain string interpolation
    // in Drizzle's sql`` template is a raw literal substitution, not a bind value.
    if (centroidStr) {
      await db.execute(sql`
        UPDATE clusters SET centroid = ${sql.param(centroidStr)}::vector
        WHERE id = ${clusterId}
      `);
    }

    // 6. Flip is_cluster_primary — exactly one row per cluster (CLUST-07)
    await db.update(items).set({ isClusterPrimary: false }).where(eq(items.clusterId, clusterId));
    await db.update(items).set({ isClusterPrimary: true }).where(eq(items.id, newPrimaryId));

    updated += 1;
  }

  return { updated };
}

/**
 * Pure helper for Plan 04 to pass to Trigger.dev v4 triggering API.
 * Signature matches RESEARCH.md §Cluster-refresh flow (lines 197-201).
 * Returns the debounce shape: { key, delay } — Plan 04 planner verifies
 * the exact Trigger.dev v4 API call site accepts this shape (Assumption A8).
 */
export function buildDebounceOpts(): { key: string; delay: string } {
  return { key: 'refresh-clusters', delay: '60s' };
}
