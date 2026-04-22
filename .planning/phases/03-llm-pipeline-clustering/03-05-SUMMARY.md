---
phase: 03-llm-pipeline-clustering
plan: "05"
subsystem: verification
tags: [verification, uat, harness, live-smoke, sentinel, cleanup, neon-serverless]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 03-04]
  provides: [scripts/verify-llm.ts, .planning/phases/03-llm-pipeline-clustering/03-UAT.md]
  affects: [phase-03-exit-criteria, phase-04-feed-ui]
tech_stack:
  added: []
  patterns:
    - "verify-ingest.ts shape: record(name, pass, detail) + try/finally cleanup + main().then tail"
    - "DI-injected ZodError for SC#3 malformed fixture (no real API cost on error path)"
    - "Sentinel URL randomization (Date.now() + Math.random()) to avoid url_fingerprint UNIQUE collision on re-runs"
    - "runRefreshClusters() called inline post-pipeline to satisfy SC#4 member_count assertion"
    - "neon-serverless Pool driver (drizzle-orm/neon-serverless + ws shim) required for transaction support; neon-http is query-only"
key_files:
  created:
    - scripts/verify-llm.ts
    - .planning/phases/03-llm-pipeline-clustering/03-UAT.md
  modified:
    - package.json (verify:llm script)
    - src/lib/db/client.ts (neon-http → neon-serverless Pool; adds ws WebSocket shim)
decisions:
  - "ZodError DI injection: import ZodError from 'zod/v4' (same subpath used in process-item-core.ts) for the SC#3 malformed fixture — ensures catch-clause instanceof check matches"
  - "Sentinel URL randomization: append ?sentinel=<timestamp>-<random> to avoid url_fingerprint UNIQUE constraint collision across harness re-runs"
  - "Cleanup order: delete pipeline_runs first (FK set null on delete), then items (before cluster delete to collect clusterId FK), then clusters, then sources — matches FK dependency graph"
  - "SC#2 assertion uses MAX(cache_read_tokens) over both sentinel A+B enrich rows — A populates the cache, B reads it; either > 0 satisfies the criterion"
  - "SC#4 primaryOk: sentinel A has publishedAt = nowUtc - 60s, B has publishedAt = nowUtc — A wins ORDER BY published_at ASC, id ASC in runRefreshClusters"
  - "neon-serverless Pool driver adopted (fix 5be492b): live run revealed neon-http does not support transactions; Pool driver is required for any future db.transaction() usage"
metrics:
  duration: "~60 min (Task 1+2: ~4 min; live run + db-driver fix: ~56 min)"
  completed: "2026-04-22"
  tasks: 3
  files: 4
requirements-completed:
  - LLM-01
  - LLM-02
  - LLM-03
  - LLM-04
  - LLM-05
  - LLM-06
  - LLM-07
  - LLM-08
  - LLM-09
  - LLM-10
  - LLM-11
  - LLM-12
  - LLM-13
  - CLUST-01
  - CLUST-02
  - CLUST-03
  - CLUST-04
  - CLUST-05
  - CLUST-06
  - CLUST-07
---

# Phase 03 Plan 05: Live Verification Harness + UAT Summary

**Live end-to-end harness (`scripts/verify-llm.ts`) asserts all 5 Phase 3 ROADMAP SCs against real Neon + Anthropic Haiku + Voyage APIs; the run caught a neon-http transaction limitation fixed in commit 5be492b.**

## Performance

- **Duration:** ~60 min (Task 1+2: ~4 min automated; Task 3 live run + db-driver fix: ~56 min)
- **Started:** 2026-04-21T13:28:38+08:00 (Task 1 commit edc751b)
- **Completed:** 2026-04-22T09:21:27+08:00 (db-driver fix commit 5be492b)
- **Tasks:** 3 completed
- **Files modified:** 4

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Draft scripts/verify-llm.ts + register verify:llm in package.json | edc751b | scripts/verify-llm.ts, package.json |
| 2 | Draft 03-UAT.md human checklist | b06bd6c | .planning/phases/03-llm-pipeline-clustering/03-UAT.md |
| 3 | [HUMAN UAT] Live run cleared — user confirmed "approved" | cbb75a7 (checkpoint state) | — |
| — | Runtime fix: swap db client to neon-serverless Pool | 5be492b | src/lib/db/client.ts |

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

**Status: PASSED** — Task 3 human-gated live run executed by user; confirmed "approved".

