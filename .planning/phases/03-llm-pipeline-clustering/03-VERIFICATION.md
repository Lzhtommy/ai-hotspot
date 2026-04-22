---
phase: 03-llm-pipeline-clustering
verified: 2026-04-22T09:30:00Z
status: passed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Update 03-UAT.md status field and fill sign-off block (Verifier, Date, branch, verdict)"
    expected: "status: approved, sign-off block completed"
    why_human: "The live run passed (confirmed via 'approved' signal, recorded in 03-05-SUMMARY.md), but 03-UAT.md frontmatter still shows status: pending and the sign-off block has placeholder tokens. The document needs to be updated to reflect the actual outcome for audit completeness."
---

# Phase 3: LLM Pipeline + Clustering — Verification Report

**Phase Goal:** Wire the LLM-driven hotness+summary+clustering pipeline end-to-end so each ingested item is enriched (Chinese title/summary/score/推荐理由/tags), embedded, and assigned to a cluster — with SC#1–5 verified.
**Verified:** 2026-04-22T09:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A newly ingested English-source item appears with Chinese title, Chinese summary, hotness score 0–100, non-empty 推荐理由, and at least one tag — all produced by Claude Haiku | VERIFIED | SC#1 PASS confirmed in live verify:llm run (03-05-SUMMARY.md). `src/lib/llm/enrich.ts` uses Haiku 4.5 via `zodOutputFormat(EnrichmentSchema)`; `process-item-core.ts` orchestrates STEPS A–G including validation and DB write. 45 unit tests pass including schema bounds, ZodError path, and LLM-12 pipeline_runs fields. |
| 2 | The pipeline_runs table shows cache_read_input_tokens > 0 confirming prompt caching is active | VERIFIED | SC#2 PASS confirmed in live run (MAX(cache_read_tokens) > 0). `src/lib/llm/prompt.ts` applies `cache_control: { type: 'ephemeral' }` on the system prompt block; estimated token count is 4098 (above the 4096 Haiku 4.5 minimum); verified by `prompt.test.ts` ≥4096-token assertion. |
| 3 | An item with a malformed LLM response transitions to dead-letter state and is never written to the published feed | VERIFIED | SC#3 PASS confirmed in live run (status=dead_letter, failure_reason non-null). `process-item-core.ts` classifies `ZodError` as `isTerminal=true`, sets `status='dead_letter'`, writes `failureReason`. Unit test case 2 (ZodError dead_letter) and case 3 (retry exhaustion) both green. |
| 4 | Two items from different sources covering the same event are assigned to the same cluster; member_count increments correctly; primary is the earliest item | VERIFIED | SC#4 PASS confirmed in live run (A.cluster_id == B.cluster_id, member_count >= 2, primaryItemId = itemAId). `join-or-create.ts` uses pgvector `<=>` cosine distance within ±24h window in a `db.transaction()`; `refresh.ts` recomputes member_count + primary via `ORDER BY published_at ASC, id ASC`. 16 cluster unit tests green. |
| 5 | Langfuse shows a trace per item with cost breakdown visible | VERIFIED | SC#5 PASS confirmed by user in live run (03-05-SUMMARY.md: "User confirmed Langfuse traces visible with non-zero cost"). `src/lib/llm/otel.ts` bootstraps `NodeSDK` with `LangfuseSpanProcessor` + `AnthropicInstrumentation.manuallyInstrument`; `process-item.ts` calls `startOtel()` at module load and `flushOtel()` in `finally{}`. OTel tests (5 cases) green. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `drizzle/0003_hnsw_index_and_settings_seed.sql` | HNSW index creation + settings threshold seed | VERIFIED | Contains `CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx ... USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)` and `INSERT INTO settings ('cluster_threshold', '0.82') ON CONFLICT DO NOTHING` |
| `drizzle/meta/_journal.json` | Entry idx=3 for migration 0003 | VERIFIED | Entry `"idx": 3, "tag": "0003_hnsw_index_and_settings_seed", "version": "7", "breakpoints": true` confirmed |
| `drizzle/meta/0003_snapshot.json` | Byte-identical copy-forward of 0002_snapshot.json | VERIFIED | File exists; SUMMARY documents byte-identical copy per plan instruction |
| `scripts/check-hnsw.ts` | Post-push assertion script | VERIFIED | File exists; queries `pg_indexes` for `items_embedding_hnsw_idx` and verifies `settings.cluster_threshold=0.82`; registered as `pnpm check:hnsw` |
| `src/lib/llm/client.ts` | Anthropic + Voyage SDK singletons | VERIFIED | File exists; exports `anthropic` + `voyage` |
| `src/lib/llm/schema.ts` | Zod EnrichmentSchema (zod/v4 subpath) | VERIFIED | File exists; exports `EnrichmentSchema`, `Enrichment` |
| `src/lib/llm/prompt.ts` | buildSystemPrompt (cache_control ephemeral + ≥4096 tokens) + buildUserMessage (untrusted_content) | VERIFIED | `cache_control: { type: 'ephemeral' }` on system block; `<untrusted_content>` wrapper on user message; 4098 estimated tokens |
| `src/lib/llm/extract.ts` | SSRF-guarded full-text extraction | VERIFIED | `isPrivateHost()` blocklist covering RFC1918 + localhost + ::1; 14 extract tests pass |
| `src/lib/llm/enrich.ts` | Claude Haiku 4.5 structured-output enrichment | VERIFIED | Uses `zodOutputFormat(EnrichmentSchema as never)`; propagates `usage` with cache tokens |
| `src/lib/llm/embed.ts` | Voyage voyage-3.5 1024-dim embedding | VERIFIED | `model: 'voyage-3.5'`, length check `!== 1024` raises `EmbedError`; 5 embed tests pass |
| `src/lib/llm/pricing.ts` | Per-call cost estimation for pipeline_runs | VERIFIED | File exists; 9 pricing tests pass |
| `src/lib/llm/otel.ts` | Langfuse OTel bootstrap (startOtel/flushOtel) | VERIFIED | `AnthropicInstrumentation.manuallyInstrument(Anthropic)` at module load; `NodeSDK` with `LangfuseSpanProcessor`; idempotent `started` guard; `flushOtel` awaits `sdk.shutdown()` |
| `src/lib/llm/process-item-core.ts` | Orchestrator STEPS A–G + dead-letter + pipeline_runs write | VERIFIED | STEPS A–G present; `ZodError` classified terminal; two `pipeline_runs` rows per item (enrich + embed); `realJoinOrCreateCluster` wired as default dep |
| `src/lib/cluster/threshold.ts` | getClusterThreshold() with settings-backed read + 0.82 default | VERIFIED | `DEFAULT_THRESHOLD = 0.82`; settings key `'cluster_threshold'`; `parseFloat` guard; 4 threshold tests pass |
| `src/lib/cluster/join-or-create.ts` | Nearest-neighbor pgvector + transactional join-or-create | VERIFIED | `db.transaction()`; `embedding <=>` cosine distance; `±24 hours` window; `isClusterPrimary: true` on new cluster; 6 join-or-create tests pass |
| `src/lib/cluster/refresh.ts` | Bulk refresh: member_count/primary/earliest/latest/centroid + buildDebounceOpts | VERIFIED | `ORDER BY published_at ASC, id ASC`; `AVG(embedding)::vector` centroid; `isClusterPrimary` flip; `buildDebounceOpts()` returns `{ key: 'refresh-clusters', delay: '60s' }`; 6 refresh tests pass |
| `src/trigger/process-pending.ts` | Scheduled poller (*/5) + atomic claim (FOR UPDATE SKIP LOCKED) + fan-out + debounced refresh enqueue | VERIFIED | `cron: '*/5 * * * *'`; `FOR UPDATE SKIP LOCKED`; `batch.triggerAndWait`; `BATCH_SIZE = 20`; `refreshClusters.trigger(undefined, { debounce: opts })` (Path A confirmed) |
| `src/trigger/process-item.ts` | Per-item task with OTel flush + maxDuration=120 + queue concurrency | VERIFIED | `startOtel()` at module load; `flushOtel()` in `finally{}`; `maxDuration: 120`; `queue: { name: 'llm-pipeline', concurrencyLimit: 4 }` |
| `src/trigger/refresh-clusters.ts` | Debounced bulk bookkeeping task, maxDuration=180 | VERIFIED | `id: 'refresh-clusters'`; `maxDuration: 180`; calls `runRefreshClusters()` |
| `src/trigger/index.ts` | Barrel exports Phase 3 tasks | VERIFIED | Exports `process-pending`, `process-item`, `refresh-clusters` alongside Phase 1/2 tasks |
| `src/lib/db/client.ts` | neon-serverless Pool driver (transaction support fix) | VERIFIED | `import { Pool, neonConfig } from '@neondatabase/serverless'`; `drizzle-orm/neon-serverless`; `ws` WebSocket shim; commit 5be492b |
| `scripts/verify-llm.ts` | Live SC harness for SC#1–4 (auto) + SC#5 (manual URL print) | VERIFIED | Imports `runProcessItem` + `runRefreshClusters`; asserts `cache_read_tokens`; `dead_letter` check; `finally{}` cleanup; `process.exit` only in tail; `ZodError` from `zod/v4` for SC#3 DI |
| `.planning/phases/03-llm-pipeline-clustering/03-UAT.md` | Human checklist SC#1–5 + preflight + troubleshooting + sign-off | VERIFIED (with note) | File exists; all 5 SCs documented; preflight, troubleshooting table, and sign-off block present. Frontmatter `status: pending` and sign-off placeholder tokens not yet updated to reflect the live PASS — see Human Verification section below. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `drizzle/0003_hnsw_index_and_settings_seed.sql` | `items.embedding` column | `CREATE INDEX USING hnsw (embedding vector_cosine_ops)` | WIRED | Pattern `hnsw (embedding vector_cosine_ops)` confirmed in migration SQL |
| `src/lib/cluster/join-or-create.ts` | `src/lib/cluster/threshold.ts` | `import { getClusterThreshold }` | WIRED | Import present; threshold injected as `params.deps?.getThreshold ?? getClusterThreshold` |
| `src/lib/cluster/join-or-create.ts` | `items` table + pgvector | `ORDER BY i.embedding <=> $1::vector LIMIT 1` | WIRED | Pattern `embedding <=>` confirmed in file |
| `src/lib/cluster/refresh.ts` | `clusters` table + items aggregate | `MIN(published_at), COUNT, AVG(embedding)` | WIRED | Pattern `MIN(.*published_at)` and `AVG(embedding)` confirmed |
| `src/trigger/process-pending.ts` | `items` table + FOR UPDATE SKIP LOCKED | `UPDATE items SET status='processing' WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING id` | WIRED | Pattern `FOR UPDATE SKIP LOCKED` confirmed |
| `src/trigger/process-pending.ts` | `src/trigger/process-item.ts` | `batch.triggerAndWait<typeof processItem>` | WIRED | Pattern `batch.triggerAndWait` confirmed |
| `src/trigger/process-item.ts` | `src/lib/llm/process-item-core.ts` + `src/lib/llm/otel.ts` | `runProcessItem` + `startOtel/flushOtel` | WIRED | `flushOtel()` in `finally{}` confirmed |
| `src/trigger/process-pending.ts` | `src/trigger/refresh-clusters.ts` via Trigger.dev debounce | `refreshClusters.trigger(undefined, { debounce: buildDebounceOpts() })` | WIRED | Path A confirmed; pattern `refresh-clusters` in debounce opts |
| `scripts/verify-llm.ts` | `src/lib/llm/process-item-core.ts` | `import runProcessItem` | WIRED | Import confirmed |
| `scripts/verify-llm.ts` | `src/lib/cluster/refresh.ts` | `import runRefreshClusters` | WIRED | Import confirmed |
| `scripts/verify-llm.ts` | `pipeline_runs` table | `SELECT MAX(cache_read_tokens)` for SC#2 | WIRED | Pattern `cache_read_tokens` confirmed in harness |
| `src/lib/llm/process-item-core.ts` | `src/lib/cluster/join-or-create.ts` | `import { joinOrCreateCluster as realJoinOrCreateCluster }` | WIRED | Import at line 39; default dep wired at line 74 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `process-item-core.ts` | `enrichRes` (title_zh, summary_zh, score, recommendation, tags) | `enrichWithClaude()` → real Anthropic Haiku call | Yes — confirmed by SC#1 live PASS | FLOWING |
| `process-item-core.ts` | `embedRes` (embedding number[]) | `embedDocument()` → real Voyage voyage-3.5 call | Yes — confirmed by SC#4 live PASS (embeddings were similar enough to cluster) | FLOWING |
| `process-item-core.ts` | `pipeline_runs` rows (cache_read_tokens) | `db.insert(pipelineRuns).values(...)` with `enrichRes.usage` | Yes — SC#2 live PASS confirmed MAX(cache_read_tokens) > 0 | FLOWING |
| `join-or-create.ts` | `clusterId` | pgvector `<=>` query over live `items.embedding` column | Yes — SC#4 live PASS confirmed cluster assignment | FLOWING |
| `otel.ts` | Langfuse traces | `LangfuseSpanProcessor` + `AnthropicInstrumentation` via `NodeSDK` | Yes — SC#5 PASS confirmed traces visible in Langfuse dashboard | FLOWING |

