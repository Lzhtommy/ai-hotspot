---
phase: 02-ingestion-pipeline
plan: 03
subsystem: ingestion
tags: [trigger-dev-v4, schedules, batch-fan-out, drizzle, d-08, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: "src/lib/rsshub.ts (fetchRSSHub), src/lib/db/{client,schema}.ts (drizzle+Neon), src/trigger/health-probe.ts (v4 task shape), trigger.config.ts (project-level maxDuration)"
  - phase: 02-ingestion-pipeline
    provides: "Plan 01 (items.published_at_source_tz column live on Neon dev branch); Plan 02 (normalize-url, fingerprint, parse-rss, RssEntry type + vitest infra)"
provides:
  - "src/lib/ingest/fetch-source-core.ts — runFetchSource(sourceId, rssUrl, deps?): testable orchestrator for fetch→parse→normalize→insert→source-row-update with D-08 counter semantics"
  - "src/trigger/fetch-source.ts — Trigger.dev v4 task (id='fetch-source', maxDuration=90) that delegates to runFetchSource"
  - "src/trigger/ingest-hourly.ts — Trigger.dev v4 schedules.task (id='ingest-hourly', cron='0 * * * *') that fans out via batch.triggerAndWait"
  - "src/trigger/index.ts — barrel now exports all three Phase 2 tasks"
  - "vitest.setup.ts — placeholder DATABASE_URL so the transitive db-client import does not throw during unit tests"
affects:
  - "02-04 (seed sources + end-to-end verification will consume these tasks)"
  - "02-05 (live verification depends on the fan-out topology being correct)"
  - "03-llm-pipeline (items with status='pending' are the handoff queue per D-17)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-core + thin-adapter split: business logic in src/lib/ingest/fetch-source-core.ts (unit-testable against injected deps); Trigger.dev task file is a ~20-line delegation shell"
    - "Dependency injection via `deps?: { db, fetchRSSHub, now }` parameter with default imports — tests inject fakes, production uses real client"
    - "Drizzle .set() inline object literal (NOT Record<string, unknown>) so strongly-typed update payloads pass strict-mode typecheck while permitting SQL-expression values on individual fields"
    - "Vitest global setup file for eager module-load env vars (placeholder DATABASE_URL) — unit tests never contact a real DB"

key-files:
  created:
    - "src/lib/ingest/fetch-source-core.ts"
    - "src/lib/ingest/fetch-source-core.test.ts"
    - "src/trigger/fetch-source.ts"
    - "src/trigger/ingest-hourly.ts"
    - "vitest.setup.ts"
  modified:
    - "src/trigger/index.ts"
    - "vitest.config.ts"

key-decisions:
  - "Trigger.dev v4 batch.triggerAndWait v4 signature is Array<{id, payload}> directly — no separate positional task-id arg. Plan's research findings documented a v3-style call; corrected as a Rule 1 fix."
  - "D-08 success-path update uses an inline object literal with conditional SQL expression: `consecutiveEmptyCount: newCount >= 1 ? 0 : sql`${sources.consecutiveEmptyCount} + 1`` — both branches emit the same three keys; test harness verifies via Object.keys()."
  - "D-08 error-path update ONLY sets consecutiveErrorCount (increment via SQL); does NOT touch lastFetchedAt or consecutiveEmptyCount — verified by test."
  - "Tests inject `deps.db` so production Neon client is never instantiated — but the transitive import of `src/lib/db/client.ts` still triggers eager `neon(process.env.DATABASE_URL!)`. Mitigation: vitest.setup.ts sets a placeholder DATABASE_URL before any module loads."

patterns-established:
  - "Core-logic / task-wrapper split for Trigger.dev tasks — the Trigger.dev file should be a thin adapter; business logic lives in a pure, testable src/lib/* module. Plan 04+ should follow this pattern."
  - "Env-bootstrap via vitest.setup.ts for unit tests of code that transitively imports the Drizzle+Neon client"

requirements-completed: [INGEST-01, INGEST-04, INGEST-06, INGEST-07, INGEST-08]

# Metrics
duration: 5min
completed: 2026-04-20
---

# Phase 02 Plan 03: Trigger.dev v4 Ingestion Tasks Summary

**`ingest-hourly` (schedules.task, cron `0 * * * *`) fans out via `batch.triggerAndWait` to `fetch-source` (task, maxDuration 90) which delegates to a test-locked `runFetchSource` core orchestrator encoding D-08 counter semantics and D-14 insert-field contract.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-20T08:48:02Z
- **Completed:** 2026-04-20T08:53:44Z
- **Tasks:** 4
- **Files created:** 5
- **Files modified:** 2

## Accomplishments

- `runFetchSource` orchestrator composes fetchRSSHub → parseRSS → normalizeUrl → urlFingerprint → contentHash → ON CONFLICT DO NOTHING insert → D-08 source-row update
- 8 vitest tests lock the contract: happy path (2 new items, counters reset), all-dupes (empty counter increments, error resets), empty feed, fetch error (error counter only, no last_fetched_at touch), parse error (same as fetch error), mixed (1 new / 1 dupe → counters reset ≥1 branch), D-14 field persistence, D-16 normalized-URL storage
- `fetch-source` Trigger.dev v4 task (id='fetch-source', maxDuration=90) is a 30-line adapter delegating to the core
- `ingest-hourly` Trigger.dev v4 schedules.task (id='ingest-hourly', cron='0 * * * *') queries active sources, fans out with `batch.triggerAndWait<typeof fetchSource>(items)`, aggregates successes/failures/newItemsTotal
- `src/trigger/index.ts` barrel re-exports all three Phase 2 tasks alongside health-probe
- `pnpm typecheck` → clean; `pnpm test` → 35/35 passing (27 from Plan 02 + 8 new)

## Task Commits

1. **Task 1: fetch-source-core.ts + 8-test contract + vitest.setup.ts** — `e43ba85` (feat)
2. **Task 2: src/trigger/fetch-source.ts (thin adapter)** — `23e1074` (feat)
3. **Task 3: src/trigger/ingest-hourly.ts (scheduled + fan-out)** — `ebb58f9` (feat)
4. **Task 4: barrel export update** — `3fad4cd` (feat)

## Files Created/Modified

- `src/lib/ingest/fetch-source-core.ts` — Pure orchestrator with injected deps; D-08 semantics encoded as inline `.set()` literal with conditional SQL expression.
- `src/lib/ingest/fetch-source-core.test.ts` — 8 tests using a hand-rolled db mock (no vi.mock because the object needs stateful chaining).
- `src/trigger/fetch-source.ts` — 30-line Trigger.dev v4 task wrapper; `maxDuration: 90` per D-03 (60s RSSHub cold-start + 30s work).
- `src/trigger/ingest-hourly.ts` — `schedules.task` with cron `0 * * * *`; queries `sources` on `is_active = true`; fans out via `batch.triggerAndWait<typeof fetchSource>(batchItems)`; aggregates result.runs.
- `src/trigger/index.ts` — added two `export *` lines alongside existing `health-probe`.
- `vitest.setup.ts` — new global setup that sets a placeholder `DATABASE_URL` so the transitive `@/lib/db/client` import does not throw `neon()`'s "no connection string" at module-load time. Unit tests never contact the real DB — they inject `deps.db`.
- `vitest.config.ts` — registered `setupFiles: ['./vitest.setup.ts']`.

## Decisions Made

### Trigger.dev v4 locked import paths

```typescript
import { schedules, batch, task } from '@trigger.dev/sdk';
```

All three exports live at the root entry — no subpaths. Verified against `@trigger.dev/sdk@4.4.4` `dist/esm/v3/index.d.ts` (which re-exports batch + schedules + task).

### `batch.triggerAndWait` v4 shape (Rule 1 auto-fix)

Plan research findings documented the v3 signature:

```typescript
// v3 (what the plan said)
batch.triggerAndWait(taskId, items);
```

But `@trigger.dev/sdk@4.4.4`'s `batch.triggerAndWait` maps to `batchTriggerByIdAndWait` (shared.d.ts:232) which has a **single** items-only signature:

```typescript
// v4 (what the SDK actually exposes)
batch.triggerAndWait<typeof fetchSource>([
  { id: 'fetch-source', payload: { sourceId, rssUrl } },
  ...
]);
```

The `id` field lives on each BatchByIdAndWaitItem, not as a separate positional arg. I detected the mismatch when the first typecheck errored (`Argument of type 'string' is not assignable to parameter of type 'BatchByIdAndWaitItem[]'`) and fixed it inline per Rule 1. No scope change.

### D-08 counter semantics encoded as inline `.set()` object literal

```typescript
// Success path (≥1 new OR all-dupes)
await db.update(sources).set({
  lastFetchedAt: now(),
  consecutiveErrorCount: 0,
  consecutiveEmptyCount: newCount >= 1 ? 0 : sql`${sources.consecutiveEmptyCount} + 1`,
}).where(eq(sources.id, sourceId));

// Error path (fetch/parse exception)
await db.update(sources).set({
  consecutiveErrorCount: sql`${sources.consecutiveErrorCount} + 1`,
}).where(eq(sources.id, sourceId));
```

Three invariants locked by the tests:
1. Success-path `.set()` object has exactly three keys: `lastFetchedAt`, `consecutiveErrorCount`, `consecutiveEmptyCount` (both branches of the conditional).
2. Error-path `.set()` object has exactly one key: `consecutiveErrorCount` (no `lastFetchedAt`, no `consecutiveEmptyCount`).
3. The inline-literal shape (not a `Record<string, unknown>` accumulator) keeps Drizzle's `.set()` type-check intact under strict mode.

### `run: async (payload) =>` single-arg form

TaskOptions.run is typed `(payload, params) => Promise<TOutput>` in core@4.4.4, but TS function-parameter contravariance allows a handler that ignores the second param. The matching JSDoc example at tasks.d.ts:201 uses exactly this single-arg form. This avoids `noUnusedLocals` / `noUnusedParameters` errors from `{ ctx }` destructuring.

### Vitest + eager module-load Neon client

`src/lib/db/client.ts` calls `neon(process.env.DATABASE_URL!)` at module scope. Any test file that transitively imports it (via `fetch-source-core.ts`) triggers that instantiation, even when tests inject `deps.db`. Solution: `vitest.setup.ts` sets a placeholder `DATABASE_URL` before any test module loads. The placeholder is never used — real queries go through the injected mock `db`. This keeps unit tests hermetic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `batch.triggerAndWait` v4 signature mismatch in plan research**
- **Found during:** Task 3 (`pnpm typecheck` after writing ingest-hourly.ts)
- **Issue:** Plan's `<research_findings>` block documented `batch.triggerAndWait(id, items)` (v3 shape). Actual @trigger.dev/sdk@4.4.4 uses `batchTriggerByIdAndWait(items)` — items-only, with `id` on each item.
- **Fix:** Rewrote the call site to `batch.triggerAndWait<typeof fetchSource>(batchItems)` with each item of shape `{ id: 'fetch-source' as const, payload: {...} }`. Comment added at call site documenting the v3→v4 shape change.
- **Files modified:** src/trigger/ingest-hourly.ts (in its initial commit — ebb58f9 already incorporates the fix; no separate fix commit).
- **Verification:** `pnpm typecheck` exits 0.

**2. [Rule 3 - Blocking] Eager `neon()` call broke unit test module loading**
- **Found during:** Task 1 (first run of `pnpm test`)
- **Issue:** `src/lib/db/client.ts:5` calls `neon(process.env.DATABASE_URL!)` at module scope. The test imports `fetch-source-core.ts`, which imports `@/lib/db/client`, which threw `No database connection string was provided` — even though the test injects a mock `db`.
- **Fix:** Added `vitest.setup.ts` with `process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?sslmode=require'` and registered it via `vitest.config.ts` `setupFiles`. The placeholder is never contacted (injected mock `db` is used for all queries).
- **Files modified:** vitest.setup.ts (new), vitest.config.ts (+1 line).
- **Verification:** All 35 tests pass without contacting any real DB.

**3. [Rule 1 - Bug] BigInt literal `1n` not available at ES2017 target**
- **Found during:** Task 1 (`pnpm typecheck` after test file write)
- **Issue:** tsconfig.json target is `ES2017`. `1n` BigInt literal syntax requires ES2020+. Plan test code used `1n`.
- **Fix:** Replaced `1n` with `BigInt(1)` in test file. Functionally identical; compatible with ES2017.
- **Files modified:** src/lib/ingest/fetch-source-core.test.ts (in its initial commit — e43ba85 already incorporates the fix).
- **Verification:** `pnpm typecheck` exits 0.

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs in plan-documented API shapes, 1 Rule 3 test infra block).
**Impact on plan:** None — behavior delivered is exactly what the plan specifies. Fixes are purely about SDK version realities (Trigger.dev v3→v4 migration of batch API shape, ES2017 BigInt syntax) and test-infra plumbing (vitest env bootstrap).

