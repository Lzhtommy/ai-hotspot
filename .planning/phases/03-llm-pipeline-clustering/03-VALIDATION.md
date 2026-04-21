---
phase: 3
slug: llm-pipeline-clustering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already configured for Phase 2 ingest unit tests) |
| **Config file** | `vitest.config.ts` + `vitest.setup.ts` at repo root |
| **Quick run command** | `pnpm test --run src/lib/llm src/lib/cluster` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~15 seconds (unit only; live verify:llm excluded) |

Live harness (out-of-band): `pnpm verify:llm` — calls real Haiku/Voyage against a seeded pending item, asserts all 5 SCs.

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run src/lib/llm src/lib/cluster`
- **After every plan wave:** Run `pnpm test --run` (full unit suite) + `pnpm typecheck`
- **Before `/gsd-verify-work`:** Full unit suite green + `pnpm verify:llm` produces a passing report
- **Max feedback latency:** 20 seconds (unit); live `verify:llm` is UAT-gated (~30-60s per item)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CLUST-02, CLUST-04 | — | Migration applies HNSW index + settings seed idempotently | integration | `pnpm db:push && pnpm verify:hnsw` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | LLM-02 | T-03-01 (SSRF/readability) | Readability gated on `body_raw.length < 500`; fetch failure falls back with `extractedFullText=false` flag (never crashes) | unit | `pnpm test --run src/lib/llm/extract` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | LLM-03, LLM-04, LLM-05, LLM-06, LLM-07, LLM-10 | T-03-02 (prompt injection) | Single Haiku structured-output call returns `{title_zh, summary_zh, score∈[0,100], recommendation, tags[]}`; schema-validation failure → terminal dead-letter, not retry | unit | `pnpm test --run src/lib/llm/enrich` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | LLM-08, LLM-12 | — | Cached system prompt ≥ 4096 tokens; `cache_control: ephemeral` emitted; `cache_read_input_tokens` persisted to `pipeline_runs` on call ≥ 2 | unit | `pnpm test --run src/lib/llm/prompt` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 2 | LLM-09 | T-03-02 (prompt injection) | All article body wrapped in `<untrusted_content>…</untrusted_content>` XML before LLM call | unit | `pnpm test --run src/lib/llm/prompt` (asserts delimiter present) | ❌ W0 | ⬜ pending |
| 03-02-05 | 02 | 2 | CLUST-01 | — | `voyage-3.5` embedding request returns 1024-dim vector; batching + retry on 429 | unit | `pnpm test --run src/lib/llm/embed` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | CLUST-03, CLUST-04, CLUST-05, CLUST-07 | — | `joinOrCreateCluster()`: finds nearest cluster within ±24h window where cosine ≥ threshold; else creates; updates member_count, primary_item_id (earliest published_at), earliest/latest_seen_at | unit | `pnpm test --run src/lib/cluster/join-or-create` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | CLUST-04 | — | `getClusterThreshold()` reads `settings` table; falls back to 0.82; cached with TTL | unit | `pnpm test --run src/lib/cluster/threshold` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 3 | CLUST-06 | — | `refreshClustersDebounced()` Trigger.dev debounce key coalesces bursts (unit tests the `buildDebounceKey()` helper; live integration gated to verify:llm) | unit | `pnpm test --run src/lib/cluster/refresh` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 4 | LLM-01 | — | `src/trigger/process-pending.ts` scheduled task claims pending items with `FOR UPDATE SKIP LOCKED`, fans out via `batch.triggerAndWait` | unit | `pnpm test --run src/trigger/process-pending-core` (pure core with injected deps) | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 4 | LLM-11 | — | `src/trigger/process-item.ts`: on transient error (API 5xx, timeout) → Trigger.dev retry up to 3; on schema-validation error → immediate dead-letter; retries exhausted → dead-letter with `failure_reason` | unit | `pnpm test --run src/trigger/process-item-core` | ❌ W0 | ⬜ pending |
| 03-04-03 | 04 | 4 | LLM-13 | — | Langfuse OTel bootstrap wraps Anthropic SDK; `sdk.shutdown()` called in task `finally{}` to flush traces before worker recycle | unit + UAT | `pnpm test --run src/trigger/otel-bootstrap` (unit shape) + UAT dashboard trace visible | ❌ W0 | ⬜ pending |
| 03-04-04 | 04 | 4 | CLUST-06 | — | `src/trigger/refresh-clusters.ts` uses Trigger.dev v4 native `debounce: {key, delay:'60s'}` queue option | integration | `pnpm test --run src/trigger/refresh-clusters` (config shape) | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 5 | SC#1–#5 | — | `scripts/verify-llm.ts` asserts: SC1 fields populated, SC2 cache_read>0 on item≥2, SC3 malformed→dead_letter, SC4 two items→same cluster + count increments, SC5 Langfuse trace URL returned | live | `pnpm verify:llm` (human UAT gate) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/llm/extract.test.ts` — stubs for LLM-02 (short-body gate, fallback flag)
- [ ] `src/lib/llm/enrich.test.ts` — stubs for LLM-03..07, LLM-10 (structured output validation, dead-letter on malformed)
- [ ] `src/lib/llm/prompt.test.ts` — stubs for LLM-08, LLM-09 (cache_control present, untrusted_content delimiters)
- [ ] `src/lib/llm/embed.test.ts` — stubs for CLUST-01 (1024-dim output, rate-limit retry)
- [ ] `src/lib/cluster/join-or-create.test.ts` — stubs for CLUST-03..07
- [ ] `src/lib/cluster/threshold.test.ts` — stubs for CLUST-04
- [ ] `src/lib/cluster/refresh.test.ts` — stubs for CLUST-06
- [ ] `src/trigger/process-pending-core.test.ts` — stubs for LLM-01 (pickup + fan-out logic)
- [ ] `src/trigger/process-item-core.test.ts` — stubs for LLM-11 (retry/dead-letter branching)
- [ ] `scripts/verify-llm.ts` + `scripts/check-hnsw.ts` — SC harnesses
- [ ] `scripts/verify-hnsw.ts` (or integrated into check-hnsw) — asserts HNSW index exists on `items.embedding`

