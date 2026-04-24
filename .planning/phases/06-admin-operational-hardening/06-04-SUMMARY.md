---
phase: 06-admin-operational-hardening
plan: "04"
subsystem: admin
tags: [admin, costs, llm-observability, pipeline_runs]
requires:
  - pipeline_runs table + pipeline_runs_created_at_idx (Phase 03 LLM-12)
  - src/app/admin/layout.tsx requireAdmin gate (Plan 06-00)
  - src/lib/auth/admin.ts (Plan 06-00)
provides:
  - /admin/costs RSC dashboard (30-day LLM cost rollup)
  - src/lib/admin/costs-repo.ts (getDailyCosts, getCostsSummary)
  - CostTable / CostSummary presentation components
affects:
  - Admin console navigation (existing /admin page card already links here)
tech-stack:
  added: []
  patterns:
    - "RSC + pure-read repo, status='ok' filter to isolate cost data from error rows"
    - "Deps-injection (ExecDb) shape for db.execute mocking in unit tests"
    - "UTC date_trunc day grouping (no timezone param in v1)"
key-files:
  created:
    - src/lib/admin/costs-repo.ts
    - src/app/admin/costs/page.tsx
    - src/components/admin/cost-table.tsx
    - src/components/admin/cost-summary.tsx
    - tests/unit/admin-costs.test.ts
  modified:
    - .planning/phases/06-admin-operational-hardening/deferred-items.md
decisions:
  - "Admin gate inherited from src/app/admin/layout.tsx — plan does not redeclare requireAdmin (Plan 06-00 contract)"
  - "Days parameter hardcoded to 30 in v1; no URL ?days= surface so T-6-42 (param tampering) is not in this plan's threat surface"
  - "Native <table> with inline styles — shadcn/ui Table is not installed in v1 and the admin console follows the inline-style convention (admin-shell.tsx, pipeline-status-card.tsx)"
  - "ExecDb narrow interface for deps-injection — avoids pulling full Drizzle type into the mock and keeps tests stable across Drizzle version bumps"
metrics:
  duration: "6 min"
  completed: "2026-04-24T02:00:13Z"
---

# Phase 06 Plan 04: LLM cost dashboard (/admin/costs) Summary

## One-liner

30-day Claude token + cost rollup from `pipeline_runs`, aggregated by day × model, rendered as a Chinese-language admin RSC with top-line totals + cache-hit ratio.

## Scope

Surfaces LLM token usage and estimated USD cost to admins so daily budget review is one page, not two tools (Langfuse + DB). Satisfies **ADMIN-09** and provides the manual verification surface for phase SC#3 (admin sees daily Claude token cost breakdown from `pipeline_runs`). Pure read-side; no new writes, no schema changes.

## What Landed

### Task 1 — costs-repo aggregation + unit tests

Commit hashes: `c703bb3` (RED test) → `3d42812` (GREEN impl).

- **`src/lib/admin/costs-repo.ts`** (141 lines)
  - `getDailyCosts({ days })` — single `GROUP BY (day UTC, model)` over `pipeline_runs`, filtered to `status = 'ok'` so failed runs do not inflate cost numbers. Window is `created_at >= NOW() - (days::int * INTERVAL '1 day')` — index-backed by `pipeline_runs_created_at_idx` (Phase 3). No N+1; no joins.
  - `getCostsSummary({ days })` — derives `{ totalUsd, totalRuns, totalTokens, cacheHitRatio, modelBreakdown }` from the daily rows in-process (no second DB roundtrip).
  - `cacheHitRatio = cache_read / (cache_read + input)`, clamped to `0` when the denominator is `0`. Range `[0, 1]`.
  - Deps-injection shape (`ExecDb`) lets unit tests mock `db.execute` without pulling Drizzle's full generic types. `toNumber()` helper normalises Neon's `bigint` / `numeric`-string return values to JS `number`.

