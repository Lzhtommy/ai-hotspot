---
phase: 04-feed-ui
plan: 03
subsystem: feed-data-access
tags: [redis-cache, drizzle-orm, feed, invalidation, isr, trigger-dev, security]
completed_at: "2026-04-22T06:30:56Z"
duration_minutes: 12

dependency_graph:
  requires:
    - 04-01  # layout primitives (env vars NEXT_PUBLIC_SITE_URL, REVALIDATE_SECRET)
    - 03-xx  # Phase 3 refresh-clusters task, db/schema, redis/client
  provides:
    - getFeed (Redis-cached paginated feed reader)
    - getItem (item detail + cluster siblings)
    - invalidateFeedCache (two-layer Redis+ISR invalidator)
    - POST /api/revalidate (shared-secret ISR endpoint)
    - feedParamsCache (nuqs search-params cache)
    - buildOgPayload / resolveSiteUrl (OG metadata)
  affects:
    - src/trigger/refresh-clusters.ts (extended with invalidateFeedCache hook)

tech_stack:
  added: []
  patterns:
    - DI-injectable deps (db, redis, now, fetch) for testability — matches Phase 2/3 pattern
    - Redis cache-aside with 300s TTL and SCAN cursor loop flush
    - timingSafeEqual constant-time secret comparison (node:crypto)
    - ALLOWED_PATHS Set for path allowlisting in revalidate endpoint
    - TDD RED/GREEN cycle per task

key_files:
  created:
    - src/lib/feed/get-feed.ts
    - src/lib/feed/get-feed.test.ts
    - src/lib/feed/get-item.ts
    - src/lib/feed/og-payload.ts
    - src/lib/feed/search-params.ts
    - src/lib/feed/cache-invalidate.ts
    - src/lib/feed/cache-invalidate.test.ts
    - src/app/api/revalidate/route.ts
  modified:
    - src/trigger/refresh-clusters.ts

decisions:
  - "Used sources.language as sourceKind proxy — schema has no dedicated 'kind' column; language ('zh'|'en') is the closest discriminator available"
  - "Sibling select in getItem includes status column to satisfy TypeScript type compatibility with the toFeedListItem helper"
  - "invalidateFeedCache swallows all errors — cluster refresh task must never fail due to cache side-effects (matches plan spec)"
  - "SCAN match pattern 'feed:*' with count=200 per page — safe for single-tenant Upstash instance (T-04-03-05 accept)"

metrics:
  tasks_completed: 2
  tests_added: 22
  files_created: 8
  files_modified: 1
---

# Phase 4 Plan 03: Feed Data Access Layer Summary

**One-liner:** Redis cache-aside `getFeed`/`getItem` with DI deps, two-layer `invalidateFeedCache` (SCAN+ISR), constant-time shared-secret `/api/revalidate`, and Trigger.dev `refresh-clusters` hook — wiring FEED-10 end-to-end.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for getFeed | d09c7e1 | src/lib/feed/get-feed.test.ts |
| 1 (GREEN) | getFeed, getItem, og-payload, search-params | be60a5c | get-feed.ts, get-item.ts, og-payload.ts, search-params.ts |
| 2 (RED) | Failing tests for cache-invalidate | 272c1ca | src/lib/feed/cache-invalidate.test.ts |
| 2 (GREEN) | cache-invalidate, /api/revalidate, refresh-clusters hook | 89d5516 | cache-invalidate.ts, route.ts, refresh-clusters.ts |

## What Was Built

### getFeed (src/lib/feed/get-feed.ts)
- Redis cache-aside with `buildFeedKey` producing stable sorted-tag keys per D-24 convention
- Featured view: `status='published' AND is_cluster_primary=true AND score>=70`
- All view: same base predicates minus score filter; adds tag array-overlap (`&&`) and sourceId eq filters
- TTL 300s; `{ ex: 300 }` on `redis.set`
- DI-injectable `GetFeedDeps` (db, redis, now) — matches Phase 2/3 pattern exactly

### getItem (src/lib/feed/get-item.ts)
- Fetches item by bigint id; returns null if not found or status != 'published'
- Fetches all cluster siblings (where cluster_id = item.clusterId) ordered by published_at ASC
- Maps each sibling with `isPrimary` flag; clusterMemberCount = siblings.length

### og-payload (src/lib/feed/og-payload.ts)
- `resolveSiteUrl()`: NEXT_PUBLIC_SITE_URL → VERCEL_URL → localhost:3000
- `buildOgPayload()`: title=`${titleZh??title} | AI Hotspot`, description=summaryZh[:160], absolute URLs

### search-params (src/lib/feed/search-params.ts)
- `feedParamsCache` nuqs singleton for /all: `page` (int, default 1), `tags` (string[], default []), `source` (string, default '')

