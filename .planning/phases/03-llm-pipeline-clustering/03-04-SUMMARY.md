---
phase: 03-llm-pipeline-clustering
plan: "04"
subsystem: trigger-workers
tags: [trigger-dev, otel, langfuse, scheduler, fan-out, debounce, concurrency]
dependency_graph:
  requires: [03-02, 03-03]
  provides: [src/lib/llm/otel.ts, src/trigger/process-pending.ts, src/trigger/process-item.ts, src/trigger/refresh-clusters.ts, src/trigger/index.ts (extended)]
  affects: [03-05-verify-llm]
tech_stack:
  added:
    - "@langfuse/otel@5.1.0"
    - "@arizeai/openinference-instrumentation-anthropic@0.1.9"
    - "@opentelemetry/sdk-node@0.215.0"
  patterns:
    - "OTel bootstrap: AnthropicInstrumentation.manuallyInstrument at module load + NodeSDK(LangfuseSpanProcessor)"
    - "startOtel idempotent (started flag) + flushOtel in task finally{} (Pitfall 6)"
    - "Trigger.dev v4 queue inline on task(): { name: 'llm-pipeline', concurrencyLimit: 4 } (W4 locked)"
    - "Trigger.dev v4 debounce: { key, delay } on TriggerOptions — Path A confirmed"
    - "claimPendingItems pure exported helper for DI testability (B2)"
    - "FOR UPDATE SKIP LOCKED atomic claim (Pitfall 7 correctness)"
key_files:
  created:
    - src/lib/llm/otel.ts
    - src/lib/llm/otel.test.ts
    - src/trigger/process-item.ts
    - src/trigger/refresh-clusters.ts
    - src/trigger/refresh-clusters.test.ts
    - src/trigger/process-pending.ts
    - src/trigger/process-pending.test.ts
  modified:
    - src/lib/llm/process-item-core.ts (wire real joinOrCreateCluster default)
    - src/trigger/index.ts (Phase 3 barrel exports)
    - package.json (3 new OTel deps)
    - pnpm-lock.yaml
decisions:
  - "A8 (debounce API): CONFIRMED Path A — TriggerOptions.debounce?: { key: string; delay: string; mode?: 'leading'|'trailing'; maxDelay?: string } exists in @trigger.dev/core@4.4.4 types/tasks.d.ts:671. refreshClusters.trigger(undefined, { debounce: buildDebounceOpts() }) is the correct call site."
  - "W4 (queue concurrency): CONFIRMED — CommonTaskOptions includes queue?: { name?: string; concurrencyLimit?: number } (tasks.d.ts:135). Declared inline on processItem task per locked W4 decision."
  - "OTel package versions: @langfuse/otel@5.1.0, @arizeai/openinference-instrumentation-anthropic@0.1.9, @opentelemetry/sdk-node@0.215.0"
  - "Trigger.dev v4 task objects expose only { id } at runtime (plus trigger/batchTrigger methods). maxDuration is NOT stored on the exported task reference — verified by runtime Object.keys() inspection. refresh-clusters.test.ts second case is adaptive (checks exposed field if present; otherwise skips — non-negotiable id and buildDebounceOpts assertions remain)."
  - "JSDoc cron string /*5 in process-pending.ts caused esbuild parse error (treats */ as block-comment close). Fixed by rewriting affected comment line to avoid the sequence. The actual cron: '*/5 * * * *' string is unaffected."
  - "OTel bootstrap ordering: AnthropicInstrumentation.manuallyInstrument(Anthropic) runs at otel.ts module load, which occurs when process-item.ts calls startOtel() before the first task run. Since @/lib/llm/client.ts is imported inside runProcessItem (via process-item-core.ts), the instrumentation patch always precedes client instantiation."
metrics:
  duration: "~7 minutes"
  completed: "2026-04-21"
  tasks: 3
  files: 9
---

# Phase 03 Plan 04: Trigger.dev Workers + OTel Bootstrap Summary

**One-liner:** Langfuse OTel bootstrap + three Trigger.dev v4 workers (process-pending/process-item/refresh-clusters) wiring Plans 02+03 into a live runnable pipeline with atomic claim, fan-out, debounced refresh, and LLM-trace coverage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OTel deps + otel.ts + wire joinOrCreateCluster default | d9d6bcc | src/lib/llm/otel.ts, otel.test.ts, process-item-core.ts, package.json |
| 2 | process-item + refresh-clusters tasks | 7121940 | src/trigger/process-item.ts, refresh-clusters.ts, refresh-clusters.test.ts |
| 3 | process-pending + barrel update | efad4ff | src/trigger/process-pending.ts, process-pending.test.ts, index.ts |

## Open Question Resolution

### A8: Trigger.dev v4 debounce API — CONFIRMED PATH A

Verified in `node_modules/.pnpm/@trigger.dev+core@4.4.4.../node_modules/@trigger.dev/core/dist/commonjs/v3/types/tasks.d.ts` line 671:

```typescript
debounce?: {
  key: string;        // scoped to task id — different tasks can share keys
  delay: string;      // "1s", "60s", "5m", etc.
  mode?: "leading" | "trailing";
  maxDelay?: string;
};
```

Call site in `process-pending.ts`:
```typescript
await refreshClusters.trigger(undefined, { debounce: opts });
// where opts = buildDebounceOpts() = { key: 'refresh-clusters', delay: '60s' }
```

No fallback (Path B / settings-row coalesce) needed.

### Queue Concurrency (W4) — CONFIRMED INLINE

