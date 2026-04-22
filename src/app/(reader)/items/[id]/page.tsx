/**
 * Item detail page — Phase 4 FEED-04, D-15.
 *
 * ISR with revalidate=3600 (1 hour). Fetches item + cluster siblings.
 * generateMetadata emits og:title/og:description/og:image for WeChat/Twitter.
 * notFound() on missing or unpublished items.
 *
 * Renders: back link, hero meta, h1 title, summary, 推荐理由 callout,
 * tags, external link, cluster siblings section when present.
 *
 * Consumed by: Next.js routing (resolves `/items/[id]`)
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { getItem } from '@/lib/feed/get-item';
import { resolveSiteUrl } from '@/lib/feed/og-payload';
import { SourceDot } from '@/components/layout/source-dot';
import { Tag } from '@/components/layout/tag';
import { Eyebrow } from '@/components/layout/eyebrow';
import { ScoreBadge } from '@/components/feed/score-badge';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return {};
  const siteUrl = resolveSiteUrl();
  const title = item.titleZh ?? item.title;
  const description = (item.summaryZh ?? '').slice(0, 160);
  return {
    title: `${title} | AI Hotspot`,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/items/${id}`,
      siteName: 'AI Hotspot',
      type: 'article',
      // Next.js auto-wires opengraph-image.tsx — do NOT set images here.
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  const tz = 'Asia/Shanghai';
  const dateStr = formatInTimeZone(new Date(item.publishedAt), tz, 'M月d日 HH:mm');
  const title = item.titleZh ?? item.title;
  const siblings = item.siblings ?? [];

  return (
    <article className="px-[32px] py-[24px] max-sm:px-[16px] max-w-[720px] mx-auto">
      {/* Back link — UI-SPEC Copywriting: ← 返回 */}
      <Link
        href="/all"
        className="text-[13px] text-[var(--fg-3)] hover:text-[var(--ink-900)] transition-colors"
      >
        ← 返回
      </Link>

      {/* Hero meta row */}
      <header className="mt-[16px] flex items-center gap-[10px] flex-wrap">
        <SourceDot sourceId={item.sourceId} nameHint={item.sourceName} size={22} />
        <span className="text-[13px] font-medium text-[var(--ink-700)]">{item.sourceName}</span>
        <span className="text-[12px] text-[var(--fg-3)]">·</span>
        <span className="text-[12px] font-mono text-[var(--fg-3)]">{dateStr}</span>
        <span className="ml-auto">
          <ScoreBadge score={item.score} />
        </span>
      </header>

      {/* Title — h1 24px/600 per UI-SPEC */}
      <h1 className="mt-[16px] text-[24px] font-semibold text-[var(--ink-900)] leading-[1.35] tracking-[-0.01em]">
        {title}
      </h1>

      {/* Summary — 14px/1.7 ink-700 */}
      <p className="mt-[16px] text-[14px] leading-[1.7] text-[var(--ink-700)] whitespace-pre-wrap">
        {item.summaryZh}
      </p>

      {/* 推荐理由 amber callout (when present) */}
      {item.recommendation && (
        <div
          className="mt-[20px] py-[12px] px-[16px] rounded-r-[6px]"
          style={{
            background: 'var(--accent-50)',
            borderLeft: '2px solid var(--accent-500)',
          }}
        >
          <Eyebrow variant="accent">★ Claude 推荐理由</Eyebrow>
          <p className="mt-[6px] text-[14px] leading-[1.55] text-[var(--ink-700)]">
            {item.recommendation}
          </p>
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="mt-[16px] flex flex-wrap gap-[5px]">
          {item.tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>
      )}

      {/* Original article link */}
      <div className="mt-[24px]">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] font-medium text-[var(--accent-700)] hover:underline"
        >
          查看原文 ↗
        </a>
      </div>

      {/* Cluster siblings section (when there are other sources covering the same event) */}
      {siblings.length > 1 && (
        <section className="mt-[40px]">
          <h2 className="text-[16px] font-semibold text-[var(--ink-900)]">
            {siblings.length - 1} 个信源也报道了此事件
          </h2>
          <ul
            className="mt-[12px] flex flex-col gap-[12px] p-[12px] rounded-[8px]"
            style={{
              border: '1px solid var(--line-weak)',
              background: 'var(--surface-1)',
            }}
          >
            {siblings
              .filter((s) => s.id !== item.id)
              .map((s) => {
                const sdate = formatInTimeZone(new Date(s.publishedAt), tz, 'M月d日 HH:mm');
                return (
                  <li key={s.id} className="flex items-center gap-[10px] min-w-0">
                    <SourceDot sourceId={s.sourceId} nameHint={s.sourceName} size={14} />
                    <Link
                      href={`/items/${s.id}`}
                      className="text-[13px] font-medium text-[var(--ink-900)] hover:underline truncate"
                    >
                      {s.titleZh ?? s.title}
                    </Link>
                    <span className="ml-auto text-[12px] text-[var(--fg-3)] flex-shrink-0 flex items-center gap-[6px]">
                      <span>
                        {s.sourceName} · {sdate} · 热度 <span className="font-mono">{s.score}</span>
                      </span>
                    </span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--fg-3)] hover:text-[var(--ink-900)] flex-shrink-0"
                      aria-label="打开原文"
                    >
                      ↗
                    </a>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </article>
  );
}
