/**
 * Favorites core — Phase 5 FAV-01, FAV-02, D-10, D-11.
 *
 * Pure deps-injected CRUD for the `favorites` table. Mirrors the Phase 2 /
 * Phase 4 core-logic / adapter split (`src/lib/feed/get-feed.ts` is the canonical
 * analog): business logic lives here and is unit-testable with a mock db;
 * the thin `'use server'` adapter at `src/server/actions/favorites.ts` wraps
 * these with auth + `revalidatePath`.
 *
 * Favorite/unfavorite are idempotent:
 *   - `favoriteItemCore` uses `INSERT ... ON CONFLICT DO NOTHING`, so a double-
 *     click is a no-op (composite PK `(user_id, item_id)` guarantees uniqueness).
 *   - `unfavoriteItemCore` is a targeted `DELETE`; deleting a missing row is
 *     a no-op in Postgres.
 *
 * Consumed by:
 *   - src/server/actions/favorites.ts
 *   - tests/integration/server-action-favorite.test.ts
 */
import { and, eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { favorites } from '@/lib/db/schema';

export interface FavoriteDeps {
  db?: typeof realDb;
}

export interface FavoriteParams {
  userId: string;
  itemId: bigint;
}

export async function favoriteItemCore(
  params: FavoriteParams,
  deps?: FavoriteDeps,
): Promise<{ favorited: true }> {
  const dbx = deps?.db ?? realDb;
  await dbx
    .insert(favorites)
    .values({ userId: params.userId, itemId: params.itemId })
    .onConflictDoNothing();
  return { favorited: true };
}

export async function unfavoriteItemCore(
  params: FavoriteParams,
  deps?: FavoriteDeps,
): Promise<{ favorited: false }> {
  const dbx = deps?.db ?? realDb;
  await dbx
    .delete(favorites)
    .where(and(eq(favorites.userId, params.userId), eq(favorites.itemId, params.itemId)));
  return { favorited: false };
}
