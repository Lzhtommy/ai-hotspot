---
phase: 01-infrastructure-foundation
plan: 02
subsystem: database
tags: [drizzle, neon, pgvector, postgresql, schema, migration, serverless, voyage-3.5]

requires:
  - phase: 01-infrastructure-foundation
    provides: "Next.js 15 scaffold, pnpm, strict TS, husky+lint-staged, .env.example canonical env registry (DATABASE_URL documented)"
provides:
  - "Drizzle ORM + @neondatabase/serverless HTTP driver wired for edge/serverless"
  - "11-table schema defined in TypeScript at src/lib/db/schema.ts (sources, items, clusters, item_clusters, tags, item_tags, users, favorites, votes, settings, pipeline_runs)"
  - "pgvector 0.8.0 enabled on Neon dev branch via hand-authored 0000_enable_pgvector.sql"
  - "vector(1024) embedding columns on items.embedding + clusters.centroid (Voyage voyage-3.5 dimensions, per D-10)"
  - "drizzle.config.ts with .env.local loading, dev branch connection live"
  - "Idempotent schema verifier at scripts/verify-schema.ts (Neon HTTP tagged-template form)"
  - "Two migrations recorded in drizzle.__drizzle_migrations journal, ready for CI replay"
affects: [01-03-trigger-redis, 01-04-rsshub-health, 01-05-ci-pipeline, 02-ingestion, 03-scoring, 04-clustering, auth-integration]

tech-stack:
  added:
    - "drizzle-orm (Neon HTTP driver)"
    - "drizzle-kit (migrate + generate)"
    - "@neondatabase/serverless (WebSocket-capable HTTP driver)"
    - "dotenv (explicit .env.local loading in drizzle-kit)"
    - "pgvector 0.8.0 (Postgres extension, server-side)"
  patterns:
    - "Hand-authored pre-schema migration (0000) + drizzle-kit generated schema migration (0001) — extension must be ready before any vector() column is created"
    - "Tagged-template SQL via @neondatabase/serverless (sql`...`) not callable form — Neon 1.0.x enforces this"
    - "Singleton Drizzle client via lazy init in src/lib/db/client.ts (edge-safe, no connection pool)"
    - "Pre-commit UUID secret scan narrowed to exclude drizzle/meta/*.json (synthetic chain IDs are not secrets)"

key-files:
  created:
    - "src/lib/db/schema.ts — 11 tables, FKs, unique constraints, vector(1024) columns"
    - "src/lib/db/client.ts — Neon HTTP Drizzle singleton"
    - "drizzle.config.ts — drizzle-kit config with explicit .env.local load"
    - "drizzle/0000_enable_pgvector.sql — CREATE EXTENSION IF NOT EXISTS vector"
    - "drizzle/0001_initial_schema.sql — generated DDL for 11 tables"
    - "drizzle/meta/_journal.json, 0000_snapshot.json, 0001_snapshot.json"
    - "scripts/verify-schema.ts — one-shot Neon schema verifier"
  modified:
    - "package.json, pnpm-lock.yaml — drizzle-orm, drizzle-kit, @neondatabase/serverless, dotenv"
    - ".husky/pre-commit — exclude drizzle/meta/*.json from UUID scan (D-08)"

key-decisions:
  - "Auth.js tables (accounts/sessions/verification_tokens) deferred to a later auth-integration plan — intentionally not in v1 schema per PLAN §Success Criteria / D-09. v1 schema has only a minimal users table."
  - "Embedding dimension pinned to vector(1024) for Voyage voyage-3.5 (D-10). Note CLAUDE.md recommends OpenAI text-embedding-3-small (1536); the plan's D-10 decision overrides — revisit if embedding provider changes."
  - "Pre-commit UUID hook narrowed (not removed) to preserve D-08 intent while allowing drizzle/meta snapshots through. Rationale committed inline."
  - "Verification script uses tagged-template sql`...` form; Neon 1.0.x removed the callable form."

