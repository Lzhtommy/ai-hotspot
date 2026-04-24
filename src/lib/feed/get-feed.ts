/**
 * Redis-cached feed reader — Phase 4 FEED-01, FEED-02, FEED-10, FEED-11, FEED-12.
 *
 * Returns paginated published items for the 精选 (featured) or 全部 AI 动态 (all) views.
 * Reads through Upstash Redis with a 300s TTL; falls back to Neon on miss.
 * Invalidation is out-of-band (see src/lib/feed/cache-invalidate.ts).
 *
 * Consumed by:
 *   - src/app/(reader)/page.tsx (view: 'featured')
 *   - src/app/(reader)/all/page.tsx (view: 'all')
 */
import { and, asc, desc, eq, gte, inArray, not, sql } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { redis as realRedis } from '@/lib/redis/client';
import { items, clusters, sources } from '@/lib/db/schema';

const TTL = 300;
const PAGE_SIZE = 50;

export type FeedListItem = {
  id: string;
  title: string;
  titleZh: string | null;
  summaryZh: string | null;
  recommendation: string | null;
  score: number;
  tags: string[] | null;
  sourceId: number;
  sourceName: string;
  sourceKind: string | null;
  publishedAt: string; // ISO
  clusterId: string | null;
  clusterMemberCount: number;
  url: string;
};

export type GetFeedParams = {
  view: 'featured' | 'all';
  page: number;
  tags?: string[];
  sourceId?: number | null;
};

export type GetFeedResult = {
  items: FeedListItem[];
  page: number;
  totalPages: number;
  lastSyncMinutes: number | null;
  clusterSiblings: Record<string, FeedListItem[]>;
};

export interface GetFeedDeps {
  db?: typeof realDb;
  redis?: typeof realRedis;
  now?: () => Date;
}

/**
 * Build the Redis cache key for a given set of feed params.
 * Keys follow the D-24 convention:
 *   feed:featured:page:{N}
 *   feed:all:page:{N}:tags:{sorted,csv}:source:{id|all}
 * Tags are sorted alphabetically (case-sensitive) and empty strings filtered out.
 */
export function buildFeedKey(p: GetFeedParams): string {
  if (p.view === 'featured') return `feed:v2:featured:page:${p.page}`;
  const tags = (p.tags ?? []).filter(Boolean).sort().join(',');
  const source = p.sourceId != null ? String(p.sourceId) : 'all';
  return `feed:v2:all:page:${p.page}:tags:${tags}:source:${source}`;
}

export async function getFeed(params: GetFeedParams, deps?: GetFeedDeps): Promise<GetFeedResult> {
  const db = deps?.db ?? realDb;
  const redis = deps?.redis ?? realRedis;
  const now = deps?.now ?? (() => new Date());
  const key = buildFeedKey(params);

  // Cache-aside: try Redis first
  const cached = await redis.get<GetFeedResult>(key);
  if (cached) return cached;

  // Build base predicates
  const predicates = [
    eq(items.status, 'published'),
    eq(items.isClusterPrimary, true),
  ] as ReturnType<typeof eq>[];

  if (params.view === 'featured') {
    predicates.push(gte(items.score, 70) as ReturnType<typeof eq>);
  }
  if (params.sourceId != null) {
    predicates.push(eq(items.sourceId, params.sourceId) as ReturnType<typeof eq>);
  }

  // Tag filter via array overlap (items.tags is text[] in schema)
  const filteredTags = (params.tags ?? []).filter(Boolean);
  const tagFilter =
    filteredTags.length > 0
      ? sql`${items.tags} && ARRAY[${sql.join(
          filteredTags.map((t) => sql`${t}`),
          sql`, `,
        )}]::text[]`
      : undefined;

  const whereClause = tagFilter ? and(...predicates, tagFilter) : and(...predicates);

  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      titleZh: items.titleZh,
      summaryZh: items.summaryZh,
      recommendation: items.recommendation,
      score: items.score,
      tags: items.tags,
      sourceId: items.sourceId,
      sourceName: sources.name,
      sourceKind: sources.language, // use language as kind proxy (kind not in schema)
      publishedAt: items.publishedAt,
      clusterId: items.clusterId,
      clusterMemberCount: clusters.memberCount,
      url: items.url,
    })
    .from(items)
    .leftJoin(clusters, eq(clusters.id, items.clusterId))
    .leftJoin(sources, eq(sources.id, items.sourceId))
    .where(whereClause)
    .orderBy(desc(items.publishedAt))
    .limit(PAGE_SIZE)
    .offset((params.page - 1) * PAGE_SIZE);

  // COUNT query for totalPages
  const countRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM items
    WHERE status = 'published'
      AND is_cluster_primary = true
      ${params.view === 'featured' ? sql`AND score >= 70` : sql``}
      ${params.sourceId != null ? sql`AND source_id = ${params.sourceId}` : sql``}
  `)) as unknown as { rows: { n: number }[] };
  const total = countRes.rows[0]?.n ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // lastSyncMinutes from sources aggregate
  const syncRes = (await db.execute(sql`
    SELECT MAX(last_fetched_at) AS last_fetched FROM sources
  `)) as unknown as { rows: { last_fetched: string | null }[] };
  const lastFetched = syncRes.rows[0]?.last_fetched ?? null;
  const lastSyncMinutes = lastFetched
    ? Math.floor((now().getTime() - new Date(lastFetched).getTime()) / 60_000)
    : null;

  // batch siblings for cluster primaries on this page
  const primaryIds = rows.filter((r) => r.clusterId != null).map((r) => r.id);
  const clusterIds = Array.from(
    new Set(rows.filter((r) => r.clusterId != null).map((r) => r.clusterId as bigint)),
  );

  const clusterSiblings: Record<string, FeedListItem[]> = {};

  if (clusterIds.length > 0) {
    const siblingRows = await db
      .select({
        id: items.id,
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
        clusterId: items.clusterId,
        url: items.url,
      })
      .from(items)
      .leftJoin(sources, eq(sources.id, items.sourceId))
      .where(
        and(
          inArray(items.clusterId, clusterIds),
          not(inArray(items.id, primaryIds)),
          eq(items.status, 'published'),
        ),
      )
      .orderBy(asc(items.publishedAt));

    for (const s of siblingRows) {
      if (s.clusterId == null) continue;
      const key = String(s.clusterId);
      const mapped: FeedListItem = {
        id: String(s.id),
        title: s.title,
        titleZh: s.titleZh ?? null,
        summaryZh: s.summaryZh ?? null,
        recommendation: s.recommendation ?? null,
        score: s.score ?? 0,
        tags: s.tags ?? null,
        sourceId: s.sourceId,
        sourceName: s.sourceName ?? '',
        sourceKind: s.sourceKind ?? null,
        publishedAt:
          s.publishedAt instanceof Date ? s.publishedAt.toISOString() : String(s.publishedAt),
        clusterId: String(s.clusterId),
        clusterMemberCount: 1,
        url: s.url,
      };
      (clusterSiblings[key] ??= []).push(mapped);
    }
  }

  const result: GetFeedResult = {
    items: rows.map((r) => ({
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
      clusterMemberCount: r.clusterMemberCount ?? 1,
      url: r.url,
    })),
    page: params.page,
    totalPages,
    lastSyncMinutes,
    clusterSiblings,
  };

  await redis.set(key, result, { ex: TTL });
  return result;
}
