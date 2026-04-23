#!/usr/bin/env tsx
/**
 * Phase 6 Plan 06-01 — admin + ops schema migration applier.
 *
 * Reads drizzle/0005_admin_ops.sql and executes against the live Neon dev branch
 * via the project's Drizzle/Neon client. Non-TTY safe (mirrors the 05-01
 * apply-0004-auth.ts precedent established when drizzle-kit push was blocked
 * by interactive prompts AND proposed to drop the Plan 03-01 HNSW index).
 *
 * Usage: pnpm db:apply:0005
 *
 * Idempotent — uses ADD COLUMN IF NOT EXISTS + DO $$ IF NOT EXISTS constraint
 * block so re-runs are safe. After apply, runs post-migration verification
 * checks asserting the four new columns + FK constraint are present.
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/client';

const MIGRATION_PATH = resolve(__dirname, '..', 'drizzle', '0005_admin_ops.sql');

/**
 * Split SQL on top-level statement boundaries, preserving DO $$ ... END$$ blocks
 * as single statements. The 0004 applier used a simple `/;\s*$/m` split which
 * would incorrectly fragment the DO block in 0005. This splitter tracks dollar-
 * quote depth to keep the DO block whole.
 */
function splitStatements(source: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  const lines = source.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip pure comment / blank lines only when outside a block and buffer empty
    if (!inDollar && buf.trim() === '' && (trimmed === '' || trimmed.startsWith('--'))) {
      continue;
    }

    buf += line + '\n';

    // Toggle dollar-quote depth on $$ occurrences (pairs).
    const dollarCount = (line.match(/\$\$/g) || []).length;
    if (dollarCount % 2 === 1) {
      inDollar = !inDollar;
    }

    // Statement terminator at end of line, outside dollar-quote block.
    if (!inDollar && /;\s*$/.test(line)) {
      const stmt = buf.trim();
      if (stmt.length > 0) {
        out.push(stmt);
      }
      buf = '';
    }
  }

  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

async function apply(): Promise<void> {
  const source = readFileSync(MIGRATION_PATH, 'utf8');
  const statements = splitStatements(source);

  console.log(`[apply] ${statements.length} statements to execute from ${MIGRATION_PATH}`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 90);
    console.log(`[apply]   [${i + 1}/${statements.length}] ${preview}...`);
    await db.execute(sql.raw(stmt));
  }
  console.log('[apply] all statements executed');
}

interface VerifyResult {
  name: string;
  passed: boolean;
  detail: string;
}

async function verify(): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];

  // 1. sources.deleted_at is timestamptz
  const r1 = (await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'deleted_at'
  `)) as unknown as { rows: Array<{ column_name: string; data_type: string }> };
  results.push({
    name: 'sources.deleted_at timestamptz',
    passed: r1.rows.length === 1 && r1.rows[0].data_type === 'timestamp with time zone',
    detail: JSON.stringify(r1.rows),
  });

  // 2. sources.category is text
  const r2 = (await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'category'
  `)) as unknown as { rows: Array<{ column_name: string; data_type: string }> };
  results.push({
    name: 'sources.category text',
    passed: r2.rows.length === 1 && r2.rows[0].data_type === 'text',
    detail: JSON.stringify(r2.rows),
  });

  // 3. users.banned_at is timestamptz
  const r3 = (await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'banned_at'
  `)) as unknown as { rows: Array<{ column_name: string; data_type: string }> };
  results.push({
    name: 'users.banned_at timestamptz',
    passed: r3.rows.length === 1 && r3.rows[0].data_type === 'timestamp with time zone',
    detail: JSON.stringify(r3.rows),
  });

  // 4. users.banned_by is uuid
  const r4 = (await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'banned_by'
  `)) as unknown as { rows: Array<{ column_name: string; data_type: string }> };
  results.push({
    name: 'users.banned_by uuid',
    passed: r4.rows.length === 1 && r4.rows[0].data_type === 'uuid',
    detail: JSON.stringify(r4.rows),
  });

  // 5. users_banned_by_fk exists and is SET NULL on delete
  const r5 = (await db.execute(sql`
    SELECT conname, confdeltype FROM pg_constraint
    WHERE conname = 'users_banned_by_fk'
  `)) as unknown as { rows: Array<{ conname: string; confdeltype: string }> };
  // confdeltype: 'n' = SET NULL, 'c' = CASCADE, 'a' = NO ACTION, 'r' = RESTRICT, 'd' = SET DEFAULT
  results.push({
    name: 'users_banned_by_fk constraint with ON DELETE SET NULL',
    passed: r5.rows.length === 1 && r5.rows[0].confdeltype === 'n',
    detail: JSON.stringify(r5.rows),
  });

  // 6. sources_deleted_at_idx index exists
  const r6 = (await db.execute(sql`
    SELECT indexname FROM pg_indexes
    WHERE indexname = 'sources_deleted_at_idx'
  `)) as unknown as { rows: Array<{ indexname: string }> };
  results.push({
    name: 'sources_deleted_at_idx index exists',
    passed: r6.rows.length === 1,
    detail: JSON.stringify(r6.rows),
  });

  return results;
}

async function main(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set — refusing to run');
    return false;
  }

  await apply();
  const results = await verify();

  let allPassed = true;
  for (const r of results) {
    console.log(`[verify] ${r.passed ? 'PASS' : 'FAIL'} — ${r.name}: ${r.detail}`);
    if (!r.passed) allPassed = false;
  }

  console.log(allPassed ? '\n[result] ALL PASS' : '\n[result] FAIL');
  return allPassed;
}

main()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((err) => {
    console.error('[fatal]', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
