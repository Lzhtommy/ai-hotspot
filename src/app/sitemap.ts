/**
 * Public sitemap — Plan 06-07 OPS-04.
 *
 * Next.js 15 App Router metadata route. Emits <urlset> with two static URLs
 * (home + /all) plus one <url> per published item (capped at 5,000 most
 * recent — the sitemap protocol allows 50,000 but v1 scale caps lower to keep
 * the XML payload small and the query fast).
 *
 * ISR revalidate: 3600s — matches the hourly ingestion cadence. Heavy crawler
 * traffic hits cache, not the DB (T-6-72 mitigation).
 */
import type { MetadataRoute } from 'next';
import { getPublishedItemUrls } from '@/lib/feed/sitemap-repo';

export const revalidate = 3600;

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const rows = await getPublishedItemUrls({ limit: 5000 });

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${siteUrl}/all`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
  ];

  const itemEntries: MetadataRoute.Sitemap = rows.map((r) => ({
    url: `${siteUrl}/items/${r.id}`,
    lastModified: r.processedAt ?? r.publishedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...itemEntries];
}
