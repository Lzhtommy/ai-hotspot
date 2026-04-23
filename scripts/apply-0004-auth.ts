/**
 * One-shot migration runner for drizzle/0004_auth.sql — Phase 5 Plan 05-01 Task 3.
 *
 * drizzle-kit push is non-TTY-hostile and, when inspecting the divergence,
 * proposed to DROP the hand-authored HNSW index from Plan 03-01. To avoid that,
 * apply only the committed migration file via the project's Neon driver
 * (psql fallback equivalent; psql is not installed on this host).
 *
 * After apply, runs the 5 post-migration verification checks from 05-01 PLAN.md.
 *
 * Usage: pnpm tsx --env-file=.env.local scripts/apply-0004-auth.ts
 * Exits 0 on PASS (all checks green), 1 on FAIL.
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/client';

const MIGRATION_PATH = resolve(__dirname, '..', 'drizzle', '0004_auth.sql');

async function apply(): Promise<void> {
  const source = readFileSync(MIGRATION_PATH, 'utf8');

  // Split on `;` followed by whitespace/EOL — matches Phase 3's seed-sources style;
  // keep it simple since the migration has no $$ function bodies.
  const statements = source
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split('\n').every((l) => l.trim().startsWith('--')));

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

  // 1. accounts.userId is uuid
  const r1 = (await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'userId'
  `)) as unknown as { rows: Array<{ column_name: string; data_type: string }> };
  results.push({
    name: 'accounts.userId uuid',
    passed: r1.rows.length === 1 && r1.rows[0].data_type === 'uuid',
    detail: JSON.stringify(r1.rows),
  });

  // 2. sessions.sessionToken exists
  const r2 = (await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'sessionToken'
  `)) as unknown as { rows: Array<{ column_name: string; data_type: string }> };
  results.push({
    name: 'sessions.sessionToken exists',
    passed: r2.rows.length === 1 && r2.rows[0].data_type === 'text',
    detail: JSON.stringify(r2.rows),
  });

  // 3. verification_tokens.identifier exists
  const r3 = (await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'verification_tokens' AND column_name = 'identifier'
  `)) as unknown as { rows: Array<{ column_name: string }> };
  results.push({
    name: 'verification_tokens.identifier exists',
    passed: r3.rows.length === 1,
    detail: JSON.stringify(r3.rows),
  });

  // 4. users.email_verified timestamptz
  const r4 = (await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_verified'
  `)) as unknown as { rows: Array<{ column_name: string; data_type: string }> };
  results.push({
    name: 'users.email_verified timestamp with time zone',
    passed: r4.rows.length === 1 && r4.rows[0].data_type === 'timestamp with time zone',
    detail: JSON.stringify(r4.rows),
  });

  // 5. users.image text
  const r5 = (await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'image'
  `)) as unknown as { rows: Array<{ column_name: string; data_type: string }> };
  results.push({
    name: 'users.image text',
    passed: r5.rows.length === 1 && r5.rows[0].data_type === 'text',
    detail: JSON.stringify(r5.rows),
  });

  return results;
}

async function main(): Promise<boolean> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

  await apply();
  const results = await verify();

  let allPassed = true;
  for (const r of results) {
    console.log(`[verify] ${r.passed ? 'PASS' : 'FAIL'} — ${r.name}: ${r.detail}`);
    if (!r.passed) allPassed = false;
  }
  return allPassed;
}

main()
  .then((ok) => {
    console.log(ok ? '\n[result] ALL PASS' : '\n[result] FAIL');
    process.exit(ok ? 0 : 1);
  })
  .catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  });
