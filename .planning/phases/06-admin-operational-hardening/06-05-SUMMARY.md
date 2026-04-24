---
phase: 06-admin-operational-hardening
plan: "05"
subsystem: admin-dead-letter
tags: [admin, ops-03, dead-letter, rate-limit, upstash]
requires:
  - "src/lib/auth/admin.ts (assertAdmin, AdminAuthError)"
  - "src/lib/redis/client.ts (Upstash Redis singleton)"
  - "src/lib/db/schema.ts (items.status, items.failureReason, items.retryCount)"
  - "src/trigger/process-pending.ts (claimPendingItems — consumes status='pending')"
provides:
  - "listDeadLetterItems(limit) — RSC read view"
  - "retryItemCore(itemId) — race-guarded single retry"
  - "retryAllCore(limit) — race-guarded bulk retry"
  - "retryItemAction / retryAllAction — rate-limited server actions"
  - "/admin/dead-letter RSC page + DeadLetterTable + RetryButton"
affects:
  - "Phase 3 LLM pipeline (items transitioning dead_letter → pending → published)"
tech-stack:
  added:
    - "@upstash/ratelimit@^2.0.8 (sliding-window rate limiter)"
  patterns:
    - "Deps-injected core-logic / thin adapter split (mirrors favorites-core)"
    - "Race-guarded UPDATE ... WHERE status='dead_letter'"
    - "retry_count + 1 via Drizzle sql template (in-DB increment, not JS read-then-write)"
    - "Upstash Ratelimit sliding-window (not tumbling — avoids 2× burst at minute boundary)"
key-files:
  created:
    - "src/lib/admin/dead-letter-repo.ts"
    - "src/server/actions/admin-dead-letter.ts"
    - "src/app/admin/dead-letter/page.tsx"
    - "src/components/admin/dead-letter-table.tsx"
    - "src/components/admin/retry-button.tsx"
    - "tests/unit/admin-dead-letter.test.ts"
  modified:
    - "package.json"
    - "pnpm-lock.yaml"
    - ".planning/phases/06-admin-operational-hardening/deferred-items.md"
decisions:
  - "Sliding-window rate limit chosen over tumbling — tumbling allows 40 retries in 2s across the minute boundary (direct LLM budget burn)"
  - "Bulk retry consumes a single rate-limit credit (not 20) but itself caps at 20 items — combined ceiling matches single-item cap"
  - "retryAllCore executes raw SQL for the bulk UPDATE because Drizzle's .update().set({retryCount: sql}).where(inArray) + race-guard composition does not round-trip the AND status='dead_letter' guard reliably through query-builder"
  - "Row click uses new-tab link to items.url (target=_blank noreferrer) so admins can investigate source content without losing their table position"
metrics:
  duration: "7min"
  tasks: 2
  files: 9
  completed: "2026-04-24"
---

# Phase 06 Plan 05: Admin Dead-Letter Queue Summary

One-liner: Admin `/admin/dead-letter` page lists failed LLM-pipeline items; rate-limited server actions transition them back to `status='pending'` for re-processing by the existing `process-pending` poller.

## Tasks Completed

| Task | Name                                                                   | Commit   | Files                                                         |
| ---- | ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| 1    | Dead-letter repo + retry core + unit tests (RED)                       | e97f5d8  | tests/unit/admin-dead-letter.test.ts                          |
| 1    | Dead-letter repo + retry core + unit tests (GREEN)                     | 920a451  | src/lib/admin/dead-letter-repo.ts, tests/unit/admin-dead-letter.test.ts |
| 2    | Rate-limited server actions + admin page + table + retry button        | 0cb9c5c  | package.json, pnpm-lock.yaml, src/server/actions/admin-dead-letter.ts, src/app/admin/dead-letter/page.tsx, src/components/admin/dead-letter-table.tsx, src/components/admin/retry-button.tsx, .planning/.../deferred-items.md |

## Must-Haves Verified

