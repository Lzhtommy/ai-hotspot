/**
 * Sitemap repo — Plan 06-07 OPS-04.
 *
 * Returns the set of published item URLs (id + lastmod timestamps) that belong
 * in the public sitemap.xml. Filters status='published' ONLY — pending, failed,
 * and dead_letter items never leak to crawlers (T-6-70 mitigation).
 *
 * WARNING-8 — Wave 1 plan: this query MUST NOT join sources.deleted_at.
 * Plan 06-07 declares depends_on: [] and is allowed to merge before Plan 06-01's
 * schema migration lands in the live database. The ingestion poller (Plan 06-02)
 * stops producing NEW items from soft-deleted sources; historical `published`
 * items from a since-deleted source remain valid for SEO purposes.
 *
 * Consumed by src/app/sitemap.ts.
 */
import { desc, eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { items } from '@/lib/db/schema';

export interface SitemapRow {
  id: string;
  publishedAt: Date;
  processedAt: Date | null;
}

export async function getPublishedItemUrls(
  opts: { limit?: number } = {},
  deps: { db?: typeof realDb } = {},
): Promise<SitemapRow[]> {
  const d = deps.db ?? realDb;
  const limit = opts.limit ?? 5000;

  const rows = await d
    .select({
      id: items.id,
      publishedAt: items.publishedAt,
      processedAt: items.processedAt,
    })
    .from(items)
    // WARNING-8: no sources join — 06-07 Wave 1 must not depend on 06-01 schema.
    // Ingestion poller (06-02) stops polling deleted sources; historical
    // published items remain valid for SEO.
    .where(eq(items.status, 'published'))
    .orderBy(desc(items.publishedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: String(r.id),
    publishedAt: r.publishedAt,
    processedAt: r.processedAt,
  }));
}
