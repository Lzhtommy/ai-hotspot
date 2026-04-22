# Phase 3: LLM Pipeline + Clustering — Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 24 (21 new + 3 modified)
**Analogs found:** 21 / 24 (3 have "no direct analog — see RESEARCH.md" deviations)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/trigger/process-pending.ts` | Trigger.dev scheduled task | event-driven (cron) + atomic-claim + fan-out | `src/trigger/ingest-hourly.ts` | exact |
| `src/trigger/process-item.ts` | Trigger.dev triggered task (thin wrapper) | request-response (per-item) | `src/trigger/fetch-source.ts` | exact |
| `src/trigger/refresh-clusters.ts` | Trigger.dev triggered task (debounce-invoked) | event-driven, coalesced | `src/trigger/fetch-source.ts` | role-match |
| `src/trigger/index.ts` (modify) | barrel export | — | `src/trigger/index.ts` (existing) | exact |
| `trigger.config.ts` (modify) | config | — | `trigger.config.ts` (existing) | exact |
| `src/lib/llm/process-item-core.ts` | pure core orchestrator (DI-friendly) | CRUD + external API orchestration | `src/lib/ingest/fetch-source-core.ts` | exact |
| `src/lib/llm/process-item-core.test.ts` | unit test (DI mocks) | — | `src/lib/ingest/fetch-source-core.test.ts` | exact |
| `src/lib/llm/client.ts` | external SDK singleton (Anthropic + Voyage) | — | `src/lib/db/client.ts` | role-match |
| `src/lib/llm/extract.ts` | pure utility (Readability wrap) | transform + external fetch | `src/lib/rsshub.ts` | role-match (I/O wrapper w/ named error + timeouts) |
| `src/lib/llm/extract.test.ts` | unit test | — | `src/lib/ingest/parse-rss.test.ts` | exact |
| `src/lib/llm/enrich.ts` | external-API wrapper (Haiku call) | request-response | `src/lib/rsshub.ts` | role-match |
| `src/lib/llm/enrich.test.ts` | unit test (mock Anthropic) | — | `src/lib/ingest/fetch-source-core.test.ts` (mock-dep shape) | role-match |
| `src/lib/llm/embed.ts` | external-API wrapper (Voyage call) | request-response | `src/lib/rsshub.ts` | role-match |
| `src/lib/llm/embed.test.ts` | unit test (mock Voyage) | — | `src/lib/ingest/fetch-source-core.test.ts` (mock-dep shape) | role-match |
| `src/lib/llm/prompt.ts` | pure utility (prompt builder) | transform | `src/lib/ingest/normalize-url.ts` (pure str transform) | role-match |
| `src/lib/llm/prompt.test.ts` | unit test (snapshot on string) | — | `src/lib/ingest/normalize-url.test.ts` | exact |
| `src/lib/llm/schema.ts` | pure utility (zod schema) | — | *(no analog — first zod usage)* | none; spec in RESEARCH.md §Pattern 1 |
| `src/lib/llm/pricing.ts` | pure constants + calc fn | transform | `src/lib/ingest/fingerprint.ts` (pure fn, constants) | role-match |
| `src/lib/llm/otel.ts` | bootstrap (OTel NodeSDK + flush) | — | *(no direct analog — new concern)* | none; spec in RESEARCH.md §Langfuse OTel bootstrap |
| `src/lib/cluster/threshold.ts` | settings lookup | CRUD (read) | `src/lib/db/client.ts` + Drizzle select pattern in `ingest-hourly.ts:41-44` | role-match |
| `src/lib/cluster/threshold.test.ts` | unit test (mock db) | — | `src/lib/ingest/fetch-source-core.test.ts` | exact |
| `src/lib/cluster/join-or-create.ts` | SQL-transaction orchestrator | CRUD + raw sql | `src/lib/ingest/fetch-source-core.ts` (update+insert+ON CONFLICT block) | role-match (transactional variant) |
| `src/lib/cluster/join-or-create.test.ts` | unit test (mock tx) | — | `src/lib/ingest/fetch-source-core.test.ts` | exact |
| `src/lib/cluster/refresh.ts` | bulk update orchestrator | CRUD (read-then-update per cluster) | `src/lib/ingest/fetch-source-core.ts` (counter-update pattern) | role-match |
| `src/lib/cluster/refresh.test.ts` | unit test | — | `src/lib/ingest/fetch-source-core.test.ts` | exact |
| `drizzle/0003_hnsw_index_and_settings_seed.sql` | SQL migration (hand-authored) | schema change + seed row | `drizzle/0000_enable_pgvector.sql` | exact (hand-authored, non-Drizzle-Kit-generated shape) |
| `drizzle/meta/_journal.json` (modify) | Drizzle Kit journal | — | existing entries at `drizzle/meta/_journal.json:4-25` | exact |
| `drizzle/meta/0003_snapshot.json` | Drizzle Kit snapshot | — | existing `0002_snapshot.json` | exact (Drizzle-Kit-generated) |
| `scripts/verify-llm.ts` | live-harness CLI | request-response + SC assertion | `scripts/verify-ingest.ts` | exact |
| `scripts/check-hnsw.ts` | CLI migration-assertion | CRUD (read) | `scripts/verify-ingest.ts` (SC#4 column-existence probe block, lines 361-369) | role-match |
| `package.json` (modify) | config | — | `package.json:24-25` existing `db:seed` + `verify:ingest` scripts | exact |
| `.env.example` (modify) | config | — | (existing) | exact |

## Pattern Assignments

### `src/trigger/process-pending.ts` (scheduled task, atomic-claim + fan-out)

**Analog:** `src/trigger/ingest-hourly.ts` — identical topology: `schedules.task` enumerates rows, `batch.triggerAndWait` fans out, aggregates child outputs into a run summary. The only difference is the enumeration query swaps "sources where is_active" for an "atomic claim via UPDATE...RETURNING."

**Imports + task-definition shape** (`src/trigger/ingest-hourly.ts:1-6, 37-40`):
```typescript
import { schedules, batch } from '@trigger.dev/sdk';
import { eq } from 'drizzle-orm';           // swap in `sql` for the claim query
import { db } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';  // swap to `items`
import { fetchSource } from './fetch-source';  // swap to `processItem`

export const ingestHourly = schedules.task({
  id: 'ingest-hourly',
  cron: '0 * * * *',
  run: async (payload) => { ... },
});
```

**Enumerate → fan-out → aggregate shape** (`src/trigger/ingest-hourly.ts:41-89`):
```typescript
const active = await db.select({ id: sources.id, rssUrl: sources.rssUrl })
  .from(sources).where(eq(sources.isActive, true));
if (active.length === 0) { return { scheduledAt: payload.timestamp, sourceCount: 0, ... }; }

const batchItems = active.map((s) => ({
  id: 'fetch-source' as const,
  payload: { sourceId: s.id, rssUrl: s.rssUrl },
}));
const result = await batch.triggerAndWait<typeof fetchSource>(batchItems);

