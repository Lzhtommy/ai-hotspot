/**
 * 404 page for item detail — Phase 4 UI-SPEC Copywriting Contract.
 *
 * Rendered by notFound() when item is missing or not published.
 * Provides: heading 动态不存在 / body / CTA back to timeline.
 *
 * Consumed by: Next.js not-found convention (invoked via notFound() in page.tsx)
 */

import Link from 'next/link';
import { EmptyState } from '@/components/feed/empty-state';

export default function ItemNotFound() {
  return (
    <div className="px-[32px] py-[24px] max-sm:px-[16px]">
      <Link
        href="/"
        className="text-[13px] text-[var(--fg-3)] hover:text-[var(--ink-900)] transition-colors"
      >
        ← 返回
      </Link>
      <EmptyState
        title="动态不存在"
        body="它可能已被删除或还未发布。"
        cta={{ label: '回到时间线', href: '/', variant: 'secondary' }}
      />
    </div>
  );
}
