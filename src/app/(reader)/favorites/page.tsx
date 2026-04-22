/**
 * Favorites page — Phase 4 D-16.
 *
 * Anonymous empty state in Phase 4; Phase 5 replaces body with the
 * authenticated RSC query (favorites JOIN items).
 *
 * force-dynamic because this page is user-specific and must not be cached
 * at the CDN layer (per CLAUDE.md §1 User pages).
 *
 * Consumed by: Next.js routing (resolves `/favorites`)
 */

import { FeedTopBar } from '@/components/feed/feed-top-bar';
import { FavoritesEmpty } from './favorites-empty';

export const dynamic = 'force-dynamic';

export default function FavoritesPage() {
  return (
    <>
      <FeedTopBar view="favorites" pathname="/favorites" />
      <FavoritesEmpty />
    </>
  );
}