let successes = 0; let failures = 0; let newItemsTotal = 0;
for (const run of result.runs) {
  if (run.ok) { successes += 1; newItemsTotal += run.output?.newCount ?? 0; }
  else { failures += 1; }
}
return { scheduledAt: payload.timestamp, sourceCount: active.length, successes, failures, newItemsTotal };
```

**Deviation — atomic claim** (RESEARCH.md §Pattern 3; no analog for `FOR UPDATE SKIP LOCKED` in repo):
```typescript
import { sql } from 'drizzle-orm';
const claimed = await db.execute(sql`
  UPDATE items SET status = 'processing'
  WHERE id IN (
    SELECT id FROM items
    WHERE status = 'pending'
    ORDER BY ingested_at ASC
    LIMIT ${batchSize}
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id
`);
const itemIds = claimed.rows.map(r => (r as { id: string }).id);
```

**JSDoc header shape** — copy convention from `src/trigger/ingest-hourly.ts:7-36`:
- Purpose sentence + requirement IDs (LLM-01, LLM-08 for cron)
- Cron: `*/5 * * * *` (RESEARCH.md §Overview, Open Question #5 — batchSize 20)
- Topology block (enumerate → fan-out → aggregate)
- Isolation/idempotency notes (LLM-11 structural isolation via per-child retry budget)
- Consumed by: block

**Cron value:** `*/5 * * * *` per RESEARCH.md §Overview + Open Q #5.

**Schedule the debounced `refresh-clusters`** after fan-out (RESEARCH.md §Cluster-refresh flow — `debounce: {key:'refresh-clusters', delay:'60s'}`). **No analog in repo** for `debounce` primitive — planner verifies Trigger.dev v4 API at plan time (see Assumption A8 in RESEARCH.md).

---

### `src/trigger/process-item.ts` (thin task wrapper)

**Analog:** `src/trigger/fetch-source.ts` — identical "thin adapter over core module" shape. Same `maxDuration` override pattern. Same DI hand-off pattern.

**Full pattern** (`src/trigger/fetch-source.ts:1-30`):
```typescript
import { task } from '@trigger.dev/sdk';
import { runFetchSource, type FetchSourceResult } from '@/lib/ingest/fetch-source-core';

/**
 * Per-source fetch worker — Phase 2 D-01, D-03, D-06..D-10, D-14.
 * [multi-line JSDoc: topology, maxDuration rationale, satisfies-reqs, consumed-by]
 */
export const fetchSource = task({
  id: 'fetch-source',
  maxDuration: 90,
  run: async (payload: { sourceId: number; rssUrl: string }): Promise<FetchSourceResult> => {
    return runFetchSource({ sourceId: payload.sourceId, rssUrl: payload.rssUrl });
  },
});
```

**New file shape:**
```typescript
import { task } from '@trigger.dev/sdk';
import { runProcessItem, type ProcessItemResult } from '@/lib/llm/process-item-core';
import { startOtel, flushOtel } from '@/lib/llm/otel';

startOtel(); // idempotent, module-load (RESEARCH.md §Langfuse OTel bootstrap)

export const processItem = task({
  id: 'process-item',
  maxDuration: 120, // RESEARCH.md §Architecture: 120s covers Haiku call + Voyage call + SQL transaction
  run: async (payload: { itemId: string }): Promise<ProcessItemResult> => {
    try {
      return await runProcessItem({ itemId: payload.itemId });
    } finally {
      await flushOtel(); // Pitfall 6: OTel spans must flush before Trigger.dev recycles the worker
    }
  },
});
```

**Deviation:** The `startOtel()` at module-load + `flushOtel()` in `finally{}` wrapper is **new** — no analog. See RESEARCH.md §Langfuse OTel bootstrap + §Pitfall 6.

---

### `src/trigger/refresh-clusters.ts` (debounce-invoked task)

**Analog:** `src/trigger/fetch-source.ts` — same `task({ id, maxDuration, run: payload => runCore(...) })` thin-wrapper shape.

**Pattern:**
```typescript
import { task } from '@trigger.dev/sdk';
import { runRefreshClusters, type RefreshClustersResult } from '@/lib/cluster/refresh';

export const refreshClusters = task({
  id: 'refresh-clusters',
  maxDuration: 180, // recomputing N clusters in one pass; 3-min ceiling for burst-coalesce case
  run: async (): Promise<RefreshClustersResult> => runRefreshClusters(),
});
```

**Deviation:** The task is **enqueued with `debounce`** from `process-pending` and/or `process-item-core` (RESEARCH.md §Cluster-refresh flow). The **invocation site** uses Trigger.dev v4's native `debounce: { key: 'refresh-clusters', delay: '60s' }` primitive. **No analog in repo**; planner verifies v4 API shape at plan time. Fallback (RESEARCH.md Assumption A8): in-task coalesce via a settings-row timestamp.

---

### `src/trigger/index.ts` (modify — add new exports)

**Analog:** itself at `src/trigger/index.ts:1-7` — extend the existing "Phase N additions" comment convention.

**Current state:**
```typescript
// Barrel export — add new task exports here as phases grow.
// Kept as a single surface so API routes and type-only importers have one import path.
export * from './health-probe';
// Phase 2 additions (ingestion pipeline):
export * from './ingest-hourly';
export * from './fetch-source';
```

**Pattern to extend:**
```typescript
// Phase 3 additions (LLM pipeline + clustering):
export * from './process-pending';
export * from './process-item';
export * from './refresh-clusters';
```

---

### `trigger.config.ts` (possibly modify — concurrency override)

**Analog:** `trigger.config.ts` (existing) — `maxDuration: 3600` at project level; per-task override is already documented at `trigger.config.ts:22-24`.

**Deviation:** RESEARCH.md calls for `queue: 'llm-pipeline', concurrencyLimit: 4` on the `process-item` task specifically. Trigger.dev v4 supports queue-level concurrency via `queue({ name, concurrencyLimit })`. Planner verifies whether this lives in `trigger.config.ts` (queue registry) or on the `task({ queue: ... })` definition — **no analog in repo** for concurrency declaration. If chosen to live in `trigger.config.ts`, add a new `queues: [...]` key alongside the existing `retries` block (`trigger.config.ts:26-35`).

---

### `src/lib/llm/process-item-core.ts` (pure core orchestrator)

**Analog:** `src/lib/ingest/fetch-source-core.ts` — **exact shape**: module-level JSDoc, DI interface, one async orchestrator function, step-by-step with counter-style updates on failure. Replicate this verbatim.

**Module JSDoc + import block** (`src/lib/ingest/fetch-source-core.ts:1-22`):
```typescript
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
```

**DI interface pattern** (`src/lib/ingest/fetch-source-core.ts:24-36`):
```typescript
export interface FetchSourceDeps {
  db?: typeof realDb;
  fetchRSSHub?: typeof realFetchRSSHub;
  now?: () => Date;
}

