# Phase 3: LLM Pipeline + Clustering — Research

**Researched:** 2026-04-21
**Domain:** Per-item LLM enrichment (translate + summarize + score + 推荐理由 + tags) + Voyage embeddings + pgvector HNSW clustering, run on Trigger.dev v4 workers
**Confidence:** HIGH (primary stack, Anthropic prompt-caching mechanics, pgvector HNSW, Voyage API, Trigger.dev v4 primitives all verified against live docs); MEDIUM on Langfuse Anthropic JS integration shape (single doc page; verified via package install command but full shutdown-in-worker semantics only lightly covered)

## Overview

Phase 3 turns a `status='pending'` `items` row into a `status='published'` row with Chinese title + summary + 推荐理由 + tags + 0–100 score + 1024-dim Voyage embedding + `cluster_id`. The pipeline runs on Trigger.dev v4 workers (Phase 2 D-17 handoff: items are queued via the `pending` status column; Phase 3 owns pickup). Each item is processed by a single Haiku 4.5 call that returns the enrichment fields via Anthropic's native `output_config.json_schema` structured output, wrapped by a Langfuse/OpenTelemetry trace. Prompt caching (`cache_control: ephemeral`, 5-min TTL) is placed on the long stable system prompt (rubric + tag taxonomy + few-shot) so the first call warms the cache and every subsequent item reads it. A separate step calls Voyage `voyage-3.5` to produce a 1024-dim embedding, then a clustering step finds the nearest item within a ±24h window using pgvector's cosine operator (`<=>`) against an HNSW index and either joins an existing cluster (cosine ≥ threshold) or opens a new one. A scheduled "refresh-clusters" task coalesces cluster-level bookkeeping (member_count, primary_item_id, centroid) once per ingestion wave via Trigger.dev `debounce`.

