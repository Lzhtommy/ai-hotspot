---
phase: 06-admin-operational-hardening
plan: "02"
subsystem: admin
tags: [admin, sources, crud, soft-delete, rsc, server-actions, tdd]
requires:
  - 06-00 (admin gate — requireAdmin, assertAdmin, AdminAuthError)
  - 06-01 (sources.deleted_at + sources.category columns + sources_deleted_at_idx)
provides:
  - "listSourcesForAdmin / getSourceByIdForAdmin / createSourceCore / updateSourceCore / softDeleteSourceCore / computeSourceHealth"
  - "SourceHealthBadge RSC"
  - "SourceForm (create + edit) client component"
  - "SourceRowActions (编辑/停用-启用/删除) client component"
  - "SourcesTable RSC (desktop table + mobile cards)"
  - "4 Server Actions: createSource, updateSource, softDeleteSource, toggleActive"
  - "Ingestion poller filters isActive=true AND deletedAt IS NULL"
  - "/admin/sources, /admin/sources/new, /admin/sources/[id]/edit routes"
affects:
  - "src/trigger/ingest-hourly.ts (added deletedAt filter to source enumeration)"
tech-stack:
  added: []
  patterns:
    - "Core / server-action / component split — pure *Core in src/lib/admin/sources-repo.ts, thin 'use server' adapter in src/server/actions/admin-sources.ts, Client Components in src/components/admin/"
    - "Opaque error-code contract — Server Actions return { ok: false, error: 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL' } and never echo err.message (T-6-24)"
    - "Destructive-action double-click guard via window.confirm with explicit 'items preserved' copy (T-6-25)"
    - "Mobile-first table collapse — desktop <table> + mobile-card alternate hidden/shown via @media (max-width: 768px)"
    - "Client form uses onSubmit + new FormData(form) rather than action={fn} prop so tests under Vitest work (Plan 05-04+ precedent)"
key-files:
  created:
    - src/lib/admin/sources-repo.ts
    - src/components/admin/source-health-badge.tsx
    - src/components/admin/source-form.tsx
    - src/components/admin/source-row-actions.tsx
    - src/components/admin/sources-table.tsx
    - src/server/actions/admin-sources.ts
    - src/app/admin/sources/page.tsx
    - src/app/admin/sources/new/page.tsx
    - src/app/admin/sources/[id]/edit/page.tsx
    - tests/unit/admin-sources.test.ts
    - tests/unit/source-health.test.ts
  modified:
    - src/trigger/ingest-hourly.ts
    - .planning/phases/06-admin-operational-hardening/deferred-items.md
decisions:
  - "rssUrl is immutable on edit (not in SourceUpdateSchema, disabled in UI). Changing a live source's URL would orphan ingested items from their origin and defeat idempotency. Admins who need a different URL must soft-delete and recreate."
  - "Category taxonomy stays free-form TEXT in DB per Plan 06-01 D; UI restricts to v1 fixed set (lab / social / forum / cn_media / other / 未分类) via a <select>. Avoids ALTER TYPE migrations when the taxonomy evolves."
  - "softDeleteSourceCore sets is_active = false in addition to deleted_at = now(). Either filter alone excludes the source from the poller (dual-filter in ingest-hourly), but clearing is_active keeps the underlying boolean truthful (a soft-deleted source is not active) and makes the read-side intent obvious."
  - "Server Actions accept plain arguments (e.g., softDeleteSourceAction(id), toggleActiveAction(id, nextActive)) rather than forcing everything through FormData. FormData is the right shape for HTML forms; primitives are the right shape for per-row inline buttons."
  - "4 of 4 per-action assertAdmin() calls happen FIRST — before zod parse, before DB access. This is the defense-in-depth invariant from the threat model (T-6-20). `grep -c 'assertAdmin' src/server/actions/admin-sources.ts` returns 6 (import + 4 calls + 1 auth-error reference) vs. the plan's >=4 floor."
metrics:
  duration: "9 min"
  completed_date: "2026-04-24"
---

# Phase 6 Plan 06-02: Admin Source Management UI — Summary

**One-liner:** Delivers `/admin/sources` list + create + edit flow with three-state health badge, four zod-gated Server Actions behind `assertAdmin()`, and a soft-delete that removes sources from both the admin table and the hourly ingestion poller without losing historical items.

## What Shipped

