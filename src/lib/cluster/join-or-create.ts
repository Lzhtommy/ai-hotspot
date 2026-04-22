/**
 * Cluster join-or-create — Phase 3 CLUST-03, CLUST-05 (partial), CLUST-07 (partial).
 *
 * Given an item's embedding + publishedAt, find the nearest prior item in
 * the ±24h window via pgvector cosine distance (<=>). If similarity >=
 * threshold (settings.cluster_threshold, default 0.82), join that item's
 * cluster. Else, create a new cluster with this item as primary.
 *
 * Both branches run inside a single db.transaction() so nearest-query and
 * item-update commit atomically — prevents a concurrent processor from
 * racing the assignment.
 *
 * Uses items_embedding_hnsw_idx from drizzle/0003 migration (Plan 01).
 * Query planner chooses the HNSW index for `ORDER BY <=> LIMIT 1`; confirm
 * with EXPLAIN ANALYZE if perf regresses (RESEARCH.md Pitfall 5).
 *
 * member_count / earliest_seen_at / latest_seen_at / centroid for EXISTING
 * clusters (the "join" branch) are refreshed asynchronously by
 * runRefreshClusters() — this function only sets cluster_id on the item.
 *
 * Consumed by:
 *   - src/lib/llm/process-item-core.ts (via injected dep)
 *   - src/trigger/process-item.ts (Plan 04)
 */
import { sql, eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { items, clusters } from '@/lib/db/schema';
import { getClusterThreshold } from './threshold';

export class ClusterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClusterError';
  }
}

export async function joinOrCreateCluster(params: {
  itemId: bigint;
  embedding: number[];
  publishedAt: Date;
  deps?: {
    db?: typeof realDb;
    getThreshold?: (deps?: { db?: typeof realDb }) => Promise<number>;
  };
}): Promise<{ clusterId: bigint; joined: boolean }> {
  const db = params.deps?.db ?? realDb;
  const thresholdFn = params.deps?.getThreshold ?? getClusterThreshold;
  const threshold = await thresholdFn({ db });
  const embeddingLiteral = `[${params.embedding.join(',')}]`;

  return db.transaction(async (tx) => {
    const nearest = await tx.execute(sql`
      SELECT i.id, i.cluster_id,
             1 - (i.embedding <=> ${embeddingLiteral}::vector) AS cosine_similarity
      FROM items i
      WHERE i.cluster_id IS NOT NULL
        AND i.embedding IS NOT NULL
        AND i.id <> ${params.itemId}
        AND i.published_at BETWEEN ${params.publishedAt}::timestamptz - interval '24 hours'
                               AND ${params.publishedAt}::timestamptz + interval '24 hours'
      ORDER BY i.embedding <=> ${embeddingLiteral}::vector
      LIMIT 1
    `);

    const row = ((nearest as unknown as { rows: Array<unknown> }).rows[0] ?? null) as null | {
      id: string;
      cluster_id: string;
      cosine_similarity: number | string;
    };

    if (row && Number(row.cosine_similarity) >= threshold) {
      const nearestClusterId = BigInt(row.cluster_id);
      await tx.update(items).set({ clusterId: nearestClusterId }).where(eq(items.id, params.itemId));
      return { clusterId: nearestClusterId, joined: true };
    }

    // Create new cluster
    const inserted = await tx
      .insert(clusters)
      .values({
        primaryItemId: params.itemId,
        centroid: params.embedding,
        memberCount: 1,
        earliestSeenAt: params.publishedAt,
        latestSeenAt: params.publishedAt,
      })
      .returning({ id: clusters.id });

    if (inserted.length !== 1) {
      throw new ClusterError('failed to insert new cluster');
    }
    const newClusterId = inserted[0].id;

    await tx
      .update(items)
      .set({ clusterId: newClusterId, isClusterPrimary: true })
      .where(eq(items.id, params.itemId));

    return { clusterId: newClusterId, joined: false };
  });
}