export interface FetchSourceResult {
  sourceId: number;
  status: 'ok' | 'error';
  newCount: number;
  seenCount: number;
  errorKind?: string;
}
```

**Apply to Phase 3** as:
```typescript
export interface ProcessItemDeps {
  db?: typeof realDb;
  anthropic?: typeof realAnthropic;       // from @/lib/llm/client
  voyage?: typeof realVoyage;              // from @/lib/llm/client
  extractFullText?: typeof realExtract;    // from @/lib/llm/extract
  now?: () => Date;
}

export interface ProcessItemResult {
  itemId: string;
  status: 'published' | 'dead_letter';
  clusterId?: string;
  joinedExistingCluster?: boolean;
  failureReason?: string;
}
```

**Orchestrator shape — happy path + error branch** (`src/lib/ingest/fetch-source-core.ts:38-124`):
```typescript
export async function runFetchSource(params: {
  sourceId: number; rssUrl: string; deps?: FetchSourceDeps;
}): Promise<FetchSourceResult> {
  const db = params.deps?.db ?? realDb;
  const fetchFn = params.deps?.fetchRSSHub ?? realFetchRSSHub;
  const now = params.deps?.now ?? (() => new Date());

  let entries;
  try {
    const res = await fetchFn(params.rssUrl);
    entries = await parseRSS(res);
  } catch (err) {
    // D-08: on error, increment error counter only; do NOT touch last_fetched_at
    await db.update(sources).set({
      consecutiveErrorCount: sql`${sources.consecutiveErrorCount} + 1`,
    }).where(eq(sources.id, params.sourceId));
    return { sourceId: params.sourceId, status: 'error', newCount: 0, seenCount: 0,
      errorKind: err instanceof Error ? err.name : 'UnknownError' };
  }

  // ... happy path: iterate, insert ON CONFLICT DO NOTHING, tally counters ...
  await db.update(sources).set({ lastFetchedAt: now(), consecutiveErrorCount: 0, ... })
    .where(eq(sources.id, params.sourceId));

  return { sourceId: params.sourceId, status: 'ok', newCount, seenCount };
}
```

**Apply to Phase 3 as STEPS A–G** (RESEARCH.md §Architecture Diagram lines 99-164). The error branch is similar but writes `items.status = 'dead_letter'` + `failure_reason` instead of incrementing a source counter (LLM-10, LLM-11). Retryable-vs-terminal decision follows RESEARCH.md lines 157-163.

---

### `src/lib/llm/process-item-core.test.ts` (unit test)

**Analog:** `src/lib/ingest/fetch-source-core.test.ts` — **exact mock-DI shape**. Mirror every test style decision.

**Mock factory pattern** (`src/lib/ingest/fetch-source-core.test.ts:5-39`):
```typescript
function makeDbMock(insertBehavior: 'new' | 'conflict' | 'mixed' = 'new') {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const insertChain = {
    values: (v: Record<string, unknown>) => { inserts.push(v); return insertChain; },
    onConflictDoNothing: () => insertChain,
    returning: () => { /* ...branch on behavior */ },
  };
  const updateChain = {
    set: (v: Record<string, unknown>) => { updates.push(v); return updateChain; },
    where: () => Promise.resolve(),
  };
  return { db: { insert: () => insertChain, update: () => updateChain }, inserts, updates };
}
```

**DI injection + assertion pattern** (`src/lib/ingest/fetch-source-core.test.ts:58-77`):
```typescript
const { db, inserts, updates } = makeDbMock('new');
const res = await runFetchSource({
  sourceId: 42, rssUrl: '/some/route',
  deps: {
    db: db as never,
    fetchRSSHub: async () => rssResponse(sampleFeedXml),
    now: () => new Date('2026-04-20T12:00:00Z'),
  },
});
expect(res).toEqual({ sourceId: 42, status: 'ok', newCount: 2, seenCount: 0 });
expect(inserts).toHaveLength(2);
```

**Apply to Phase 3:** inject `anthropic`, `voyage`, `extractFullText`, `db` via `deps`. For LLM-10 (schema-validation failure → dead_letter), mock `anthropic.messages.parse` to return an object whose `parsed_output` fails zod. For LLM-11 (max retries), throw a non-retryable error and assert `status: 'dead_letter'` + `failureReason`. For LLM-12 (pipeline_runs row written), spy on inserts (`Object.keys(updates[0])` idiom from fetch-source-core.test.ts:96-98).

---

### `src/lib/llm/client.ts` (SDK singleton)

**Analog:** `src/lib/db/client.ts` — the canonical "env-driven singleton at module scope" pattern in this repo.

**Full analog** (`src/lib/db/client.ts:1-7`):
```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
export { schema };
```

**Apply to Phase 3:**
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { VoyageAIClient } from 'voyageai';

// Non-null assertion matches db/client.ts pattern — env guaranteed in Trigger.dev Cloud
// (Phase 1 D-07) + vitest.setup.ts pre-populates a dummy value for test-time module-load.
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
export const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! });
```

**vitest.setup.ts must be extended** to predefine `ANTHROPIC_API_KEY` + `VOYAGE_API_KEY` dummy values (mirror `vitest.setup.ts:10`):
```typescript
process.env.ANTHROPIC_API_KEY ??= 'sk-ant-test-dummy';
process.env.VOYAGE_API_KEY ??= 'pa-test-dummy';
```

---

### `src/lib/llm/extract.ts` (Readability + jsdom wrapper)

**Analog:** `src/lib/rsshub.ts` — same role: I/O wrapper that (a) fetches an external URL with a timeout budget, (b) scrubs errors into a named error class, (c) is called by the core orchestrator.

**Named error class** (`src/lib/rsshub.ts:17-25`):
```typescript
export class RSSHubError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'RSSHubError';
  }
}
```

**Apply to Phase 3:**
```typescript
export class ExtractError extends Error {
  constructor(message: string, public readonly kind: 'fetch' | 'parse' | 'blocked') {
    super(message);
    this.name = 'ExtractError';
  }
}
```

**Fetch-with-timeout pattern** (`src/lib/rsshub.ts:60-71`):
```typescript
let res: Response;
try {
  res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'ai-hotspot/1.0 (+https://github.com/)' },
  });
} catch (err) {
  // Never expose the URL with the key in the error — scrub it.
  throw new RSSHubError(`RSSHub fetch failed: ${err instanceof Error ? err.name : 'unknown'}`);
}
```

**Apply to Phase 3** — fetch arbitrary URL with 15s timeout + 2MB size cap + scheme whitelist (RESEARCH.md §Known Threat Patterns — SSRF row):
```typescript
export async function extractFullText(
  bodyRaw: string, url: string, opts?: { threshold?: number }
): Promise<{ text: string; extracted: boolean }> {
  const threshold = opts?.threshold ?? 500;  // RESEARCH.md Assumption A10
  if (bodyRaw.length >= threshold) {
    return { text: bodyRaw, extracted: false };
  }
  // gated fetch + jsdom + Readability.parse(); on null/error return {bodyRaw, false}
  // (RESEARCH.md §Pitfall 3 — do NOT dead-letter on null)
}
```

