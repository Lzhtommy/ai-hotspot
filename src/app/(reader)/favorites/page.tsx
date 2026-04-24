/**
 * Favorites page — Phase 5 Plan 05-08 (D-15 Option A, FAV-03).
 *
 * Anonymous → redirect('/') (planner's choice per CONTEXT D-15; see
 * 05-CONTEXT.md §decisions D-15 for the rationale).
 * Authenticated → user-scoped favorites JOIN items query (reverse-chrono by
 * favorites.createdAt), rendered with the same <Timeline>/<FeedCard>
 * components as `/` and `/all` (no new card variant needed per D-15).
 *
 * force-dynamic because this page is user-specific and must NOT be cached
 * at the CDN layer (per CLAUDE.md §1 User pages + Threat T-5-10 information
 * disclosure mitigation in PLAN).
 *
 * Threat model mitigations applied here (PLAN §threat_model):
 *   - T-5-10: WHERE favorites.userId = session.user.id + dynamic='force-dynamic'
 *   - T-5-06: redirect('/') before any DB read when session is null
 *   - T-5-03: session callback (Plan 05-02) returns null for banned users → falls
 *     into the same redirect branch
 *
 * Note: 列表聚类展开 (clusterSiblings) 暂不在 favorites 页启用。若后续需要,需
 *       为此页添加与 get-feed.ts 类似的批量 sibling 取;favorites 不经 getFeed。
 *
 * Consumed by: Next.js routing (resolves `/favorites`)
 */

import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { favorites, items, sources, clusters } from '@/lib/db/schema';
import { FeedTopBar } from '@/components/feed/feed-top-bar';
import { Timeline } from '@/components/feed/timeline';
import { getUserInteractions } from '@/lib/user-actions/get-interactions';
import type { FeedListItem } from '@/lib/feed/get-feed';
import { FavoritesEmpty } from './favorites-empty';

export const dynamic = 'force-dynamic';

// Plan 05-07 / 05-08 prop-threading contract: every <FeedCard> rendered through
// <Timeline> below receives isAuthenticated + initial via forwarded props
// (see Timeline.tsx + FeedCard.tsx).

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    // D-15 Option A: anonymous users go to the featured feed; the sign-in
    // modal is available from every page. No empty-state render path reachable
    // to anonymous users on this route in Phase 5.
    redirect('/');
  }
  const userId = session.user.id;
  // Quick 260424-oyc: role-gate the 手动同步 button (server-authoritative on POST).
  const canSync = (session.user as { role?: string }).role === 'admin';

  // Reverse-chronological by favorites.createdAt (most recently favorited first).
  // innerJoin items so unpublished / dropped items never leak through favorites
  // rows pointing at them. leftJoin sources + clusters so card meta + cluster
  // counts thread through to FeedCard the same as the /all query.
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
      sourceKind: sources.language, // mirror get-feed.ts: language proxies kind
      publishedAt: items.publishedAt,
      clusterId: items.clusterId,
      clusterMemberCount: clusters.memberCount,
      url: items.url,
      // favoritedAt is the ordering key — also useful for future UI (e.g., "收藏于…")
      favoritedAt: favorites.createdAt,
    })
    .from(favorites)
    .innerJoin(items, eq(items.id, favorites.itemId))
    .leftJoin(sources, eq(sources.id, items.sourceId))
    .leftJoin(clusters, eq(clusters.id, items.clusterId))
    .where(and(eq(favorites.userId, userId), eq(items.status, 'published')))
    .orderBy(desc(favorites.createdAt));

  // Reshape into FeedListItem shape consumed by Timeline/FeedCard. Mirrors the
  // mapping in get-feed.ts lines 153–169.
  const feedItems: FeedListItem[] = rows.map((r) => ({
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
  }));

  // Every row on /favorites is by definition favorited by the current user.
  // Call getUserInteractions to pick up the correct vote state (favorited is
  // already known). Anonymous branch is unreachable here (redirect above).
  const interactionMap =
    feedItems.length > 0
      ? await getUserInteractions(
          userId,
          feedItems.map((i) => BigInt(i.id)),
        )
      : new Map<string, { favorited: boolean; vote: -1 | 0 | 1 }>();

  // Authenticated subtitle per UI-SPEC §/favorites page:
  //   with items: 共 {N} 条
  //   empty:      还没有收藏
  const subtitle = feedItems.length > 0 ? `共 ${feedItems.length} 条` : '还没有收藏';

  return (
    <>
      <FeedTopBar
        view="favorites"
        pathname="/favorites"
        count={feedItems.length}
        subtitle={subtitle}
        canSync={canSync}
      />
      {feedItems.length === 0 ? (
        <FavoritesEmpty authenticated />
      ) : (
        <Timeline
          items={feedItems}
          isAuthenticated={true}
          interactionMap={interactionMap}
          // Every row on /favorites is favorited by definition — the fallback
          // for items missing from the interactionMap reflects that truth.
          initial={{ favorited: true, vote: 0 }}
        />
      )}
    </>
  );
}