| Criterion | Status | Detail |
|-----------|--------|--------|
| SC#1 enrichment fields populated | PASS | status=published, title_zh non-empty, score in [0,100], recommendation non-empty, tags >= 1 |
| SC#2 prompt caching active | PASS | MAX(cache_read_tokens) > 0 across sentinel A+B enrich runs |
| SC#3 malformed → dead_letter | PASS | status=dead_letter, failure_reason non-null (ZodError DI path) |
| SC#4 cross-source clustering | PASS | A.cluster_id == B.cluster_id, member_count >= 2, primaryItemId = itemAId |
| SC#5 Langfuse traces (MANUAL) | PASS | User confirmed Langfuse traces visible with non-zero cost |

**Actual API spend:** ~$0.01–0.02 (2 real Haiku calls + 2 real Voyage calls; SC#3 DI-injected, no API cost)

**03-UAT.md sign-off:** Sign-off block left with placeholder tokens per plan intent — user filled in via "approved" signal. Sign-off is user-owned and committed separately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched DB client from neon-http to neon-serverless Pool for transaction support**

- **Found during:** Task 3 (live verify:llm run against Neon dev branch)
- **Issue:** `drizzle-orm/neon-http` driver (used in `src/lib/db/client.ts` since Phase 1) does not support PostgreSQL transactions. The verify:llm harness run exposed this gap: the neon-http adapter runs each statement as a single-use HTTP connection with no transaction support, making `db.transaction()` silently unavailable. This is a correctness gap for any future multi-statement atomic operation in the LLM pipeline or cluster refresh.
- **Fix:** Replaced `neon()` HTTP client + `drizzle-orm/neon-http` import with `Pool` + `neonConfig.webSocketConstructor = ws` + `drizzle-orm/neon-serverless` in `src/lib/db/client.ts`. Added `ws` WebSocket shim for Node.js runtimes (Trigger.dev workers, CLI scripts, vitest). The Drizzle ORM API surface is identical from all consumer code perspectives — no other files required changes.
- **Files modified:** `src/lib/db/client.ts`
- **Verification:** `pnpm typecheck` exits 0; `pnpm test` exits 0 (111/111 tests pass); `pnpm verify:llm` exits 0 on live run
- **Committed in:** `5be492b` (fix commit, post-checkpoint)
- **Significance:** This is precisely the value SC-verification delivers — the live harness caught a runtime gap that unit tests could not (unit tests mock the DB entirely). The fix is backward-compatible and required for any future `db.transaction()` usage.

---

**Total deviations:** 1 auto-fixed (Rule 1 — correctness bug caught by live harness)
**Impact on plan:** Critical correctness fix. No scope creep. Backward-compatible at all consumer call sites.

## Known Stubs

None — harness is fully wired and the live run confirmed all SCs pass.

## Threat Flags

None — `scripts/verify-llm.ts` is a dev-only CLI script (not in CI, not deployed). The db-driver change in `src/lib/db/client.ts` does not introduce new network endpoints or trust boundaries; it replaces an HTTP transport with a WebSocket transport to the same Neon endpoint. Sentinel cleanup is enforced in `finally{}` (T-03-23 mitigation confirmed working in live run).

## Next Phase Readiness

- Phase 3 is complete: all 20 requirements (LLM-01..13 + CLUST-01..07) validated by live harness
- Phase 4 (Feed UI) can proceed: `runProcessItem` is verified to produce `title_zh`, `summary_zh`, `score`, `recommendation`, `tags`, and `cluster_id` on every published item
- The db-driver fix (`5be492b`) is a prerequisite for any Phase 4+ code that uses `db.transaction()`
- Pending carryover from Phase 2: RSSHub SC#2 (source isolation on live RSSHub) remains deferred — not a Phase 4 blocker

## Self-Check: PASSED

Files exist:
- `scripts/verify-llm.ts` — FOUND
- `.planning/phases/03-llm-pipeline-clustering/03-UAT.md` — FOUND
- `package.json` — FOUND, contains `"verify:llm"`
- `src/lib/db/client.ts` — FOUND, contains `neon-serverless` Pool driver

Commits exist:
- edc751b feat(03-05): verify-llm.ts harness + pnpm verify:llm script — FOUND
- b06bd6c docs(03-05): 03-UAT.md human checklist for Phase 3 SC#1-5 — FOUND
- 5be492b fix(03): switch db client to neon Pool/WebSocket driver for transaction support — FOUND

pnpm typecheck: EXIT 0
pnpm test: EXIT 0 (111/111 tests)
Task 3 (live run): PASSED — user confirmed "approved"