- **Pure data layer** (`src/lib/admin/sources-repo.ts`) — `listSourcesForAdmin`, `getSourceByIdForAdmin`, `createSourceCore`, `updateSourceCore`, `softDeleteSourceCore`, `computeSourceHealth`. Deps-injected `db` so the core is unit-testable without Neon.
- **Health badge** (`src/components/admin/source-health-badge.tsx`) — RSC dot + Chinese label. Red when either consecutive counter ≥ 3; yellow at ≥ 1; green otherwise (ADMIN-06).
- **Four Server Actions** (`src/server/actions/admin-sources.ts`) — create / update / softDelete / toggleActive. Every action starts with `assertAdmin(await auth())` before touching zod or the DB. Zod schemas enforce `name` length, `rss_url` URL shape, `weight` numeric-string pattern matching `numeric(3,1)`, category ≤ 40 chars. Errors map to opaque codes — never `err.message`.
- **Reusable form** (`src/components/admin/source-form.tsx`) — shared between create and edit. `rssUrl` disabled on edit with a Chinese hint; category `<select>` restricted to the v1 set; submit uses `onSubmit` + `new FormData(form)` so tests can exercise it.
- **Per-row actions** (`src/components/admin/source-row-actions.tsx`) — 编辑 / 停用-启用 / 删除. Delete guarded by `window.confirm('确认删除信源「${name}」?这会将其从轮询中移除,已入库的文章保留。')`.
- **List table** (`src/components/admin/sources-table.tsx`) — 10-column desktop table with SourceHealthBadge on every row; mobile viewport collapses to per-source cards via `@media (max-width: 768px)`.
- **Three pages** — `src/app/admin/sources/page.tsx` (`force-dynamic` list), `new/page.tsx`, `[id]/edit/page.tsx` (404 when row missing or soft-deleted).
- **Ingestion poller filter** — `src/trigger/ingest-hourly.ts` now filters `eq(isActive, true) AND isNull(deletedAt)` when enumerating sources (ADMIN-05).

## Requirements Satisfied

| Requirement | How |
| --- | --- |
| ADMIN-02 (list with health fields) | `/admin/sources` lists every non-deleted source with name, rss_url, weight, is_active, last_fetched_at, consecutive_empty_count, consecutive_error_count, category, plus SourceHealthBadge per row. |
| ADMIN-03 (create with category) | `/admin/sources/new` → createSourceAction; category select + isActive + language + weight + rssUrl + name. |
| ADMIN-04 (edit weight/name/active/category) | `/admin/sources/[id]/edit` → updateSourceAction; zod `SourceUpdateSchema` permits only those four. rssUrl is immutable by design. |
| ADMIN-05 (soft-delete preserves items) | softDeleteSourceCore sets `deleted_at = now()` and `is_active = false`. Source disappears from `listSourcesForAdmin` (WHERE deleted_at IS NULL). Ingestion poller skips it. Items referencing the source (via FK) remain in the feed. |
| ADMIN-06 (red badge when counter ≥ 3) | `computeSourceHealth`; 7 unit-test cases cover every threshold boundary; badge renders color + Chinese label. |

## Threat Model Realization

| Threat | Mitigation |
| --- | --- |
| T-6-20 (Elevation of Privilege) | Every action begins with `assertAdmin(await auth())`. `grep -c` returns 6 (floor was 4). |
| T-6-21 (IDOR) | `id` zod-parsed to positive int. No per-row ownership model — admins are trusted callers. |
| T-6-22 (Injection) | zod `.string().url()` on rssUrl; Drizzle parameterizes all binds. |
| T-6-24 (Info Disclosure) | `toErrorCode(e)` maps caught exceptions to `'INTERNAL'` by default; `AdminAuthError` is the only typed escape hatch, producing `'UNAUTHENTICATED'` or `'FORBIDDEN'`. `err.message` never reaches the client. |
| T-6-25 (Data loss) | Soft delete only — no hard delete exists in this plan. Confirm dialog copy tells the admin items are preserved. |

## Verification Results

| Check | Result |
| --- | --- |
| `pnpm test --run tests/unit/admin-sources.test.ts tests/unit/source-health.test.ts` | ✅ 18/18 pass (11 repo + 7 health) |
| `pnpm exec tsc --noEmit` | ✅ clean |
| `pnpm run build` | ✅ succeeds; `/admin/sources`, `/admin/sources/[id]/edit`, `/admin/sources/new` all compile as ƒ (Dynamic). Build required `.env.local` (copied from project root, removed after). |
| Acceptance grep: `isNull(sources.deletedAt)` in sources-repo | ✅ present |
| Acceptance grep: `isNull(sources.deletedAt)` in ingestion | ✅ present in `src/trigger/ingest-hourly.ts` |
| Acceptance grep: `assertAdmin` count ≥ 4 in admin-sources.ts | ✅ 6 |
| Acceptance grep: `z.object` in admin-sources.ts | ✅ present (SourceCreateSchema, SourceUpdateSchema) |
| Acceptance grep: `window.confirm` in source-row-actions.tsx | ✅ present |
| Acceptance grep: `信源管理` in /admin/sources page | ✅ present |
| Acceptance grep: `force-dynamic` in /admin/sources page | ✅ present |