### Behavioral Spot-Checks

Live `pnpm verify:llm` run against Neon dev + Anthropic + Voyage (not reproducible in CI). Results recorded from 03-05-SUMMARY.md Task 3.

| Behavior | Result | Status |
|----------|--------|--------|
| SC#1: English item → Chinese enrichment (title_zh, summary_zh, score, recommendation, tags) | status=published, all fields present | PASS |
| SC#2: Prompt caching active (MAX cache_read_tokens > 0) | MAX(cache_read_tokens) > 0 | PASS |
| SC#3: Malformed ZodError fixture → dead_letter (DI-injected, no API cost) | status=dead_letter, failure_reason non-null | PASS |
| SC#4: Two cross-source same-event items → same cluster, member_count >= 2, primary = earliest | A.cluster_id == B.cluster_id, member_count >= 2, primaryItemId = itemAId | PASS |
| SC#5: Langfuse traces visible with non-zero cost | User confirmed in live run | PASS |
| Unit test suite (pnpm test --run) | 111/111 pass (03-04-SUMMARY.md) | PASS |
| pnpm typecheck | Exit 0 (03-04-SUMMARY.md, 03-05-SUMMARY.md) | PASS |

### Requirements Coverage

All 20 Phase 3 requirements are satisfied. Plan 05's `requirements` field claims all 20 IDs explicitly (LLM-01..13 + CLUST-01..07), consistent with verify:llm being the single gate that observes them in live operation. Each requirement maps to implementation verified above.

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| LLM-01 | 03-04, 03-05 | Pipeline runs on Trigger.dev workers (never in Next.js routes) | SATISFIED | `process-pending.ts` + `process-item.ts` are Trigger.dev v4 tasks; `process-item.ts` has queue/concurrency declared inline |
| LLM-02 | 03-02, 03-05 | Full-text extraction (Readability) with fallback | SATISFIED | `extract.ts` SSRF-guarded; falls back to `body_raw` with `extracted=false`; 14 extract tests |
| LLM-03 | 03-02, 03-05 | English items translated to Chinese by Haiku 4.5 | SATISFIED | `prompt.ts` buildUserMessage includes translation instruction; SC#1 confirmed Chinese output |
| LLM-04 | 03-02, 03-05 | Chinese summary (2–4 sentences) per item | SATISFIED | `EnrichmentSchema` `summary_zh: z.string().min(10)`; SC#1 PASS |
| LLM-05 | 03-02, 03-05 | Hotness score 0–100 per item | SATISFIED | `score: z.number().min(0).max(100)` in schema; SC#1 PASS |
| LLM-06 | 03-02, 03-05 | One-line 推荐理由 per item | SATISFIED | `recommendation: z.string().min(2)` in schema; SC#1 PASS |
| LLM-07 | 03-02, 03-05 | Up to N auto-tags per item | SATISFIED | `tags: z.array(...).min(1).max(5)` in schema; SC#1 PASS |
| LLM-08 | 03-02, 03-05 | Prompt caching enabled; cache_read_input_tokens > 0 verified | SATISFIED | System prompt has `cache_control: ephemeral`; 4098 tokens (≥4096 minimum); SC#2 PASS |
| LLM-09 | 03-02, 03-05 | Article text wrapped in `<untrusted_content>` delimiters | SATISFIED | `buildUserMessage` wraps text in `<untrusted_content>...</untrusted_content>`; test confirms |
| LLM-10 | 03-02, 03-05 | Invalid LLM outputs validated; invalid → dead-letter | SATISFIED | `ZodError` classified `isTerminal=true`; SC#3 PASS |
| LLM-11 | 03-04, 03-05 | Failed items → `failed`; max retries exceeded → dead-letter | SATISFIED | `process-item.ts` retries inherited from `trigger.config.ts` (maxAttempts=3); `process-item-core.ts` `retriesExhausted` path sets `dead_letter` |
| LLM-12 | 03-02, 03-05 | Token usage logged to `pipeline_runs` | SATISFIED | Two `pipeline_runs` rows per item (enrich + embed) with input/cache-read/cache-write/output tokens; SC#2 evidence |
| LLM-13 | 03-04, 03-05 | LLM pipeline calls instrumented with Langfuse traces | SATISFIED | `otel.ts` Langfuse OTel bootstrap; `startOtel`/`flushOtel` in `process-item.ts`; SC#5 PASS |
| CLUST-01 | 03-02, 03-05 | Voyage voyage-3.5 1024-dim embedding per published item | SATISFIED | `embed.ts` uses `model: 'voyage-3.5'`; 1024-dim length check enforced |
| CLUST-02 | 03-01, 03-05 | Embeddings stored with HNSW index | SATISFIED | `0003_hnsw_index_and_settings_seed.sql` creates `items_embedding_hnsw_idx`; `pnpm check:hnsw` exits 0 |
| CLUST-03 | 03-03, 03-05 | Cluster assignment: nearest ≥ threshold within ±24h → join; else create | SATISFIED | `join-or-create.ts` implements pgvector `<=>` within ±24h window; SC#4 PASS |
| CLUST-04 | 03-01, 03-03, 03-05 | Threshold stored in `settings` table, adjustable without redeploy | SATISFIED | `0003` migration seeds `cluster_threshold=0.82`; `threshold.ts` reads live from settings |
| CLUST-05 | 03-03, 03-05 | Cluster tracks member_count, primary_item_id, earliest_seen_at, latest_seen_at | SATISFIED | `refresh.ts` recomputes all 4 fields + centroid; SC#4 PASS (member_count >= 2) |
| CLUST-06 | 03-03, 03-04, 03-05 | Refresh task debounced (coalesces bursts) | SATISFIED | `buildDebounceOpts()` returns `{ key: 'refresh-clusters', delay: '60s' }`; Path A debounce confirmed in `process-pending.ts` |
| CLUST-07 | 03-03, 03-05 | Primary item = earliest timestamp (stable, tiebreak by id ASC) | SATISFIED | `refresh.ts` uses `ORDER BY published_at ASC, id ASC LIMIT 1`; SC#4 primaryOk=true |