**Deviation:** jsdom + Readability invocation has no analog. RESEARCH.md §Architecture Diagram STEP B (lines 107-113) + §Pitfall 3 specifies the shape.

---

### `src/lib/llm/enrich.ts` (Haiku call)

**Analog:** `src/lib/rsshub.ts:38-78` — same "external API wrapper with named error + env-keyed client + measured call." Not the full match — the Haiku call goes through the SDK singleton not raw `fetch`, but the **shape of the wrapper** (import client → call → wrap-errors → return typed result) is identical.

**Pattern to replicate:**
1. Top-of-file JSDoc: purpose, requirements satisfied (LLM-03..07, LLM-09, LLM-12), consumed-by (`src/lib/rsshub.ts:1-15`).
2. Named error class (`RSSHubError` → `EnrichError`).
3. Env-keyed singleton client imported from `./client` (parallels `neon(process.env.DATABASE_URL!)` in `src/lib/db/client.ts:5`).
4. Returns a typed result object (parallels `fetchRSSHub` returning `Response`).

**Shape:**
```typescript
import { anthropic } from './client';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { EnrichmentSchema, type Enrichment } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export interface EnrichResult {
  enrichment: Enrichment;
  usage: {
    input_tokens: number; output_tokens: number;
    cache_read_input_tokens: number; cache_creation_input_tokens: number;
  };
  latencyMs: number;
}

export async function enrichWithClaude(params: {
  text: string; title: string; sourceLang: 'zh' | 'en';
}): Promise<EnrichResult> {
  const start = Date.now();
  const res = await anthropic.messages.parse({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: buildSystemPrompt(),   // cache_control on this block — Pattern 1
    messages: [{ role: 'user', content: [{ type: 'text', text: buildUserMessage(params) }] }],
    output_config: { format: zodOutputFormat(EnrichmentSchema) },
  });
  return {
    enrichment: res.parsed_output!,
    usage: res.usage as EnrichResult['usage'],
    latencyMs: Date.now() - start,
  };
}
```

**RESEARCH.md §Pattern 1** is the canonical spec (lines 231-282).

---

### `src/lib/llm/embed.ts` (Voyage call)

**Analog:** `src/lib/rsshub.ts` — same wrapper shape.

**Shape** (RESEARCH.md §Voyage embedding call, lines 474-491):
```typescript
import { voyage } from './client';

export class EmbedError extends Error {
  constructor(message: string) { super(message); this.name = 'EmbedError'; }
}

export async function embedDocument(text: string): Promise<number[]> {
  try {
    const res = await voyage.embed({
      input: [text], model: 'voyage-3.5', inputType: 'document',
    });
    return res.data[0].embedding;
  } catch (err) {
    throw new EmbedError(`Voyage embed failed: ${err instanceof Error ? err.name : 'unknown'}`);
  }
}
```

**Deviation:** `voyageai` SDK method signatures are MEDIUM-confidence (RESEARCH.md Assumption A2). Planner inspects `node_modules/voyageai/**/*.d.ts` at plan time before finalizing this shape.

---

### `src/lib/llm/prompt.ts` (pure prompt builder)

**Analog:** `src/lib/ingest/normalize-url.ts` — pure utility, named exports, module-level constants (`TRACKING_PARAMS`), no external deps, one primary function.

**Constants + export pattern** (`src/lib/ingest/normalize-url.ts:18-31, 40-65`):
```typescript
const TRACKING_PARAMS = new Set([...]);

export class UrlNormalizationError extends Error { ... }

export function normalizeUrl(input: string): string { ... }
```

**Apply to Phase 3:**
```typescript
const RUBRIC_TEXT = `...0-100 hotness scoring rubric with anchor examples...`;
const TAG_TAXONOMY = `...30 tags with examples...`;
const FEW_SHOT_EXAMPLES = `...2-3 input→output pairs...`;

export function buildSystemPrompt(): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
  return [{
    type: 'text',
    text: `${RUBRIC_TEXT}\n\n${TAG_TAXONOMY}\n\n${FEW_SHOT_EXAMPLES}`,
    cache_control: { type: 'ephemeral' },  // RESEARCH.md §Pattern 1 + Pitfall 1 — must total ≥4096 tokens
  }];
}

export function buildUserMessage(params: {
  text: string; title: string; sourceLang: 'zh' | 'en';
}): string {
  // LLM-09: wrap article in <untrusted_content> for prompt-injection defense
  return `Source language: ${params.sourceLang}\n` +
         `Title: ${params.title}\n\n` +
         `<untrusted_content>\n${params.text}\n</untrusted_content>\n\n` +
         `Return the enrichment JSON.`;
}
```

---

### `src/lib/llm/prompt.test.ts` (snapshot-style string test)

**Analog:** `src/lib/ingest/normalize-url.test.ts` — pure-input/pure-output tests, no mocks, `toBe` / `toMatch` assertions on strings.

**Pattern** (`src/lib/ingest/normalize-url.test.ts:1-9`):
```typescript
import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './normalize-url';

describe('normalizeUrl', () => {
  it('strips utm_source and keeps other params', () => {
    expect(normalizeUrl('https://example.com/a?utm_source=x&keep=1')).toBe('https://example.com/a?keep=1');
  });
  // ...
});
```

**Apply to Phase 3 tests:**
- LLM-09 assertion: `expect(buildUserMessage({...})).toContain('<untrusted_content>')` + `.toContain('</untrusted_content>')`.
- Cache-control shape: `expect(buildSystemPrompt()[0].cache_control).toEqual({ type: 'ephemeral' })`.
- Token-floor check: `expect(estimateTokens(buildSystemPrompt()[0].text)).toBeGreaterThanOrEqual(4096)` (Pitfall 1 — RESEARCH.md lines 372-377).

---

### `src/lib/llm/schema.ts` (zod schema)

**Analog:** *(none — first zod usage in repo)*.

**Deviation — no analog.** RESEARCH.md §Pattern 1 is the canonical spec (lines 245-251):
```typescript
import { z } from 'zod';

// FROZEN — changing this shape invalidates the Anthropic prompt cache (RESEARCH.md Pitfall 2).
// Any modification is a new Phase 3 sub-phase.
export const EnrichmentSchema = z.object({
  title_zh: z.string().min(1).max(200),
  summary_zh: z.string().min(10).max(800),
  score: z.number().int().min(0).max(100),
  recommendation: z.string().min(2).max(80),
  tags: z.array(z.string()).min(1).max(5),
});

export type Enrichment = z.infer<typeof EnrichmentSchema>;
```

**Conventions carried over from this repo:** named export (not default); file-header JSDoc; pin zod v3 initially (RESEARCH.md Assumption A1).

---

### `src/lib/llm/pricing.ts` (constants + cost fn)

**Analog:** `src/lib/ingest/fingerprint.ts` — pure function module with module-level constants, `createHash`-style composition, no I/O.