## TDD Gate Compliance

Task 1 used full RED/GREEN cycle:
- RED commit `236722a`: `test(06-02): add failing tests for admin sources-repo + computeSourceHealth` — tests failed because the module did not exist (`Failed to resolve import "@/lib/admin/sources-repo"`).
- GREEN commit `b19625c`: `feat(06-02): add sources-repo + health badge, filter soft-deleted in poller` — 18/18 tests pass after implementation.

Tasks 2 and 3 were `type="auto"` (not TDD) per plan spec — gate does not apply.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Installed dependencies + copied `.env.local` for production build**
- **Found during:** Task 1 RED run (`vitest: command not found`)
- **Fix:** `pnpm install --frozen-lockfile` inside the worktree. Later the build needed `DATABASE_URL` because `/sitemap.xml` prerenders at build time; copied `/Users/r25477/Project/ai-hotspot/.env.local` into the worktree for the build, then removed it (not committed). This is a fresh-worktree hygiene step, not a code change.
- **Files modified:** none committed (node_modules is .gitignored; .env.local was removed before commit).

### Intentional Divergences from the Plan Stub

**1. `SourceUpdateSchema` does not include `rssUrl`.**
The plan's example action includes `rssUrl` in create only, but the plan's must-haves require `updateSourceAction` to accept name/weight/isActive/category. rssUrl is left out of the update schema deliberately so the field can be `disabled` in the UI without also silently accepting a posted value. Documented in `src/server/actions/admin-sources.ts` JSDoc and `src/components/admin/source-form.tsx` Chinese hint.

**2. Added `toggleActiveAction(id, nextActive)` with explicit next-state argument.**
The plan mentions a toggleActiveAction without specifying the signature. Accepting the next state (rather than reading current state + flipping) keeps the Server Action stateless and prevents race conditions between two admin tabs.

**3. `updateSourceCore` is a no-op on an empty patch.**
Drizzle rejects `.set({})` with "No values to set" at runtime. Guarding before the call avoids the throw and is easier to reason about than forcing the caller to pre-check.

## Known Stubs

None. The page renders live data from Neon via `listSourcesForAdmin`; form submits go through real Server Actions; row actions mutate real DB rows. All three pages are wired end-to-end.

## Deferred Issues

Pre-existing `jsdom + Anthropic SDK browser guard` test failures persist (5 test files, all transitive imports of `@/lib/llm/client.ts`). Tracked in `.planning/phases/06-admin-operational-hardening/deferred-items.md` with updated scope note. Out of scope for Plan 06-02.

## Commits (worktree `worktree-agent-abbfd5cf`)

| # | Hash | Type | Scope | Subject |
| --- | --- | --- | --- | --- |
| 1 | `236722a` | test | 06-02 | add failing tests for admin sources-repo + computeSourceHealth |
| 2 | `b19625c` | feat | 06-02 | add sources-repo + health badge, filter soft-deleted in poller |
| 3 | `b86c238` | feat | 06-02 | add admin-sources server actions + SourceForm + SourceRowActions |
| 4 | `16988c5` | feat | 06-02 | add admin sources pages (list/new/edit) + SourcesTable |

## Self-Check: PASSED

All 11 key files present:
- ✅ src/lib/admin/sources-repo.ts
- ✅ src/components/admin/source-health-badge.tsx
- ✅ src/components/admin/source-form.tsx
- ✅ src/components/admin/source-row-actions.tsx
- ✅ src/components/admin/sources-table.tsx
- ✅ src/server/actions/admin-sources.ts
- ✅ src/app/admin/sources/page.tsx
- ✅ src/app/admin/sources/new/page.tsx
- ✅ src/app/admin/sources/[id]/edit/page.tsx
- ✅ tests/unit/admin-sources.test.ts
- ✅ tests/unit/source-health.test.ts

All 4 commits present in `git log --oneline`: 236722a, b19625c, b86c238, 16988c5.
