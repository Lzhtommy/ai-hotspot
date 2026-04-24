---
phase: quick-260424-oyc
plan: 01
subsystem: admin-ops
tags: [admin, trigger.dev, ingest, sync, ui, ratelimit, rsc-client-island]
dependency_graph:
  requires:
    - src/lib/auth (Auth.js v5 session)
    - src/lib/auth/admin.ts (assertAdmin + AdminAuthError)
    - src/lib/redis/client.ts (Upstash singleton)
    - src/trigger/ingest-hourly.ts (schedules.task target of manual run)
    - src/components/layout/button.tsx (Button primitive)
    - src/components/feed/feed-top-bar.tsx (mount point)
  provides:
    - POST /api/admin/sync — admin-gated Trigger.dev manual-run endpoint
    - <ManualSyncButton canSync /> — 'use client' island with in-flight/cooldown/result states
    - canSync?: boolean on FeedTopBarProps — role-gate threaded from RSC pages
  affects:
    - src/app/(reader)/page.tsx, /all/page.tsx, /favorites/page.tsx (FeedTopBar mounts)
tech_stack:
  added: []
  patterns:
    - "Three-gate stack (auth → rate-limit → trigger) mirroring src/server/actions/admin-dead-letter.ts:40-49"
    - "Client-island RSC prop-threading (Plan 05-07 precedent) — canSync flows RSC → FeedTopBar(server) → ManualSyncButton(client)"
    - "Fail-closed on Redis outage (availability ↓ safety ↑ to protect LLM budget)"
    - "Opaque error response shape — never echoes err.message (T-OYC-04 secret-safety contract)"
key_files:
  created:
    - src/app/api/admin/sync/route.ts (99 LOC) — POST route handler
    - src/components/feed/manual-sync-button.tsx (147 LOC) — client island
    - tests/unit/sync-route.test.ts (142 LOC) — 6 unit tests
  modified:
    - src/components/feed/feed-top-bar.tsx — +canSync prop; 手动同步 placeholder → <ManualSyncButton>
    - src/app/(reader)/page.tsx — derives canSync, threads to <FeedTopBar>
    - src/app/(reader)/all/page.tsx — derives canSync, threads to <FeedTopBar>
    - src/app/(reader)/favorites/page.tsx — derives canSync, threads to <FeedTopBar>
decisions:
  - "D-01 Client island (NOT convert FeedTopBar to 'use client') — preserves RSC for static bar; only sync button ships JS"
  - "D-02 Server is sole auth authority — canSync prop is UX-only; route re-derives via assertAdmin on every POST"
  - "D-03 Upstash sliding-window authoritative; localStorage countdown is UX parity only (server wins on disagreement)"
  - "D-04 NO toast dependency (sonner/react-hot-toast) — inline <span role=status aria-live=polite> for all feedback"
  - "D-06 Opaque response shape — 401/403/429/500 variants; never includes err.message (Trigger.dev errors may embed TRIGGER_SECRET_KEY fragments)"
  - "D-08 Payload = undefined (runtime) with 'as never' cast — Trigger.dev v4 server synthesises ScheduledTaskPayload for manual runs of schedules.task"
  - "D-09 Expose run.id (runId) but NOT publicAccessToken — realtime SDK out of scope; avoid third-party subscription surface"
metrics:
  duration: "~20min"
  completed: 2026-04-24
commits:
  - c1fd2b7 test(quick-260424-oyc): add failing tests for POST /api/admin/sync
  - 50acd82 feat(sync): add POST /api/admin/sync admin-gated Trigger.dev manual-run route
  - 0c4069e feat(sync): wire right-top 手动同步 button to /api/admin/sync via ManualSyncButton client island
---

# Quick 260424-oyc: Manual Sync Button Summary

One-liner: Admin-only 手动同步 button wired to `POST /api/admin/sync` (three gates: assertAdmin → Upstash slidingWindow(1/120s/user) → `tasks.trigger('ingest-hourly')`) — replaces the Phase-4 disabled placeholder in FeedTopBar with a `'use client'` island on 3 feed pages.

## Artifacts

### Created