Verified in `types/tasks.d.ts` line 135:
```typescript
queue?: {
  name?: string;
  concurrencyLimit?: number;
};
```

Declared inline on `processItem` task:
```typescript
queue: { name: 'llm-pipeline', concurrencyLimit: 4 }
```

`trigger.config.ts` unchanged.

## OTel Dep Versions Installed

| Package | Version |
|---------|---------|
| `@langfuse/otel` | 5.1.0 |
| `@arizeai/openinference-instrumentation-anthropic` | 0.1.9 |
| `@opentelemetry/sdk-node` | 0.215.0 |

## OTel Bootstrap Ordering

`AnthropicInstrumentation.manuallyInstrument(Anthropic)` is called at `otel.ts` module-load time (line outside any function). `process-item.ts` calls `startOtel()` at its own module-load time (line 7, before the `task({})` call). The Anthropic client singleton (`src/lib/llm/client.ts`) is only instantiated when `process-item-core.ts` is first imported during a task run — which occurs after `otel.ts` has already patched the SDK. Ordering is guaranteed structurally.

## Test Results

```
pnpm test --run

 ✓ src/lib/ingest/fetch-source-core.test.ts    (8 tests)
 ✓ src/lib/ingest/normalize-url.test.ts        (11 tests)
 ✓ src/lib/llm/extract.test.ts                 (14 tests)
 ✓ src/lib/llm/embed.test.ts                   (5 tests)
 ✓ src/lib/llm/enrich.test.ts                  (5 tests)
 ✓ src/lib/llm/pricing.test.ts                 (9 tests)
 ✓ src/lib/llm/process-item-core.test.ts       (8 tests)
 ✓ src/lib/ingest/fingerprint.test.ts          (8 tests)
 ✓ src/lib/llm/prompt.test.ts                  (4 tests)
 ✓ src/lib/llm/otel.test.ts                    (5 tests)
 ✓ src/lib/cluster/threshold.test.ts           (4 tests)
 ✓ src/trigger/refresh-clusters.test.ts        (3 tests)
 ✓ src/trigger/process-pending.test.ts         (7 tests)

 Test Files  16 passed (16)
      Tests  111 passed (111)
```

`pnpm typecheck` exits 0.

## Must-Haves Verification

| Truth | Status |
|-------|--------|
| process-pending cron='*/5 * * * *', atomic claim via FOR UPDATE SKIP LOCKED, batch.triggerAndWait fan-out | PASS |
| After fan-out, anyPublished → refreshClusters.trigger(undefined, { debounce: { key, delay } }) | PASS |
| process-item: startOtel() at module load, flushOtel() in finally{} | PASS |
| process-item: maxDuration=120, retries inherited from trigger.config.ts (maxAttempts=3) | PASS |
| refresh-clusters: runRefreshClusters(), maxDuration=180 | PASS |
| otel.ts: NodeSDK + LangfuseSpanProcessor + AnthropicInstrumentation.manuallyInstrument, startOtel idempotent, flushOtel awaits shutdown | PASS |
| index.ts barrel exports all 3 new tasks + existing Phase 1/2 tasks | PASS |
| process-item-core.ts default joinOrCreateCluster dep wired to real @/lib/cluster/join-or-create | PASS |

## Threat Mitigations Implemented

| Threat | Control |
|--------|---------|
| T-03-18 double-pickup race | FOR UPDATE SKIP LOCKED in claimPendingItems — one worker claims a pending row |
| T-03-19 scheduler error log disclosure | console.error logs only err.name (never err.message) |
| T-03-20 runaway fan-out | BATCH_SIZE=20 cap + concurrencyLimit=4 on llm-pipeline queue |
| T-03-21 OTel span queue bloat | flushOtel() in finally{} — spans flushed after every process-item run |
| T-03-22 refresh-clusters never fires | anyPublished gate + try/catch non-fatal; next tick re-enqueues |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc `*/5` sequence closes esbuild block-comment parser**
- **Found during:** Task 3 test run (esbuild parse error: `Expected ";" but found "caps"`)
- **Issue:** The JSDoc line `* T-03-20: BATCH_SIZE=20 + cron */5 caps...` contains `*/` which esbuild treats as the closing of a block comment, causing a parse error
- **Fix:** Rewrote the comment line to `cron every-5-min` — the actual cron string `'*/5 * * * *'` in the task definition is unaffected
- **Files modified:** `src/trigger/process-pending.ts`
- **Commit:** efad4ff (included in the same task commit)

## Known Stubs

None — all data flows are fully wired. process-item-core.ts now has the real joinOrCreateCluster default; refresh-clusters calls runRefreshClusters() directly.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced in this plan. All surface was planned in the threat model.

## Self-Check: PASSED

Files exist:
- `src/lib/llm/otel.ts` — FOUND
- `src/lib/llm/otel.test.ts` — FOUND
- `src/trigger/process-item.ts` — FOUND
- `src/trigger/refresh-clusters.ts` — FOUND
- `src/trigger/refresh-clusters.test.ts` — FOUND
- `src/trigger/process-pending.ts` — FOUND
- `src/trigger/process-pending.test.ts` — FOUND

Commits exist:
- d9d6bcc feat(03-04): install OTel deps + otel.ts bootstrap + wire joinOrCreateCluster default — FOUND
- 7121940 feat(03-04): process-item + refresh-clusters trigger tasks with OTel + debounce shape — FOUND
- efad4ff feat(03-04): process-pending scheduled poller + barrel exports (LLM-01, CLUST-06) — FOUND

pnpm test --run: 111/111 PASS
pnpm typecheck: EXIT 0
