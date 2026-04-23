/**
 * Batch-load the current user's favorite + vote state for a set of items — Phase 5 FAV-01/VOTE-02.
 *
 * Called from every RSC feed surface (`/`, `/all`, `/items/[id]`, and Plan 05-08's
 * `/favorites`) to thread the initial interaction Map into `<FeedCard>` props, which
 * in turn feed `<FeedCardActions>` so useOptimistic has a truthful starting point.
 *
 * Pure / deps-injected per the Phase 2 pattern (mirrors `src/lib/feed/get-feed.ts`).
 * Empty input → empty Map, zero queries. Anonymous callers should short-circuit before
 * invoking this.
 *
 * Consumed by:
 *   - src/app/(reader)/page.tsx (featured)
 *   - src/app/(reader)/all/page.tsx (all)
 *   - src/app/(reader)/items/[id]/page.tsx (detail)
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { favorites, votes } from '@/lib/db/schema';

export type Vote = -1 | 0 | 1;
export type InteractionState = { favorited: boolean; vote: Vote };

export interface GetInteractionsDeps {
  db?: typeof realDb;
}

/**
 * Returns `Map<itemIdAsString, {favorited, vote}>`. Items with no favorite row
 * default to `favorited=false`; items with no vote row default to `vote=0`.
 *
 * The Map key is a string representation of `items.id` (bigserial → bigint in TS).
 * Callers key by `String(item.id)` so the lookup matches the FeedListItem.id string
 * shape returned from get-feed.ts.
 */
export async function getUserInteractions(
  userId: string,
  itemIds: bigint[],
  deps?: GetInteractionsDeps,
): Promise<Map<string, InteractionState>> {
  const result = new Map<string, InteractionState>();
  if (itemIds.length === 0) return result;
  const dbx = deps?.db ?? realDb;

  const [favRows, voteRows] = await Promise.all([
    dbx
      .select({ itemId: favorites.itemId })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), inArray(favorites.itemId, itemIds))),
    dbx
      .select({ itemId: votes.itemId, value: votes.value })
      .from(votes)
      .where(and(eq(votes.userId, userId), inArray(votes.itemId, itemIds))),
  ]);

  for (const id of itemIds) {
    result.set(String(id), { favorited: false, vote: 0 });
  }
  for (const r of favRows) {
    const key = String(r.itemId);
    const curr = result.get(key) ?? { favorited: false, vote: 0 };
    result.set(key, { ...curr, favorited: true });
  }
  for (const r of voteRows) {
    const key = String(r.itemId);
    const curr = result.get(key) ?? { favorited: false, vote: 0 };
    const v: Vote = r.value === 1 ? 1 : r.value === -1 ? -1 : 0;
    result.set(key, { ...curr, vote: v });
  }
  return result;
}
