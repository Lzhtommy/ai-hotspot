---
phase: 03-llm-pipeline-clustering
plan: "03"
subsystem: cluster
tags: [cluster, pgvector, hnsw, settings, debounce, tdd]
dependency_graph:
  requires: [03-01]
  provides: [threshold, join-or-create, refresh, buildDebounceOpts]
  affects: [03-04]
tech_stack:
  added: []
  patterns:
    - makeTxMock factory for transaction-level DI mocking
    - sequential execute() call index for multi-step SQL mocks
key_files:
  created:
    - src/lib/cluster/threshold.ts
    - src/lib/cluster/threshold.test.ts
    - src/lib/cluster/join-or-create.ts
    - src/lib/cluster/join-or-create.test.ts
    - src/lib/cluster/refresh.ts
    - src/lib/cluster/refresh.test.ts
  modified: []
decisions:
  - "getClusterThreshold() passes { db } to thresholdFn injected via deps — allows tests to bypass real DB entirely"
  - "joinOrCreateCluster accepts deps.getThreshold as (deps?: { db? }) => Promise<number> so threshold read also uses the mocked db"
  - "runRefreshClusters centroid updated via raw db.execute(sql`UPDATE ... SET centroid = ${}::vector`) rather than Drizzle .update().set({ centroid }) to avoid Drizzle vector type coercion surprises"
  - "buildDebounceOpts is a pure helper returning { key, delay } — Plan 04 planner verifies Trigger.dev v4 debounce API call-site shape (Assumption A8)"
  - "refresh.test.ts uses sequential execute call index (executeCallIndex++) to multiplex 4-5 distinct SQL responses through one mock db.execute"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-21"
  tasks_completed: 3
  files_created: 6
---

# Phase 03 Plan 03: Clustering Library Modules Summary

**One-liner:** pgvector-backed cluster join-or-create transaction + bulk refresh recomputation + settings-backed runtime threshold, all with DI-friendly test harness.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | threshold.ts + test (settings-backed read with default) | 7ccd9eb | src/lib/cluster/threshold.ts, threshold.test.ts |
| 2 | join-or-create.ts + test (nearest-neighbor pgvector + transaction) | a321619 | src/lib/cluster/join-or-create.ts, join-or-create.test.ts |
| 3 | refresh.ts + test (bulk bookkeeping + debounce-opts helper) | 9f36d2b | src/lib/cluster/refresh.ts, refresh.test.ts |

## Test Results

```
pnpm test --run src/lib/cluster

 ✓ src/lib/cluster/threshold.test.ts     (4 tests)
 ✓ src/lib/cluster/refresh.test.ts       (6 tests)
 ✓ src/lib/cluster/join-or-create.test.ts (6 tests)

 Test Files  3 passed (3)
 Tests       16 passed (16)
```

`pnpm typecheck` exits 0.

## Must-Haves Verification

| Truth | Status |
|-------|--------|
| getClusterThreshold() returns 0.82 default when settings row absent | PASS — 4 test cases cover all branches |
| joinOrCreateCluster() returns {clusterId, joined:true} when cosine >= threshold | PASS — boundary test at cosine==0.82 |
| joinOrCreateCluster() returns {clusterId, joined:false} + INSERTs new cluster when no nearest or cosine < threshold | PASS — no-row and below-threshold cases |
| joinOrCreateCluster() wraps both branches in db.transaction() | PASS — grep confirmed |
| runRefreshClusters() recomputes member_count + primary + earliest + latest + centroid | PASS — 6 test cases |
| CLUST-07: primary_item_id by MIN(published_at), tiebreak id ASC | PASS — grep `ORDER BY published_at ASC, id ASC` confirmed |
| buildDebounceOpts() returns { key: 'refresh-clusters', delay: '60s' } | PASS — exact equality assertion |

## Drizzle + pgvector Boundary Notes

**Centroid AVG passthrough:** Drizzle's `.update().set({ centroid: ... })` accepts `number[]` for vector columns normally. However, the centroid returned from `AVG(embedding)::vector` is a Postgres-formatted string (e.g., `[0.1,0.2,...]`), not a JS array. To avoid potential Drizzle vector coercion surprises, the centroid update uses a raw `db.execute(sql\`UPDATE clusters SET centroid = ${centroidStr}::vector WHERE id = ${clusterId}\`)` when the centroid string is present. The cluster `.update().set()` call sets all scalar fields (member_count, primary_item_id, etc.) independently.

**embeddingLiteral in join-or-create:** `params.embedding: number[]` is typed as numeric — not attacker-controlled. The `[${params.embedding.join(',')}]` literal produces a numeric string passed through Drizzle's tagged-template `sql` (parameterized at the driver level). Threat T-03-13 disposition: mitigated.

## makeTxMock Factory Shape (for future phase reuse)

```typescript
function makeTxMock(opts: {
  nearestRow?: { id: string; cluster_id: string; cosine_similarity: number } | null;
  returningCluster?: { id: bigint };
  threshold?: number;
}) {
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const executeCalls: Array<unknown> = [];

  const tx = {
    execute: async (q: unknown) => {
      executeCalls.push(q);
      return { rows: opts.nearestRow != null ? [opts.nearestRow] : [] };
    },
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updates.push(v);
        return { where: async () => {} };
      },
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserts.push(v);
        return {
          returning: async () => [opts.returningCluster ?? { id: BigInt(999) }],
        };
      },
    }),
  };

  const db = {
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
  };

  return { db, tx, inserts, updates, executeCalls };
}
```

For multi-step execute() mocking (refresh.ts pattern), use a sequential `executeCallIndex++` approach that dispatches to a pre-configured response array per call index.

## buildDebounceOpts Return Shape

`buildDebounceOpts()` returns `{ key: 'refresh-clusters', delay: '60s' }`.

Plan 04 (Trigger.dev task wrappers) is responsible for verifying that this shape matches the Trigger.dev v4 debounce API at the `refreshClusters.trigger({ debounce: buildDebounceOpts() })` call site (Assumption A8 in RESEARCH.md). The helper is intentionally agnostic of the v4 API — it only provides the canonical key+delay values.

## Deviations from Plan

None — plan executed exactly as written. All 6 files match the plan's `files_modified` list. All `must_haves.truths` verified via unit tests.

## Self-Check: PASSED

- `src/lib/cluster/threshold.ts` EXISTS
- `src/lib/cluster/threshold.test.ts` EXISTS
- `src/lib/cluster/join-or-create.ts` EXISTS
- `src/lib/cluster/join-or-create.test.ts` EXISTS
- `src/lib/cluster/refresh.ts` EXISTS
- `src/lib/cluster/refresh.test.ts` EXISTS
- Commit 7ccd9eb EXISTS (threshold)
- Commit a321619 EXISTS (join-or-create)
- Commit 9f36d2b EXISTS (refresh)