patterns-established:
  - "Migration ordering: hand-authored extension migration (00NN) always precedes drizzle-generated schema migration (00NN+1). Any future pgvector-dependent column follows this split."
  - "Schema verification belongs in a standalone tsx script (not a unit test) so CI can run it against a branch DB post-migrate without loading the Next.js runtime."
  - "drizzle.config.ts explicitly loads .env.local via dotenv config() — drizzle-kit does not read .env.local by default."

requirements-completed: [INFRA-02, INFRA-03]

duration: ~15min (across two executor sessions, checkpoint-interrupted)
completed: 2026-04-17
---

# Phase 1 Plan 02: Drizzle Schema Summary

**11-table Postgres schema with Drizzle ORM + pgvector 0.8.0 live on Neon dev branch, ready for ingestion pipeline (Wave 3).**

## Performance

- **Duration:** ~15 min (cross-session — initial execution paused at checkpoint for hook narrowing approval)
- **Started:** 2026-04-17T07:28Z (Task 1 scaffolding)
- **Completed:** 2026-04-17T07:43:23Z (Task 3 verification)
- **Tasks:** 3 (+ 1 interstitial hook narrowing chore)
- **Files modified:** 12

## Accomplishments

- Drizzle ORM + `@neondatabase/serverless` HTTP driver installed and wired via a singleton client at `src/lib/db/client.ts`
- Full 11-table schema authored in TypeScript: `sources`, `items`, `clusters`, `item_clusters`, `tags`, `item_tags`, `users`, `favorites`, `votes`, `settings`, `pipeline_runs`
- Hand-authored `drizzle/0000_enable_pgvector.sql` runs before the generated schema migration so `vector(1024)` columns resolve
- `pnpm drizzle-kit migrate` applied both migrations to the live Neon dev branch (explicit user authorization)
- pgvector 0.8.0 enabled; `items.embedding` and `clusters.centroid` both materialized as `vector`
- Idempotent `scripts/verify-schema.ts` confirms pgvector, 11 tables, vector columns, and drizzle migration journal
- Pre-commit UUID secret scan narrowed (not weakened) to exclude synthetic drizzle snapshot chain IDs

## Task Commits

1. **Task 1: Install Drizzle + Neon driver, author schema.ts + client.ts + drizzle.config.ts** — `4f9788c` (feat)
2. **Interstitial: Narrow pre-commit UUID scan to exclude drizzle/meta (D-08)** — `6e9fa7a` (chore/hooks)
3. **Task 2: Add pgvector + initial schema migrations** — `f126e79` (feat)
4. **Task 3: Apply migrations to Neon dev branch + verify schema** — `d090830` (feat)

_Task 1 landed in the prior executor session; Tasks 2–3 + interstitial landed in this continuation session._

## Files Created/Modified

**Created**

- `src/lib/db/schema.ts` — 11 table definitions, FKs, unique constraints, vector(1024) columns
- `src/lib/db/client.ts` — Neon HTTP-driven Drizzle singleton
- `drizzle.config.ts` — drizzle-kit config loading .env.local
- `drizzle/0000_enable_pgvector.sql` — CREATE EXTENSION IF NOT EXISTS vector
- `drizzle/0001_initial_schema.sql` — generated DDL for 11 tables
- `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json`, `drizzle/meta/0001_snapshot.json` — drizzle migration journal
- `scripts/verify-schema.ts` — idempotent Neon schema verifier

**Modified**

- `package.json`, `pnpm-lock.yaml` — drizzle-orm, drizzle-kit, @neondatabase/serverless, dotenv
- `.husky/pre-commit` — exclude `drizzle/meta/*.json` from UUID scan

## Decisions Made