## Authentication Gates

None. All work was code + tests; no secrets or live services touched.

## Issues Encountered

- Plan's `<research_findings>` cited v3-style `batch.triggerAndWait(taskId, items)`. SDK 4.4.4 actually wires `batch.triggerAndWait` to `batchTriggerByIdAndWait`, which is items-only. Caught by typecheck and fixed inline. Worth noting in STATE.md decisions so future Phase plans know the v4 signature.
- ES2017 target in tsconfig forces `BigInt(1)` instead of `1n` in test code. Low impact, but future test-writing tasks should prefer the constructor form.

## Next Phase Readiness

- Plan 02-04 (source seeding) can `insert` into `sources` knowing that `ingest-hourly` will pick up `is_active = true` rows and fan out.
- Plan 02-05 (verification) can manual-trigger `ingest-hourly` from the Trigger.dev dashboard; idempotency is structurally guaranteed by the `items.url_fingerprint` UNIQUE constraint (D-10).
- The `trigger.dev deploy` step in Phase 1's CI workflow will auto-register both new tasks on the next push to main (no additional CI changes needed).

## TDD Gate Compliance

Plan is `type: execute`, not `type: tdd`. Task 1 used `tdd="true"` — RED confirmed live (`Failed to load url ./fetch-source-core`), then GREEN achieved after implementation. Compressed into a single `feat(02-03):` commit per the precedent set by Plan 02 (atomic commit convention); the git log therefore shows one feat commit for Task 1, not separate test + feat commits. The invariant "no production code exists without its test" is preserved.