### Anti-Patterns Found

No blockers or warnings. Scan of key Phase 3 files:

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `src/trigger/process-pending.ts` | `console.error` for debounce failure | Info | Intentional — non-fatal, logs only `err.name` per T-03-19 mitigation. Not a stub. |
| `src/lib/cluster/refresh.ts` | Two separate `db.update(items)` calls for is_cluster_primary flip | Info | Intentional design decision (clear all, then set new primary). Not a stub; documented in Plan 03 SUMMARY. |
| `scripts/verify-llm.ts` | `void sentinelItemIds` to suppress unused-var | Info | Harmless TypeScript strict-mode workaround. |

No `return null`, empty handlers, placeholder comments, or hardcoded empty data found in Phase 3 production code.

### Human Verification Required

#### 1. Update 03-UAT.md sign-off

**Test:** Open `.planning/phases/03-llm-pipeline-clustering/03-UAT.md`. Change `status: pending` to `status: approved` in the frontmatter. Fill in the sign-off block at the bottom:
- **Verifier:** your name
- **Date:** 2026-04-22 (or the actual run date)
- **Neon dev branch:** the branch used
- **ANTHROPIC_API_KEY configured:** yes
- **VOYAGE_API_KEY configured:** yes
- **LANGFUSE configured:** yes (or note if deferred)
- **Verdict:** PASS

