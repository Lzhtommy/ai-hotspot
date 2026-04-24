/**
 * Core ingestion orchestrator — Phase 2 D-06 / D-08 / D-14.
 *
 * Given a source row (id + rssUrl), this module:
 *   1. fetchRSSHub(rssUrl) → Response
 *   2. parseRSS(res) → RssEntry[]
 *   3. For each entry: normalizeUrl → urlFingerprint → contentHash → insert ON CONFLICT DO NOTHING
 *   4. Update the source row per D-08 counter semantics
 *
 * Extracted from src/trigger/fetch-source.ts so it is unit-testable without the
 * Trigger.dev runtime. The Trigger.dev task file is a thin adapter.
 *
 * Consumed by:
 *   - src/trigger/fetch-source.ts (Plan 03 Trigger.dev task)
 */
import { sql, eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { items, sources } from '@/lib/db/schema';
import { fetchRSSHub as realFetchRSSHub } from '@/lib/rsshub';
import { parseRSS } from '@/lib/ingest/parse-rss';
import { normalizeUrl } from '@/lib/ingest/normalize-url';
import { urlFingerprint, contentHash } from '@/lib/ingest/fingerprint';

export interface FetchSourceDeps {
  db?: typeof realDb;
  fetchRSSHub?: typeof realFetchRSSHub;
  nativeFetch?: typeof fetch;
  now?: () => Date;
}

const HTTP_URL_RE = /^https?:\/\//i;

async function fetchBySource(
  rssUrl: string,
  deps: { fetchRSSHub: typeof realFetchRSSHub; nativeFetch: typeof fetch },
): Promise<Response> {
  if (HTTP_URL_RE.test(rssUrl)) {
    const res = await deps.nativeFetch(rssUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'ai-hotspot/1.0 (+https://github.com/)' },
    });
    if (!res.ok) {
      const err = new Error(`Native fetch returned HTTP ${res.status}`);
      err.name = 'NativeFetchError';
      throw err;
    }
    return res;
  }
  return deps.fetchRSSHub(rssUrl);
}

export interface FetchSourceResult {
  sourceId: number;
  status: 'ok' | 'error';
  newCount: number;
  seenCount: number;
  errorKind?: string;
}

export async function runFetchSource(params: {
  sourceId: number;
  rssUrl: string;
  deps?: FetchSourceDeps;
}): Promise<FetchSourceResult> {
  const db = params.deps?.db ?? realDb;
  const fetchRSSHubFn = params.deps?.fetchRSSHub ?? realFetchRSSHub;
  const nativeFetchFn =
    params.deps?.nativeFetch ??
    ((url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      globalThis.fetch(url, init));
  const now = params.deps?.now ?? (() => new Date());

  let entries;
  try {
    const res = await fetchBySource(params.rssUrl, {
      fetchRSSHub: fetchRSSHubFn,
      nativeFetch: nativeFetchFn,
    });
    entries = await parseRSS(res);
  } catch (err) {
    // D-08: on error, increment error counter only; do NOT touch last_fetched_at or empty counter.
    await db
      .update(sources)
      .set({
        consecutiveErrorCount: sql`${sources.consecutiveErrorCount} + 1`,
      })
      .where(eq(sources.id, params.sourceId));
    return {
      sourceId: params.sourceId,
      status: 'error',
      newCount: 0,
      seenCount: 0,
      errorKind: err instanceof Error ? err.name : 'UnknownError',
    };
  }

  let newCount = 0;
  let seenCount = 0;

  for (const entry of entries) {
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(entry.url);
    } catch {
      // Malformed entry URL — skip this item but continue the run.
      continue;
    }
    const fp = urlFingerprint(normalizedUrl);
    const ch = contentHash(normalizedUrl, entry.title);

    const inserted = await db
      .insert(items)
      .values({
        sourceId: params.sourceId,
        url: normalizedUrl, // D-16: store normalized, not raw
        urlFingerprint: fp,
        contentHash: ch,
        title: entry.title,
        bodyRaw: entry.bodyRaw,
        publishedAt: entry.publishedAtUtc,
        publishedAtSourceTz: entry.publishedAtSourceTz,
        status: 'pending',
        retryCount: 0,
      })
      .onConflictDoNothing({ target: items.urlFingerprint })
      .returning({ id: items.id });

    if (inserted.length === 1) newCount += 1;
    else seenCount += 1;
  }

  // D-08: on success.
  // Use an inline object literal (NOT Record<string, unknown>) so Drizzle's
  // strongly-typed .set() accepts the call. The `consecutiveEmptyCount` branch
  // toggles between `0` (≥1 new item) and a SQL increment expression (zero new
  // items); both branches still produce the same three keys on the object,
  // which is what the test harness asserts via Object.keys(updates[0]).
  await db
    .update(sources)
    .set({
      lastFetchedAt: now(),
      consecutiveErrorCount: 0,
      consecutiveEmptyCount: newCount >= 1 ? 0 : sql`${sources.consecutiveEmptyCount} + 1`,
    })
    .where(eq(sources.id, params.sourceId));

  return {
    sourceId: params.sourceId,
    status: 'ok',
    newCount,
    seenCount,
  };
}
