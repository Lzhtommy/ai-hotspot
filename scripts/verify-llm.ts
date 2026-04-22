/**
 * Phase 3 verification harness — runs the LLM pipeline end-to-end against
 * a live Neon dev branch + live Anthropic + live Voyage + live Langfuse,
 * asserts ROADMAP §Phase 3 Success Criteria #1-4 programmatically, and
 * prints a Langfuse trace URL for SC#5 human UAT.
 *
 * Run: `pnpm verify:llm`
 *
 * Exits 0 on PASS, 1 on any failure. Cleans up its own sentinel rows on exit.
 * NOT run by CI — requires live ANTHROPIC_API_KEY + VOYAGE_API_KEY + DATABASE_URL
 * + (optional) LANGFUSE_*.
 *
 * Cost: ~$0.01-0.02 per full run (2 real Haiku + 2 real Voyage + 1 malformed
 * fixture that never hits APIs).
 *
 * Pattern source: scripts/verify-ingest.ts (Phase 2 template).
 * DO NOT call process.exit() inside main() — bypasses finally, leaks sentinels.
 * See: verify-ingest.ts:373-376 (critical lesson).
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../src/lib/db/client';
import { items, sources, pipelineRuns, clusters } from '../src/lib/db/schema';
import { runProcessItem } from '../src/lib/llm/process-item-core';
import { runRefreshClusters } from '../src/lib/cluster/refresh';
import { urlFingerprint, contentHash } from '../src/lib/ingest/fingerprint';

const SENTINEL_PREFIX = '__verify_llm__';
const SOURCE_A_ROUTE = `/${SENTINEL_PREFIX}/source-a`;
const SOURCE_B_ROUTE = `/${SENTINEL_PREFIX}/source-b`;
const SOURCE_MAL_ROUTE = `/${SENTINEL_PREFIX}/malformed`;

type CriterionResult = { name: string; pass: boolean; detail: string };
const results: CriterionResult[] = [];
function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
}

async function insertSentinelSource(
  name: string,
  route: string,
  lang: 'en' | 'zh',
): Promise<number> {
  await db
    .insert(sources)
    .values({ name, rssUrl: route, language: lang, weight: '0.1' })
    .onConflictDoNothing({ target: sources.rssUrl });
  const found = await db.select({ id: sources.id }).from(sources).where(eq(sources.rssUrl, route));
  if (!found[0]) throw new Error(`failed to insert sentinel source ${route}`);
  return found[0].id;
}

async function insertSentinelItem(params: {
  sourceId: number;
  urlPath: string;
  title: string;
  bodyRaw: string;
  publishedAt: Date;
}): Promise<bigint> {
  const url = `https://example.com${params.urlPath}?sentinel=${Date.now()}-${Math.random()}`;
  const fp = urlFingerprint(url);
  const ch = contentHash(url, params.title);
  const inserted = await db
    .insert(items)
    .values({
      sourceId: params.sourceId,
      url,
      urlFingerprint: fp,
      contentHash: ch,
      title: params.title,
      bodyRaw: params.bodyRaw,
      publishedAt: params.publishedAt,
      status: 'pending',
      retryCount: 0,
    })
    .returning({ id: items.id });
  if (inserted.length === 0) throw new Error('failed to insert sentinel item');
  return inserted[0].id;
}

async function cleanup(sentinelSourceIds: number[]) {
  if (sentinelSourceIds.length === 0) return;
  // Delete pipeline_runs linked to sentinel items
  await db.execute(sql`
    DELETE FROM pipeline_runs
    WHERE item_id IN (
      SELECT id FROM items WHERE source_id IN (${sql.join(
        sentinelSourceIds.map((i) => sql`${i}`),
        sql`, `,
      )})
    )
  `);
  // Collect cluster IDs before deleting items
  const clusterRows = await db
    .select({ cid: items.clusterId })
    .from(items)
    .where(inArray(items.sourceId, sentinelSourceIds));
  const clusterIds = Array.from(
    new Set(clusterRows.map((r) => r.cid).filter((c): c is bigint => c !== null)),
  );
  // Delete sentinel items
  await db.delete(items).where(inArray(items.sourceId, sentinelSourceIds));
  // Delete orphaned clusters that were solely composed of sentinel items
  if (clusterIds.length > 0) {
    await db.delete(clusters).where(inArray(clusters.id, clusterIds));
  }
  // Delete sentinel sources
  await db.delete(sources).where(inArray(sources.id, sentinelSourceIds));
}

async function main(): Promise<boolean> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  if (!process.env.VOYAGE_API_KEY) throw new Error('VOYAGE_API_KEY not set');

  console.log('== Pre-flight ==');
  const sourceAId = await insertSentinelSource('Sentinel A (verify-llm)', SOURCE_A_ROUTE, 'en');
  const sourceBId = await insertSentinelSource('Sentinel B (verify-llm)', SOURCE_B_ROUTE, 'en');
  const sourceMalId = await insertSentinelSource(
    'Sentinel Malformed (verify-llm)',
    SOURCE_MAL_ROUTE,
    'en',
  );
  const sentinelSourceIds = [sourceAId, sourceBId, sourceMalId];
  console.log(`Sentinel sources inserted: A=${sourceAId}, B=${sourceBId}, Mal=${sourceMalId}`);

  try {
    const nowUtc = new Date();
    // Shared-event body: two items reporting the same announcement — SC#4 expects them to cluster.
    // Body must be >= 500 chars so extractFullText uses bodyRaw directly (skips SSRF fetch).
    const sharedEventBody = `
Anthropic today announced Claude Sonnet 4.6, the latest model in the Claude 4 family.
The model introduces structured output enforcement, a 1M-token context window, and
improved reasoning for agentic workflows. Claude Sonnet 4.6 is available today via the
Claude API at $3 per million input tokens and $15 per million output tokens. The model
scores 72% on SWE-bench Verified and 48% on the GPQA Diamond benchmark.
Early-access partners including Cursor, Zed, and Replit report substantial improvements
in multi-turn tool use and code-generation consistency. The model supports prompt caching
with 5-minute and 1-hour TTLs, and is cross-compatible with the tool-use and
structured-output APIs released earlier in 2025.
    `.trim();
    const variantB = sharedEventBody
      .replace('Anthropic today announced', 'Anthropic has unveiled')
      .replace('the latest model', 'their newest model');

    // Sentinel A — source A, English, shared-event body, slightly earlier timestamp
    const itemAId = await insertSentinelItem({
      sourceId: sourceAId,
      urlPath: '/anthropic-sonnet-4-6-a',
      title: 'Anthropic Launches Claude Sonnet 4.6',
      bodyRaw: sharedEventBody,
      publishedAt: new Date(nowUtc.getTime() - 60_000),
    });
    console.log(`Sentinel A item inserted: id=${itemAId}`);

    // Sentinel B — source B, English, same event different wording, slightly later timestamp
    const itemBId = await insertSentinelItem({
      sourceId: sourceBId,
      urlPath: '/anthropic-sonnet-4-6-b',
      title: 'Claude 4.6 Unveiled by Anthropic',
      bodyRaw: variantB,
      publishedAt: nowUtc,
    });
    console.log(`Sentinel B item inserted: id=${itemBId}`);

    // Sentinel Malformed — SC#3: inject a broken enrich dep (no real API cost)
    const malformedItemBody = 'A short article about AI stuff. Just some test content.';
    const itemMalId = await insertSentinelItem({
      sourceId: sourceMalId,
      urlPath: '/malformed-test',
      title: 'Malformed Fixture',
      bodyRaw: malformedItemBody.padEnd(600, ' filler'), // >=500 chars to skip extract fetch
      publishedAt: nowUtc,
    });
    console.log(`Sentinel Malformed item inserted: id=${itemMalId}`);

    // ========================================================================
    // RUN PIPELINE — SC#1 (enrichment) + SC#2 (cache) via real API calls
    // ========================================================================
    console.log('\n== Run: Sentinel A (first item, populates Haiku prompt cache) ==');
    const resA = await runProcessItem({ itemId: itemAId });
    console.log(`  result: ${JSON.stringify(resA)}`);

    console.log('\n== Run: Sentinel B (second item, should hit cache_read_tokens > 0) ==');
    const resB = await runProcessItem({ itemId: itemBId });
    console.log(`  result: ${JSON.stringify(resB)}`);

    // ========================================================================
    // SC#3 malformed fixture — inject a broken enrichWithClaude dep that throws
    // a ZodError. This triggers the TERMINAL error path in process-item-core.ts
    // (ZodError → isTerminal=true → status='dead_letter'). No real API cost.
    // ========================================================================
    console.log('\n== Run: Sentinel Malformed (expected dead_letter via DI ZodError) ==');
    const resMal = await runProcessItem({
      itemId: itemMalId,
      deps: {
        // Throw a ZodError so process-item-core classifies it as terminal → dead_letter.
        // We import ZodError from 'zod/v4' to match the catch clause in process-item-core.ts.
        enrichWithClaude: async () => {
          const { ZodError } = await import('zod/v4');
          throw new ZodError([
            { code: 'custom', path: ['score'], message: 'sentinel-malformed-injected' } as never,
          ]);
        },
      },
    });
    console.log(`  result: ${JSON.stringify(resMal)}`);

    // ========================================================================
    // RUN REFRESH-CLUSTERS — required for SC#4 member_count assertion
    // ========================================================================
    console.log('\n== Run: runRefreshClusters ==');
    const refResult = await runRefreshClusters();
    console.log(`  updated: ${refResult.updated}`);

    // ========================================================================
    // ASSERTIONS
    // ========================================================================
    console.log('\n== Assertions ==');

    // ---------- SC#1: enrichment fields populated on Sentinel A ----------
    const aRow = await db.select().from(items).where(eq(items.id, itemAId));
    const a = aRow[0];
    const sc1Ok =
      a?.status === 'published' &&
      !!a.titleZh &&
      a.titleZh.length > 0 &&
      !!a.summaryZh &&
      a.summaryZh.length > 0 &&
      typeof a.score === 'number' &&
      a.score >= 0 &&
      a.score <= 100 &&
      !!a.recommendation &&
      a.recommendation.length > 0 &&
      Array.isArray(a.tags) &&
      (a.tags?.length ?? 0) >= 1;
    record(
      'SC#1 enrichment fields populated',
      sc1Ok,
      `status=${a?.status}, title_zh_len=${a?.titleZh?.length ?? 0}, score=${a?.score}, tags=${JSON.stringify(a?.tags)}`,
    );

    // ---------- SC#2: cache_read_tokens > 0 on at least one enrich run ----------
    const cacheRes = (await db.execute(sql`
      SELECT MAX(cache_read_tokens)::int AS max_cache
      FROM pipeline_runs
      WHERE item_id IN (${itemAId}, ${itemBId})
        AND task = 'enrich'
    `)) as unknown as { rows: Array<{ max_cache: number | null }> };
    const maxCache = cacheRes.rows[0]?.max_cache ?? 0;
    record(
      'SC#2 prompt caching active',
      (maxCache ?? 0) > 0,
      `MAX(cache_read_tokens)=${maxCache} across sentinel A+B enrich runs`,
    );

    // ---------- SC#3: malformed → dead_letter ----------
    const malRow = await db.select().from(items).where(eq(items.id, itemMalId));
    const m = malRow[0];
    const sc3Ok = m?.status === 'dead_letter' && !!m?.failureReason;
    record(
      'SC#3 malformed → dead_letter (not published)',
      sc3Ok,
      `status=${m?.status}, failure_reason=${m?.failureReason}`,
    );

    // ---------- SC#4: two items from different sources cluster together ----------
    const aFresh = await db.select().from(items).where(eq(items.id, itemAId));
    const bFresh = await db.select().from(items).where(eq(items.id, itemBId));
    const sameCluster =
      aFresh[0]?.clusterId !== null &&
      bFresh[0]?.clusterId !== null &&
      String(aFresh[0]?.clusterId) === String(bFresh[0]?.clusterId);
    let sc4Ok = sameCluster;
    let sc4Detail = `A.cluster_id=${aFresh[0]?.clusterId}, B.cluster_id=${bFresh[0]?.clusterId}`;
    if (sameCluster && aFresh[0]?.clusterId) {
      const clusterRow = await db
        .select()
        .from(clusters)
        .where(eq(clusters.id, aFresh[0].clusterId!));
      const memberCount = clusterRow[0]?.memberCount ?? 0;
      // A was inserted with earlier publishedAt — runRefreshClusters should elect A as primary.
      const primaryOk =
        clusterRow[0]?.primaryItemId !== null &&
        String(clusterRow[0]?.primaryItemId) === String(itemAId);
      sc4Ok = sc4Ok && memberCount >= 2 && primaryOk;
      sc4Detail += `, member_count=${memberCount}, primary=${clusterRow[0]?.primaryItemId} (expected ${itemAId}), primaryOk=${primaryOk}`;
    } else if (!sameCluster) {
      sc4Detail +=
        ' — items NOT in same cluster. Possible causes: cosine<threshold (tune cluster_threshold) or HNSW index missing (run pnpm check:hnsw).';
    }
    record('SC#4 cross-source clustering', sc4Ok, sc4Detail);

    // ---------- SC#5: Langfuse trace presence (manual UAT) ----------
    const langfuseBase = process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com';
    console.log('\n== SC#5 (MANUAL UAT) ==');
    console.log(`  Open Langfuse dashboard: ${langfuseBase}`);
    console.log(`  Navigate to Traces → filter by the last 10 minutes.`);
    console.log(`  Expected: >=2 traces for sentinel items A (${itemAId}) and B (${itemBId}).`);
    console.log(`  Each trace must show: input_tokens > 0, estimated cost > 0.`);
    console.log(
      `  Second trace (item B) must show cache_read_input_tokens > 0 (SC#2 corroboration).`,
    );
    console.log(`  Record the result in .planning/phases/03-llm-pipeline-clustering/03-UAT.md.`);

    // Final summary — DO NOT call process.exit() here.
    // process.exit inside a try block bypasses the finally block in Node's async runtime,
    // leaking sentinel rows in the database. Return a boolean; the .then() tail handles exit.
    // See: scripts/verify-ingest.ts:373-376 (critical lesson).
    console.log('\n== Summary (SC#1-4 auto; SC#5 manual) ==');
    const failed = results.filter((r) => !r.pass);
    for (const r of results) console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (failed.length > 0) {
      console.error(
        `\n${failed.length}/${results.length} automated criteria FAILED. SC#5 still requires manual Langfuse UAT.`,
      );
    } else {
      console.log(
        `\nAll ${results.length} automated criteria PASSED. SC#5 requires manual Langfuse UAT (see above).`,
      );
    }
    return failed.length === 0;
  } finally {
    // Cleanup runs regardless of assertion outcome — mirrors verify-ingest.ts:386-390.
    console.log('\n== Cleanup ==');
    await cleanup(sentinelSourceIds);
    console.log(
      `Removed sentinel sources [${sentinelSourceIds.join(', ')}] + their items + pipeline_runs + clusters.`,
    );
  }
}

main()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((e) => {
    console.error('VERIFY FAILED:', e);
    process.exit(1);
  });