| File | LOC | Purpose |
|------|-----|---------|
| `src/app/api/admin/sync/route.ts` | 99 | POST route: authz + cooldown + manual Trigger.dev run |
| `src/components/feed/manual-sync-button.tsx` | 147 | `'use client'` island with in-flight / cooldown / result state |
| `tests/unit/sync-route.test.ts` | 142 | 6 unit tests (auth / rate-limit / trigger / error-no-leak / per-user key) |

### Modified

| File | Change | LOC delta |
|------|--------|-----------|
| `src/components/feed/feed-top-bar.tsx` | +`canSync?: boolean` prop; import `ManualSyncButton`; replace 手动同步 placeholder | +11, -4 |
| `src/app/(reader)/page.tsx` | Derive `canSync` from session role; pass to `<FeedTopBar>` | +4, -0 |
| `src/app/(reader)/all/page.tsx` | Same | +3, -0 |
| `src/app/(reader)/favorites/page.tsx` | Same | +3, -0 |

Scope boundary upheld: 导出 button bit-identical (`disabled title="Phase 6 开放"`), sidebar / sidebar-search / feed-card untouched.

## Commits

| # | SHA | Type | Message |
|---|-----|------|---------|
| 1 | c1fd2b7 | test | test(quick-260424-oyc): add failing tests for POST /api/admin/sync |
| 2 | 50acd82 | feat | feat(sync): add POST /api/admin/sync admin-gated Trigger.dev manual-run route |
| 3 | 0c4069e | feat | feat(sync): wire right-top 手动同步 button via ManualSyncButton client island |

TDD gate sequence for Task 1 satisfied: RED (c1fd2b7) precedes GREEN (50acd82).

## Test Results

### Plan unit tests (sync-route)

```
✓ tests/unit/sync-route.test.ts (6 tests) 37ms
  ✓ returns 401 UNAUTHENTICATED when there is no session
  ✓ returns 403 FORBIDDEN when session.user.role !== "admin"
  ✓ returns 429 RATE_LIMITED when the sliding-window denies the admin
  ✓ returns 200 { ok:true, runId } on a successful admin trigger
  ✓ returns opaque 500 INTERNAL on trigger failure without leaking the error message
  ✓ keys the sliding-window rate-limit by the admin user id (per-user isolation)
```

### Adjacent tests (no regressions)

```
✓ tests/unit/admin-gate.test.ts              (8/8)
✓ tests/unit/admin-sources-actions.test.ts   (11/11)
```

### Static analysis

| Check | Result |
|-------|--------|
| `pnpm typecheck` | PASS (0 errors) |
| `pnpm build`     | PASS — `/api/admin/sync` registered as ƒ 330 B |

### Grep contract assertions (all 7 match)

```
src/components/feed/feed-top-bar.tsx : "ManualSyncButton"
src/app/api/admin/sync/route.ts      : "tasks.trigger", "admin:sync"
src/components/feed/feed-top-bar.tsx : "Phase 6 开放"  (导出 button retained)
src/app/(reader)/page.tsx            : "canSync"
src/app/(reader)/all/page.tsx        : "canSync"
src/app/(reader)/favorites/page.tsx  : "canSync"
```

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — blocking type error] `tasks.trigger<typeof ingestHourly>('ingest-hourly', undefined)` failed typecheck**

- **Found during:** Task 1 GREEN gate (`pnpm typecheck` after implementation)
- **Issue:** The plan (D-08) prescribes `undefined` as the payload for `tasks.trigger` on a `schedules.task`. The runtime does accept this (Trigger.dev v4 server synthesises `ScheduledTaskPayload` when the client omits it), but the static TS type of the second parameter is `TaskPayload<TTask>`, which for `ingestHourly` is the full `ScheduledTaskPayload` object — not `undefined`. `tsc --noEmit` flagged `TS2345: Argument of type 'undefined' is not assignable to parameter of type '{ type: "DECLARATIVE" | "IMPERATIVE"; timestamp: Date; ... }'`.
- **Fix:** Pass `undefined as never` and document the server-side synthesis contract inline. Preserves the generic-constrained task id (`'ingest-hourly'` must be a valid task), while letting the runtime rely on Trigger.dev filling in `{ timestamp: now(), scheduleId, type, timezone, upcoming }` for the manual run.
- **Files modified:** `src/app/api/admin/sync/route.ts`
- **Commit:** 50acd82 (fix rolled into GREEN commit — same TDD cycle)
- **Impact on verification:** zero. The runtime path is unchanged from what the plan intended; Trigger.dev's schedules-task manual-run surface does not require the client to construct the payload. The test suite's mock of `tasks.trigger` asserts invocation with `('ingest-hourly', undefined)`, which continues to pass because `as never` is erased at runtime.

