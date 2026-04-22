/**
 * Core LLM-pipeline orchestrator — Phase 3 LLM-02, LLM-03..07, LLM-09, LLM-10,
 * LLM-11, LLM-12, CLUST-01.
 *
 * Given a pending items.id, this module:
 *   STEP A: load item row (title, bodyRaw, url, sourceId, source.language)
 *   STEP B: extractFullText(bodyRaw, url)  — LLM-02
 *   STEP C: enrichWithClaude(text, title, lang)  — LLM-03..07, LLM-09
 *   STEP D: zod validate (redundant; enrich.ts already parses)  — LLM-10
 *   STEP E: embedDocument(title_zh + '\n\n' + summary_zh)  — CLUST-01
 *   STEP F: joinOrCreateCluster(itemId, embedding, publishedAt)  — Plan 03 dep
 *   STEP G: one UPDATE items (set all enrichment fields, status='published')
 *           + two INSERT pipeline_runs (enrich + embed)  — LLM-12
 *
 * ERROR PATH (classification rules):
 *   TERMINAL (no retry, status='dead_letter'):
 *     - ZodError: schema enforcement failed — data is unfixable
 *     - EnrichError kind='parse': Anthropic returned malformed JSON — not retryable
 *     - EnrichError kind='schema': zod re-validation failed — not retryable
 *     - EmbedError with 'malformed' in message: Voyage returned wrong dimensions
 *     - retryCount >= MAX_RETRIES (3): retry budget exhausted regardless of error type
 *   RETRYABLE (rethrow → Trigger.dev retries the task):
 *     - EnrichError kind='api': Anthropic network/5xx/rate-limit — transient
 *     - EmbedError (non-malformed): Voyage network failure — transient
 *     - ClusterError: cluster insert/transaction failure — transient
 *     - Any other thrown error
 *
 *   Adding a new error kind: decide terminal vs retryable, add to the correct
 *   list above AND update the `isTerminal` predicate in the catch block below.
 *
 * Extracted so it is unit-testable without the Trigger.dev runtime. The
 * Trigger.dev task file (Plan 04 — src/trigger/process-item.ts) is a thin
 * adapter that calls runProcessItem and flushes OTel in finally{}.
 *
 * Consumed by:
 *   - src/trigger/process-item.ts  (Plan 04)
 *   - scripts/verify-llm.ts  (Plan 05)
 */
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod/v4';
import { db as realDb } from '@/lib/db/client';
import { items, sources, pipelineRuns } from '@/lib/db/schema';
import { extractFullText as realExtract } from './extract';
import { enrichWithClaude as realEnrich, EnrichError } from './enrich';
import { embedDocument as realEmbed, EmbedError } from './embed';
import { computeHaikuCostUsd, computeVoyageCostUsd } from './pricing';
import { joinOrCreateCluster as realJoinOrCreateCluster } from '@/lib/cluster/join-or-create';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const VOYAGE_MODEL = 'voyage-3.5';
const MAX_RETRIES = 3;

export interface ProcessItemDeps {
  db?: typeof realDb;
  extractFullText?: typeof realExtract;
  enrichWithClaude?: typeof realEnrich;
  embedDocument?: typeof realEmbed;
  joinOrCreateCluster?: (p: {
    itemId: bigint;
    embedding: number[];
    publishedAt: Date;
  }) => Promise<{ clusterId: bigint; joined: boolean }>;
  now?: () => Date;
}

export interface ProcessItemResult {
  itemId: string;
  status: 'published' | 'dead_letter';
  clusterId?: string;
  joinedExistingCluster?: boolean;
  failureReason?: string;
}

