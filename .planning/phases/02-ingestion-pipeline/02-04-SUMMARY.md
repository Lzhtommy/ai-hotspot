---
phase: 02-ingestion-pipeline
plan: 04
subsystem: database
tags: [drizzle, neon, postgres, seed, rsshub, idempotent, tsx, dotenv]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: "sources table with UNIQUE(rss_url) constraint; Drizzle db singleton; .env.local DATABASE_URL wired to Neon dev branch"
  - phase: 02-ingestion-pipeline (Plan 02-01)
    provides: "Validated ingestion interfaces; sources schema stable"
provides:
  - "Idempotent pnpm db:seed alias that populates 3 canary sources (Anthropic, HN AI, buzzing.cc)"
  - "Dev/preview Neon branch has ≥3 active sources with correct language + weight for ingest-hourly to enumerate"
  - "Precedent for future seed/backfill scripts to reuse the shared db singleton via tsx --env-file=.env.local"
affects:
  - 02-05 (verification-harness — needs ≥1 active source that returns items for no-dupe rerun test)
  - 03 (llm-pipeline — operates on items ingested from these sources)
  - 06 (admin — will replace manual seeding with CRUD UI)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seed-script env loading: `tsx --env-file=.env.local <script.ts>` (preloads env before module evaluation, so eager neon() clients see DATABASE_URL)"
    - "Idempotent seed: `db.insert(table).values(...).onConflictDoNothing({ target: table.uniqueColumn })` per D-19"
    - "RSSHub routes stored as paths only (e.g. `/anthropic/news`) — RSSHUB_BASE_URL + ACCESS_KEY composed at request time (D-20 secret hygiene)"

key-files:
  created:
    - "drizzle/seed-sources.ts — 3-row canary seed, idempotent via ON CONFLICT (rss_url) DO NOTHING"
  modified:
    - "package.json — db:seed alias (with --env-file flag for correct dotenv ordering)"

key-decisions:
  - "Use `tsx --env-file=.env.local` instead of in-file dotenv.config() because db/client.ts eagerly calls neon() at import time — ES-module hoisting made the in-file dotenv.config() run too late"
  - "Keep the seed reusing the shared `db` singleton (no second neon() invocation) per plan acceptance criteria — env preloading solves the bootstrap gap"
  - "Stored RSSHub routes as paths, not full URLs, so rotating RSSHUB_BASE_URL or ACCESS_KEY requires zero DB updates"

patterns-established:
  - "Seed/one-shot scripts that import from @/lib/db/client must be invoked with `tsx --env-file=.env.local` (or equivalent preload) — direct `tsx script.ts` will fail with 'No database connection string was provided'"
  - "Idempotent ON CONFLICT seeding pattern (Drizzle): `.onConflictDoNothing({ target: table.uniqueCol })` — re-running the script is a true no-op"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-04-20
---

# Phase 2 Plan 04: Canary source seed Summary

**Three canary RSSHub sources (Anthropic Blog, Hacker News AI, buzzing.cc) seeded into Neon dev branch via idempotent `pnpm db:seed` — ingest-hourly cron now has real data to enumerate for Plan 05 verification.**

## Performance

- **Duration:** ~8 min (code tasks previously committed; this session handled the live verification + env-loading fix)
- **Started:** 2026-04-20T08:55:50Z (continuation from Plan 02-03 completion)
- **Completed:** 2026-04-20T09:01:13Z
- **Tasks:** 2 (both originally autonomous)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `drizzle/seed-sources.ts` authored with 3 canary RSSHub routes, typed rows, shared `db` singleton reuse, and ON CONFLICT idempotency.
- `pnpm db:seed` alias added to `package.json` with `--env-file=.env.local` for correct env bootstrap.
- Live dev-branch verification: first run inserted 3 rows; second run inserted 0 rows (idempotency proven); `SELECT COUNT(*) FROM sources WHERE is_active = true` returns exactly 3.
- Unblocked Plan 02-05 (verification harness) — `ingest-hourly` will now enumerate ≥1 active source per success criterion #1.

## Task Commits

1. **Task 1: Create drizzle/seed-sources.ts** — `c22a542` (feat)
2. **Task 2: Add db:seed script to package.json** — `97242c6` (feat)

**Auto-fix commit (Rule 3 — blocking):** `db1f0ee` (fix) — switch `db:seed` to `tsx --env-file=.env.local` so eager `neon()` at db-client import time sees DATABASE_URL. See Deviations.

**Plan metadata commit:** (this SUMMARY + STATE/ROADMAP update) — hash recorded at final commit.

## Files Created/Modified

- `drizzle/seed-sources.ts` (CREATED) — Idempotent 3-row canary seed for the `sources` table.
- `package.json` (MODIFIED) — Added `"db:seed": "tsx --env-file=.env.local drizzle/seed-sources.ts"`.

## Live Verification Output

### Run 1 — first invocation (expected: 3 inserts)

```
> ai-hotspot@0.1.0 db:seed /Users/r25477/Project/ai-hotspot
> tsx --env-file=.env.local drizzle/seed-sources.ts

◇ injected env (0) from .env.local // tip: ⌁ auth for agents [www.vestauth.com]
Seeded 3 rows (idempotent). Total sources now: 3.
  #1  Anthropic Blog  /anthropic/news
  #2  Hacker News AI  /hackernews/newest/ai
  #3  buzzing.cc  /buzzing/whatsnew
```