**Pattern** (`src/lib/ingest/fingerprint.ts:13-21`):
```typescript
import { createHash } from 'node:crypto';
export function urlFingerprint(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl, 'utf8').digest('hex');
}
```

**Apply to Phase 3:**
```typescript
// Source: CLAUDE.md §7 pricing table + Voyage pricing docs (RESEARCH.md §Sources)
const HAIKU_INPUT_PER_MTOK = 1;        // USD per million input tokens
const HAIKU_OUTPUT_PER_MTOK = 5;
const HAIKU_CACHE_READ_PER_MTOK = 0.10;  // 10% of input price
const HAIKU_CACHE_WRITE_5M_PER_MTOK = 1.25;
const VOYAGE_35_PER_MTOK = 0.06;

export function computeHaikuCostUsd(u: {
  input_tokens: number; output_tokens: number;
  cache_read_input_tokens: number; cache_creation_input_tokens: number;
}): number { ... }

export function computeVoyageCostUsd(tokens: number): number { ... }
```

---

### `src/lib/llm/otel.ts` (OTel NodeSDK bootstrap)

**Analog:** *(no direct analog — new concern)*.

**Deviation — no analog.** RESEARCH.md §Langfuse OTel bootstrap (lines 428-472) is the canonical spec. Key conventions to mirror from the repo:
- Module-level singleton pattern with idempotent `start()` guard (parallels `src/lib/db/client.ts:5` singleton idea).
- Named exports (not default).
- JSDoc header per repo convention.
- Non-null env assertion acceptable for `LANGFUSE_*` env vars (matches `src/lib/rsshub.ts:45-46` "throw if env missing" pattern).

**Key shape (from RESEARCH.md):**
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { AnthropicInstrumentation } from '@arizeai/openinference-instrumentation-anthropic';
import Anthropic from '@anthropic-ai/sdk';

const instrumentation = new AnthropicInstrumentation();
instrumentation.manuallyInstrument(Anthropic);

const otel = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
  instrumentations: [instrumentation],
});

let started = false;
export function startOtel() { if (started) return; otel.start(); started = true; }
export async function flushOtel() { await otel.shutdown(); }
```

---

### `src/lib/cluster/threshold.ts` (settings lookup)

**Analog:** `src/trigger/ingest-hourly.ts:41-44` — the Drizzle `db.select().from().where(eq(...))` read pattern against a schema table.

**Pattern** (`src/trigger/ingest-hourly.ts:41-44`):
```typescript
const active = await db
  .select({ id: sources.id, rssUrl: sources.rssUrl })
  .from(sources)
  .where(eq(sources.isActive, true));
```

**Apply to Phase 3:**
```typescript
import { eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';

const DEFAULT_THRESHOLD = 0.82; // CLUST-04 default

export async function getClusterThreshold(deps?: { db?: typeof realDb }): Promise<number> {
  const db = deps?.db ?? realDb;
  const rows = await db.select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'cluster_threshold'));
  if (rows.length === 0) return DEFAULT_THRESHOLD;
  const parsed = parseFloat(rows[0].value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_THRESHOLD;
}
```

**DI convention:** `deps?: { db?: typeof realDb }` matches `fetch-source-core.ts:24-28` style.

---

### `src/lib/cluster/join-or-create.ts` (SQL-transaction orchestrator)

**Analog:** `src/lib/ingest/fetch-source-core.ts:82-116` — same "raw SQL + parameterized Drizzle update pattern" idiom.

**Raw sql + execute pattern** (referenced in RESEARCH.md §Pattern 2; closest in-repo precedent is `scripts/verify-ingest.ts:118-121, 154-158, 334-339`):
```typescript
// scripts/verify-ingest.ts:118-121
const n1Row = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM items`)) as unknown as {
  rows: Array<{ n: number }>;
};
```

**Apply to Phase 3** (RESEARCH.md §Join-or-create cluster, lines 493-551):
```typescript
import { sql } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { items, clusters } from '@/lib/db/schema';
import { getClusterThreshold } from './threshold';

export async function joinOrCreateCluster(params: {
  itemId: bigint; embedding: number[]; publishedAt: Date;
  deps?: { db?: typeof realDb };
}): Promise<{ clusterId: bigint; joined: boolean }> {
  const db = params.deps?.db ?? realDb;
  const threshold = await getClusterThreshold({ db });
  const embeddingLiteral = `[${params.embedding.join(',')}]`;

  return db.transaction(async (tx) => {
    const nearest = await tx.execute(sql`
      SELECT i.id, i.cluster_id,
             1 - (i.embedding <=> ${embeddingLiteral}::vector) AS cosine_similarity
      FROM items i
      WHERE i.cluster_id IS NOT NULL ...
      ORDER BY i.embedding <=> ${embeddingLiteral}::vector LIMIT 1
    `);
    // branch: join vs create (see RESEARCH.md for full shape)
  });
}
```

