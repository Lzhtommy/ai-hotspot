/**
 * Suspense loading fallback — Phase 4 UI-SPEC Loading State.
 *
 * Renders 6 skeleton cards in the main column while data is loading.
 * No spinner, no "加载中…" text — pure visual placeholder per design.
 *
 * Consumed by: Next.js Suspense (applies to all (reader) routes)
 */

import { SkeletonCard } from '@/components/feed/skeleton-card';

export default function Loading() {
  return (
    <div className="px-[32px] py-[24px] max-sm:px-[16px] max-w-[920px] mx-auto flex flex-col gap-[12px]">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