Exit code: 0.

### Run 2 — second invocation (expected: 0 new inserts, total stays 3)

```
> ai-hotspot@0.1.0 db:seed /Users/r25477/Project/ai-hotspot
> tsx --env-file=.env.local drizzle/seed-sources.ts

◇ injected env (0) from .env.local // tip: ⌘ custom filepath { path: '/custom/path/.env' }
Seeded 3 rows (idempotent). Total sources now: 3.
  #1  Anthropic Blog  /anthropic/news
  #2  Hacker News AI  /hackernews/newest/ai
  #3  buzzing.cc  /buzzing/whatsnew
```

Exit code: 0. Total count unchanged — `ON CONFLICT (rss_url) DO NOTHING` fired three times silently.

### Active source count confirmation

```
Active sources: 3
[
  { "id": 1, "name": "Anthropic Blog", "rss_url": "/anthropic/news",       "language": "en", "weight": "1.0", "is_active": true },
  { "id": 2, "name": "Hacker News AI", "rss_url": "/hackernews/newest/ai", "language": "en", "weight": "0.8", "is_active": true },
  { "id": 3, "name": "buzzing.cc",     "rss_url": "/buzzing/whatsnew",     "language": "zh", "weight": "1.0", "is_active": true }
]
```

All 3 rows present with `is_active=true`, correct language (2× en + 1× zh), correct weight (1.0 / 0.8 / 1.0), and rss_url values matching the D-18 canary set exactly.

## Decisions Made

- **Env preload via `tsx --env-file=.env.local`** — chosen over "inline `neon()` in the seed" because the plan explicitly requires reusing the shared `db` singleton (acceptance criterion: `grep -c "neon(" drizzle/seed-sources.ts` must return 0). The `--env-file` flag solves the bootstrap problem without violating that contract and establishes a reusable pattern for future scripts.
- **Seed stores RSSHub paths, not full URLs** — retains D-20 secret hygiene (ACCESS_KEY never hits the DB) and keeps `RSSHUB_BASE_URL` rotatable from env alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Seed script crashed on first run: "No database connection string was provided to neon()"**

- **Found during:** Task 2 live verification (`pnpm db:seed`, first run)
- **Issue:** The seed file ordering is `import 'dotenv/config'` → `config({ path: '.env.local' })` → `import { db } from '../src/lib/db/client'`. But ES-module imports are hoisted: the `db` client import executes BEFORE the `config({ path: '.env.local' })` statement runs. Inside `src/lib/db/client.ts`, `neon(process.env.DATABASE_URL!)` runs at module-evaluation time, sees `undefined`, and throws. `scripts/verify-schema.ts` doesn't hit this because it inlines `neon()` directly (post-dotenv) rather than importing a module that eagerly creates a client.
- **Fix:** Changed `package.json` `db:seed` script from `tsx drizzle/seed-sources.ts` → `tsx --env-file=.env.local drizzle/seed-sources.ts`. The `--env-file` flag injects env vars into `process.env` before any user code (including transitive imports) executes. Seed script's in-file `dotenv` calls become belt-and-suspenders.
- **Files modified:** `package.json` (1 line)
- **Verification:** Both seed runs now exit 0; direct DB query confirms 3 active sources.
- **Committed in:** `db1f0ee` (post-task fix commit)
- **Alternative considered & rejected:** Inline `neon(process.env.DATABASE_URL!)` in the seed. Rejected because plan acceptance criterion forbids a second `neon()` invocation (`grep -c "neon(" drizzle/seed-sources.ts` must be 0) — violating that would duplicate the connection-opening concern.

---

**Total deviations:** 1 auto-fixed (1 blocking / Rule 3)
**Impact on plan:** Minimal — one-line package.json change unblocks live verification. Plan intent (idempotent seed, shared db singleton, no secrets in DB) is fully preserved. The fix additionally establishes a reusable pattern for future seed/backfill/one-shot scripts that import the shared Drizzle client.

## Issues Encountered

Only the blocking issue documented under Deviations above. No route-health probing was performed in this session (optional per plan — Phase 2 tolerates 1 broken route; Plan 05 verification harness will exercise the routes end-to-end).

## User Setup Required

None — the only user action needed (approval to write to the shared Neon dev branch) was granted as part of this session's objective. The dev branch now contains the 3 canary sources required for Plan 02-05.

## Next Phase Readiness

- **Plan 02-05 (verification harness):** Ready — `ingest-hourly` enumerating active sources returns a non-empty set; the "two consecutive runs, zero duplicates" test is now observable.
- **Future backfill/migration scripts:** Should follow the same `tsx --env-file=.env.local` invocation pattern or add `--env-file-if-exists` for CI-safe variants.
- **Phase 6 admin UI:** Will eventually supersede this seed with CRUD; until then `pnpm db:seed` is safe to re-run at any time (fully idempotent).

## Self-Check: PASSED

- FOUND: `.planning/phases/02-ingestion-pipeline/02-04-SUMMARY.md`
- FOUND: `drizzle/seed-sources.ts`
- FOUND commit: `c22a542` (feat — seed script)
- FOUND commit: `97242c6` (feat — db:seed alias)
- FOUND commit: `db1f0ee` (fix — --env-file bootstrap)

---
*Phase: 02-ingestion-pipeline*
*Plan: 02-04*
*Completed: 2026-04-20*
