---
phase: 03-llm-pipeline-clustering
plan: "05"
subsystem: verification
tags: [verification, uat, harness, live-smoke, sentinel, cleanup]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 03-04]
  provides: [scripts/verify-llm.ts, .planning/phases/03-llm-pipeline-clustering/03-UAT.md]
  affects: [phase-03-exit-criteria]
tech_stack:
  added: []
  patterns:
    - "verify-ingest.ts shape: record(name, pass, detail) + try/finally cleanup + main().then tail"
    - "DI-injected ZodError for SC#3 malformed fixture (no real API cost on error path)"
    - "Sentinel URL randomization (Date.now() + Math.random()) to avoid url_fingerprint UNIQUE collision on re-runs"
    - "runRefreshClusters() called inline post-pipeline to satisfy SC#4 member_count assertion"
key_files:
  created:
    - scripts/verify-llm.ts
    - .planning/phases/03-llm-pipeline-clustering/03-UAT.md
  modified:
    - package.json (verify:llm script)
decisions:
  - "ZodError DI injection: import ZodError from 'zod/v4' (same subpath used in process-item-core.ts) for the SC#3 malformed fixture — ensures catch-clause instanceof check matches"
  - "Sentinel URL randomization: append ?sentinel=<timestamp>-<random> to avoid url_fingerprint UNIQUE constraint collision across harness re-runs"
  - "Cleanup order: delete pipeline_runs first (FK set null on delete), then items (before cluster delete to collect clusterId FK), then clusters, then sources — matches FK dependency graph"
  - "SC#2 assertion uses MAX(cache_read_tokens) over both sentinel A+B enrich rows — A populates the cache, B reads it; either > 0 satisfies the criterion"
  - "SC#4 primaryOk: sentinel A has publishedAt = nowUtc - 60s, B has publishedAt = nowUtc — A wins ORDER BY published_at ASC, id ASC in runRefreshClusters"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-21"
  tasks: 2
  files: 3
---

# Phase 03 Plan 05: Live Verification Harness + UAT Summary

**One-liner:** Phase 3 live verification harness (`scripts/verify-llm.ts`) + UAT checklist (`03-UAT.md`) asserting all 5 ROADMAP SCs against real Anthropic + Voyage + Neon dev APIs; human-gated at Task 3 for live run + Langfuse UAT.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Draft scripts/verify-llm.ts + register verify:llm in package.json | edc751b | scripts/verify-llm.ts, package.json |
| 2 | Draft 03-UAT.md human checklist | b06bd6c | .planning/phases/03-llm-pipeline-clustering/03-UAT.md |

## Task 3 Status: AWAITING HUMAN UAT

Task 3 is a `checkpoint:human-verify` gate. The automated script (`pnpm verify:llm`) must be run
by the operator against the live Neon DEV branch with real API credentials. See checklist below.

## What Was Built

### scripts/verify-llm.ts

Live SC harness that:
1. Seeds 3 sentinel sources + 3 sentinel items (A, B, Malformed)
2. Runs `runProcessItem(itemAId)` — real Haiku + real Voyage (populates prompt cache)
3. Runs `runProcessItem(itemBId)` — real Haiku + real Voyage (should cache-read from A)
4. Runs `runProcessItem(itemMalId, { deps: { enrichWithClaude: ZodError-injector } })` — no API cost
5. Runs `runRefreshClusters()` to update cluster member_count
6. Asserts SC#1 (enrichment fields), SC#2 (cache_read_tokens>0), SC#3 (dead_letter), SC#4 (cluster)
7. Prints Langfuse dashboard URL for SC#5 manual UAT
8. Cleans up ALL sentinel rows in `finally{}` regardless of assertion outcome

Key design decisions following verify-ingest.ts template:
- `process.exit()` only in `.then()/.catch()` tail — never inside `main()` (avoids finally bypass)
- Sentinel URL randomization (`?sentinel=<ts>-<random>`) avoids url_fingerprint UNIQUE collision on re-runs
- `ZodError` imported from `zod/v4` to match the `catch` clause in `process-item-core.ts`

### 03-UAT.md

Human checklist covering:
- 5-item preflight (env vars, HNSW, tests, typecheck)
- Per-SC verification steps with exact SQL queries
- SC#5 deferral protocol (pipeline_runs fallback matching Phase 2 precedent)
- Troubleshooting table with root cause + fix for every SC failure mode
- Sign-off block for verifier name, date, branch, verdict

## Live Run Results

**Status: PENDING** — Task 3 (human-gated live run) not yet executed.

To be filled in after `pnpm verify:llm` runs against live dev branch:

| Criterion | Status | Detail |
|-----------|--------|--------|
| SC#1 enrichment fields populated | PENDING | — |
| SC#2 prompt caching active | PENDING | — |
| SC#3 malformed → dead_letter | PENDING | — |
| SC#4 cross-source clustering | PENDING | — |
| SC#5 Langfuse traces (MANUAL) | PENDING | — |

Actual API spend: PENDING (expected ~$0.01–0.02 per run)
Langfuse trace URLs: PENDING

## Deviations from Plan

None — plan executed exactly as written. The harness content in the plan was followed
verbatim with minor improvements: more explicit cleanup ordering (pipeline_runs → items →
clusters → sources) and a `String()` comparison for BigInt cluster IDs to avoid `===`
identity comparison on different BigInt objects.

## Known Stubs

None — harness is fully wired. All imports resolve (pnpm typecheck exits 0). The script
does not execute (live API calls) until the human runs `pnpm verify:llm`.

## Threat Flags

None — this plan introduces a dev-only CLI script. No new network endpoints, auth paths,
or schema changes. Sentinel cleanup is enforced in `finally{}` (T-03-23 mitigation).

## Self-Check: PASSED

Files exist:
- `scripts/verify-llm.ts` — FOUND
- `.planning/phases/03-llm-pipeline-clustering/03-UAT.md` — FOUND
- `package.json` — FOUND, contains `"verify:llm"`

Commits exist:
- edc751b feat(03-05): verify-llm.ts harness + pnpm verify:llm script — FOUND
- b06bd6c docs(03-05): 03-UAT.md human checklist for Phase 3 SC#1-5 — FOUND

pnpm typecheck: EXIT 0
Task 3 (live run): AWAITING HUMAN