- **Auth.js tables deferred.** The plan's 11-table spec (§Success Criteria / D-09) does not include `accounts/sessions/verification_tokens`. A later auth-integration plan will add them via `@auth/drizzle-adapter`. The v1 `users` table here is minimal (id, timestamps) — Auth.js will extend it.
- **Embedding dimension = 1024 (Voyage voyage-3.5).** Plan D-10 specifies this. CLAUDE.md's stack recommendation (OpenAI text-embedding-3-small, 1536) is overridden by the plan's explicit decision. Swapping providers later will require a migration to resize the vector column.
- **Narrow the pre-commit UUID hook rather than disable.** Drizzle migration snapshots contain synthetic `id` / `prevId` chain UUIDs that look like secrets but are not. The hook now excludes `drizzle/meta/*.json` while still blocking non-drizzle files containing UUID-shaped strings (smoke-tested). Committed as an atomic `chore(hooks)` so the rationale is traceable.
- **Verification as a standalone tsx script, not a Jest/Vitest test.** CI can run `pnpm tsx scripts/verify-schema.ts` against a fresh Neon branch without bootstrapping the Next.js runtime. This keeps the verifier fast and portable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Pre-commit UUID hook blocked Task 2 commit**

- **Found during:** Task 2 (commit of drizzle migrations)
- **Issue:** `.husky/pre-commit` from Plan 01-01 rejected any staged file containing a UUID-shaped string. Drizzle snapshot files legitimately contain synthetic UUIDs (id/prevId chain identifiers) and failed the scan.
- **Fix:** Paused at checkpoint for architectural decision. User approved narrowing (Option A1). Added `drizzle/meta/.*\.json` to the grep exclusion regex with a rationale comment referencing D-08. Committed atomically as `chore(hooks): exclude drizzle/meta snapshots from UUID scan (D-08)` (`6e9fa7a`). Smoke-tested: a non-drizzle file with a UUID still fails the commit.
- **Files modified:** `.husky/pre-commit`
- **Verification:** Manual smoke test (staged a non-drizzle UUID file → hook rejected; staged drizzle/meta only → hook passed)
- **Committed in:** `6e9fa7a` (separate atomic commit, not bundled with Task 2)

**2. [Rule 1 — Bug] Verification script used deprecated `sql(string)` callable form**

- **Found during:** Task 3 (first run of `scripts/verify-schema.ts`)
- **Issue:** `@neondatabase/serverless` 1.0.x enforces tagged-template calls (`sql\`...\``) and throws on the older callable form (`sql("SELECT ...")`). The initial draft used callable form and the script failed immediately.
- **Fix:** Rewrote all four queries in tagged-template form.
- **Files modified:** `scripts/verify-schema.ts`
- **Verification:** Re-ran the script; all four checks (pgvector, tables, vector columns, migration journal) now PASS.
- **Committed in:** `d090830` (rolled into Task 3 commit)

**3. [Rule 1 — Bug] Verification script EXPECTED_TABLES list included Auth.js tables not yet in schema**

- **Found during:** Task 3 (second run of `scripts/verify-schema.ts`)
- **Issue:** Script expected 13 tables (11 domain + 3 Auth.js) based on a misread of CLAUDE.md. The plan's authoritative §Success Criteria D-09 specifies only 11 tables with no Auth.js overlap in v1.
- **Fix:** Corrected `EXPECTED_TABLES` to the 11-table list from the plan. Added a header comment documenting that Auth.js tables are deferred.
- **Files modified:** `scripts/verify-schema.ts`
- **Verification:** Re-ran → "OK: 11 expected tables present".
- **Committed in:** `d090830`

**4. [Rule 3 — Blocking] Drizzle-kit migrate denied by sandbox as "Blind Apply"**

- **Found during:** Task 3 (initial `pnpm drizzle-kit migrate` invocation)
- **Issue:** Sandbox policy blocked `drizzle-kit migrate` against the remote Neon dev database without explicit authorization. This is a safety gate, not a bug in the plan.
- **Fix:** Returned a checkpoint listing the exact DDL that would run (0000 + 0001), noting the dev branch was empty and the migrations were non-destructive. User granted explicit authorization (Option A). Retried with sandbox elevation for that single command.
- **Files modified:** None (operational decision)
- **Verification:** Migration applied successfully; verifier confirmed schema is live.
- **Committed in:** `d090830`