**Deviation:** `db.transaction(async (tx) => {...})` has no direct analog in Phase 2 code (Phase 2's insert uses `onConflictDoNothing` instead of an explicit transaction). Drizzle's `transaction` API is canonical; planner verifies shape at plan time.

---

### `src/lib/cluster/refresh.ts` (bulk bookkeeping updater)

**Analog:** `src/lib/ingest/fetch-source-core.ts:109-116` — the `.update(sources).set({ ... }).where(eq(sources.id, ...))` pattern, repeated per cluster.

**Apply to Phase 3:**
```typescript
import { sql, eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { clusters, items } from '@/lib/db/schema';

export async function runRefreshClusters(deps?: { db?: typeof realDb }): Promise<{ updated: number }> {
  const db = deps?.db ?? realDb;
  // 1. Find clusters touched since last refresh — from items.cluster_id assignments
  //    (cheap heuristic: every cluster whose latest_seen_at < MAX(items.processed_at)).
  // 2. For each such cluster, compute: member_count, primary_item_id (MIN published_at),
  //    earliest_seen_at, latest_seen_at, centroid (AVG embedding).
  // 3. UPDATE clusters SET ... WHERE id = $clusterId.
}
```

**CLUST-07 (primary by earliest published_at):** use `SELECT id FROM items WHERE cluster_id = $c ORDER BY published_at ASC LIMIT 1`.

**Deviation:** The AVG-of-vectors centroid calculation needs a parameterized SQL pass. pgvector supports `AVG(embedding)` across rows; verify at plan time via the pgvector docs already cited in RESEARCH.md §Sources.

---

### `src/lib/cluster/*.test.ts` files

**Analog:** `src/lib/ingest/fetch-source-core.test.ts` — same `makeDbMock()` pattern with `inserts[]` / `updates[]` arrays and `Object.keys(updates[0])` assertions.

Use the identical factory shape. For `join-or-create.test.ts`, add a `makeTxMock()` that exposes the same `insert`/`update`/`execute` chains as `makeDbMock` but nested inside a `transaction(cb => cb(txMock))` wrapper.

---

### `drizzle/0003_hnsw_index_and_settings_seed.sql` (hand-authored migration)

**Analog:** `drizzle/0000_enable_pgvector.sql` — the only **hand-authored** migration in the repo; `0001` and `0002` are Drizzle-Kit-generated.

**Full analog** (`drizzle/0000_enable_pgvector.sql`):
```sql
-- Enable pgvector extension for the Voyage voyage-3.5 1024-dim embedding column.
-- Must run before 0001_initial_schema.sql because items.embedding = vector(1024).
-- Source: D-10 / RESEARCH.md §Pattern 4 / neon.com/docs/extensions/pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

**Apply to Phase 3** (RESEARCH.md §HNSW index migration, lines 554-567):
```sql
-- Phase 3 migration — adds HNSW index on items.embedding (CLUST-02) and seeds
-- the cluster threshold setting (CLUST-04).
-- Hand-authored (not drizzle-kit generated) because Drizzle schema DSL does not
-- yet emit HNSW index definitions; mirror the precedent in 0000_enable_pgvector.sql.
-- Source: RESEARCH.md §Pattern 2 + §Pitfall 5, neon.com/docs/extensions/pgvector

CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
  ON items USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

INSERT INTO settings (key, value)
VALUES ('cluster_threshold', '0.82')
ON CONFLICT (key) DO NOTHING;
```

**Journal entry shape** — append to `drizzle/meta/_journal.json` (copy from entries at `drizzle/meta/_journal.json:19-25`):
```json
{
  "idx": 3,
  "version": "7",
  "when": <epoch_ms>,
  "tag": "0003_hnsw_index_and_settings_seed",
  "breakpoints": true
}
```

**Snapshot:** `drizzle/meta/0003_snapshot.json` — Drizzle Kit normally generates this from schema, but because this migration is hand-authored and does not alter the schema DSL (indexes on vector columns with HNSW are not representable in Drizzle's current index builder), the snapshot should be copied from `drizzle/meta/0002_snapshot.json` verbatim (the DSL schema is unchanged). Planner confirms at plan time.

---

### `scripts/verify-llm.ts` (live SC harness)

**Analog:** `scripts/verify-ingest.ts` — **exact shape**: env-bootstrap + per-SC functions + result-recorder + cleanup-in-finally + `main().then(passed => process.exit(passed ? 0 : 1))`.

**Env bootstrap** (`scripts/verify-ingest.ts:23-25`):
```typescript
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
```

**Result-recorder pattern** (`scripts/verify-ingest.ts:35-42`):
```typescript
type CriterionResult = { name: string; pass: boolean; detail: string };
const results: CriterionResult[] = [];
function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
}
```

**Sentinel pattern** (`scripts/verify-ingest.ts:32-33, 44-60`): Phase 2 inserts a broken source sentinel; Phase 3 can insert 2 `items` rows with `status='pending'` as sentinels, and run `runProcessItem` on them sequentially. Clean up in `finally{}`.

**Cleanup-in-finally pattern** (`scripts/verify-ingest.ts:386-390`) — **critical for avoiding sentinel-row leaks** (explicit comment at `verify-ingest.ts:373-376`):
```typescript
try { ... return failed.length === 0; }
finally {
  console.log('\n== Cleanup ==');
  await cleanup(brokenId);
}
```

**Main tail shape** (`scripts/verify-ingest.ts:393-400`):
```typescript
main()
  .then((passed) => { process.exit(passed ? 0 : 1); })
  .catch((e) => { console.error('VERIFY FAILED:', e); process.exit(1); });
```

**Phase 3 SCs to assert** (RESEARCH.md §Phase Requirements → Test Map, lines 657-678 — especially the ones flagged "live smoke"):
- SC-LLM-08 `cache_read_input_tokens > 0 on call 2+` — run `enrichWithClaude` back-to-back on 2 sentinel items, assert `pipeline_runs.cache_read_tokens > 0` on the second row.
- SC-LLM-13 `Langfuse trace shape` — assert env vars present; print dashboard URL in output for human UAT.
- SC-CLUST-02 delegate to `scripts/check-hnsw.ts`.
- End-to-end: one sentinel item goes `pending → published` with all enrichment fields + `cluster_id` populated.

---

### `scripts/check-hnsw.ts` (post-migration assertion)

**Analog:** `scripts/verify-ingest.ts:361-369` — the `information_schema`/`pg_indexes` probe block for column existence.

**Pattern to replicate** (`scripts/verify-ingest.ts:361-369`):
```typescript
const colRes = (await db.execute(sql`
  SELECT data_type, is_nullable FROM information_schema.columns
  WHERE table_name = 'items' AND column_name = 'published_at_source_tz'
`)) as unknown as { rows: Array<{ data_type: string; is_nullable: string }> };
const colRow = colRes.rows;
if (colRow.length !== 1 || colRow[0].data_type !== 'text' || colRow[0].is_nullable !== 'YES') {
  sc4Ok = false;
  sc4Detail.push(`column shape incorrect: ${JSON.stringify(colRow)}`);
}
```

**Apply to Phase 3** (RESEARCH.md §Pitfall 5 asserts the index plan):
```typescript
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db/client';

