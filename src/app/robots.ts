/**
 * Public robots.txt — Plan 06-07 OPS-04.
 *
 * Next.js 15 App Router metadata route. Disallows /admin, /api, /favorites,
 * and /admin/access-denied so crawlers do not index privileged or per-user
 * paths (T-6-71 mitigation). References /sitemap.xml so well-behaved crawlers
 * discover the published-items index without scraping.
 */
import type { MetadataRoute } from 'next';

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/all', '/items/'],
        disallow: ['/admin', '/api', '/favorites', '/admin/access-denied'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
