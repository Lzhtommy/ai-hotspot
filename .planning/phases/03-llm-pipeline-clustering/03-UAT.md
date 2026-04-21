---
phase: 03-llm-pipeline-clustering
created: 2026-04-21
status: pending
---

# Phase 3 — User Acceptance Test

Gated by the orchestrator after Plan 05 ships. Confirms all 5 ROADMAP Success Criteria live
against the Neon DEV branch + real Anthropic + Voyage + Langfuse APIs.

## Preflight

- [ ] `.env.local` has `DATABASE_URL` pointing at a Neon **DEV branch** (never production)
- [ ] `.env.local` has `ANTHROPIC_API_KEY` (Haiku 4.5 calls)
- [ ] `.env.local` has `VOYAGE_API_KEY` (voyage-3.5 embeddings)
- [ ] `.env.local` has `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`
  (LANGFUSE_* are optional — if absent SC#5 is DEFERRED and verified via `pipeline_runs` fallback)
- [ ] `pnpm check:hnsw` exits 0 — confirms HNSW index is present on items.embedding (Plan 01)
- [ ] `pnpm test --run` exits 0 — all 111+ library unit tests green
- [ ] `pnpm typecheck` exits 0

## Automated Run

**Command:** `pnpm verify:llm`

Expected cost: ~$0.01–0.02 (2 real Haiku calls + 2 real Voyage embedding calls; SC#3 is
DI-injected — no API cost on the malformed fixture path).

Expected duration: 30–60 seconds.

**Expected stdout PASS lines:**

```
[PASS] SC#1 enrichment fields populated
[PASS] SC#2 prompt caching active
[PASS] SC#3 malformed → dead_letter (not published)
[PASS] SC#4 cross-source clustering
```

If any line shows `[FAIL]`, see the Troubleshooting section below before proceeding.

## Per-SC Checklist

### SC#1 — English source item → full Chinese enrichment

- [ ] `pnpm verify:llm` output shows `[PASS] SC#1`
- [ ] The SC#1 detail line shows: `status=published`, `title_zh_len > 0`, `score` in [0, 100],
  `tags` non-empty array
- [ ] (Linguistic check, optional) Open Neon SQL editor and run while verify:llm is mid-execution
  (items are cleaned up in `finally{}`):
  ```sql
  SELECT title_zh, summary_zh, recommendation
  FROM items
  WHERE source_id IN (SELECT id FROM sources WHERE name LIKE '%Sentinel A%')
  ORDER BY ingested_at DESC LIMIT 1;
  ```
  Confirm: Chinese title, 2–4 sentence Chinese summary, Chinese 推荐理由, no English leakage.
- Reference: ROADMAP.md Phase 3 SC#1

### SC#2 — Prompt caching active (cache_read_tokens > 0)

- [ ] `pnpm verify:llm` output shows `[PASS] SC#2` with `MAX(cache_read_tokens) > 0`
- [ ] If FAIL: Confirm both enrich calls (items A and B) ran within 5 minutes — the default
  prompt-cache TTL on Haiku 4.5. verify:llm runs them sequentially in the same process, so
  the window is naturally satisfied.
- [ ] If FAIL: Check system prompt token floor. Run:
  ```bash
  pnpm test --run src/lib/llm/prompt
  ```
  The `buildSystemPrompt >= 4096 tokens` test MUST be green (RESEARCH.md Pitfall 1).
  If it fails, the system prompt is below the Haiku 4.5 caching minimum — add content.
- Reference: ROADMAP.md Phase 3 SC#2

### SC#3 — Malformed LLM response → dead_letter

- [ ] `pnpm verify:llm` output shows `[PASS] SC#3`
- [ ] The SC#3 detail line shows `status=dead_letter` and a non-null `failure_reason`
- [ ] `failure_reason` does not contain API key fragments (looks like `ZodError` or similar
  error class name — check the console output line for the detail field)
- Reference: ROADMAP.md Phase 3 SC#3

### SC#4 — Cross-source clustering

- [ ] `pnpm verify:llm` output shows `[PASS] SC#4`
- [ ] The SC#4 detail line shows `member_count >= 2` and `primaryOk=true`
  (sentinel A, which has an earlier `published_at`, is elected as cluster primary)
- [ ] If FAIL with "items NOT in same cluster": See Troubleshooting → SC#4 below
- Reference: ROADMAP.md Phase 3 SC#4

### SC#5 — Langfuse trace per item with cost breakdown (MANUAL)

- [ ] Open Langfuse dashboard at `${LANGFUSE_BASE_URL}` (default: https://cloud.langfuse.com)
- [ ] Navigate to **Traces** → filter by last 10 minutes
- [ ] Confirm ≥ 2 traces exist matching the verify:llm run timestamp
- [ ] Open the trace for Sentinel A (first run):
  - `input_tokens > 0`
  - `output_tokens > 0`
  - `estimated_cost_usd > 0` (non-zero)
  - No `sk-ant-...` prefix visible in prompt/completion text (privacy check)
- [ ] Open the trace for Sentinel B (second run):
  - Same fields as above
  - `cache_read_input_tokens > 0` (SC#2 Langfuse corroboration)
- [ ] (Optional) Check Voyage embedding spans if OpenInference instruments voyageai
- [ ] If Langfuse credentials are **NOT configured**, record SC#5 as **DEFERRED** and verify
  token data via the `pipeline_runs` table instead:
  ```sql
  SELECT item_id, model, task, input_tokens, cache_read_tokens, estimated_cost_usd
  FROM pipeline_runs
  ORDER BY created_at DESC LIMIT 6;
  ```
  Confirm: 2+ enrich rows with `input_tokens > 0`; at least one with `cache_read_tokens > 0`;
  `estimated_cost_usd` is non-zero. This matches the Phase 2 SC#2 deferral precedent
  (see `.planning/phases/02-ingestion-pipeline/02-UAT.md`).
- Reference: ROADMAP.md Phase 3 SC#5

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| SC#1 FAIL: `status=dead_letter` on sentinel A | Haiku schema-validation failure or API error | Read `items.failure_reason` via Neon SQL editor for the sentinel row (before cleanup runs). If ZodError → check EnrichmentSchema bounds or Haiku output quality; if network error → re-run. |
| SC#1 FAIL: `score=null` or `title_zh` empty | Haiku returned a partial JSON | Check `items.failure_reason`. If the item is `published` with nulls, EnrichmentSchema validation was too permissive — check `src/lib/llm/schema.ts` field constraints. |
| SC#2 FAIL: `MAX(cache_read_tokens)=0` | System prompt < 4096 tokens (Pitfall 1) | Run `pnpm test --run src/lib/llm/prompt` — must assert `estimateTokens >= 4096`. Expand `rubric.md`, `tag-taxonomy.md`, or `few-shot.md` to increase token count. |
| SC#3 FAIL: `status=published` on malformed | `runProcessItem` didn't classify ZodError as terminal | Review `src/lib/llm/process-item-core.ts` catch block — `ZodError` must be in `isTerminal` set. Also verify `ZodError` is imported from `zod/v4` (same subpath used in `process-item-core.ts`). |
| SC#4 FAIL: different clusters | Cosine similarity below threshold OR HNSW index missing | (a) Run `pnpm check:hnsw` — must exit 0. (b) Check threshold: `SELECT value FROM settings WHERE key = 'cluster_threshold';` — should be `0.82`. Try lowering to `0.75` for this run, then restore. (c) Confirm shared-event body in `scripts/verify-llm.ts` is semantically similar — if the two summaries drift too far after Chinese translation, embeddings may diverge. |
| SC#4 FAIL: same cluster but `member_count=1` | `runRefreshClusters` ran before both items were published | Check `scripts/verify-llm.ts` — `runRefreshClusters()` must be called AFTER both `runProcessItem` calls. |
| SC#4 FAIL: `primaryOk=false` | Items A and B have the same `published_at` (timestamp collision) | Confirm sentinel A's `publishedAt` is `nowUtc - 60_000` ms — the 60-second offset ensures A wins the `ORDER BY published_at ASC, id ASC` tiebreak in `runRefreshClusters`. |
| SC#5 DEFERRED | `LANGFUSE_*` env not configured | Acceptable — verify via `pipeline_runs` SQL fallback (see SC#5 checklist above). Note in sign-off. Phase 3 exit criteria allow observability deferral matching Phase 2 precedent. |
| `ANTHROPIC_API_KEY not set` error | `.env.local` missing or not loaded | Confirm file path: `ls -la .env.local`. Confirm the key: `grep ANTHROPIC .env.local`. Then re-run. |
| TypeScript error in verify-llm.ts | Dependency API change | Run `pnpm typecheck` and fix the reported error. |

## Sign-off

- [ ] SC#1 PASS
- [ ] SC#2 PASS
- [ ] SC#3 PASS
- [ ] SC#4 PASS
- [ ] SC#5 PASS (or DEFERRED with `pipeline_runs` fallback observed and noted)

**Verifier:** {name}
**Date:** {YYYY-MM-DD}
**Neon dev branch:** {branch-name-or-URL}
**ANTHROPIC_API_KEY configured:** yes / no
**VOYAGE_API_KEY configured:** yes / no
**LANGFUSE configured:** yes / no / DEFERRED

**Verdict:** PASS · FAIL · DEFERRED (SC#5 only)

---

_Phase: 03-llm-pipeline-clustering_
_Plan: 03-05 (verification harness)_
_Dev branch: Neon dev_
