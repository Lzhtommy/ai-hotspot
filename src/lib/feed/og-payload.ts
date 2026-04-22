/**
 * OG metadata shaping — Phase 4.
 *
 * Provides absolute URL resolution and Open Graph payload construction
 * for item detail pages.
 *
 * Consumed by:
 *   - src/app/(reader)/items/[id]/page.tsx (generateMetadata)
 *   - src/app/(reader)/items/[id]/opengraph-image.tsx
 */

/**
 * Resolve the canonical site URL from environment variables.
 * Priority: NEXT_PUBLIC_SITE_URL → VERCEL_URL → localhost:3000
 */
export function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

export type OgPayload = {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
};

/**
 * Build the OG payload for a given item.
 *
 * - title: `${titleZh ?? title} | AI Hotspot`
 * - description: summaryZh truncated to 160 chars
 * - url: absolute canonical item URL
 * - imageUrl: absolute opengraph-image URL
 *
 * Security note (T-04-03-07): returns plain strings; downstream generateMetadata
 * emits via Next.js which auto-escapes into meta content attributes. Never use
 * these values in dangerouslySetInnerHTML.
 */
export function buildOgPayload(item: {
  id: string;
  title: string;
  titleZh: string | null;
  summaryZh: string | null;
  sourceName?: string;
}): OgPayload {
  const siteUrl = resolveSiteUrl();
  const title = `${item.titleZh ?? item.title} | AI Hotspot`;
  const description = (item.summaryZh ?? '').slice(0, 160);
  return {
    title,
    description,
    url: `${siteUrl}/items/${item.id}`,
    imageUrl: `${siteUrl}/items/${item.id}/opengraph-image`,
  };
}