*Existing infrastructure covers:* vitest + `vitest.setup.ts` (Phase 2), `db` singleton, `fetchRSSHub()`, `src/trigger/index.ts` barrel, tsx CLI pattern (`pnpm verify:ingest`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Langfuse dashboard shows per-item trace with cost breakdown | LLM-13, SC#5 | Requires live Langfuse account + trace propagation to hosted UI | Run `pnpm verify:llm`, open Langfuse dashboard, confirm trace exists with Anthropic + Voyage spans and non-zero cost |
| `pipeline_runs.cache_read_input_tokens > 0` across multiple items | LLM-08, SC#2 | Requires live Anthropic prompt-cache hit (≥ 5min window, ≥ 4096-token system prompt) | Run `pnpm verify:llm` against ≥ 2 items within 5 minutes; query `SELECT MAX(cache_read_tokens) FROM pipeline_runs` |
| Cross-source cluster join (SC#4) | CLUST-03, SC#4 | Requires two real sources covering the same event within ±24h; hard to fake in unit tests without contrived embeddings | Seed two sources with articles about the same event; wait for process-pending + refresh-clusters; assert `SELECT cluster_id FROM items WHERE source_id IN (s1, s2)` returns equal values; assert `member_count >= 2` |
| Haiku 4.5 Chinese output quality (~2-4 sentence summary, natural 推荐理由) | LLM-03, LLM-04, LLM-06 | Subjective linguistic quality — requires native Chinese reader | Run `pnpm verify:llm`; review produced `summary_zh` and `recommendation` for naturalness, completeness, no English leakage |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