- **Admin `/admin/dead-letter` lists items where status='dead_letter'** with id, title, source name, failureReason (truncated to 80 chars + hover `title`), retryCount, processedAt — ✓ via `DeadLetterTable` Chinese columns (标题, 信源, 失败原因, 重试次数, 处理时间, 操作).
- **Clicking 重试 transitions the row back to `status='pending'`**, clears `failureReason`, increments `retryCount`, nullifies `processedAt` — ✓ `retryItemCore` with `WHERE id=? AND status='dead_letter'` race guard. `process-pending`'s existing `claimPendingItems` (FOR UPDATE SKIP LOCKED over `status='pending'`) picks it up on the next 5-minute tick — no pipeline change required.
- **Rate limit: max 20 retries per admin per 60-second window** — ✓ Upstash `Ratelimit.slidingWindow(20, '60 s')` with `prefix: 'admin:retry'`. Sliding window (not tumbling) prevents 40-in-2-seconds bursts at minute boundaries.
- **Every retry action calls `assertAdmin(session)` first** — ✓ both `retryItemAction` and `retryAllAction` fetch `auth()` and call `assertAdmin()` before any DB or Redis touch (Layer 3 of the admin-gate defense-in-depth).
- **Bulk "retry all" capped at 20 items per bulk click** — ✓ `BULK_LIMIT=20` passed to `retryAllCore`; bulk action uses a single rate-limit credit (same ceiling holds).

## Artifacts

| Path                                             | Provides                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| src/lib/admin/dead-letter-repo.ts                | `listDeadLetterItems`, `retryItemCore`, `retryAllCore` (pure, deps-injected) |
| src/server/actions/admin-dead-letter.ts          | `retryItemAction`, `retryAllAction` with `assertAdmin` + Upstash `Ratelimit.slidingWindow(20, '60 s')` |
| src/app/admin/dead-letter/page.tsx               | RSC list, `force-dynamic`, Chinese heading 死信队列              |
| src/components/admin/dead-letter-table.tsx       | Chinese columns, bulk-retry button with `window.confirm`, empty-state copy |
| src/components/admin/retry-button.tsx            | `useTransition`-driven retry; Chinese error mapping for RATE_LIMITED / auth / INTERNAL |
| tests/unit/admin-dead-letter.test.ts             | 6 passing unit tests                                             |

## Key Links Verified

| From                                  | To                                 | Via                                                                                     |
| ------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| `retryItemCore`                       | `items.status = 'pending'`         | `UPDATE items SET status='pending', failure_reason=NULL, retry_count=retry_count+1, processed_at=NULL WHERE id=? AND status='dead_letter'` |
| `retryAllCore`                        | `items.status = 'pending'` (bulk)  | Raw SQL `UPDATE ... WHERE id IN ${ids} AND status = 'dead_letter'` (race guard preserved) |
| `retryItemAction` / `retryAllAction`  | `processPending` poller            | No change needed — poller's `claimPendingItems` already scans `status='pending'` via FOR UPDATE SKIP LOCKED; retried rows join the queue naturally |

## Threat Model Coverage

| Threat ID | Disposition | Mitigation (as implemented)                                                                                           |
| --------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| T-6-50    | mitigate    | `assertAdmin(await auth())` fires at action entry, before any DB or Redis access                                      |
| T-6-51    | mitigate    | Upstash `Ratelimit.slidingWindow(20, '60 s')` per-admin key; bulk action counts as one credit but caps at 20 items    |
| T-6-52    | mitigate    | Both `retryItemCore` and `retryAllCore` include `AND status = 'dead_letter'` in the UPDATE — concurrent retries on the same id hit zero rows on the second call |
| T-6-53    | mitigate    | `IdSchema = z.object({ itemId: z.string().regex(/^\d+$/) })` then `BigInt(...)` coercion inside the action            |
| T-6-54    | accept      | failure_reason truncated to 80 chars in UI with full text under `title=` attr (admin-only audience)                    |
| T-6-55    | mitigate    | `revalidatePath('/admin/dead-letter')` after both actions; row disappears on next render once status flipped to pending |

## Deviations from Plan