async function main(): Promise<boolean> {
  const res = (await db.execute(sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'items' AND indexname = 'items_embedding_hnsw_idx'
  `)) as unknown as { rows: Array<{ indexname: string; indexdef: string }> };
  const ok = res.rows.length === 1 && res.rows[0].indexdef.toLowerCase().includes('hnsw');
  console.log(ok ? 'PASS: items_embedding_hnsw_idx present' : `FAIL: ${JSON.stringify(res.rows)}`);
  return ok;
}
main().then(ok => process.exit(ok ? 0 : 1));
```

---

### `package.json` (modify — new scripts)

**Analog:** `package.json:24-25` — exactly the Phase 2 `db:seed` and `verify:ingest` precedent using `tsx --env-file=.env.local`.

**Existing precedent:**
```json
"db:seed": "tsx --env-file=.env.local drizzle/seed-sources.ts",
"verify:ingest": "tsx --env-file=.env.local scripts/verify-ingest.ts",
```

**Add (follow same `--env-file=.env.local` convention):**
```json
"verify:llm": "tsx --env-file=.env.local scripts/verify-llm.ts",
"check:hnsw": "tsx --env-file=.env.local scripts/check-hnsw.ts"
```

Lives next to `verify:ingest`. Not invoked by CI.

---

### `.env.example` (modify — new vars)

**Pattern:** each new var gets a comment explaining its purpose and where it's consumed. Existing file (Phase 1 D-06..D-08) is the convention source.

**Add (per RESEARCH.md §Environment Availability, line 634):**
```env
# LLM pipeline — Phase 3
ANTHROPIC_API_KEY=        # Haiku 4.5 structured-output calls (LLM-03..07)
VOYAGE_API_KEY=           # voyage-3.5 embeddings (CLUST-01)
LANGFUSE_PUBLIC_KEY=      # Langfuse OTel trace export (LLM-13)
LANGFUSE_SECRET_KEY=      # Langfuse OTel trace export (LLM-13)
LANGFUSE_BASE_URL=        # e.g., https://cloud.langfuse.com — Langfuse OTel endpoint
```

`ANTHROPIC_API_KEY` + `VOYAGE_API_KEY` were noted "available" in RESEARCH.md line 634 (Phase 1 D-07); confirm at plan time. `LANGFUSE_*` are the new additions (RESEARCH.md line 635 — may already be in Vercel Marketplace but Trigger.dev Cloud env is unconfirmed).

---

## Shared Patterns

### 1. Module-header JSDoc convention
**Source:** `src/lib/rsshub.ts:1-15`, `src/trigger/ingest-hourly.ts:7-36`, `src/lib/ingest/fetch-source-core.ts:1-15`
**Apply to:** every new Phase 3 file.

Required elements:
- One-sentence purpose + phase + comma-separated decision/requirement IDs (e.g., "LLM-03, LLM-04, LLM-07").
- Blank line.
- Multi-step summary ("Given X, this module: 1. ... 2. ... 3. ...").
- Blank line.
- `Consumed by:` bullet list with file paths (concrete paths, not descriptions).
- `Phase N replaces / augments this` forward-pointer when relevant.

### 2. Core/Trigger-task split (DI-friendly)
**Source:** `src/lib/ingest/fetch-source-core.ts` + `src/trigger/fetch-source.ts` + `src/lib/ingest/fetch-source-core.test.ts`
**Apply to:** `process-item-core.ts` ↔ `process-item.ts`, and the `refresh-clusters` pair by analogy.

Locked rules:
- Core module lives in `src/lib/**` and has a single `run<Feature>(params: { ..., deps?: <DepsInterface> })` export.
- `deps?.X ?? realX` fallback pattern for every external dependency (`fetch-source-core.ts:43-45`).
- Trigger.dev task file lives in `src/trigger/**` and is a **thin adapter**: imports the core fn, imports the `Result` type, passes payload through unchanged.
- Test file lives next to the core module (not the task file) and uses pure mock-DI (no vi.mock of module internals).

### 3. Drizzle + Neon HTTP singleton
**Source:** `src/lib/db/client.ts:1-7`
**Apply to:** every Phase 3 file that touches the DB.

Import only as `import { db } from '@/lib/db/client'`. Never instantiate a second `neon()` or `drizzle()`. The env var assertion (`process.env.DATABASE_URL!`) is intentional — `vitest.setup.ts:10` pre-populates it for module-load; Trigger.dev Cloud has it set (Phase 1 D-06).

### 4. Named error classes
**Source:** `src/lib/rsshub.ts:17-25` (RSSHubError), `src/lib/ingest/parse-rss.ts:20-25` (RSSParseError), `src/lib/ingest/normalize-url.ts:33-38` (UrlNormalizationError)
**Apply to:** every external-I/O wrapper in Phase 3.

Convention:
```typescript
export class FooError extends Error {
  constructor(message: string, public readonly kind?: string) {
    super(message);
    this.name = 'FooError';
  }
}
```

Planned Phase 3 classes: `ExtractError` (extract.ts), `EnrichError` (enrich.ts), `EmbedError` (embed.ts), `ClusterError` (join-or-create.ts).

### 5. Secret hygiene in error messages
**Source:** `src/lib/rsshub.ts:68-71` — never log the authenticated URL or key; wrap the raw error into a scrubbed message.
**Apply to:** `enrich.ts`, `embed.ts` — when the Anthropic / Voyage SDKs throw, do not re-throw the raw error (which may include request headers with the API key). Wrap:
```typescript
throw new EnrichError(`Anthropic call failed: ${err instanceof Error ? err.name : 'unknown'}`);
```

### 6. Test framework conventions
**Source:** `vitest.config.ts:1-16`, `vitest.setup.ts:1-10`, `src/lib/ingest/fetch-source-core.test.ts`
**Apply to:** every Phase 3 test file.

Locked rules:
- `describe`/`it`/`expect` imported from `'vitest'` explicitly (no globals — `vitest.config.ts:8`).
- Test file co-located with source (`src/**/*.test.ts`).
- DB tests use `makeDbMock()` factory with `inserts[]` / `updates[]` arrays — no `vi.mock` on `@/lib/db/client`.
- External-SDK tests take the SDK as a DI input — mock returns plain objects.
- `Object.keys(updates[0])` idiom (see `fetch-source-core.test.ts:96-98, 136-138`) for asserting which fields are absent/present in a Drizzle `.set({ ... })` payload.
- vitest.setup.ts is the ONLY place env vars are pre-populated for module-load — Phase 3 extends `vitest.setup.ts` with dummy `ANTHROPIC_API_KEY` + `VOYAGE_API_KEY` + `LANGFUSE_*`.

### 7. tsx + --env-file=.env.local for CLI scripts
**Source:** `package.json:24-25`, `scripts/verify-ingest.ts:23-25`, `drizzle/seed-sources.ts:14-16`
**Apply to:** every new CLI script in `scripts/` or `drizzle/`.

Two patterns observed — both acceptable:
- `tsx --env-file=.env.local script.ts` in `package.json` script (preferred; Phase 2 seed + verify both use this).
- `import 'dotenv/config'; import { config } from 'dotenv'; config({ path: '.env.local' });` at the top of the script (double-belts-and-suspenders; used by `verify-ingest.ts` + `seed-sources.ts`).

### 8. Drizzle migration numbering + journal
**Source:** `drizzle/meta/_journal.json:4-25` (entries 0, 1, 2)
**Apply to:** new migration `0003_hnsw_index_and_settings_seed`.

Rules:
- Next `idx: 3`.
- `tag` matches filename-without-extension.
- `version: "7"`, `breakpoints: true` — match existing entries exactly.
- For hand-authored migrations (precedent: `0000_enable_pgvector.sql`), the snapshot JSON may need to be copy-forward from the previous snapshot since the Drizzle DSL schema is unchanged. Planner verifies Drizzle Kit tolerates this.

### 9. UTC-by-default timestamps
**Source:** every `timestamp('...', { withTimezone: true })` in `src/lib/db/schema.ts`
**Apply to:** Phase 3 is read-mostly on timestamps. `clusters.earliest_seen_at` + `latest_seen_at` + `updated_at` are already TIMESTAMPTZ. `items.processed_at` is TIMESTAMPTZ. All Date objects passed to Drizzle are treated as UTC instants.

---

## No Analog Found

Files with no direct match in the codebase; planner should use RESEARCH.md as the canonical spec. All three are **low-risk** either because the spec is thorough, the library is well-documented, or the surface is tiny.

| File | Role | Data Flow | Reason | Canonical Spec |
|------|------|-----------|--------|----------------|
| `src/lib/llm/schema.ts` | zod schema | — | First zod usage in repo. | RESEARCH.md §Pattern 1 lines 245-251. Pin zod v3. |
| `src/lib/llm/otel.ts` | OTel NodeSDK bootstrap | — | First OTel usage in repo; Arize + Langfuse wiring is new. | RESEARCH.md §Langfuse OTel bootstrap lines 428-472. |
| Trigger.dev v4 `debounce` at `process-pending.ts` / `process-item.ts` call-sites | trigger-time flag | — | First use of `debounce` primitive in repo. | RESEARCH.md §Cluster-refresh flow lines 197-201; Assumption A8 flags a fallback to settings-row-timestamp coalesce if the v4 API shape doesn't match docs. |

Secondary low-confidence items where the analog pattern is *close* but the target library's API shape is **only MEDIUM confidence** in RESEARCH.md:
- `src/lib/llm/embed.ts` — `voyageai` TS SDK method signatures (RESEARCH.md Assumption A2; planner inspects `node_modules/voyageai/**/*.d.ts` at plan time).
- `src/lib/llm/enrich.ts` — `@anthropic-ai/sdk/helpers/zod` export shape at v0.90 (RESEARCH.md Assumption A1; planner inspects `node_modules/@anthropic-ai/sdk/helpers/zod.d.ts` at plan time).

---

## Metadata

**Analog search scope:**
- `/Users/r25477/Project/ai-hotspot/src/trigger/` (4 files — health-probe, ingest-hourly, fetch-source, index)
- `/Users/r25477/Project/ai-hotspot/src/lib/ingest/` (6 files — core, parse-rss, normalize-url, fingerprint, types, plus .test.ts siblings)
- `/Users/r25477/Project/ai-hotspot/src/lib/rsshub.ts`, `/src/lib/db/{client,schema}.ts`
- `/Users/r25477/Project/ai-hotspot/drizzle/` (3 migrations + meta + seed-sources)
- `/Users/r25477/Project/ai-hotspot/scripts/` (verify-ingest, verify-schema)
- `/Users/r25477/Project/ai-hotspot/trigger.config.ts`, `/vitest.config.ts`, `/vitest.setup.ts`, `/package.json`

**Files scanned:** 22

**Key observations that shape planning:**

1. **Phase 2 established the "core + task + test" triad as the repo's locked pattern.** Phase 3 should ship three new triads (process-item, refresh-clusters, plus threshold/join-or-create/refresh as library-only triads). The `fetch-source-core.ts` + `fetch-source.ts` + `fetch-source-core.test.ts` triple is the template — copy the shape verbatim, substitute the domain.

2. **The `makeDbMock()` factory idiom in `fetch-source-core.test.ts:5-39` is the **only** DB-test pattern in the repo.** Phase 3 tests MUST use this factory (not `vi.mock` on `@/lib/db/client`). Extending it for transactions (`makeTxMock`) is new but structurally identical.

3. **Hand-authored migrations are precedented (`0000_enable_pgvector.sql`) but rare.** Phase 3's HNSW index migration MUST be hand-authored because Drizzle's index DSL does not yet support HNSW + `vector_cosine_ops` + `WITH (m = ..., ef_construction = ...)`. The `_journal.json` still gets an `idx: 3` entry; the `0003_snapshot.json` may need to be a copy-forward of `0002_snapshot.json` (Drizzle schema DSL is unchanged).

4. **Trigger.dev v4 primitives used in Phase 2 (`schedules.task`, `batch.triggerAndWait`) are verified against `@trigger.dev/sdk@4.4.4`.** Phase 3 adds two new primitives — `debounce` and queue-level `concurrencyLimit` — that have **no in-repo precedent**. The planner MUST verify these at plan time against the actual SDK node_modules before writing production code (mirrors `ingest-hourly.ts:28-31, 56-60` comment convention which cites `tasks.d.ts:213` directly).

5. **Secret handling is already institutionalized via `src/lib/rsshub.ts:68-71`** — wrap external-SDK errors into named-error classes that include only `err.name`, never the raw error object (which may contain request headers / body with API keys). Apply to enrich.ts and embed.ts without exception.

6. **`scripts/verify-ingest.ts` is the canonical live-harness template** — Phase 3's `scripts/verify-llm.ts` mirrors its `record(name, pass, detail)` + `try/finally cleanup` + `main().then(passed => process.exit(passed ? 0 : 1))` shape exactly. The "do NOT process.exit inside try" comment at `verify-ingest.ts:373-376` is a lesson-learned worth copying verbatim.

7. **vitest.setup.ts is the single point for env-var pre-population at test module-load.** Phase 3 extends it with `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` dummy defaults — the `??=` idiom from `vitest.setup.ts:10` is the correct form.

8. **`trigger.config.ts` already documents the per-task maxDuration override pattern.** Phase 3's `process-item` (120s) and `refresh-clusters` (180s) both use the per-task override; no changes to the project-level `maxDuration: 3600` in `trigger.config.ts:25`. Queue-level `concurrencyLimit: 4` is new and may require a `queues: [...]` key in `trigger.config.ts` (planner verifies).

**Pattern extraction date:** 2026-04-21

## PATTERN MAPPING COMPLETE

**Phase:** 3 — LLM Pipeline + Clustering
**Files classified:** 24 new + 3 modified = 27 files total (counting meta/_journal.json and meta/0003_snapshot.json as 2 additional Drizzle artifacts)
**Analogs found:** 21 exact-or-role matches / 3 no-analog (all low-risk, canonical spec in RESEARCH.md)

### Coverage
- Files with exact analog: 12
- Files with role-match analog: 12
- Files with no analog: 3 (schema.ts, otel.ts, debounce call-sites)

### Key Patterns Identified
- **Core + task-wrapper + DI-mock test triad** locked by Phase 2 (`fetch-source-core.ts` + `fetch-source.ts` + `fetch-source-core.test.ts`) — copy shape verbatim for `process-item`, `refresh-clusters`, and library modules.
- **`schedules.task` → `batch.triggerAndWait` → aggregate-runs** topology in `ingest-hourly.ts` is the exact template for `process-pending.ts` (swap sources enumeration for atomic-claim `UPDATE...RETURNING`).
- **Named error classes + scrubbed error messages** (`RSSHubError` pattern at `src/lib/rsshub.ts:17-25, 68-71`) — apply to every external-API wrapper to preserve secret hygiene.
- **`makeDbMock()` factory + `Object.keys(updates[0])` idiom** (`fetch-source-core.test.ts:5-39, 96-98`) is the only DB-test pattern in the repo; extend with `makeTxMock()` for transaction tests.
- **Hand-authored SQL migration** precedent (`0000_enable_pgvector.sql`) — Phase 3's HNSW migration follows this pattern because Drizzle's DSL lacks HNSW index support.
- **`tsx --env-file=.env.local` + `scripts/verify-*.ts` cleanup-in-finally** — exact template for Phase 3's `verify:llm` + `check:hnsw` harness.

### File Created
`/Users/r25477/Project/ai-hotspot/.planning/phases/03-llm-pipeline-clustering/03-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns directly by file:line in PLAN.md actions. The three no-analog deviations (schema.ts, otel.ts, debounce call-sites) are fully specified in RESEARCH.md and flagged with planner-verification items.
