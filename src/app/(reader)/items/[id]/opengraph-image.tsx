/**
 * Dynamic OG image for item detail pages — Phase 4 FEED-09, D-25.
 *
 * Edge runtime: 1200×630 PNG rendered via next/og ImageResponse.
 * Noto Sans SC ArrayBuffer loaded at request time to support Chinese characters
 * (Pitfall 2 — without fonts param, CJK chars render as tofu squares).
 *
 * Font resolved via new URL(..., import.meta.url) — not a remote fetch —
 * which bundles the path at build time (Pitfall 10 / T-04-05-03 SSRF mitigation).
 *
 * Layout: paper background + 6px amber left stripe + title (38px/600) +
 * source name line with optional HOT chip for score >= 80.
 *
 * Consumed by: Next.js OG image convention (auto-wired from opengraph-image.tsx)
 */

import { ImageResponse } from 'next/og';
import { getItem } from '@/lib/feed/get-item';

export const runtime = 'edge';
export const alt = 'AI Hotspot item';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: { id: string } }) {
  const item = await getItem(params.id).catch(() => null);

  // Load Noto Sans SC woff2 as ArrayBuffer for CJK character rendering
  // Font path resolved at build time via import.meta.url (not user-controlled — T-04-05-03)
  const notoSansSC = await fetch(
    new URL('../../../../../public/fonts/NotoSansSC-Variable.woff2', import.meta.url),
  ).then((r) => r.arrayBuffer());

  const title = item ? (item.titleZh ?? item.title) : 'AI Hotspot';
  const sourceName = item?.sourceName ?? 'AI 动态';
  const hot = (item?.score ?? 0) >= 80;

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#FAF8F4', // --paper
        padding: 56,
        fontFamily: '"NotoSansSC"',
      }}
    >
      {/* Amber left stripe — 6px per D-25 design spec */}
      <div style={{ width: 6, background: '#D4911C', marginRight: 32, flexShrink: 0 }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        {/* Title — 38px/600 ink-900, max 4 lines */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 600,
            color: '#0B0B0C', // --ink-900
            lineHeight: 1.35,
            maxWidth: 1000,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </div>

        {/* Source name line + optional HOT chip + site attribution */}
        <div
          style={{
            marginTop: 18,
            fontSize: 16,
            color: '#3A3833', // --ink-700
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>{sourceName}</span>
          {hot && (
            <span
              style={{
                background: '#FCF3E0', // --accent-50
                color: '#8F5D0A', // --accent-700
                border: '1px solid #F8E4B8', // --accent-100
                padding: '2px 8px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              HOT
            </span>
          )}
          <span style={{ marginLeft: 'auto', color: '#807A6D', fontSize: 13 }}>
            AI Hotspot · 中文 AI 动态聚合
          </span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: 'NotoSansSC',
          data: notoSansSC,
          style: 'normal',
          weight: 500,
        },
      ],
    },
  );
}
