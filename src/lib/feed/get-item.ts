/**
 * Item detail reader — Phase 4 FEED-04.
 *
 * Returns the full item plus its cluster-mate siblings ordered by published_at ASC.
 * Returns null when the item is not found or not in 'published' status.
 *
 * Consumed by:
 *   - src/app/(reader)/items/[id]/page.tsx
 */
import { eq, asc } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { items, sources } from '@/lib/db/schema';
import type { FeedListItem } from './get-feed';

export type ItemDetail = FeedListItem & {
  publishedAtSourceTz: string | null;
  siblings: Array<FeedListItem & { isPrimary: boolean }>;
};

export interface GetItemDeps {
  db?: typeof realDb;
}

export async function getItem(id: string, deps?: GetItemDeps): Promise<ItemDetail | null> {
  const db = deps?.db ?? realDb;

  // Fetch the primary item by id (include status for the published check)
  const [row] = await db
    .select({
      id: items.id,
      status: items.status,
      title: items.title,
      titleZh: items.titleZh,
      summaryZh: items.summaryZh,
      recommendation: items.recommendation,
      score: items.score,
      tags: items.tags,
      sourceId: items.sourceId,
      sourceName: sources.name,
      sourceKind: sources.language,
      publishedAt: items.publishedAt,
      publishedAtSourceTz: items.publishedAtSourceTz,
      clusterId: items.clusterId,
      isClusterPrimary: items.isClusterPrimary,
      url: items.url,
    })
    .from(items)
    .leftJoin(sources, eq(sources.id, items.sourceId))
    .where(eq(items.id, BigInt(id)));

  if (!row) return null;
  if (row.status !== 'published') return null;

  // Helper to map a row to FeedListItem
  function toFeedListItem(r: typeof row): FeedListItem {
    return {
      id: String(r.id),
      title: r.title,
      titleZh: r.titleZh ?? null,
      summaryZh: r.summaryZh ?? null,
      recommendation: r.recommendation ?? null,
      score: r.score ?? 0,
      tags: r.tags ?? null,
      sourceId: r.sourceId,
      sourceName: r.sourceName ?? '',
      sourceKind: r.sourceKind ?? null,
      publishedAt:
        r.publishedAt instanceof Date ? r.publishedAt.toISOString() : String(r.publishedAt),
      clusterId: r.clusterId != null ? String(r.clusterId) : null,
      clusterMemberCount: 1, // will be updated from siblings count below
      url: r.url,
    };
  }

  // Fetch siblings if item belongs to a cluster
  let siblings: Array<FeedListItem & { isPrimary: boolean }> = [];

  if (row.clusterId != null) {
    const siblingRows = await db
      .select({
        id: items.id,
        status: items.status,
        title: items.title,
        titleZh: items.titleZh,
        summaryZh: items.summaryZh,
        recommendation: items.recommendation,
        score: items.score,
        tags: items.tags,
        sourceId: items.sourceId,
        sourceName: sources.name,
        sourceKind: sources.language,
        publishedAt: items.publishedAt,
        publishedAtSourceTz: items.publishedAtSourceTz,
        clusterId: items.clusterId,
        isClusterPrimary: items.isClusterPrimary,
        url: items.url,
      })
      .from(items)
      .leftJoin(sources, eq(sources.id, items.sourceId))
      .where(eq(items.clusterId, row.clusterId))
      .orderBy(asc(items.publishedAt));

    siblings = siblingRows.map((s) => ({
      ...toFeedListItem(s),
      clusterMemberCount: siblingRows.length,
      isPrimary: s.isClusterPrimary,
    }));
  }

  const primaryItem = toFeedListItem(row);
  primaryItem.clusterMemberCount = siblings.length || 1;

  return {
    ...primaryItem,
    publishedAtSourceTz: row.publishedAtSourceTz ?? null,
    siblings,
  };
}
