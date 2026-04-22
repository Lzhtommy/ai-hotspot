/**
 * Post-migration assertion — Phase 3 CLUST-02.
 *
 * Asserts that drizzle/0003_hnsw_index_and_settings_seed.sql has been applied
 * against the connected Neon branch: items_embedding_hnsw_idx exists, is an
 * HNSW index, and covers the embedding column. Also verifies settings seed.
 *
 * Run: `pnpm check:hnsw`
 *
 * Exits 0 on PASS, 1 on FAIL. NOT run by CI — developer/operator tool.
 *
 * Pattern mirrors scripts/verify-ingest.ts:361-369 (information_schema probe) +
 * verify-ingest.ts:393-400 (main().then(process.exit) shape).
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/client';

async function main(): Promise<boolean> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

  const res = (await db.execute(sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'items' AND indexname = 'items_embedding_hnsw_idx'
  `)) as unknown as { rows: Array<{ indexname: string; indexdef: string }> };
  const rows = res.rows;

  if (rows.length !== 1) {
    console.error(`[FAIL] Expected 1 row for items_embedding_hnsw_idx, got ${rows.length}`);
    return false;
  }
  const def = rows[0].indexdef.toLowerCase();
  if (!def.includes('using hnsw')) {
    console.error(`[FAIL] Index is not HNSW: ${rows[0].indexdef}`);
    return false;
  }
  if (!def.includes('embedding')) {
    console.error(`[FAIL] Index does not cover embedding column: ${rows[0].indexdef}`);
    return false;
  }

  const sres = (await db.execute(sql`
    SELECT key, value FROM settings WHERE key = 'cluster_threshold'
  `)) as unknown as { rows: Array<{ key: string; value: string }> };
  if (sres.rows.length !== 1 || sres.rows[0].value !== '0.82') {
    console.error(`[FAIL] settings.cluster_threshold not seeded: ${JSON.stringify(sres.rows)}`);
    return false;
  }

  console.log('[PASS] items_embedding_hnsw_idx (HNSW) + settings.cluster_threshold=0.82');
  return true;
}

main()
  .then((ok) => {
    process.exit(ok ? 0 : 1);
  })
  .catch((e) => {
    console.error('check:hnsw FAILED:', e);
    process.exit(1);
  });