- **`tests/unit/admin-costs.test.ts`** (182 lines, 6 tests, all passing)
  - `getDailyCosts` — row shape, numeric coercion, `cacheHitRatio` calculation (`0.5` for input=10/cacheRead=10), zero-denominator guard (returns `0`, not `NaN`).
  - SQL literal grep — asserts `status = 'ok'`, `date_trunc`, `pipeline_runs` all appear in the composed template.
  - `getCostsSummary` — totalUsd / totalRuns / totalTokens / cacheHitRatio aggregation across 4 fake rows; per-model breakdown (Haiku 4.5 vs Sonnet 4.6); empty-rows case returns all zeros with empty `modelBreakdown`.

**Gate compliance:** RED commit (`c703bb3`) precedes GREEN commit (`3d42812`) in git log. Tests confirmed failing before impl (import-resolve error), then all 6 passing after.

### Task 2 — /admin/costs RSC page + table + summary

Commit hash: `0eb3c2d`.

- **`src/app/admin/costs/page.tsx`** — RSC, `force-dynamic` + `revalidate = 0`. Fans `getDailyCosts` + `getCostsSummary` out via `Promise.all`. Admin gate inherited from `src/app/admin/layout.tsx` (Plan 06-00's `requireAdmin`); no redeclaration per the Plan 06-00 contract. Header copy: `LLM 成本` / `最近 30 天 · Claude 令牌用量与估算花费(来源:pipeline_runs)`.
- **`src/components/admin/cost-summary.tsx`** — four stat cards (总花费 / 运行次数 / 总令牌 / 缓存命中率) + a per-model breakdown chip row. `Intl.NumberFormat('zh-CN')` for token counts; `$X.XXXX` for USD; `XX.X%` for the cache-hit ratio. Uses `sr-only` h2 for screen readers.
- **`src/components/admin/cost-table.tsx`** — native `<table>` with 9 columns (`日期 · 模型 · 输入令牌 · 缓存读取 · 缓存写入 · 输出令牌 · 估算花费 · 运行次数 · 缓存命中率`). `tabular-nums` on the right-aligned numeric columns so digits line up vertically. Empty state renders `近 30 天无 LLM 运行记录` in a single centered cell; table chrome is preserved so the admin sees where data will appear.

All Chinese UI; no shadcn/ui Table dep added (not installed in v1 — matches the admin console's inline-style convention: `admin-shell.tsx`, `pipeline-status-card.tsx`).

## Verification Results

- `pnpm test --run tests/unit/admin-costs.test.ts` — **6/6 pass**.
- `pnpm exec tsc --noEmit` — **clean** (exits 0, no output).
- Acceptance grep gate:
  - `grep -q "status = 'ok'" src/lib/admin/costs-repo.ts` — PASS
  - `grep -q "date_trunc" src/lib/admin/costs-repo.ts` — PASS
  - `grep -q "cache_read_tokens" src/lib/admin/costs-repo.ts` — PASS
  - `grep -q "getDailyCosts"` + `getCostsSummary` in page.tsx — PASS
  - `grep -q "LLM 成本"` in page.tsx — PASS
  - `Intl.NumberFormat` in cost-summary.tsx — PASS
  - Chinese column headers (`日期` / `模型` / `估算花费`) in cost-table.tsx — PASS
  - `test -f src/app/admin/costs/page.tsx && test -f src/app/admin/layout.tsx` — PASS
- `pnpm run build` — **fails on `/sitemap.xml` prerender** (unrelated, pre-existing — see **Deferred Issues** below).

## Threat-Model Coverage

| Threat ID | Disposition in plan | Implementation |
|-----------|--------------------|----|
| T-6-40 (info disclosure of cost data) | mitigate | `/admin/costs` page lives under `src/app/admin/layout.tsx`; layout's `requireAdmin()` redirects anonymous → `/` and non-admin → `/admin/access-denied` BEFORE the RSC is reached. Page does not redeclare the check (Plan 06-00 contract). |
| T-6-41 (DoS via 30-day agg) | mitigate | Single `GROUP BY (day, model)` query; `pipeline_runs_created_at_idx DESC` (Phase 3) covers the `created_at >= NOW() - 30 days` filter. `Promise.all` fan-out on the 2 reads. |
| T-6-42 (param tampering of days) | n/a in v1 | Days hardcoded to `30` in page.tsx as `WINDOW_DAYS`; not read from URL or form. Future exposure would need zod bound + server enforcement. |
| T-6-43 (SQL injection) | mitigate | Drizzle `sql`` ` tag binds `${opts.days}::int` as a param + explicit int cast. `opts.days` typed as `number`. Rest of the query is a static literal. |

No new threat surface introduced beyond the plan's register.

## Deviations from Plan

**None functional.** Plan executed as specified. Minor non-functional adjustment:

- **[Non-deviation — documentation]** Logged `/sitemap.xml` build-time prerender failure in `deferred-items.md` as out-of-scope. Confirmed pre-existing at baseline `f816ef7` before any 06-04 edits (reproduced by running `pnpm run build` at the baseline commit with the same placeholder `DATABASE_URL`). Plan 06-04 did not alter `/sitemap.xml` or its repo.

## Deferred Issues

### `/sitemap.xml` prerender failure at build-time

`pnpm run build` fails during "Generating static pages" on `/sitemap.xml/route` when no real `DATABASE_URL` is reachable (worktree / CI without Neon credentials). Confirmed pre-existing at commit `f816ef7` — the baseline commit this worktree was started from — so the failure is not caused by Plan 06-04. Ownership belongs to Plan 06-07 (sitemap route). Fix candidates: force `dynamic='force-dynamic'` on the route, or env-guard the DB query and return an empty sitemap when `DATABASE_URL` is absent at build time.

Plan 06-04's own route `/admin/costs` is `force-dynamic` + `revalidate=0` and does NOT prerender, so it is unaffected by and does not worsen the existing failure.

## Known Stubs

None. All data sources are wired to live `pipeline_runs` — no placeholder values or mock data flowing to the UI.

## TDD Gate Compliance

- **RED** — `c703bb3` (`test(06-04): add failing tests for admin costs-repo`) — confirmed failing before impl existed (import-resolve error).
- **GREEN** — `3d42812` (`feat(06-04): add admin costs-repo aggregation over pipeline_runs`) — 6/6 tests pass.
- REFACTOR — skipped; GREEN implementation was already minimal.

Both gate commits present in git log in the correct order.

## Commits

| Hash | Type | Subject |
|------|------|---------|
| `c703bb3` | test | add failing tests for admin costs-repo (RED) |
| `3d42812` | feat | add admin costs-repo aggregation over pipeline_runs (GREEN) |
| `0eb3c2d` | feat | add /admin/costs page + cost-summary + cost-table components |
| `d5c069c` | docs | log /sitemap.xml prerender failure as deferred (pre-existing) |

## Threat Flags

None. Plan 06-04 introduces no new network endpoints, no auth paths, no file access, and no schema changes at trust boundaries. All surface falls under the existing Plan 06-00 admin gate and the Phase 3 `pipeline_runs` table.

## Self-Check: PASSED

- `src/lib/admin/costs-repo.ts` exists — FOUND
- `src/app/admin/costs/page.tsx` exists — FOUND
- `src/components/admin/cost-table.tsx` exists — FOUND
- `src/components/admin/cost-summary.tsx` exists — FOUND
- `tests/unit/admin-costs.test.ts` exists — FOUND
- Commit `c703bb3` present in `git log` — FOUND
- Commit `3d42812` present in `git log` — FOUND
- Commit `0eb3c2d` present in `git log` — FOUND
- Commit `d5c069c` present in `git log` — FOUND