---

**Total deviations:** 4 auto-fixed (1 architectural checkpoint for hook narrowing, 2 Rule 1 bugs in verifier script, 1 Rule 3 sandbox-authorization gate)
**Impact on plan:** Two architectural/security decisions (hook narrowing, live DB write) required user checkpoints — handled via normal authorization flow. Verifier script bugs were self-contained to the new file and fixed before commit. No scope creep; all fixes directly serve task completion.

## Issues Encountered

- **Stash merge conflict on `drizzle/meta/0001_snapshot.json`.** Running `git stash --keep-index` during the pre-commit hook smoke test produced a three-way conflict when unstashing because the working tree at stash time held a placeholder-UUID snapshot while the index held the real drizzle-generated snapshot. Resolved by taking stage 2 (the real snapshot) and dropping the stash. No data lost.
- **Prettier reformatted verifier script after commit.** lint-staged's prettier pass collapsed a multi-line conditional into a single line after the Task 3 commit landed. The change is cosmetic and was applied by the commit hook itself — no follow-up needed.

## User Setup Required

None additional for this plan. `DATABASE_URL` was already populated in `.env.local` before Task 3 (prerequisite from Plan 01-01 + user's dashboard config per PLAN `user_setup` directives). The live Neon dev branch now contains the full schema.

Future plans needing CI access will still require `NEON_API_KEY` and `NEON_PROJECT_ID` (documented in plan frontmatter, not used here).

## Threat Flags

None — no new security surface introduced beyond DDL. `users` table exists but has no auth columns yet; Auth.js integration is a separately-planned boundary.

## Known Stubs

None. All tables are real and queryable; no placeholder data sources.

## Next Phase Readiness

- **Ready for Plan 01-03 (trigger-redis):** Inngest + Upstash Redis layer can proceed independently; no DB dependency.
- **Ready for Plan 01-04 (rsshub-health):** `/api/health` route can now import `db` from `src/lib/db/client.ts` and `SELECT 1` against Neon to prove connectivity.
- **Ready for Plan 01-05 (ci-pipeline):** CI can run `pnpm drizzle-kit migrate` against per-PR Neon branches using the same config; verifier script is CI-portable.
- **Open item (not blocking):** Auth.js integration plan (future phase) will need to extend `users` and add `accounts/sessions/verification_tokens` via `@auth/drizzle-adapter`. When that lands, update `scripts/verify-schema.ts` to expect 14 tables.

## Self-Check: PASSED

**Files:**
- FOUND: `src/lib/db/schema.ts`
- FOUND: `src/lib/db/client.ts`
- FOUND: `drizzle.config.ts`
- FOUND: `drizzle/0000_enable_pgvector.sql`
- FOUND: `drizzle/0001_initial_schema.sql`
- FOUND: `drizzle/meta/_journal.json`
- FOUND: `drizzle/meta/0000_snapshot.json`
- FOUND: `drizzle/meta/0001_snapshot.json`
- FOUND: `scripts/verify-schema.ts`
- FOUND: `.husky/pre-commit` (modified)

**Commits:**
- FOUND: `4f9788c` (Task 1)
- FOUND: `6e9fa7a` (interstitial hook chore)
- FOUND: `f126e79` (Task 2)
- FOUND: `d090830` (Task 3)

**Live schema verification:**
- pgvector 0.8.0 installed on Neon dev branch
- 11 tables present: clusters, favorites, item_clusters, item_tags, items, pipeline_runs, settings, sources, tags, users, votes
- 2 vector columns: clusters.centroid, items.embedding
- 2 migrations in drizzle.__drizzle_migrations journal

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-04-17*