Commit the updated file.

**Expected:** `03-UAT.md` frontmatter shows `status: approved`; sign-off block is filled (not placeholder tokens).

**Why human:** The live `pnpm verify:llm` run was performed by the user who replied "approved"; all 5 SCs passed per `03-05-SUMMARY.md`. The document simply needs its sign-off block updated by the verifier to close the audit trail. This is a documentation step, not a re-run.

---

## Gaps Summary

No functional gaps. All 5 ROADMAP Success Criteria passed in the live end-to-end `pnpm verify:llm` run. All 20 requirements (LLM-01..13, CLUST-01..07) are implemented and verified.

One documentation task remains: the `03-UAT.md` sign-off block was intentionally left for the human verifier to fill in (per Plan 05 Task 2 design — "Sign-off is user-owned and committed separately"). The live PASS is fully documented in `03-05-SUMMARY.md`. This is an administrative closure step and does not block Phase 4.

Notable delivery items:
- **neon-http → neon-serverless Pool fix** (commit 5be492b): the live harness caught a transaction-support gap that unit tests could not. The fix is backward-compatible and required for any future `db.transaction()` usage.
- **zod/v4 subpath requirement**: `zodOutputFormat` in `@anthropic-ai/sdk@0.90.0` requires zod v4 internally; `EnrichmentSchema` uses `import { z } from 'zod/v4'` with `as never` cast.
- **Prompt token floor**: original prompt content was below the 4096-token Haiku 4.5 cache minimum; expanded to 4098 estimated tokens across `rubric.md`, `tag-taxonomy.md`, `few-shot.md`.

---

_Verified: 2026-04-22T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
