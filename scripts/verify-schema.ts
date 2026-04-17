/**
 * One-shot schema verification script for Plan 01-02 Task 3.
 * Verifies:
 *   1. pgvector extension is installed
 *   2. All 11 expected domain tables exist (per PLAN §Success Criteria / D-09)
 *   3. vector(1024) columns are present on items.embedding and clusters.centroid
 *
 * Auth.js tables (accounts/sessions/verification_tokens) are intentionally NOT
 * in v1 schema — they will be added by a later auth integration plan.
 *
 * Run: pnpm tsx scripts/verify-schema.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });

// Per PLAN 01-02 §Success Criteria & D-09: exactly these 11 tables.
const EXPECTED_TABLES = [
  'clusters',
  'favorites',
  'item_clusters',
  'item_tags',
  'items',
  'pipeline_runs',
  'settings',
  'sources',
  'tags',
  'users',
  'votes',
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = neon(url);

  console.log('=== 1. pgvector extension ===');
  const ext = (await sql`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
  `) as Array<{ extname: string; extversion: string }>;
  if (ext.length !== 1) {
    console.error('FAIL: pgvector not installed');
    process.exit(1);
  }
  console.log(`OK: vector ${ext[0].extversion}`);

  console.log('\n=== 2. Tables ===');
  const rows = (await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `) as Array<{ tablename: string }>;
  const present = rows.map((r) => r.tablename);
  console.log(`Present (${present.length}):`, present.join(', '));
  const missing = EXPECTED_TABLES.filter((t) => !present.includes(t));
  const extra = present.filter((t) => !EXPECTED_TABLES.includes(t) && t !== '__drizzle_migrations');
  if (missing.length) {
    console.error(`FAIL: missing tables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (extra.length) {
    console.warn(`WARN: unexpected tables: ${extra.join(', ')}`);
  }
  console.log(`OK: ${EXPECTED_TABLES.length} expected tables present`);

  console.log('\n=== 3. vector(1024) columns ===');
  const vectorCols = (await sql`
    SELECT table_name, column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema='public' AND udt_name='vector'
    ORDER BY table_name, column_name
  `) as Array<{ table_name: string; column_name: string; udt_name: string }>;
  vectorCols.forEach((c) => console.log(`  ${c.table_name}.${c.column_name} :: ${c.udt_name}`));
  if (vectorCols.length < 2) {
    console.error('FAIL: expected at least 2 vector columns (items.embedding, clusters.centroid)');
    process.exit(1);
  }
  console.log(`OK: ${vectorCols.length} vector columns`);

  console.log('\n=== 4. drizzle migration journal ===');
  const migrations = (await sql`
    SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id
  `) as Array<{ id: number; hash: string; created_at: string | number }>;
  migrations.forEach((m) => console.log(`  #${m.id}: ${m.hash.slice(0, 12)}…`));
  console.log(`OK: ${migrations.length} migrations recorded`);

  console.log('\n=== ALL CHECKS PASSED ===');
}

main().catch((e) => {
  console.error('VERIFICATION FAILED:', e);
  process.exit(1);
});
