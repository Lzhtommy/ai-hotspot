---
phase: quick-260424-ney
plan: 01
subsystem: feed-reader
tags: [feed, clustering, ui, cache]
dependency_graph:
  requires:
    - src/lib/feed/get-feed.ts (existing cache-aside reader)
    - src/components/feed/timeline.tsx (existing clusterSiblings prop contract)
    - src/components/feed/cluster-section.tsx (existing expand/siblings render)
  provides:
    - getFeed() clusterSiblings map keyed by clusterId
    - feed:v2: cache key namespace (old entries cannot collide)
  affects:
    - src/app/(reader)/page.tsx
    - src/app/(reader)/all/page.tsx
tech_stack:
  added: []
  patterns:
    - Drizzle inArray + not for batch sibling fetch
    - Cache-key versioning for shape migration
key_files:
  created: []
  modified:
    - src/lib/feed/get-feed.ts
    - src/lib/feed/get-feed.test.ts
    - src/app/(reader)/page.tsx
    - src/app/(reader)/all/page.tsx
    - src/app/(reader)/favorites/page.tsx
decisions:
  - Bump cache namespace to feed:v2: rather than invalidate Redis manually — new shape lands cleanly without runtime coordination
  - Favorites page scope-boundary documented in JSDoc; not wired in v1 (non-goal)
  - BigInt literals replaced with BigInt() calls — tsconfig target=ES2017 disallows Nn literals
requirements:
  - FEED-SIB-01
metrics:
  duration: 7min
  completed: 2026-04-24T08:59Z
---

# quick-260424-ney: Feed Cluster Siblings Wiring Summary

**One-liner:** getFeed now returns a `clusterSiblings: Record<clusterId, FeedListItem[]>` map that threads through Timeline into ClusterSection, making the 「另有 N 个源也报道了此事件」 expand button actually render siblings on `/` and `/all`.

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | feat | 07e3db3 | getFeed produces clusterSiblings map via batch sibling query + feed:v2: cache prefix |
| 2 | test | 186237f | Extend get-feed tests: v2: prefix, clusterSiblings fixture, cluster-primary populate + short-circuit coverage |
| 3 | feat | ecf89ec | FeaturedPage and AllFeedPage pass clusterSiblings into Timeline; favorites boundary comment |

## Task 1 — `getFeed` produces clusterSiblings

**Files:** `src/lib/feed/get-feed.ts`

- `GetFeedResult` gained required field `clusterSiblings: Record<string, FeedListItem[]>`
- Added `inArray`, `not`, `asc` to the drizzle-orm import
- After the main `rows` fetch, when at least one row has a non-null `clusterId`:
  - Collect `primaryIds` and unique `clusterIds`
  - Single batched `SELECT` on `items ⨝ sources` filtered by `clusterId IN (...)`, `id NOT IN primaryIds`, `status = 'published'`, ordered `publishedAt ASC`
  - Map into `FeedListItem` shape (same mapping style as primary rows); push into `clusterSiblings[String(clusterId)]`
- When no row has a `clusterId`, the sibling query is skipped entirely — only one `db.select` call occurs
- `buildFeedKey` outputs now start with `feed:v2:` so stale pre-fix entries in Upstash cannot satisfy cache-hit checks (new shape is populated on first miss)

## Task 2 — test coverage

**Files:** `src/lib/feed/get-feed.test.ts`

- All 8 `buildFeedKey` assertions updated to expect `feed:v2:` prefix
- `CACHED_RESULT` fixture gained `clusterSiblings: {}` (required field on `GetFeedResult`)
- New test: *cache miss + cluster primary* — mocks a 2-chain `db.select` (primary + sibling), asserts `mockDb.select` called twice, `result.clusterSiblings['42']` has 2 entries, primary id `'100'` is not present, first sibling matches `{id:'101', sourceName:'Source B', clusterId:'42'}`
- New test: *cache miss without cluster primaries* — returns a single non-clustered row, asserts `mockDb.select` called exactly once (no sibling SQL), `result.clusterSiblings === {}`
- 14/14 tests pass

## Task 3 — page-layer prop threading

**Files:** `src/app/(reader)/page.tsx`, `src/app/(reader)/all/page.tsx`, `src/app/(reader)/favorites/page.tsx`

- `/` and `/all`: destructure `clusterSiblings` from `getFeed(...)`; pass `clusterSiblings={clusterSiblings}` to `<Timeline>` alongside existing `isAuthenticated` / `interactionMap` / `initial` props (order preserved)
- `/favorites`: JSDoc gains a Chinese note marking this page as intentionally out of scope for cluster-sibling expansion in v1 (favorites reshapes its own query and does not call `getFeed`); zero code logic change

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] BigInt literals incompatible with tsconfig target**
- **Found during:** Task 2 (post-test) typecheck
- **Issue:** Plan's test snippet used `100n` / `42n` / `200n` BigInt literals, but `tsconfig.json` has `target: ES2017` — tsc emits TS2737 "BigInt literals are not available when targeting lower than ES2020".
- **Fix:** Replaced all five `Nn` literals with `BigInt(N)` calls. Runtime value is identical.
- **Files modified:** `src/lib/feed/get-feed.test.ts` (lines 225, 236, 244, 252, 307)
- **Commit:** 186237f

No other deviations.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Unit tests | `pnpm test src/lib/feed/get-feed.test.ts` | 14/14 pass |
| Typecheck | `pnpm typecheck` | exit 0 (no errors) |

**Success criteria (from plan):**
- [x] `/` and `/all` cluster expand button renders sibling list (data now threads end-to-end; UI components unchanged per plan scope)
- [x] Primary never appears in its own sibling list (`NOT IN primaryIds` in batch query + test assertion `every(s => s.id !== '100')`)
- [x] Only `status='published'` siblings included (WHERE clause)
- [x] Old Redis entries cannot poison new shape (`feed:v2:` prefix)
- [x] `/favorites` code logic zero-changed; boundary documented in JSDoc
- [x] 5 UI components (Timeline / FeedCard / ClusterSection / ClusterTrigger / ClusterSiblings) unchanged
- [x] typecheck + tests green

**Manual smoke (post-merge, deferred):** `pnpm dev` → visit `/` → expand a clustered card → siblings visible; same on `/all`.

## Self-Check: PASSED

- FOUND: src/lib/feed/get-feed.ts
- FOUND: src/lib/feed/get-feed.test.ts
- FOUND: src/app/(reader)/page.tsx
- FOUND: src/app/(reader)/all/page.tsx
- FOUND: src/app/(reader)/favorites/page.tsx
- FOUND: commit 07e3db3
- FOUND: commit 186237f
- FOUND: commit ecf89ec