No architectural deviations (Rule 4); no other bug fixes (Rule 1) or added missing functionality (Rule 2).

## Authentication Gates

None encountered — the unit tests mock `@/lib/auth` directly, and the Vercel-live smoke checks (manual trigger from admin browser + Trigger.dev dashboard cross-reference) are deferred to post-merge per the plan's optional manual-smoke block.

## Live Verification

Deferred to post-merge user action — requires a real admin session + `TRIGGER_SECRET_KEY` in production env + browser access to the `/` page to observe button states and the Trigger.dev dashboard to confirm a run with the returned `runId`. The static build (`pnpm build`) registers the route, so the merge gate is satisfied on CI without a live smoke test.

## Scope Verification (plan success criteria 1-8)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | All must-haves truths observable (admin enabled button, non-admin tooltip, loading/success/429, 120s server cooldown, all 文案中文, 导出 unchanged) | PASS — code paths cover each; live-smoke deferred |
| 2 | 6 unit tests green (auth 401 / auth 403 / rate-limit 429 / success 200 runId / trigger error opaque 500 no-leak / per-user key) | PASS 6/6 |
| 3 | `pnpm build` + `pnpm typecheck` green | PASS |
| 4 | No new npm dependencies | PASS — `git diff package.json` empty |
| 5 | `FeedTopBar` remains Server Component; only `<ManualSyncButton>` is `'use client'` | PASS — `'use client'` directive present on ManualSyncButton only |
| 6 | 导出 button bit-identical (`disabled title="Phase 6 开放"`) | PASS — lines 142-144 of feed-top-bar.tsx unchanged in semantics |
| 7 | sidebar*.tsx and sidebar-search.tsx NOT modified | PASS — `git diff --stat src/components/layout/sidebar*.tsx` empty |
| 8 | No run-status polling / app-level audit / toast dep | PASS — scope adhered |

## Deferred Follow-Ups (v1.1 / v2 backlog)

- Live run-status polling (subscribe to Trigger.dev realtime via the returned runId + `@trigger.dev/react`) — deferred: requires new client dependency (not in current lockfile)
- App-level audit table for manual triggers (who / when / runId) — deferred: T-OYC-03 accepted via Trigger.dev native audit log
- Feed page auto-revalidate after run completion (POST-trigger polling or realtime + `router.refresh()`) — deferred: current ISR revalidate=300 is sufficient for hourly ingest cadence
- Export button implementation — out of scope per CONTEXT; still `disabled title="Phase 6 开放"`
- Live browser UAT (admin session + Trigger.dev dashboard cross-reference) — deferred, matches Plan 05-10 / 06-06 precedent of decoupling code-complete from experiential verification

## Known Stubs

None. The button is fully wired end-to-end; no UI element renders mock data or a placeholder.

## Threat Flags

No new trust-boundary surface beyond what the plan's `<threat_model>` already enumerates (T-OYC-01..08). The route adds one new admin POST endpoint, which the plan anticipated and mitigated (assertAdmin + slidingWindow + fail-closed Redis + opaque error shape).

## Self-Check: PASSED

Created files verified present on disk:
- `src/app/api/admin/sync/route.ts` FOUND
- `src/components/feed/manual-sync-button.tsx` FOUND
- `tests/unit/sync-route.test.ts` FOUND

Commits verified in `git log --all --oneline`:
- c1fd2b7 FOUND (RED test)
- 50acd82 FOUND (GREEN route)
- 0c4069e FOUND (UI wiring)

Build artifact verified: `/api/admin/sync` listed in Next.js route table as dynamic function.
