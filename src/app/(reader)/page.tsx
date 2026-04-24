/**
 * Featured feed page (精选) — Phase 4 FEED-01, D-13.
 *
 * ISR with revalidate=300 (5 minutes). Queries items where
 * status='published' AND is_cluster_primary=true AND score>=70,
 * renders via Timeline component. Empty state when no high-score items.
 *
 * Consumed by: Next.js routing (resolves `/`)
 */

import { getFeed } from '@/lib/feed/get-feed';
import { FeedTopBar } from '@/components/feed/feed-top-bar';
import { Timeline } from '@/components/feed/timeline';
import { EmptyState } from '@/components/feed/empty-state';
import { auth } from '@/lib/auth';
import { getUserInteractions } from '@/lib/user-actions/get-interactions';

// Plan 05-07 prop-threading contract: every <FeedCard> rendered through <Timeline>
// below receives isAuthenticated + initial via forwarded props (see Timeline.tsx).

export const revalidate = 300;

export default async function FeaturedPage() {
  const { items, lastSyncMinutes, clusterSiblings } = await getFeed({ view: 'featured', page: 1 });

  // Phase 5 Plan 05-07: thread session + initial interactions into every FeedCard.
  const session = await auth();
  const isAuthenticated = !!session?.user?.id;
  const interactionMap = isAuthenticated
    ? await getUserInteractions(
        session!.user!.id!,
        items.map((i) => BigInt(i.id)),
      )
    : new Map<string, { favorited: boolean; vote: -1 | 0 | 1 }>();

  return (
    <>
      <FeedTopBar
        view="featured"
        count={items.length}
        lastSyncMinutes={lastSyncMinutes}
        pathname="/"
      />
      {items.length === 0 ? (
        <EmptyState
          title="暂无精选动态"
          body="当 Claude 筛出热度 70 以上的新动态,它们会出现在这里。"
          cta={{ label: '查看全部动态', href: '/all', variant: 'secondary' }}
        />
      ) : (
        <Timeline
          items={items}
          clusterSiblings={clusterSiblings}
          isAuthenticated={isAuthenticated}
          interactionMap={interactionMap}
          initial={{ favorited: false, vote: 0 }}
        />
      )}
    </>
  );
}
