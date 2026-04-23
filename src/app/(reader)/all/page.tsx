/**
 * Full feed page (全部 AI 动态) — Phase 4 FEED-02, D-14.
 *
 * ISR with revalidate=300. Reads nuqs search params for page/tags/source via
 * feedParamsCache.parse(await searchParams) — Next.js 15 async searchParams API.
 * Renders FeedTopBar + FilterPopover + Timeline + pagination links.
 * Two empty states: no items at all vs filter returns zero.
 *
 * Consumed by: Next.js routing (resolves `/all`)
 */

import Link from 'next/link';
import { getFeed } from '@/lib/feed/get-feed';
import { feedParamsCache } from '@/lib/feed/search-params';
import { FeedTopBar } from '@/components/feed/feed-top-bar';
import { Timeline } from '@/components/feed/timeline';
import { EmptyState } from '@/components/feed/empty-state';
import { FilterPopover } from '@/components/feed/filter-popover';
import { db } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { getUserInteractions } from '@/lib/user-actions/get-interactions';

// Plan 05-07 prop-threading contract: every <FeedCard> rendered through <Timeline>
// below receives isAuthenticated + initial via forwarded props (see Timeline.tsx).

export const revalidate = 300;

export default async function AllFeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { page, tags, source } = feedParamsCache.parse(await searchParams);
  const { items, totalPages, lastSyncMinutes } = await getFeed({
    view: 'all',
    page,
    tags,
    sourceId: source ? Number(source) : null,
  });

  // Phase 5 Plan 05-07: thread session + initial interactions into every FeedCard.
  const session = await auth();
  const isAuthenticated = !!session?.user?.id;
  const interactionMap = isAuthenticated
    ? await getUserInteractions(
        session!.user!.id!,
        items.map((i) => BigInt(i.id)),
      )
    : new Map<string, { favorited: boolean; vote: -1 | 0 | 1 }>();

  // Available sources for the filter popover
  const availableSources = await db.select({ id: sources.id, name: sources.name }).from(sources);

  // Available tags derived from items on this page (stable for ISR)
  const availableTags = Array.from(new Set(items.flatMap((i) => i.tags ?? []))).sort();

  const hasFilters = tags.length > 0 || source !== '';

  return (
    <>
      <FeedTopBar
        view="all"
        count={items.length}
        lastSyncMinutes={lastSyncMinutes}
        pathname="/all"
      />
      <div className="px-[32px] pt-[8px] max-sm:px-[16px]">
        <FilterPopover availableTags={availableTags} availableSources={availableSources} />
      </div>
      {items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="没有匹配的动态"
            body="换一组标签或信源试试;或清除全部筛选。"
            cta={{ label: '清除筛选', href: '/all', variant: 'ghost' }}
          />
        ) : (
          <EmptyState title="还没有动态" body="抓取流水线还没有入库内容;稍等几分钟后刷新。" />
        )
      ) : (
        <>
          <Timeline
            items={items}
            isAuthenticated={isAuthenticated}
            interactionMap={interactionMap}
            initial={{ favorited: false, vote: 0 }}
          />
          {totalPages > 1 && (
            <nav className="flex justify-center gap-2 py-8" aria-label="分页">
              {page > 1 && (
                <Link
                  href={`/all?page=${page - 1}`}
                  className="px-3 py-1 border rounded text-[13px] text-[var(--ink-700)] border-[var(--line)] hover:bg-[var(--surface-1)]"
                >
                  上一页
                </Link>
              )}
              <span className="px-3 py-1 text-[13px] text-[var(--fg-3)]">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/all?page=${page + 1}`}
                  className="px-3 py-1 border rounded text-[13px] text-[var(--ink-700)] border-[var(--line)] hover:bg-[var(--surface-1)]"
                >
                  下一页
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
