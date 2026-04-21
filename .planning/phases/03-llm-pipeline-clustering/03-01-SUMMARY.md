---
phase: 03-llm-pipeline-clustering
plan: "01"
subsystem: schema-migration
status: awaiting-human-gate
tags: [migration, pgvector, hnsw, settings, env, vitest]
dependency_graph:
  requires: []
  provides: [hnsw-index-migration, cluster-threshold-seed, check-hnsw-script, phase3-env-registry]
  affects: [plans-02-03-wave2-unblock]
tech_stack:
  added: []
  patterns: [hand-authored-sql-migration, tsx-env-file-script, vitest-setup-dummy-vars]
key_files:
  created:
    - drizzle/0003_hnsw_index_and_settings_seed.sql
    - drizzle/meta/0003_snapshot.json
    - scripts/check-hnsw.ts
  modified:
    - drizzle/meta/_journal.json
    - package.json
    - vitest.setup.ts
decisions:
  - "0003_snapshot.json is byte-identical copy-forward of 0002 (Drizzle DSL unchanged — HNSW index not representable in current Drizzle index builder)"
  - ".env.example already contained all 5 Phase 3 vars from prior work — no append needed"
  - "vitest.setup.ts dummy prefixes: sk-ant-test-dummy, pa-test-dummy, pk-lf-test-dummy, sk-lf-test-dummy (clearly non-resolvable per T-03-09)"
metrics:
  duration: ~5min
  completed_date: "2026-04-21T07:50:55Z"
  tasks_completed: 2/3
  files_changed: 6
---

# Phase 3 Plan 01: HNSW Migration + Env Preconditions Summary

**One-liner:** Hand-authored HNSW index migration (m=16/ef=64) + cluster_threshold seed (0.82) + check:hnsw assertion script + vitest dummy env vars for Phase 3 LLM module imports.

## Status: AWAITING HUMAN GATE (Task 3)

Tasks 1 and 2 are committed. Task 3 requires the developer to push migration 0003 to the live Neon dev branch and verify with `pnpm check:hnsw`.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Hand-SQL migration + journal entry + snapshot copy-forward | 1e1b7b2 | drizzle/0003_hnsw_index_and_settings_seed.sql, drizzle/meta/_journal.json, drizzle/meta/0003_snapshot.json |
| 2 | check-hnsw script + package.json scripts + vitest.setup.ts dummies | 9abaefd | scripts/check-hnsw.ts, package.json, vitest.setup.ts |

## Migration File Details

**File:** `drizzle/0003_hnsw_index_and_settings_seed.sql`

**When epoch (journal entry):** 1776757755000

Key SQL operations:
- `CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx ON items USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)` — satisfies CLUST-02
- `INSERT INTO settings (key, value) VALUES ('cluster_threshold', '0.82') ON CONFLICT (key) DO NOTHING` — satisfies CLUST-04

**Idempotency:** Both operations are safe to re-run (IF NOT EXISTS + ON CONFLICT DO NOTHING).

## Journal + Snapshot State

`drizzle/meta/_journal.json` now has 4 entries (idx 0–3):
- idx 3: tag=`0003_hnsw_index_and_settings_seed`, version="7", breakpoints=true, when=1776757755000

`drizzle/meta/0003_snapshot.json` is a byte-identical copy of `0002_snapshot.json`. The Drizzle DSL schema (`src/lib/db/schema.ts`) is unchanged by this migration — HNSW index definition lives outside Drizzle's current index builder capability. This preserves drizzle-kit's chain integrity per PATTERNS.md §Shared Pattern 8.

## Vitest Dummy Env Var Choices

The following dummy values were chosen for `vitest.setup.ts` (documented for downstream plan tests):

| Env Var | Dummy Value | Rationale |
|---------|-------------|-----------|
| `ANTHROPIC_API_KEY` | `sk-ant-test-dummy` | Matches Anthropic key prefix format; `-test-dummy` suffix is clearly non-real |
| `VOYAGE_API_KEY` | `pa-test-dummy` | Voyage keys use `pa-` prefix; `-test-dummy` suffix is clearly non-real |
| `LANGFUSE_PUBLIC_KEY` | `pk-lf-test-dummy` | Langfuse public key prefix `pk-lf-`; clearly non-resolvable |
| `LANGFUSE_SECRET_KEY` | `sk-lf-test-dummy` | Langfuse secret key prefix `sk-lf-`; clearly non-resolvable |
| `LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` | Real hostname acceptable (no credentials leaked; URL only) |

All use `??=` idiom — real env vars set at runtime (Trigger.dev Cloud / Vercel) override at module-load.

## .env.example Status

All 5 Phase 3 vars (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`) were already present in `.env.example` from prior work. No append was needed. Acceptance criteria satisfied.

## Deviations from Plan

### Auto-fixed Issues

None.

### Observations

**1. [Observation] .env.example already populated**
- **Found during:** Task 2
- **Issue:** Plan instructed appending 5 Phase 3 env vars to `.env.example`, but all 5 were already present from Phase 1/2 work.
- **Fix:** No change made — existing entries satisfy acceptance criteria.
- **Files modified:** None (deviation was non-action)

## Threat Surface Scan

No new security-relevant surfaces introduced:
- Migration SQL is hand-reviewed, idempotent, no dynamic values (T-03-05 mitigated)
- `.env.example` contains only var names, no values (T-03-06 accepted)
- `check-hnsw.ts` outputs only index metadata and settings.value — no credentials or row data from `items` (T-03-07 mitigated)
- Vitest dummies use clearly non-resolvable prefixes (T-03-09 mitigated)

## Pending: Task 3 Human Gate

Task 3 requires the developer to:
1. Confirm `.env.local` points at the Neon DEV branch
2. Run `pnpm drizzle-kit push` (or `pnpm db:push`)
3. Run `pnpm check:hnsw` — expect `[PASS] items_embedding_hnsw_idx (HNSW) + settings.cluster_threshold=0.82` and exit 0
4. Cross-check: `psql "$DATABASE_URL" -c "SELECT indexdef FROM pg_indexes WHERE indexname='items_embedding_hnsw_idx';"`

Type "approved" to unblock Wave 2 (Plans 02 + 03).

## Self-Check

**Created files exist:**
- drizzle/0003_hnsw_index_and_settings_seed.sql: FOUND
- drizzle/meta/0003_snapshot.json: FOUND
- scripts/check-hnsw.ts: FOUND

**Commits exist:**
- 1e1b7b2: FOUND (chore(03-01): author HNSW migration)
- 9abaefd: FOUND (feat(03-01): add check-hnsw script)

## Self-Check: PASSED
