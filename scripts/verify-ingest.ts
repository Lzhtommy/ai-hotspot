/**
 * Phase 2 verification harness — exercises the ingestion pipeline end-to-end
 * against a live Neon dev branch + live RSSHub and asserts all 4 Phase 2
 * success criteria from ROADMAP.md.
 *
 * Run: `pnpm verify:ingest`
 *
 * Exits 0 on PASS, 1 on any failure. Cleans up its own sentinel source on exit.
 *
 * NOT run by CI — requires live RSSHub reachability + live Neon dev branch.
 *
 * Success criteria asserted:
 *   SC#1 idempotency        — two consecutive runs produce zero new items on Run 2;
 *                             no duplicate url_fingerprints in the items table
 *   SC#2 source isolation   — a broken sentinel source does not prevent siblings
 *                             from being polled and inserting items
 *   SC#3 counter accuracy   — D-08 counter semantics verified at TWO snapshots
 *                             (post-Run-1 AND post-Run-2) — both success branches
 *                             (newCount>=1 vs zero-new) and the error branch
 *   SC#4 utc storage        — items.published_at is TIMESTAMPTZ; source-tz
 *                             is preserved separately in published_at_source_tz
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../src/lib/db/client';
import { items, sources } from '../src/lib/db/schema';
import { runFetchSource } from '../src/lib/ingest/fetch-source-core';

const BROKEN_ROUTE = '/__verify_ingest_broken_sentinel__';
const BROKEN_NAME = 'BROKEN (verify-ingest sentinel)';

type CriterionResult = { name: string; pass: boolean; detail: string };

const results: CriterionResult[] = [];

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
}

async function insertBrokenSentinel(): Promise<number> {
  await db
    .insert(sources)
    .values({ name: BROKEN_NAME, rssUrl: BROKEN_ROUTE, language: 'en', weight: '0.1' })
    .onConflictDoNothing({ target: sources.rssUrl });
  const found = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.rssUrl, BROKEN_ROUTE));
  if (!found[0]) throw new Error('failed to insert broken sentinel');
  return found[0].id;
}

async function cleanup(brokenId: number) {
  await db.delete(items).where(eq(items.sourceId, brokenId));
  await db.delete(sources).where(eq(sources.id, brokenId));
}

async function enumerateActive() {
  return db
    .select({ id: sources.id, rssUrl: sources.rssUrl, name: sources.name })
    .from(sources)
    .where(eq(sources.isActive, true));
}

async function snapshotSources(activeIds: number[]) {
  return db
    .select({
      id: sources.id,
      lastFetchedAt: sources.lastFetchedAt,
      consecutiveEmptyCount: sources.consecutiveEmptyCount,
      consecutiveErrorCount: sources.consecutiveErrorCount,
      name: sources.name,
    })
    .from(sources)
    .where(inArray(sources.id, activeIds));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

  console.log('== Pre-flight ==');
  const preActive = await enumerateActive();
  if (preActive.length < 3) {
    throw new Error(
      `Expected >=3 active sources (run pnpm db:seed first). Found ${preActive.length}.`,
    );
  }
  console.log(`Pre-flight OK: ${preActive.length} active sources.`);

  // Insert broken sentinel
  const brokenId = await insertBrokenSentinel();
  console.log(`Broken sentinel source id=${brokenId}`);

  try {
    const active = await enumerateActive();
    const activeIds = active.map((s) => s.id);

    console.log('\n== Run 1 ==');
    const run1Results: Array<{
      sourceId: number;
      status: 'ok' | 'error';
      newCount: number;
      seenCount: number;
      errorKind?: string;
      name: string;
    }> = [];
    for (const s of active) {
      const r = await runFetchSource({ sourceId: s.id, rssUrl: s.rssUrl });
      console.log(
        `  [${r.status}] source=${s.name} new=${r.newCount} seen=${r.seenCount}${r.errorKind ? ' err=' + r.errorKind : ''}`,
      );
      run1Results.push({ ...r, name: s.name });
    }
    const n1Row = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM items`)) as unknown as {
      rows: Array<{ n: number }>;
    };
    const N1 = n1Row.rows[0].n;
    console.log(`Items after Run 1: ${N1}`);

    // Snapshot BETWEEN runs — captures post-Run-1 state for SC#3 D-08 semantics.
    const sourcesAfterRun1 = await snapshotSources(activeIds);

    console.log('\n== Run 2 (idempotency check) ==');
    const run2Results: Array<{
      sourceId: number;
      status: 'ok' | 'error';
      newCount: number;
      seenCount: number;
      errorKind?: string;
      name: string;
    }> = [];
    for (const s of active) {
      const r = await runFetchSource({ sourceId: s.id, rssUrl: s.rssUrl });
      console.log(
        `  [${r.status}] source=${s.name} new=${r.newCount} seen=${r.seenCount}${r.errorKind ? ' err=' + r.errorKind : ''}`,
      );
      run2Results.push({ ...r, name: s.name });
    }
    const n2Row = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM items`)) as unknown as {
      rows: Array<{ n: number }>;
    };
    const N2 = n2Row.rows[0].n;
    console.log(`Items after Run 2: ${N2}`);

    const sourcesAfterRun2 = await snapshotSources(activeIds);

    console.log('\n== Assertions ==');

    // Criterion #1: idempotency — N2 must equal N1; zero duplicate fingerprints.
    const dupRow = (await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM (
        SELECT url_fingerprint FROM items GROUP BY url_fingerprint HAVING COUNT(*) > 1
      ) q
    `)) as unknown as { rows: Array<{ n: number }> };
    const dupCount = dupRow.rows[0].n;
    record(
      'SC#1 idempotency',
      N2 === N1 && dupCount === 0,
      `N1=${N1}, N2=${N2}, dup-fingerprint-groups=${dupCount}`,
    );

    // Criterion #2: source isolation — broken sentinel has an error after Run 1;
    // at least one other source succeeded in Run 1.
    const brokenAfterRun1 = sourcesAfterRun1.find((s) => s.id === brokenId);
    const okCount = run1Results.filter((r) => r.status === 'ok' && r.sourceId !== brokenId).length;
    record(
      'SC#2 source isolation',
      (brokenAfterRun1?.consecutiveErrorCount ?? 0) >= 1 && okCount >= 1,
      `broken.err_count_after_run1=${brokenAfterRun1?.consecutiveErrorCount}, ok_non_broken=${okCount}/${active.length - 1}`,
    );

    // Criterion #3: D-08 counter semantics across BOTH runs.
    let sc3Ok = true;
    const sc3Detail: string[] = [];

    const r1ById = new Map(run1Results.map((r) => [r.sourceId, r]));
    const snap1ById = new Map(sourcesAfterRun1.map((s) => [s.id, s]));
    const snap2ById = new Map(sourcesAfterRun2.map((s) => [s.id, s]));

    // --- Post-Run-1 checks ---
    {
      const b = snap1ById.get(brokenId);
      if (!b) {
        sc3Ok = false;
        sc3Detail.push('post-run1: broken source row missing');
      } else {
        if (b.lastFetchedAt !== null) {
          sc3Ok = false;
          sc3Detail.push(
            `post-run1 broken.last_fetched_at must be null on error, got ${b.lastFetchedAt}`,
          );
        }
        if (b.consecutiveEmptyCount !== 0) {
          sc3Ok = false;
          sc3Detail.push(`post-run1 broken.empty_count must be 0, got ${b.consecutiveEmptyCount}`);
        }
        if (b.consecutiveErrorCount < 1) {
          sc3Ok = false;
          sc3Detail.push(
            `post-run1 broken.error_count must be >=1, got ${b.consecutiveErrorCount}`,
          );
        }
      }

      for (const r of run1Results) {
        if (r.sourceId === brokenId) continue;
        const snap = snap1ById.get(r.sourceId);
        if (!snap) {
          sc3Ok = false;
          sc3Detail.push(`post-run1 snapshot missing for ${r.name}`);
          continue;
        }
        if (r.status !== 'ok') continue;
        if (snap.lastFetchedAt === null) {
          sc3Ok = false;
          sc3Detail.push(`post-run1 ${r.name}.last_fetched_at should be set after success`);
        }
        if (snap.consecutiveErrorCount !== 0) {
          sc3Ok = false;
          sc3Detail.push(
            `post-run1 ${r.name}.error_count should be 0 after success, got ${snap.consecutiveErrorCount}`,
          );
        }
        if (r.newCount >= 1) {
          if (snap.consecutiveEmptyCount !== 0) {
            sc3Ok = false;
            sc3Detail.push(
              `post-run1 ${r.name}.empty_count should be 0 (>=1 new branch), got ${snap.consecutiveEmptyCount}`,
            );
          }
        } else {
          if (snap.consecutiveEmptyCount < 1) {
            sc3Ok = false;
            sc3Detail.push(
              `post-run1 ${r.name}.empty_count should be >=1 (zero-new branch), got ${snap.consecutiveEmptyCount}`,
            );
          }
        }
      }
    }

    // --- Post-Run-2 checks ---
    {
      const b = snap2ById.get(brokenId);
      if (!b) {
        sc3Ok = false;
        sc3Detail.push('post-run2: broken source row missing');
      } else {
        if (b.lastFetchedAt !== null) {
          sc3Ok = false;
          sc3Detail.push(
            `post-run2 broken.last_fetched_at must still be null, got ${b.lastFetchedAt}`,
          );
        }
        if (b.consecutiveEmptyCount !== 0) {
          sc3Ok = false;
          sc3Detail.push(
            `post-run2 broken.empty_count must still be 0, got ${b.consecutiveEmptyCount}`,
          );
        }
        if (b.consecutiveErrorCount < 2) {
          sc3Ok = false;
          sc3Detail.push(
            `post-run2 broken.error_count must be >=2 (two failed runs), got ${b.consecutiveErrorCount}`,
          );
        }
      }

      for (const r2 of run2Results) {
        if (r2.sourceId === brokenId) continue;
        const r1 = r1ById.get(r2.sourceId);
        const snap1 = snap1ById.get(r2.sourceId);
        const snap2 = snap2ById.get(r2.sourceId);
        if (!r1 || !snap1 || !snap2) {
          sc3Ok = false;
          sc3Detail.push(`post-run2 snapshot missing for ${r2.name}`);
          continue;
        }
        if (r2.status !== 'ok') continue;
        if (snap2.consecutiveErrorCount !== 0) {
          sc3Ok = false;
          sc3Detail.push(
            `post-run2 ${r2.name}.error_count should be 0, got ${snap2.consecutiveErrorCount}`,
          );
        }
        if (snap2.lastFetchedAt === null) {
          sc3Ok = false;
          sc3Detail.push(`post-run2 ${r2.name}.last_fetched_at should be set`);
        }
        // advancement: post-run2 last_fetched_at should be strictly > post-run1
        if (
          snap1.lastFetchedAt &&
          snap2.lastFetchedAt &&
          !(new Date(snap2.lastFetchedAt).getTime() > new Date(snap1.lastFetchedAt).getTime())
        ) {
          sc3Ok = false;
          sc3Detail.push(
            `post-run2 ${r2.name}.last_fetched_at did not advance (run1=${snap1.lastFetchedAt}, run2=${snap2.lastFetchedAt})`,
          );
        }
        // empty_count semantics: if Run 1 had new items (>=1), Run 2 finds zero (all dedup'd) → empty_count should be exactly 1.
        // If Run 1 already had zero new (already populated branch), Run 2 also zero → empty_count should be >=2.
        if (r1.newCount >= 1) {
          if (snap2.consecutiveEmptyCount !== 1) {
            sc3Ok = false;
            sc3Detail.push(
              `post-run2 ${r2.name}.empty_count should be 1 (run1 had new items, run2 zero new), got ${snap2.consecutiveEmptyCount}`,
            );
          }
        } else {
          if (snap2.consecutiveEmptyCount < 2) {
            sc3Ok = false;
            sc3Detail.push(
              `post-run2 ${r2.name}.empty_count should be >=2 (both runs zero-new), got ${snap2.consecutiveEmptyCount}`,
            );
          }
        }
      }
    }

    record(
      'SC#3 counter accuracy',
      sc3Ok,
      sc3Detail.length === 0
        ? 'all D-08 counters match expected post-Run-1 and post-Run-2 states'
        : sc3Detail.join('; '),
    );

    // Criterion #4: UTC storage + source_tz preservation.
    const tzRes = (await db.execute(sql`
      SELECT published_at, published_at_source_tz
      FROM items
      WHERE published_at_source_tz IS NOT NULL
      LIMIT 5
    `)) as unknown as { rows: Array<{ published_at: string; published_at_source_tz: string }> };
    const tzRows = tzRes.rows;

    let sc4Ok = true;
    const sc4Detail: string[] = [];
    if (tzRows.length === 0) {
      sc4Detail.push('no items with non-null published_at_source_tz yet — schema check only');
    } else {
      for (const row of tzRows) {
        const utcMs = new Date(row.published_at).getTime();
        const srcTzMs = new Date(row.published_at_source_tz).getTime();
        const deltaMs = Math.abs(utcMs - srcTzMs);
        if (deltaMs > 1000) {
          sc4Ok = false;
          sc4Detail.push(
            `utc=${row.published_at} vs source_tz=${row.published_at_source_tz} delta=${deltaMs}ms`,
          );
        }
      }
      if (sc4Ok) sc4Detail.push(`${tzRows.length} rows checked, all match within 1s`);
    }
    // Column existence sanity — always checked.
    const colRes = (await db.execute(sql`
      SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'items' AND column_name = 'published_at_source_tz'
    `)) as unknown as { rows: Array<{ data_type: string; is_nullable: string }> };
    const colRow = colRes.rows;
    if (colRow.length !== 1 || colRow[0].data_type !== 'text' || colRow[0].is_nullable !== 'YES') {
      sc4Ok = false;
      sc4Detail.push(`column shape incorrect: ${JSON.stringify(colRow)}`);
    }
    record('SC#4 utc storage + source_tz', sc4Ok, sc4Detail.join('; '));

    // Final summary
    console.log('\n== Summary ==');
    const failed = results.filter((r) => !r.pass);
    for (const r of results) console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (failed.length > 0) {
      console.error(`\n${failed.length}/${results.length} criteria FAILED.`);
      process.exit(1);
    }
    console.log(`\nAll ${results.length} criteria PASSED.`);
  } finally {
    console.log('\n== Cleanup ==');
    await cleanup(brokenId);
    console.log(`Removed broken sentinel source id=${brokenId} and its items.`);
  }
}

main().catch((e) => {
  console.error('VERIFY FAILED:', e);
  process.exit(1);
});
