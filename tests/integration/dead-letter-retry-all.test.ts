/**
 * Plan 06-05 follow-up — integration test proving retryAllCore actually flips
 * multiple dead_letter rows to pending against a real Supabase test database.
 *
 * Why this exists: 06-REVIEW CR-01 flagged that the unit test for retryAllCore
 * only walked the rendered Drizzle SQL queryChunks — it never executed the
 * query against a real driver. The original raw-SQL `WHERE id IN ${ids}`
 * shape crashed at runtime because Drizzle's sql tag binds a JS array as a
 * single parameter. This test exercises the query-builder (inArray) fix end
 * to end against real Postgres so the bulk path is proved, not just rendered.
 *
 * Uses the same node-postgres Pool driver as the production client
 * (src/lib/db/client.ts), so transaction/execute semantics match.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { retryAllCore } from '@/lib/admin/dead-letter-repo';
import { items, sources } from '@/lib/db/schema';
import * as schema from '@/lib/db/schema';
import { urlFingerprint, contentHash } from '@/lib/ingest/fingerprint';

const url = process.env.DATABASE_URL ?? '';
const hasRealDb =
  process.env.RUN_INTEGRATION_DB === '1' ||
  url.includes('.supabase.') ||
  url.includes('.pooler.supabase.com');

// Fail-closed against production — mirror tests/helpers/test-db.ts guard.
const isProd = /prod/i.test(url);

describe('retryAllCore — bulk dead-letter → pending (integration)', () => {
  const describeDb = hasRealDb && !isProd ? describe : describe.skip;

  describeDb('with a live Supabase database (Pool driver)', () => {
    const pool = new Pool({ connectionString: url });
    const db = drizzle({ client: pool, schema });

    let sourceId: number;
    const seededItemIds: bigint[] = [];

    beforeEach(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [src] = await db
        .insert(sources)
        .values({
          name: `retryAll sentinel ${suffix}`,
          rssUrl: `https://example.com/__retry_all_sentinel__/${suffix}`,
          language: 'en',
          weight: '0.1',
          category: 'lab',
          isActive: false,
        })
        .returning();
      sourceId = src.id;

      // Seed two dead_letter items so retryAllCore has something to flip.
      for (let i = 0; i < 2; i++) {
        const itemUrl = `https://example.com/__retry_all_sentinel__/${suffix}/${i}`;
        const [row] = await db
          .insert(items)
          .values({
            sourceId,
            url: itemUrl,
            urlFingerprint: urlFingerprint(itemUrl),
            contentHash: contentHash(itemUrl, `retryAll sentinel ${i}`),
            title: `retryAll sentinel ${i}`,
            bodyRaw: 'integration test — retryAllCore',
            publishedAt: new Date(Date.now() - (i + 1) * 60_000),
            status: 'dead_letter',
            failureReason: 'ZodError: sentinel',
            processedAt: new Date(Date.now() - (i + 1) * 60_000),
            retryCount: 0,
          })
          .returning({ id: items.id });
        seededItemIds.push(row.id);
      }
    });

    afterEach(async () => {
      if (seededItemIds.length > 0) {
        await db.delete(items).where(inArray(items.id, seededItemIds));
        seededItemIds.length = 0;
      }
      if (sourceId != null) {
        await db.delete(sources).where(eq(sources.id, sourceId));
      }
    });

    afterAll(async () => {
      await pool.end();
    });

    it('flips every seeded dead_letter row to pending and increments retry_count', async () => {
      const res = await retryAllCore({ limit: 10 }, { db });
      expect(res.count).toBe(2);

      const rows = await db
        .select({
          id: items.id,
          status: items.status,
          retryCount: items.retryCount,
          failureReason: items.failureReason,
          processedAt: items.processedAt,
        })
        .from(items)
        .where(inArray(items.id, seededItemIds));

      expect(rows).toHaveLength(2);
      for (const r of rows) {
        expect(r.status).toBe('pending');
        expect(r.retryCount).toBe(1);
        expect(r.failureReason).toBeNull();
        expect(r.processedAt).toBeNull();
      }
    });
  });
});