export async function runProcessItem(params: {
  itemId: bigint | string;
  deps?: ProcessItemDeps;
}): Promise<ProcessItemResult> {
  const db = params.deps?.db ?? realDb;
  const extractFn = params.deps?.extractFullText ?? realExtract;
  const enrichFn = params.deps?.enrichWithClaude ?? realEnrich;
  const embedFn = params.deps?.embedDocument ?? realEmbed;
  const joinFn = params.deps?.joinOrCreateCluster ?? ((p) => realJoinOrCreateCluster(p));
  const now = params.deps?.now ?? (() => new Date());
  const itemId = typeof params.itemId === 'string' ? BigInt(params.itemId) : params.itemId;

  // STEP A — load item + source language
  const loaded = await db
    .select({
      id: items.id,
      title: items.title,
      bodyRaw: items.bodyRaw,
      url: items.url,
      publishedAt: items.publishedAt,
      retryCount: items.retryCount,
      sourceLang: sources.language,
    })
    .from(items)
    .leftJoin(sources, eq(sources.id, items.sourceId))
    .where(eq(items.id, itemId));

  if (loaded.length === 0) {
    return { itemId: itemId.toString(), status: 'dead_letter', failureReason: 'item not found' };
  }
  const row = loaded[0];
  const retryCount = row.retryCount ?? 0;

  try {
    // STEP B — extract (never throws; returns fallback on any error)
    const { text } = await extractFn(row.bodyRaw ?? '', row.url);

    // STEP C — enrich
    const sourceLang = (row.sourceLang as 'zh' | 'en') ?? 'en';
    if (!row.sourceLang) {
      // leftJoin miss: source row deleted or item has no sourceId. Default to 'en'.
      // Log so orphaned items can be detected in Langfuse / Sentry.
      console.warn(
        `process-item: item ${itemId} has no source language (source missing?), defaulting to 'en'`,
      );
    }
    const enrichRes = await enrichFn({
      text,
      title: row.title,
      sourceLang,
    });

    // STEP D — validate happens inside enrich via EnrichmentSchema.parse — we trust enrichRes.enrichment here.
    const enrichment = enrichRes.enrichment;

    // STEP E — embed (title_zh + '\n\n' + summary_zh per RESEARCH.md Step 5)
    const embedInput = `${enrichment.title_zh}\n\n${enrichment.summary_zh}`;
    const embedStart = Date.now();
    const embedding = await embedFn(embedInput);
    const embedLatencyMs = Date.now() - embedStart;

    // STEP F — cluster assignment
    const { clusterId, joined } = await joinFn({
      itemId,
      embedding,
      publishedAt: row.publishedAt,
    });

    // STEP G — write final published state + two pipeline_runs rows
    await db
      .update(items)
      .set({
        titleZh: enrichment.title_zh,
        summaryZh: enrichment.summary_zh,
        recommendation: enrichment.recommendation,
        score: enrichment.score,
        tags: enrichment.tags,
        embedding: embedding,
        clusterId: clusterId,
        status: 'published',
        processedAt: now(),
      })
      .where(eq(items.id, itemId));

    // Enrich run — LLM-12
    await db.insert(pipelineRuns).values({
      itemId,
      model: HAIKU_MODEL,
      task: 'enrich',
      inputTokens: enrichRes.usage.input_tokens,
      outputTokens: enrichRes.usage.output_tokens,
      cacheReadTokens: enrichRes.usage.cache_read_input_tokens,
      cacheWriteTokens: enrichRes.usage.cache_creation_input_tokens,
      estimatedCostUsd: computeHaikuCostUsd(enrichRes.usage).toFixed(6),
      latencyMs: enrichRes.latencyMs,
      status: 'ok',
    });

    // Embed run — LLM-12 + CLUST-01
    await db.insert(pipelineRuns).values({
      itemId,
      model: VOYAGE_MODEL,
      task: 'embed',
      inputTokens: Math.ceil(embedInput.length / 4), // token estimate for cost
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      estimatedCostUsd: computeVoyageCostUsd(Math.ceil(embedInput.length / 4)).toFixed(6),
      latencyMs: embedLatencyMs,
      status: 'ok',
    });

    return {
      itemId: itemId.toString(),
      status: 'published',
      clusterId: clusterId.toString(),
      joinedExistingCluster: joined,
    };
  } catch (err) {
    const isTerminal =
      err instanceof ZodError ||
      (err instanceof EnrichError && (err.kind === 'parse' || err.kind === 'schema')) ||
      (err instanceof EmbedError && String(err.message).includes('malformed'));
    const retriesExhausted = retryCount >= MAX_RETRIES; // dead-letter after 3 retryable failures

    // Scrub: never persist err.message (may contain URLs with keys, headers) — use err.name only.
    const scrubbedReason = (err instanceof Error ? err.name : 'UnknownError').slice(0, 500);

    if (isTerminal || retriesExhausted) {
      // TERMINAL — status=dead_letter, increment retry_count, persist scrubbed reason.
      await db
        .update(items)
        .set({
          status: 'dead_letter',
          failureReason: scrubbedReason,
          retryCount: retryCount + 1,
          processedAt: now(),
        })
        .where(eq(items.id, itemId));
      // Error run — LLM-12
      await db.insert(pipelineRuns).values({
        itemId,
        model: err instanceof EmbedError ? VOYAGE_MODEL : HAIKU_MODEL,
        task: err instanceof EmbedError ? 'embed' : 'enrich',
        status: 'error',
        errorMessage: scrubbedReason,
      });
      return { itemId: itemId.toString(), status: 'dead_letter', failureReason: scrubbedReason };
    }

    // Retryable — bump retry_count and rethrow so Trigger.dev (Plan 04) retries.
    await db
      .update(items)
      .set({ retryCount: retryCount + 1 })
      .where(eq(items.id, itemId));
    throw err;
  }
}