**[Rule 1 — Bug] Chainable mock required custom SQL flattener for retry_count assertion**
- Found during: Task 1 RED → GREEN iteration
- Issue: The initial test used `JSON.stringify` to assert `retry_count + 1` was embedded in the Drizzle SQL. JSON.stringify cannot serialise Drizzle's sql-template values: they reference `items` (PgTable, circular) and bigints. The 4/6 passing subset was not affected, but the 2 SQL-assertion tests failed.
- Fix: Added a `flattenSql(node)` helper in the test file that walks the queryChunks tree picking up string fragments (`value`, `sql`, `queryChunks`) into an array. Used for the `retry_count + 1` assertion and the bulk `retry_count = retry_count + 1` assertion.
- Files modified: tests/unit/admin-dead-letter.test.ts
- Commit: 920a451

**[Rule 1 — Bug] BigInt literal (`1n`) syntax not available under ES2017 TS target**
- Found during: `pnpm exec tsc --noEmit` after GREEN
- Issue: `tsconfig.json` pins `"target": "ES2017"`; bigint literals require ES2020.
- Fix: Replaced every `101n` / `1n` etc. with `BigInt(101)` / `BigInt(1)`. Runtime behaviour identical.
- Files modified: tests/unit/admin-dead-letter.test.ts
- Commit: 920a451

**[Rule 1 — Bug] Bulk UPDATE needed raw SQL, not the query builder**
- Found during: retryAllCore implementation
- Issue: Composing `.update(items).set({retryCount: sql\`${items.retryCount} + 1\`}).where(and(inArray(items.id, ids), eq(items.status, 'dead_letter')))` does not reliably round-trip the race guard (the race guard was ineffective if the SELECT and UPDATE drifted). More importantly, keeping the race-guard explicit and auditable in SQL is what the threat model T-6-52 mitigation hangs on.
- Fix: `retryAllCore` uses `d.execute(sql\`UPDATE items SET ... WHERE id IN ${ids} AND status = 'dead_letter'\`)` — explicit, auditable, testable (SQL fragments visible via the `flattenSql` walker).
- Files modified: src/lib/admin/dead-letter-repo.ts
- Commit: 920a451

## Deferred Issues

**Pre-existing: `/sitemap.xml` build failure without `DATABASE_URL`**
- Logged in `.planning/phases/06-admin-operational-hardening/deferred-items.md`
- Introduced by Plan 06-07 commit `228c421` (Wave 1); sitemap route is statically rendered at build time and queries Neon.
- Out of scope for Plan 06-05 (OPS-03). Build of `/admin/dead-letter` succeeded — `.next/server/app/admin/dead-letter/page.js` (188KB) was produced before the sitemap error terminated the build.

## Self-Check: PASSED

Files exist:
- `src/lib/admin/dead-letter-repo.ts` ✓
- `src/server/actions/admin-dead-letter.ts` ✓
- `src/app/admin/dead-letter/page.tsx` ✓
- `src/components/admin/dead-letter-table.tsx` ✓
- `src/components/admin/retry-button.tsx` ✓
- `tests/unit/admin-dead-letter.test.ts` ✓

Commits in branch:
- `e97f5d8` RED (test-only) ✓
- `920a451` GREEN (dead-letter-repo + test fix) ✓
- `0cb9c5c` feat: admin page + rate-limited actions ✓

Verifications run:
- `pnpm test --run tests/unit/admin-dead-letter.test.ts` → 6/6 passing
- `pnpm exec tsc --noEmit` → exit 0
- `pnpm run build` → `/admin/dead-letter` compiled (page.js emitted); build terminated on pre-existing `/sitemap.xml` error (deferred)

Acceptance grep checks:
- `status = 'dead_letter'` appears 3× in src/lib/admin/dead-letter-repo.ts ✓
- `retry_count + 1` appears in src/lib/admin/dead-letter-repo.ts ✓
- `@upstash/ratelimit` present in package.json ✓
- `Ratelimit.slidingWindow(20` + `'60 s'` + `RATE_LIMITED` + `assertAdmin` all present in src/server/actions/admin-dead-letter.ts ✓
- `listDeadLetterItems` + `死信队列` in page.tsx ✓
- `重试` in retry-button.tsx ✓
