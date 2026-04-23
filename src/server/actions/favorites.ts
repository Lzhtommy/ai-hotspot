'use server';

/**
 * Favorites server actions — Phase 5 FAV-01, FAV-02.
 *
 * Thin 'use server' adapter over the pure core at
 * `src/lib/user-actions/favorites-core.ts`. Responsible for:
 *   1. Reading the live session via `auth()` (Auth.js v5).
 *   2. Enforcing D-05 Layer 2 ban guard via `requireLiveUserCore` — throws
 *      AuthError{UNAUTHENTICATED|FORBIDDEN}; the client catches and either
 *      dispatches `open-login-modal` or surfaces a generic error.
 *   3. Wrapping the string `itemId` from the client in `BigInt()` (items.id
 *      is bigserial; RESEARCH §Pattern 6 / §Pitfall 6).
 *   4. Calling the pure core for the DB mutation.
 *   5. `revalidatePath('/favorites')` so the authenticated /favorites RSC
 *      reflects the change on the next navigation.
 *
 * Consumed by:
 *   - src/components/feed/feed-card-actions.tsx (Plan 05-07 — UI wiring)
 */
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireLiveUserCore } from '@/lib/user-actions/auth-guard';
import {
  favoriteItemCore,
  unfavoriteItemCore,
} from '@/lib/user-actions/favorites-core';

export async function favoriteItem(itemId: string): Promise<{ favorited: true }> {
  const session = await auth();
  const userId = await requireLiveUserCore(session);
  const result = await favoriteItemCore({ userId, itemId: BigInt(itemId) });
  revalidatePath('/favorites');
  return result;
}

export async function unfavoriteItem(itemId: string): Promise<{ favorited: false }> {
  const session = await auth();
  const userId = await requireLiveUserCore(session);
  const result = await unfavoriteItemCore({ userId, itemId: BigInt(itemId) });
  revalidatePath('/favorites');
  return result;
}