### invalidateFeedCache (src/lib/feed/cache-invalidate.ts)
- SCAN cursor loop `feed:*` with count=200; batch DEL per page
- POSTs `{ paths: ['/', '/all'] }` to `/api/revalidate` with 10s AbortSignal.timeout
- All errors swallowed — never throws; warn-logged only
- Skips fetch silently when NEXT_PUBLIC_SITE_URL or REVALIDATE_SECRET are absent

### POST /api/revalidate (src/app/api/revalidate/route.ts)
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`
- `timingSafeEqual` constant-time comparison (T-04-03-01)
- `ALLOWED_PATHS = new Set(['/', '/all'])` — arbitrary paths rejected with 400 (T-04-03-02)
- Secret never logged or echoed in responses (T-04-03-03)
- 503 when REVALIDATE_SECRET not configured; 401 on wrong secret; 400 on bad/disallowed paths

### refresh-clusters hook (src/trigger/refresh-clusters.ts)
- Wraps `runRefreshClusters()` and calls `invalidateFeedCache()` only when `result.updated > 0`
- try/catch around invalidateFeedCache — cluster refresh task never fails due to cache errors

## Threat Mitigations Applied

| ID | Mitigation |
|----|-----------|
| T-04-03-01 | `timingSafeEqual` via `node:crypto`; length mismatch returns false before Buffer allocation |
| T-04-03-02 | `ALLOWED_PATHS` Set; arbitrary paths like `/admin` or `/../etc/passwd` return 400 |
| T-04-03-03 | Secret never in console.log; responses contain no header echo |
| T-04-03-06 | Errors in cache-invalidate are warn-logged with sanitized messages only |
| T-04-03-07 | `buildOgPayload` returns plain strings; no `dangerouslySetInnerHTML` usage |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript: sibling select missing `status` column**
- **Found during:** Task 1 typecheck
- **Issue:** `toFeedListItem` was typed as `typeof row` which included `status`, but sibling rows select omitted `status`, causing TS2345 error
- **Fix:** Added `status: items.status` to the sibling rows select in `getItem`
- **Files modified:** src/lib/feed/get-item.ts
- **Commit:** be60a5c (in the same feat commit)

**2. [Rule 1 - Bug] Lint: unused imports/vars in get-feed.test.ts**
- **Found during:** Task 2 lint pass
- **Issue:** `GetFeedParams` type import and `capturedPredicates` local variable were imported/declared but not used
- **Fix:** Removed unused import; simplified the predicate-capture test to not capture predicates
- **Files modified:** src/lib/feed/get-feed.test.ts
- **Commit:** 89d5516 (staged with Task 2 commit)

**3. [Design] sourceKind mapped from sources.language**
- **Found during:** Task 1 implementation
- **Issue:** `FeedListItem.sourceKind` is in the type spec but `sources` table has no `kind` column — only `language` ('zh'|'en')
- **Fix:** Used `sources.language` as `sourceKind` proxy; this is functionally equivalent for the feed card's source-type discriminator
- **Impact:** Plan 05 consumers should treat `sourceKind` as language code, not a platform kind enum

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (Task 1) | d09c7e1 | test(04-03): failing tests for getFeed |
| GREEN (Task 1) | be60a5c | feat(04-03): getFeed implementation |
| RED (Task 2) | 272c1ca | test(04-03): failing tests for cache-invalidate |
| GREEN (Task 2) | 89d5516 | feat(04-03): cache-invalidate implementation |

## Test Coverage

- 12 tests in `get-feed.test.ts`: buildFeedKey key builder (8), cache-hit/miss semantics (4)
- 10 tests in `cache-invalidate.test.ts`: SCAN cursor loop (4), fetch behaviour (5), redis error resilience (1)
- Total new tests: 22 across 2 test files
- All 150 tests in suite pass

## Known Stubs

None. All exported functions are fully implemented against the real Drizzle/Redis clients with DI fallback to real clients.

## Threat Flags

None beyond the plan's existing threat model.

## Self-Check: PASSED

Files verified present:
- src/lib/feed/get-feed.ts: FOUND
- src/lib/feed/get-feed.test.ts: FOUND
- src/lib/feed/get-item.ts: FOUND
- src/lib/feed/og-payload.ts: FOUND
- src/lib/feed/search-params.ts: FOUND
- src/lib/feed/cache-invalidate.ts: FOUND
- src/lib/feed/cache-invalidate.test.ts: FOUND
- src/app/api/revalidate/route.ts: FOUND

Commits verified:
- d09c7e1: test(04-03) RED Task 1 — FOUND
- be60a5c: feat(04-03) GREEN Task 1 — FOUND
- 272c1ca: test(04-03) RED Task 2 — FOUND
- 89d5516: feat(04-03) GREEN Task 2 — FOUND