## Self-Check

- [x] `src/lib/ingest/fetch-source-core.ts` exists with `runFetchSource` + `FetchSourceResult` + `FetchSourceDeps` exports
- [x] `src/lib/ingest/fetch-source-core.test.ts` exists with 8 tests — all passing
- [x] `src/trigger/fetch-source.ts` exists with `id: 'fetch-source'` + `maxDuration: 90` + delegates to `runFetchSource`
- [x] `src/trigger/ingest-hourly.ts` exists with `id: 'ingest-hourly'` + `cron: '0 * * * *'` + `batch.triggerAndWait<typeof fetchSource>`
- [x] `src/trigger/index.ts` re-exports all three tasks
- [x] `vitest.setup.ts` exists with DATABASE_URL bootstrap
- [x] `vitest.config.ts` includes `setupFiles: ['./vitest.setup.ts']`
- [x] `pnpm typecheck` exits 0
- [x] `pnpm test` → 35/35 passing
- [x] Commit `e43ba85` exists (Task 1)
- [x] Commit `23e1074` exists (Task 2)
- [x] Commit `ebb58f9` exists (Task 3)
- [x] Commit `3fad4cd` exists (Task 4)

## Self-Check: PASSED

---
*Phase: 02-ingestion-pipeline*
*Plan: 03*
*Completed: 2026-04-20*