**Primary recommendation:** One scheduled poller task `process-pending` runs every 5 minutes on a dedicated queue (`llm-pipeline`, `concurrencyLimit: 4`), batch-claims up to N rows via `UPDATE ... WHERE status='pending' ... RETURNING`, and fans out to a per-item child task `process-item` via `batch.triggerAndWait`. Each child does a **single** Haiku 4.5 structured-output call (no separate translate/summarize/score passes), then a Voyage embedding call, then an atomic "join-or-create cluster" SQL transaction. A debounced scheduled task `refresh-clusters` (debounce key = "refresh-clusters", delay = 60s) reconciles cluster centroids/member counts once the wave quiesces.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pick up `pending` items (queue) | Database (row state) + Trigger.dev worker | — | Phase 2 D-17 locks status-column-as-queue; Trigger.dev poller claims rows atomically. No API-route involvement (LLM-01 explicit). |
| Full-text extraction (Readability) | Trigger.dev worker (Node runtime) | — | jsdom + @mozilla/readability require a real Node runtime; Edge/Vercel API routes forbidden (LLM-01). |
| Haiku call (translate/summarize/score/推荐理由/tags) | Trigger.dev worker | — | Single fan-out unit is the item; caching keyed on worker-reused system prompt. |
| Voyage embedding | Trigger.dev worker | — | 1 HTTP POST per item; done inline with LLM step to keep the item's processing atomic. |
| Clustering (nearest-neighbor + join/create) | Database (pgvector HNSW + SQL transaction) | Trigger.dev worker (glue) | pgvector does ANN server-side; worker only runs the `SELECT ... ORDER BY embedding <=> $1 LIMIT 1` and a 2-statement join-or-insert. |
| Cluster centroid/member bookkeeping | Scheduled debounced task | — | Coalesces a burst of new items into one refresh; avoids N×N updates during fan-out. |
| Cost + token accounting | `pipeline_runs` table writes | Langfuse trace | Durable audit in DB (admin dashboard source) + observability in Langfuse. |
| Prompt-injection defense | Prompt engineering in worker (XML tag wrap) | — | Claude's own instruction-hierarchy respects the convention; no library needed. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.90.0` [VERIFIED: `npm view @anthropic-ai/sdk version` → 0.90.0] | Haiku 4.5 messages API with prompt caching + native structured outputs | Official SDK; `cache_control` + `output_config.json_schema` + `zodOutputFormat` helper all first-class. [CITED: https://platform.claude.com/docs/en/build-with-claude/structured-outputs] |
| `voyageai` | `^0.2.1` [VERIFIED: `npm view voyageai version` → 0.2.1] | Voyage `voyage-3.5` embeddings (1024-dim) | Official TS SDK; exposes `embed()` with `input_type: 'document'`. [CITED: https://docs.voyageai.com/docs/embeddings] |
| `@langfuse/otel` + `@arizeai/openinference-instrumentation-anthropic` + `@opentelemetry/sdk-node` | latest | Auto-trace Anthropic calls to Langfuse via OpenTelemetry | Langfuse's 2026 Node/TS path is OTel-based; the Arize instrumentor auto-captures Anthropic requests/responses incl. prompt-cache usage fields. [CITED: https://langfuse.com/integrations/model-providers/anthropic-js] |
| `@mozilla/readability` + `jsdom` | `^0.6.0` + `^29.0.2` [VERIFIED via npm view] | Full-text extraction for LLM-02 | The reference implementation of the Reader-mode algorithm; accepts a jsdom `Document`, returns `{ title, content, textContent, excerpt, byline, ... }`. [CITED: https://github.com/mozilla/readability] |
| `zod` | `^3.25` [VERIFIED: `npm view zod version` → 4.3.6 exists, but `@anthropic-ai/sdk/helpers/zod` docs show Zod 3 shape] | Runtime validation of LLM JSON output + schema source for `zodOutputFormat` | Same zod used by Anthropic's `parse()` helper. |
| `drizzle-orm` | `^0.45.2` (pinned, existing) | SQL access | Already in repo; no change. |
| `@trigger.dev/sdk` | `^4.4.4` (pinned, existing) | Workers, scheduled tasks, batch.triggerAndWait, debounce, idempotencyKey | Already in repo; extend with new tasks. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-retry` (optional) | `^6.x` | Exponential-backoff wrapper for 429s | If Trigger.dev's built-in retries don't give enough control for Anthropic/Voyage rate-limit spikes. Default: lean on Trigger.dev retries first. |
| `dompurify` + `jsdom` | — | Sanitize Readability HTML output | Only needed if we store `body_zh_html`; since we only pass text to Claude, we can use `Readability.parse().textContent` directly and skip sanitization. Recommended: skip DOMPurify in v1. [CITED: https://github.com/mozilla/readability — "strongly recommend sanitizer when rendering"] — we never render Readability output in a browser, so skip. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@anthropic-ai/sdk` `output_config.json_schema` | `tool_use` with a single forced tool + `tool_choice: {type:'tool', name:'emit'}` | Tool use works and is cacheable, but adds ~313–346 "tool system prompt" tokens per call and slightly more indirection. `output_config` is the newer, cheaper, clearer path. [CITED: tool-use docs show the per-call tool system overhead table.] |
| `voyageai` TS SDK | Raw `fetch` to `https://api.voyageai.com/v1/embeddings` | Fewer deps, but we lose retry/timeout ergonomics and types. SDK is ~0 runtime cost. |
| Langfuse OTel route | Direct `langfuse` SDK (v3.x) with manual `generation` creation | Direct SDK is more control but requires we manually log usage, cost, prompt/output. OTel + Arize instrumentor auto-captures everything. **Pick OTel.** |
| @mozilla/readability | `unfluff`, `@postlight/parser`, Jina Reader API | `unfluff` is unmaintained; Postlight Parser is heavier; Jina Reader is a paid external API. Readability is the canonical, maintained, dependency-light choice. |
| One-call Haiku (translate+score+tags+推荐理由) | Multi-call pipeline (translate → then summarize → then score) | Multi-call has better per-step isolation but multiplies cache-read cost, doubles latency, and multiplies Langfuse traces. One call wins on both prompt-caching hit rate and Langfuse clarity. |
| `voyage-3.5` | `voyage-3-large`, OpenAI `text-embedding-3-small` | STATE.md + schema pin `vector(1024)` which matches voyage-3.5 default. Changing breaks the schema. Do not switch. |

**Installation:**
```bash
pnpm add @anthropic-ai/sdk voyageai @langfuse/otel @arizeai/openinference-instrumentation-anthropic @opentelemetry/sdk-node @mozilla/readability jsdom zod
pnpm add -D @types/jsdom
```

**Version verification (performed 2026-04-21):**
| Package | Latest on registry | Action |
|---------|-------------------|--------|
| `@anthropic-ai/sdk` | 0.90.0 | Pin `^0.90.0` (CLAUDE.md says ≥0.26.0 for cache_control — we are far past) |
| `voyageai` | 0.2.1 | Pin `^0.2.1` |
| `langfuse` (legacy SDK) | 3.38.20 | **Do not install** — use `@langfuse/otel` per 2026 docs |
| `@mozilla/readability` | 0.6.0 | Pin `^0.6.0` |
| `jsdom` | 29.0.2 | Pin `^29.0.2` |
| `zod` | 4.3.6 available; Anthropic `zodOutputFormat` docs show v3 syntax | Pin `^3.25` initially; re-evaluate once Anthropic SDK confirms zod 4 support. [ASSUMED — worth verifying in plan step by reading `node_modules/@anthropic-ai/sdk/helpers/zod.d.ts`] |

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Phase 2 Output (already live)                         │
│  items.status='pending'  ← rows written by src/lib/ingest/fetch-source    │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  src/trigger/process-pending.ts  (schedules.task, cron '*/5 * * * *')    │
│    1. atomic claim: UPDATE items SET status='processing' WHERE           │
│       status='pending' LIMIT $batchSize RETURNING id                     │
│    2. batch.triggerAndWait([{id:'process-item', payload:{itemId}}, ...]) │
│       queue: 'llm-pipeline', concurrencyLimit: 4                         │
│    3. after wave finishes, enqueue refresh-clusters with                 │
│       debounce: {key:'refresh-clusters', delay:'60s'}                    │
└──────────────────────────────────────────────────────────────────────────┘
                                     │ (fan-out, one child per item)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  src/trigger/process-item.ts  (task, maxDuration=120, retries ≤3)        │
│    thin adapter → runProcessItem({ itemId, deps })                       │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  src/lib/llm/process-item-core.ts  (pure core logic, DI-friendly)         │
│                                                                           │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │ STEP A: load item row (title, body_raw, source.language)    │        │
│   └─────────────────────────────────────────────────────────────┘        │
│                                │                                          │
│                                ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │ STEP B: extractFullText(body_raw, url)  (lib/llm/extract.ts)│        │
│   │   - if body_raw length >= 500 chars: use body_raw as text   │        │
│   │   - else fetch(url) → jsdom → Readability.parse().textContent│        │
│   │   - on fetch failure: fallback to body_raw, flag {extracted:false}│  │
│   └─────────────────────────────────────────────────────────────┘        │
│                                │                                          │
│                                ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │ STEP C: enrichWithClaude(text, title, lang)  (lib/llm/enrich.ts)│    │
│   │   - single messages.parse() call, Haiku 4.5                 │        │
│   │   - system prompt with cache_control: ephemeral (5m)        │        │
│   │   - user content wraps article in <untrusted_content>       │        │
│   │   - zodOutputFormat(EnrichmentSchema) enforces JSON shape   │        │
│   │   returns {title_zh, summary_zh, score, recommendation, tags,│       │
│   │            usage: {input, output, cache_read, cache_write}} │        │
│   └─────────────────────────────────────────────────────────────┘        │
│                                │                                          │
│                                ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │ STEP D: zod validate (redundant but belt-and-suspenders)    │        │
│   │   - on validation failure: status='dead_letter', return     │        │
│   └─────────────────────────────────────────────────────────────┘        │
│                                │                                          │
│                                ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │ STEP E: embedWithVoyage(text_for_embedding)  (lib/llm/embed.ts)│     │
│   │   - voyageai.embed({texts:[...], model:'voyage-3.5',         │        │
│   │                     inputType:'document'})                  │        │
│   │   returns Float32Array(1024)                                 │        │
│   └─────────────────────────────────────────────────────────────┘        │
│                                │                                          │
│                                ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │ STEP F: joinOrCreateCluster(itemId, embedding, publishedAt) │        │
│   │   (lib/cluster/join-or-create.ts)                           │        │
│   │   - SELECT nearest item via pgvector <=>  (see §Cluster SQL)│        │
│   │   - if cosine ≥ threshold → UPDATE item.cluster_id          │        │
│   │   - else → INSERT cluster, UPDATE item.cluster_id + primary │        │
│   └─────────────────────────────────────────────────────────────┘        │
│                                │                                          │
│                                ▼                                          │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │ STEP G: write final update                                  │        │
│   │   UPDATE items SET title_zh, summary_zh, recommendation,    │        │
│   │     score, tags, embedding, status='published',             │        │
│   │     processed_at = now()                                    │        │
│   │   INSERT INTO pipeline_runs  (two rows: 'enrich' + 'embed') │        │
│   └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
│   ERROR PATH (any step throws):                                           │
│     - retry_count < max (3) AND error is retryable (network, 429, 5xx):  │
│         rethrow → Trigger.dev v4 retries per trigger.config.ts            │
│     - retry_count ≥ max OR error is terminal (schema validation, 4xx):   │
│         UPDATE items SET status='dead_letter', failure_reason,            │
│           retry_count = retry_count + 1                                   │
│         return (do not throw — terminal)                                  │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  src/trigger/refresh-clusters.ts  (task)                                  │
│   - enqueued with debounce key 'refresh-clusters', delay 60s              │
│   - recompute for every cluster touched since last run:                   │
│       member_count = COUNT(items WHERE cluster_id = c.id)                 │
│       primary_item_id = item with MIN(published_at) in that cluster       │
│       earliest_seen_at = MIN(published_at),  latest = MAX                 │
│       centroid = AVG(embedding) across members (running mean)             │
│   - one UPDATE per dirty cluster                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  src/lib/otel/langfuse.ts  (bootstrap, imported by each trigger task file)│
│   - NodeSDK({spanProcessors:[new LangfuseSpanProcessor()], ...}).start() │
│   - AnthropicInstrumentation().manuallyInstrument(Anthropic)             │
│   - export async function flush() = sdk.shutdown()                       │
│   - each process-item run calls flush() in a finally{} block             │
└──────────────────────────────────────────────────────────────────────────┘
```

### Per-item flow (numbered)

1. **Claim** — poller atomically flips `pending → processing` for up to N rows.
2. **Extract** — if `body_raw` is short (< 500 chars), fetch `url`, run through jsdom + Readability, use `textContent`. Fallback to `body_raw` on fetch failure (flag recorded).
3. **Enrich** — single Haiku 4.5 call via `messages.parse()` with `zodOutputFormat(EnrichmentSchema)`. System prompt cached (5m ephemeral). User block wraps article text in `<untrusted_content>` XML tags.
4. **Validate** — zod schema re-checks score ∈ [0,100], required fields present, tags non-empty.
5. **Embed** — Voyage `voyage-3.5` call with `inputType:'document'`, text = `title_zh + '\n\n' + summary_zh` (NOT the raw body — too long; summary is the semantic payload).
6. **Cluster** — single SQL pass: find nearest `items` row with `cluster_id IS NOT NULL` in ±24h window, cosine ≥ threshold → join; else create a new row in `clusters` and assign.
7. **Publish** — one UPDATE sets all enrichment fields + `status='published'`; two INSERTs into `pipeline_runs` (one per LLM/embed call).
8. **Flush** — Langfuse OTel SDK `shutdown()` in the task's finally block so traces reach Langfuse before the Trigger.dev runtime recycles the process.

### Cluster-refresh flow

- Any `process-item` that assigned an item to a cluster enqueues `refresh-clusters` with `debounce: {key:'refresh-clusters', delay:'60s'}`. Rapid bursts coalesce into one run 60s after the last trigger (trailing-edge debounce). [CITED: https://trigger.dev/docs/triggering — debounce primitive]
- The task recomputes `member_count`, `primary_item_id` (earliest `published_at`), `earliest_seen_at`, `latest_seen_at`, and `centroid` (mean of member embeddings) per cluster that has had a new member since last refresh.

### Recommended Project Structure
```
src/
├── lib/
│   ├── llm/
│   │   ├── extract.ts           # Readability + jsdom wrapper (LLM-02)
│   │   ├── enrich.ts            # Haiku call + prompt + schema (LLM-03..07,09,10)
│   │   ├── embed.ts             # Voyage wrapper (CLUST-01)
│   │   ├── prompt.ts            # System prompt + tag taxonomy (cached block)
│   │   ├── schema.ts            # zod EnrichmentSchema
│   │   ├── process-item-core.ts # STEPS A–G orchestrator (DI-friendly, unit-testable)
│   │   └── pricing.ts           # Haiku 4.5 + Voyage pricing constants → cost calc for pipeline_runs
│   ├── cluster/
│   │   ├── join-or-create.ts    # pgvector nearest-neighbor + transaction (CLUST-03..07)
│   │   ├── refresh.ts           # centroid/member bookkeeping (CLUST-05..07)
│   │   └── threshold.ts         # read settings('cluster_threshold') with default 0.82 (CLUST-04)
│   └── otel/
│       └── langfuse.ts          # OTel SDK bootstrap + shutdown (LLM-13)
├── trigger/
│   ├── process-pending.ts       # schedules.task(cron:'*/5 * * * *') (LLM-01)
│   ├── process-item.ts          # task, per-item, maxDuration:120 (LLM-01)
│   └── refresh-clusters.ts      # task, debounce-invoked (CLUST-06)
└── (existing files unchanged)

drizzle/
├── 0003_hnsw_index_and_settings_seed.sql   # HNSW index + settings row for threshold
└── meta/ (generated)
```

### Pattern 1: Single-call structured-output with prompt caching

**What:** One Haiku 4.5 `messages.parse()` call returns all enrichment fields. The long stable system prompt (rubric + tag taxonomy + 2–3 few-shot examples) carries `cache_control: ephemeral`; the user block changes per item and is not cached.

**When to use:** Every `process-item` invocation.

**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
// Source: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const EnrichmentSchema = z.object({
  title_zh: z.string().min(1).max(200),
  summary_zh: z.string().min(10).max(800),   // ~2–4 sentences in zh
  score: z.number().int().min(0).max(100),
  recommendation: z.string().min(2).max(80), // one-line 推荐理由
  tags: z.array(z.string()).min(1).max(5),
});

const SYSTEM_PROMPT_PARTS = [
  { type: 'text', text: RUBRIC_AND_TAXONOMY_TEXT, cache_control: { type: 'ephemeral' } },
  // rubric, tag taxonomy, few-shot examples — all static, cacheable.
  // MUST total ≥ 4096 tokens to qualify for Haiku 4.5 prompt caching.
];

const res = await client.messages.parse({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 800,
  system: SYSTEM_PROMPT_PARTS,
  messages: [{
    role: 'user',
    content: [{
      type: 'text',
      text:
        `Source language: ${lang}\n` +
        `Title: ${title}\n\n` +
        `<untrusted_content>\n${articleText}\n</untrusted_content>\n\n` +
        `Return the enrichment JSON.`,
    }],
  }],
  output_config: { format: zodOutputFormat(EnrichmentSchema) },
});

// Usage fields captured on res.usage:
//   input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens
const parsed = res.parsed_output!; // zod-validated
```

**Why caching here:** Haiku 4.5 requires ≥ 4096 tokens in the cached block [CITED: Anthropic prompt-caching docs table]. Pack the system prompt with: (a) the full hotness rubric with anchor examples, (b) the ~30-item tag taxonomy, (c) 2–3 few-shot {input → output} pairs. This easily hits 4k+ tokens and makes `cache_read_input_tokens > 0` automatic on call #2 within 5 minutes. Success Criterion #2 is satisfied structurally.

### Pattern 2: pgvector HNSW nearest-neighbor in ±24h window

**What:** One SELECT finds the nearest prior item; application logic decides join vs create.

**When to use:** Every `process-item` STEP F.

**Example:**
```sql
-- Source: https://neon.com/docs/extensions/pgvector
-- Source: https://github.com/pgvector/pgvector#querying

-- Find nearest item already assigned to a cluster, in ±24h window.
-- Cosine distance: <=>  (similarity = 1 - distance)
SELECT
  i.id,
  i.cluster_id,
  1 - (i.embedding <=> $1::vector) AS cosine_similarity
FROM items i
WHERE i.cluster_id IS NOT NULL
  AND i.embedding IS NOT NULL
  AND i.published_at BETWEEN $2::timestamptz - interval '24 hours'
                         AND $2::timestamptz + interval '24 hours'
ORDER BY i.embedding <=> $1::vector
LIMIT 1;
```
Application logic:
- If `cosine_similarity >= threshold` (threshold from settings, default 0.82): `UPDATE items SET cluster_id = $nearest.cluster_id WHERE id = $itemId`.
- Else: `INSERT INTO clusters (primary_item_id, centroid, member_count, earliest_seen_at, latest_seen_at) VALUES ($itemId, $embedding, 1, $publishedAt, $publishedAt) RETURNING id` → `UPDATE items SET cluster_id = $newClusterId, is_cluster_primary = true WHERE id = $itemId`.

Wrap both paths in a single Drizzle `db.transaction(async tx => { ... })` so the two writes commit atomically.

### Pattern 3: Trigger.dev v4 atomic poller (status → processing claim)

**What:** Use a single `UPDATE ... RETURNING` to atomically flip rows from `pending` to `processing`, preventing a second poller tick from re-claiming the same row.

**When to use:** In `process-pending.run`.

**Example:**
```typescript
// drizzle + raw sql (drizzle-orm does not expose ORDER BY + LIMIT on UPDATE yet; use sql tag)
const claimed = await db.execute(sql`
  UPDATE items
  SET status = 'processing'
  WHERE id IN (
    SELECT id FROM items
    WHERE status = 'pending'
    ORDER BY ingested_at ASC
    LIMIT ${batchSize}
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id
`);
const ids = claimed.rows.map(r => (r as { id: string }).id);
```
`FOR UPDATE SKIP LOCKED` guarantees concurrent-safe pickup if two pollers ever overlap (not expected with 5-min cron + concurrency 4, but free insurance).

### Anti-Patterns to Avoid

- **Running the LLM pipeline inside Next.js API routes.** Explicit LLM-01 prohibition. API routes are request-scoped, have Vercel function timeouts (5–10 min on Pro), no step functions, no retries, no debounce. **Use Trigger.dev.**
- **Multi-call LLM pipeline (translate → summarize → score).** Triples cache-read cost and Langfuse traces without improving output. One structured-output call is the correct shape.
- **Caching the user block / article text.** Article text is unique per item — caching it is pointless and wastes the cache-write budget. Cache only the system prompt (rubric + taxonomy + few-shot).
- **Computing centroid on every item insert.** N×M rewrites per wave. Debounced `refresh-clusters` coalesces the bookkeeping.
- **Running Readability + jsdom on every item unconditionally.** Many RSS feeds already include full `content:encoded` (Phase 2 D-15 stores up to 50kB). Gate on `body_raw.length >= 500` (or similar) and skip fetch+parse when RSS already had enough.
- **Embedding the raw body_raw (50kB).** Voyage charges by tokens; embedding the full body is wasteful and the semantic signal is in the summary. Embed `title_zh + '\n\n' + summary_zh`.
- **Storing secrets in code.** `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` all from env; never `.planning/`.
- **Hand-rolling HNSW index at query time.** Create the index in migration `0003`. Query planner will use it for `ORDER BY embedding <=> $1 LIMIT k`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON from Claude | Text prompt + JSON.parse + regex cleanup | `output_config.format = zodOutputFormat(Schema)` + `messages.parse()` | First-class SDK support; guaranteed schema conformance; zod validation built in. |
| Full-text article extraction | Regex on `<article>` tags, custom CSS selectors per site | `@mozilla/readability` + `jsdom` | Battle-tested algorithm powering Firefox Reader Mode; handles 1000s of sites. |
| Near-duplicate detection for news | MinHash / SimHash shingles | pgvector cosine similarity on Voyage embeddings | Semantic (same event, different wording) — MinHash would miss "OpenAI launches GPT-X" ↔ "OpenAI 发布 GPT-X". [CITED: CLAUDE.md "What NOT to Use" — MinHash] |
| Prompt-injection mitigation | Input sanitizer / LLM-based guard pass | XML-tagged content with `<untrusted_content>` delimiters in the user turn | Anthropic's documented recommendation. [CITED: https://platform.claude.com/docs/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks — example uses `<content>...</content>` tags] |
| LLM cost calculation | Homebrew per-model pricing dicts updated by hand | Langfuse (per-model cost registered) + per-call write to `pipeline_runs.estimated_cost_usd` | Langfuse handles dashboards; pipeline_runs handles admin reports. |
| LLM observability | Hand-wired logger | Langfuse via OTel + Arize Anthropic instrumentor | Captures prompt, output, tokens (including cache_read/cache_write), latency, cost automatically. |
| Worker scheduling / retries / debounce | cron + Redis locks | Trigger.dev v4 `schedules.task`, `retries`, `debounce`, `idempotencyKey` | Already locked as the platform. |
| Rate-limit handling | Manual token bucket | Trigger.dev queue `concurrencyLimit` + SDK retries on 429 | At Haiku 4.5 RPM limits (tier-dependent; documented per Anthropic), concurrency 4 keeps us well inside free/mid tier. |

**Key insight:** Every problem in this phase has a mature open-source or vendor-provided solution. Our code is ~80% glue between libraries, not algorithm.

## Runtime State Inventory

> Not applicable — Phase 3 is greenfield code, not a rename/refactor/migration. No prior state to migrate.

## Common Pitfalls

### Pitfall 1: Prompt-cache miss because system prompt is too short
**What goes wrong:** `cache_read_input_tokens` stays at 0 forever; SC#2 fails.
**Why it happens:** Haiku 4.5 requires ≥ 4096 tokens in the cached block. [CITED: Anthropic prompt-caching docs]
**How to avoid:** Pack the system prompt with the full rubric + ≥ 30 tag taxonomy entries + 2–3 few-shot example pairs (each ~300–500 tokens). Log `input_tokens` on the first call and confirm ≥ 4096.
**Warning signs:** First call runs fine but second call also has `cache_read_input_tokens = 0`. Check response.usage on both calls; if min-threshold unmet, there will be no silent error — just no caching.

### Pitfall 2: `output_config` change invalidates cache
**What goes wrong:** Dev tweaks the schema; cache never hits in production.
**Why it happens:** [CITED] "Changing the `output_config.format` parameter will invalidate any prompt cache for that conversation thread."
**How to avoid:** Freeze `EnrichmentSchema` shape. Version it in `src/lib/llm/schema.ts` with a module-level constant and a comment warning. Any schema change = new Phase 3 sub-phase.
**Warning signs:** Langfuse trace shows 0 cache reads after a deploy.

### Pitfall 3: Readability returns null on podcasts / video / 404s
**What goes wrong:** `readability.parse()` returns `null` for some pages (non-article content).
**Why it happens:** Readability's `isProbablyReaderable` heuristic rejects non-article pages; fetch can 404.
**How to avoid:** Wrap in try/catch + null-check; fall back to `body_raw` with `{extractedFullText: false}` flag. Do NOT dead-letter — the RSS excerpt is still useful.
**Warning signs:** Logs show "Readability.parse returned null" for certain domains.

### Pitfall 4: Voyage rate limit (2000 RPM Tier 1) under burst
**What goes wrong:** A 200-item wave hits 429s.
**Why it happens:** Tier 1 = 2000 RPM / 8M TPM [CITED: voyage rate limits]. 200 concurrent is far under but if the whole fan-out bursts in <1 minute with concurrency higher than 4, we could touch it.
**How to avoid:** Queue `llm-pipeline` with `concurrencyLimit: 4` (sequential enough to stay well under 2000/min). Let Trigger.dev retries (3 attempts, exponential) absorb occasional 429.
**Warning signs:** Langfuse shows 429 responses from Voyage.

### Pitfall 5: pgvector query not using HNSW index
**What goes wrong:** Nearest-neighbor query does a sequential scan; 10k-row cluster table makes it slow.
**Why it happens:** HNSW index not created on `clusters.centroid`, or the query uses `WHERE embedding IS NOT NULL` without the index being on `items.embedding`.
**How to avoid:** Create HNSW index on **`items.embedding`** (not `clusters.centroid` — the nearest-neighbor query hits `items`). Confirm with `EXPLAIN ANALYZE` that the query plan says "Index Scan using items_embedding_hnsw_idx".
**Warning signs:** Query latency > 50ms at 10k rows.

### Pitfall 6: OTel spans not flushed in Trigger.dev worker
**What goes wrong:** Langfuse dashboard shows no traces despite code executing.
**Why it happens:** Trigger.dev recycles the worker process aggressively; OTel spans sit in the batch queue and die with the process.
**How to avoid:** Call `sdk.shutdown()` (alias for forceFlush) in a `finally{}` at the end of every `process-item` run. [CITED: Langfuse Anthropic JS docs — "Call `forceFlush()` at the end of your application"]
**Warning signs:** Traces visible in dev when process lives long enough, but missing on short Trigger.dev runs.

### Pitfall 7: Claiming rows without SKIP LOCKED → double-processing
**What goes wrong:** Two pollers pick up the same item; both call Haiku; duplicate pipeline_runs; second update clobbers first.
**Why it happens:** Naive `UPDATE ... WHERE status='pending' LIMIT N` can interleave between pollers.
**How to avoid:** Use `FOR UPDATE SKIP LOCKED` in the inner SELECT of the claim query. Also: only one `process-pending` scheduled task (no duplicate cron).
**Warning signs:** Duplicate `pipeline_runs` rows for same `item_id` + `task`.

### Pitfall 8: `published_at` used for clustering window is wrong when it's the ingestion timestamp
**What goes wrong:** RSS entries without pubDate get `published_at = now()` (Phase 2 D-13). All such items fall in the same 24h window forever, pulling them into wrong clusters.
**Why it happens:** D-13 intentionally uses `now()` as fallback for items without pubDate.
**How to avoid:** Cluster window is a reasonable 24h; the D-13 fallback is rare (most feeds have pubDate). Accept residual noise; do not over-engineer.
**Warning signs:** Cluster contains items whose titles are unrelated; investigate their `published_at`.

### Pitfall 9: `ingest-hourly` schedules dedup conflict
**What goes wrong:** Phase 2's `ingest-hourly` also enqueues `refresh-clusters` (it shouldn't), double-running the task.
**Why it happens:** Scope creep — planner forgets Phase 2 is frozen.
**How to avoid:** Phase 3 adds new tasks only; does not modify `ingest-hourly.ts`. Cluster refresh is triggered from `process-item` only.
**Warning signs:** `refresh-clusters` runs more often than expected.

## Code Examples

### Langfuse OTel bootstrap (LLM-13)
```typescript
// Source: https://langfuse.com/integrations/model-providers/anthropic-js
// src/lib/otel/langfuse.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { AnthropicInstrumentation } from '@arizeai/openinference-instrumentation-anthropic';
import Anthropic from '@anthropic-ai/sdk';

const instrumentation = new AnthropicInstrumentation();
instrumentation.manuallyInstrument(Anthropic);

export const otel = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
  instrumentations: [instrumentation],
});

let started = false;
export function startOtel() {
  if (started) return;
  otel.start();
  started = true;
}

export async function flushOtel() {
  await otel.shutdown();
}
```

Used in `src/trigger/process-item.ts`:
```typescript
import { startOtel, flushOtel } from '@/lib/otel/langfuse';
startOtel(); // idempotent, at module load
export const processItem = task({
  id: 'process-item',
  maxDuration: 120,
  run: async (payload: { itemId: string }) => {
    try {
      return await runProcessItem({ itemId: payload.itemId });
    } finally {
      await flushOtel();
    }
  },
});
```

### Voyage embedding call (CLUST-01)
```typescript
// Source: https://docs.voyageai.com/docs/embeddings
// src/lib/llm/embed.ts
import { VoyageAIClient } from 'voyageai';

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! });

export async function embedDocument(text: string): Promise<number[]> {
  const res = await voyage.embed({
    input: [text],
    model: 'voyage-3.5',
    inputType: 'document',
    // default dimensions = 1024, matches items.embedding vector(1024)
  });
  return res.data[0].embedding;
}
```

### Join-or-create cluster (CLUST-03..07)
```typescript
// src/lib/cluster/join-or-create.ts
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { items, clusters } from '@/lib/db/schema';
import { getClusterThreshold } from './threshold';

export async function joinOrCreateCluster(params: {
  itemId: bigint;
  embedding: number[];
  publishedAt: Date;
}): Promise<{ clusterId: bigint; joined: boolean }> {
  const threshold = await getClusterThreshold(); // default 0.82 (CLUST-04)
  const embeddingLiteral = `[${params.embedding.join(',')}]`;

  return db.transaction(async (tx) => {
    const nearest = await tx.execute(sql`
      SELECT i.id, i.cluster_id,
             1 - (i.embedding <=> ${embeddingLiteral}::vector) AS cosine_similarity
      FROM items i
      WHERE i.cluster_id IS NOT NULL
        AND i.embedding IS NOT NULL
        AND i.id <> ${params.itemId}
        AND i.published_at BETWEEN ${params.publishedAt}::timestamptz - interval '24 hours'
                               AND ${params.publishedAt}::timestamptz + interval '24 hours'
      ORDER BY i.embedding <=> ${embeddingLiteral}::vector
      LIMIT 1
    `);

    const row = (nearest.rows[0] ?? null) as null | {
      id: string; cluster_id: string; cosine_similarity: number;
    };

    if (row && row.cosine_similarity >= threshold) {
      await tx.update(items)
        .set({ clusterId: BigInt(row.cluster_id) })
        .where(sql`${items.id} = ${params.itemId}`);
      // member_count increment happens in refresh-clusters (debounced)
      return { clusterId: BigInt(row.cluster_id), joined: true };
    }

    const [created] = await tx.insert(clusters)
      .values({
        primaryItemId: params.itemId,
        centroid: params.embedding as unknown as number[],
        memberCount: 1,
        earliestSeenAt: params.publishedAt,
        latestSeenAt: params.publishedAt,
      })
      .returning({ id: clusters.id });

    await tx.update(items)
      .set({ clusterId: created.id, isClusterPrimary: true })
      .where(sql`${items.id} = ${params.itemId}`);

    return { clusterId: created.id, joined: false };
  });
}
```

### HNSW index migration (CLUST-02)
```sql
-- drizzle/0003_hnsw_index_and_settings_seed.sql
-- Source: https://neon.com/docs/extensions/pgvector, pgvector README

CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
  ON items USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- default clustering threshold — admin can change without redeploy (CLUST-04)
INSERT INTO settings (key, value)
VALUES ('cluster_threshold', '0.82')
ON CONFLICT (key) DO NOTHING;
```
`m = 16` and `ef_construction = 64` are the pgvector documented defaults, appropriate for 10k–100k vectors. [CITED: Neon pgvector docs]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Anthropic tool_use to force JSON output | `output_config.json_schema` + `messages.parse()` + `zodOutputFormat` | 2025 H2 Anthropic release | Cleaner API; fewer overhead tokens; cache-compatible (schema is part of cache key though). |
| Manual cost/latency logging | OTel auto-instrumentation via `@arizeai/openinference-instrumentation-anthropic` + `@langfuse/otel` | 2025 H2 Langfuse direction | Zero per-call instrumentation code; prompt-cache fields captured automatically. |
| Legacy `langfuse` v3 SDK with manual `generation()` calls | OTel-based setup (above) | 2026 (langfuse.com docs) | Standard pattern for 2026; the direct SDK still works but is no longer the recommended path for new Anthropic integrations. |
| Separate LLM calls per task (translate, score, tag, ...) | Single structured-output call returning all fields | Native structured outputs GA'd | 3–4× fewer API calls; unified Langfuse trace per item; cache-hit rate improves. |
| pgvector `ivfflat` index | pgvector `hnsw` index | pgvector 0.5.0 (2023), standard by 2026 | Better recall at similar build cost; handles writes without retraining centroids; default for new projects. |

**Deprecated/outdated:**
- Anthropic SDK < 0.26.0 — no `cache_control` support. CLAUDE.md already warns about this. We pin ≥0.90.0.
- `langfuse` direct SDK (v3.x) for Anthropic — still works but not the 2026 recommended path; OTel replaces it.
- `ivfflat` index — still supported but HNSW is the default for new work.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@anthropic-ai/sdk/helpers/zod` accepts Zod 3 schemas (docs example uses v3 syntax) — not confirmed for Zod 4 | Standard Stack / Pattern 1 | Plan step must verify `node_modules/@anthropic-ai/sdk/helpers/zod.d.ts` signature; if Zod 4 breaks, pin `zod@^3.25`. |
| A2 | `voyageai` TS SDK `embed()` signature matches docs (`input`, `model`, `inputType`) | Code Examples — Voyage | Plan step verifies by reading `node_modules/voyageai/**/*.d.ts` — docs show Python shape primarily. Fallback: raw `fetch` to `/v1/embeddings`. |
| A3 | Anthropic Haiku 4.5 respects `<untrusted_content>` XML tags as prompt-injection delimiter | Pattern 1 / Pitfall 1 | Anthropic's own docs use `<content>` tags in their harmlessness-screen example. The exact tag name is convention, not magic — Claude treats XML-looking tags as structured markers regardless of name. LOW risk. |
| A4 | Voyage Tier 1 rate limits (8M TPM, 2000 RPM) are sufficient for 200 items/hour | Pitfall 4 | At concurrency 4 + ~500 tokens/item, we're at ≈ 2 RPS / 1000 TPM — well below limits. LOW risk. |
| A5 | Summary (title_zh + summary_zh) is a better embedding input than body_raw | Architecture / Pattern | Embedding quality could theoretically suffer on very terse summaries. Alternative: embed `title_zh + '\n' + first 512 chars of extracted body`. Plan may adjust after early live signal. MEDIUM risk — easy to flip. |
| A6 | HNSW `m=16, ef_construction=64` is appropriate for our scale (~10k–100k rows in v1) | Code Example — HNSW | These are pgvector defaults. For > 100k rows, bump `m=32, ef_construction=128`. LOW risk at v1 scale. |
| A7 | Scheduled poller every 5 minutes is acceptable freshness for hourly ingestion | Architecture | Ingestion is hourly; 5-min poll = items become published in ≤ 5 min after ingest. Alternative: `*/2 * * * *` for 2-min freshness. LOW risk. |
| A8 | Trigger.dev v4 `debounce` works on `triggerAndWait` as claimed in docs | Cluster-refresh flow | Verified in [CITED] Trigger.dev triggering docs but should be tested live; worst-case fall back to in-task coalescing via a settings row timestamp. LOW risk. |
| A9 | Haiku 4.5 translation quality is "good enough" for Chinese summarization of English AI news | Standard Stack | CLAUDE.md and STATE.md already accepted this decision. No new risk added by this phase. |
| A10 | Full-text extraction is triggered only when `body_raw.length < 500`; threshold picked by intuition | Pattern 1 / Step B | Threshold is tunable; if too low, we skip extraction when we shouldn't (truncated summaries). Plan may set it higher (e.g., 1500) after first live run. MEDIUM risk — easy to tune. |

## Open Questions

1. **Does `@anthropic-ai/sdk` 0.90 export `zodOutputFormat` at `@anthropic-ai/sdk/helpers/zod` with the shape the docs show?**
   - What we know: docs show the import and the usage; 0.90 is post-structured-outputs GA.
   - What's unclear: the `parsed_output` field on the response, and whether zod 3 vs 4 is required.
   - Recommendation: Plan Task 0 does `tsc`-level verification: import the helper in a throwaway file, assert types. If the helper is not yet published in 0.90, fall back to `messages.create` with `output_config.format.json_schema` and manual zod parse of `res.content[0].text`.

2. **Is there a cleaner way to get usage.cache_read_input_tokens onto `pipeline_runs` than reading `res.usage` manually?**
   - What we know: OTel auto-captures usage; `res.usage` fields exist on the Anthropic response object.
   - What's unclear: whether the Arize instrumentor's OpenTelemetry spans expose them in a way we can also read for DB persistence.
   - Recommendation: Read `res.usage` directly. Simple + deterministic. The OTel path is for Langfuse only; `pipeline_runs` is fed by our own code.

3. **Should `refresh-clusters` also update the `centroid` column, or is centroid only advisory?**
   - What we know: Schema has `clusters.centroid vector(1024)` but the nearest-neighbor query in §Pattern 2 goes against `items.embedding`, not `clusters.centroid`.
   - What's unclear: if centroid matters for any v1 query.
   - Recommendation: Keep `centroid` populated by `refresh-clusters` as the mean of member embeddings. Cheap insurance; v2 may move the clustering join against `clusters.centroid` to avoid fan-out lookups.

4. **What's the right tag taxonomy size?**
   - What we know: CLAUDE.md mentions tags "Agent, 模型发布, 编码, Anthropic"; LLM-07 says "up to N auto-tags".
   - What's unclear: final N + full list.
   - Recommendation: Planner drafts a ~30-tag taxonomy (brands: Anthropic/OpenAI/DeepMind/Meta; categories: 模型发布/Agent/编码/多模态/评测/开源/论文/产品/融资/安全/政策; languages: —). Plan step authors it in `src/lib/llm/prompt.ts`. Ceiling on output = 5 tags per item.

5. **How many items should `process-pending` claim per tick?**
   - What we know: 5-min cron; ≤ 200 items per hour nominal; concurrency 4.
   - What's unclear: whether to claim all pending in one tick or rate-limit.
   - Recommendation: `batchSize = 20` per tick. At 4 concurrency × 12 ticks/hour = 48 slots/hr; 20 claim per tick × 12 = 240 items/hr — enough headroom with plenty of slack.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20.9+ (Trigger.dev Cloud) | All worker tasks | ✓ (Phase 1 D-14) | 20.9 | — |
| Neon Postgres + pgvector | Cluster queries, HNSW index | ✓ (Phase 1 INFRA-02) | pgvector extension active | — |
| Anthropic API key | Haiku calls | ✓ (Phase 1 D-07) | `ANTHROPIC_API_KEY` set in Vercel + Trigger.dev Cloud | — |
| Voyage API key | Embeddings | ✓ (Phase 1 D-07) | `VOYAGE_API_KEY` set | — |
| Langfuse credentials | Tracing | ⚠ likely present in Vercel Marketplace integration per CLAUDE.md §9, but unconfirmed for Trigger.dev Cloud env | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` | If missing, LLM-13 will require plan step that adds them to Trigger.dev env + .env.example. Feature degrades to DB-only observability via `pipeline_runs`. |
| Settings row `cluster_threshold` | CLUST-04 runtime adjustment | ✗ (not seeded) | — | Migration 0003 seeds it with default 0.82. |
| HNSW index on items.embedding | CLUST-02 | ✗ (Phase 1 D-10 deferred) | — | Migration 0003 creates it. |

**Missing dependencies with no fallback:**
- None. Langfuse env is the only risk and has a graceful-degradation fallback.

**Missing dependencies with fallback:**
- Langfuse env in Trigger.dev Cloud — plan step confirms via dashboard or adds to env topology. If unresolvable in the short term, skip OTel wiring and rely on `pipeline_runs` for audit.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (existing; see package.json) |
| Config file | `vitest.config.ts` (existing — used by Phase 2) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test && pnpm typecheck` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| LLM-01 | Pipeline runs on Trigger.dev (no API route import) | grep/static | `pnpm test src/lib/llm/process-item-core.test.ts` + CI grep check (no `@/app/api/.../process*` import) | ❌ Wave 0 |
| LLM-02 | Short body_raw triggers Readability fallback | unit | `pnpm test src/lib/llm/extract.test.ts` (mock fetch) | ❌ Wave 0 |
| LLM-03 | English source → Chinese translation in Haiku output | unit (schema) + live smoke (UAT) | `pnpm test src/lib/llm/schema.test.ts` locks `title_zh` non-empty | ❌ Wave 0 |
| LLM-04 | Chinese summary present, 2–4 sentences | unit (schema) + prompt-snapshot | `pnpm test src/lib/llm/schema.test.ts` (summary_zh length bounds) | ❌ Wave 0 |
| LLM-05 | score ∈ [0,100] | unit | `pnpm test src/lib/llm/schema.test.ts` | ❌ Wave 0 |
| LLM-06 | Non-empty recommendation | unit | `pnpm test src/lib/llm/schema.test.ts` | ❌ Wave 0 |
| LLM-07 | ≥ 1 tag, ≤ 5 | unit | same | ❌ Wave 0 |
| LLM-08 | cache_read_input_tokens > 0 on call 2+ | live smoke | `scripts/verify-llm.ts` — runs two items back-to-back, asserts usage on pipeline_runs | ❌ Wave 0 |
| LLM-09 | User content wrapped in `<untrusted_content>` | unit (prompt snapshot) | `pnpm test src/lib/llm/enrich.test.ts` asserts substring | ❌ Wave 0 |
| LLM-10 | Malformed response → dead_letter | unit | `pnpm test src/lib/llm/process-item-core.test.ts` (mock Anthropic to return garbage) | ❌ Wave 0 |
| LLM-11 | Retries exhausted → dead_letter with failure_reason | unit | same test file | ❌ Wave 0 |
| LLM-12 | pipeline_runs row written per LLM call with token fields | unit | `pnpm test src/lib/llm/process-item-core.test.ts` (spy on inserts) | ❌ Wave 0 |
| LLM-13 | Langfuse trace shape | live smoke | Manual dashboard check + `scripts/verify-llm.ts` asserts `LANGFUSE_*` env present | ❌ Wave 0 |
| CLUST-01 | embedding = 1024 floats | unit | `pnpm test src/lib/llm/embed.test.ts` (mock Voyage) | ❌ Wave 0 |
| CLUST-02 | HNSW index exists | migration check | `pnpm test scripts/check-hnsw.ts` queries pg_indexes | ❌ Wave 0 |
| CLUST-03 | Cosine ≥ threshold joins; else creates | unit | `pnpm test src/lib/cluster/join-or-create.test.ts` (mock nearest query) | ❌ Wave 0 |
| CLUST-04 | Threshold read from settings, default 0.82 | unit | `pnpm test src/lib/cluster/threshold.test.ts` | ❌ Wave 0 |
| CLUST-05 | member_count / primary_item_id / earliest/latest updated by refresh | unit | `pnpm test src/lib/cluster/refresh.test.ts` | ❌ Wave 0 |
| CLUST-06 | refresh debounced once per wave | behavioral | debounce call-shape asserted in process-item-core test | ❌ Wave 0 |
| CLUST-07 | primary_item_id = earliest published_at | unit | `pnpm test src/lib/cluster/refresh.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test src/lib/llm/ src/lib/cluster/` (unit subset)
- **Per wave merge:** `pnpm test && pnpm typecheck`
- **Phase gate:** Full suite green + `pnpm verify:llm` live run + 5 ROADMAP SCs observed in Trigger.dev Cloud/Langfuse dashboards before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/llm/extract.test.ts` — covers LLM-02
- [ ] `src/lib/llm/enrich.test.ts` — covers LLM-03,04,05,06,07,09 (prompt snapshot + mocked Anthropic)
- [ ] `src/lib/llm/schema.test.ts` — zod schema boundary tests
- [ ] `src/lib/llm/embed.test.ts` — Voyage wrapper with mocked client
- [ ] `src/lib/llm/process-item-core.test.ts` — orchestrator with DI (mocks of Anthropic, Voyage, db)
- [ ] `src/lib/cluster/threshold.test.ts` — settings-backed read with default
- [ ] `src/lib/cluster/join-or-create.test.ts` — mocked nearest query; join and create branches
- [ ] `src/lib/cluster/refresh.test.ts` — centroid + primary + counts
- [ ] `scripts/verify-llm.ts` — end-to-end live harness (mirrors `scripts/verify-ingest.ts` pattern from Phase 2)
- [ ] `scripts/check-hnsw.ts` — post-migration assertion that `items_embedding_hnsw_idx` exists
- [ ] `package.json` scripts: `"verify:llm": "tsx --env-file=.env.local scripts/verify-llm.ts"`

*(Framework install is not needed — Vitest already in devDependencies.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 3 has no user-facing surface (Auth.js is Phase 5) |
| V3 Session Management | no | Same |
| V4 Access Control | partial | Trigger.dev task endpoints are authenticated by Trigger.dev Cloud; our workers have read-write DB access — no additional control needed, but admin-only retry of dead-letters is Phase 6 |
| V5 Input Validation | yes | zod validates Anthropic output before DB write (LLM-10); `normalizeUrl` already validates input URLs (Phase 2) |
| V6 Cryptography | no | No new cryptography in Phase 3 |
| V7 Data Protection | yes | Anthropic/Voyage/Langfuse API keys MUST stay in env vaults (Phase 1 D-06..08); never log request bodies that contain keys |
| V12 Files & Resources | yes | Readability+jsdom fetches arbitrary URLs from RSS — SSRF surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via RSS body | Tampering | XML-tagged `<untrusted_content>` wrapper [CITED: https://platform.claude.com/docs/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks] + structured output constrains the output surface regardless of content |
| SSRF via Readability fetch on attacker-controlled URL | Tampering / Info Disclosure | URL scheme whitelist (`https`/`http` only), block RFC1918 + `localhost`, timeout 15s, size cap 2 MB, no redirect-follow to a different host; skip fetch for sources marked `language: 'en'` + domain not in known-good list (OPTIONAL — default: fetch anything but with the above guardrails) |
| API-key exfiltration via logs | Info Disclosure | Never log the raw Anthropic/Voyage request bodies that transit keys (they don't — keys are in headers, headers aren't in `res.usage`). `fetchRSSHub` pattern — wrap errors, scrub secrets. Apply same pattern to Voyage and Anthropic wrappers. |
| Log-volume DoS via malformed feed | Denial of Service | Length-cap `body_raw` (Phase 2 already truncates to 50kB) + 120s `maxDuration` per `process-item` prevents a single item from hanging the worker |
| Malformed/huge LLM output consuming output tokens | Resource Abuse | `max_tokens: 800` on Haiku call — hard cap. Response schema keeps output structured and short. |
| Voyage / Anthropic / Langfuse key rotation | — | Rotation is an env-var change; no code change. Document in `docs/llm-pipeline.md` runbook. |

## Sources

### Primary (HIGH confidence)
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching) — TTLs (5m / 1h), cache_control JSON shape, Haiku 4.5 pricing ($1 input / $0.10 cache hit / $1.25 5m-write / $2 1h-write / MTok), minimum cacheable block size = 4096 tokens for Haiku 4.5
- [Anthropic structured outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `output_config.format = zodOutputFormat(Schema)`, `messages.parse()`, `res.parsed_output`, cache-invalidation-on-format-change warning
- [Anthropic tool use docs](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/overview) — tool overhead tokens, `tool_choice`, `strict: true`
- [Anthropic jailbreak mitigation docs](https://platform.claude.com/docs/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks) — XML-tag-wrapped untrusted content pattern
- [Voyage embeddings docs](https://docs.voyageai.com/docs/embeddings) — voyage-3.5 1024-dim default, 32k context, `input_type` values, 1000-text batch size
- [Voyage pricing](https://docs.voyageai.com/docs/pricing) — voyage-3.5 = $0.06/MTok
- [Voyage rate limits](https://docs.voyageai.com/docs/rate-limits) — Tier 1: 8M TPM / 2000 RPM
- [Trigger.dev v4 scheduled tasks](https://trigger.dev/docs/tasks/scheduled) — `schedules.task({ id, cron, run })`, `payload.timestamp`
- [Trigger.dev v4 triggering docs](https://trigger.dev/docs/triggering) — `batch.triggerAndWait`, `queue.concurrencyLimit`, `concurrencyKey`, `idempotencyKey`, `debounce: { key, delay, mode, maxDelay }`
- [Neon pgvector docs](https://neon.com/docs/extensions/pgvector) — HNSW create syntax, `<=>` cosine operator, 1024-dim supported (up to 2000)
- [@mozilla/readability repo](https://github.com/mozilla/readability) — API, jsdom integration, return fields
- [Langfuse Anthropic JS integration](https://langfuse.com/integrations/model-providers/anthropic-js) — OTel + Arize Anthropic instrumentor setup, `sdk.shutdown()` flush semantics

### Secondary (MEDIUM confidence)
- [npm view confirmations 2026-04-21] — `@anthropic-ai/sdk@0.90.0`, `voyageai@0.2.1`, `@mozilla/readability@0.6.0`, `jsdom@29.0.2`, `rss-parser@3.13.0`, `zod@4.3.6`
- CLAUDE.md §7 (pricing table for Haiku 4.5) — confirms $1 input / $5 output base
- Phase 1 01-CONTEXT.md D-10 — `vector(1024)` pinned for Voyage voyage-3.5
- Phase 2 02-CONTEXT.md D-17 — status-only handoff to Phase 3

### Tertiary (LOW confidence)
- Exact Voyage TS SDK (`voyageai` npm pkg) method signatures — verified version exists; internals not deeply inspected. Plan Task 0 should read `node_modules/voyageai/**/*.d.ts`.
- `@anthropic-ai/sdk/helpers/zod` surface in 0.90 — docs show the shape but plan step should verify `helpers/zod.d.ts` exports before writing production code against it.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every lib version npm-verified, docs cross-referenced, no deprecated choices
- Architecture: HIGH — all primitives (schedules.task, batch.triggerAndWait, debounce) are documented v4 features; poller pattern is standard
- Prompt caching + structured outputs: HIGH — docs explicit on Haiku 4.5 TTLs, thresholds, pricing, cache-invalidation edge cases
- Clustering: HIGH — pgvector HNSW syntax and operators are stable; the join-or-create query is a standard pattern
- Langfuse integration: MEDIUM — only one canonical doc page; the "flush in short-lived worker" advice is clear but worth live-testing early
- Voyage TS SDK internals: MEDIUM — docs are mostly Python-shaped; plan should inspect .d.ts before committing to method signatures

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days — stable ecosystem; prompt-caching minimums and voyage-3.5 pricing have been stable for months)

## RESEARCH COMPLETE
