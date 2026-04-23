---
phase: 05-auth-user-interactions
plan: 01
subsystem: database
tags: [drizzle, neon, auth.js, postgres, pgvector, schema-migration]

requires:
  - phase: 01-infrastructure-foundation
    provides: users/favorites/votes tables + Drizzle+Neon HTTP singleton (D-09); Auth.js adapter tables explicitly deferred
  - phase: 03-llm-pipeline-clustering
    provides: items_embedding_hnsw_idx (CLUST-02) — hand-authored HNSW index preserved during this migration
  - phase: 05-auth-user-interactions
    provides: Plan 05-00 red-state stubs (schema-auth + schema-users-extension) flipped green by this plan
provides:
  - users.emailVerified (timestamptz null) + users.image (text null) columns on Neon dev branch
  - accounts / sessions / verification_tokens tables on Neon dev branch with uuid userId FK CASCADE
  - Drizzle TS exports (accounts, sessions, verificationTokens) matching @auth/drizzle-adapter contract
  - drizzle/0004_auth.sql + drizzle/meta/_journal.json idx=4 journal entry
  - scripts/apply-0004-auth.ts one-shot runner (psql fallback substitute; idempotent via IF NOT EXISTS)
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10]

tech-stack:
  added: []
  patterns:
    - "Hand-authored migration + project-driver runner fallback (Phase 3 precedent) — avoids drizzle-kit push dropping hand-authored pgvector indexes it cannot represent in its DSL"
    - "camelCase quoted SQL identifiers for @auth/drizzle-adapter contract (scoped to accounts/sessions/verification_tokens only; rest of schema stays snake_case)"

key-files:
  created:
    - drizzle/0004_auth.sql
    - scripts/apply-0004-auth.ts
    - .planning/phases/05-auth-user-interactions/05-01-SUMMARY.md
  modified:
    - src/lib/db/schema.ts
    - drizzle/meta/_journal.json
    - tests/unit/schema-auth.test.ts
    - tests/unit/schema-users-extension.test.ts

key-decisions:
  - "psql fallback re-used for migration apply (Phase 3 precedent) — drizzle-kit push was BOTH non-TTY-blocked AND proposed dropping the hand-authored HNSW index from Plan 03-01. A tsx runner via the project's Neon HTTP driver was used in place of psql (not installed locally), applying only the statements in drizzle/0004_auth.sql."
  - "camelCase SQL column names (\"userId\", \"providerAccountId\", \"sessionToken\") kept verbatim per @auth/drizzle-adapter contract — one project-scoped exception to the snake_case convention."
  - "uuid FK matches users.id primary key type (RESEARCH §Pitfall 2); Auth.js docs' default text() columns would have failed with type-mismatch."

patterns-established:
  - "Pattern: phase migration runner at scripts/apply-NNNN-*.ts invokes db.execute(sql.raw(...)) over the committed .sql file with post-apply information_schema verification. Mirrors scripts/check-hnsw.ts structure."

requirements-completed: [AUTH-01]

duration: 22 min
completed: 2026-04-23
---

# Phase 5 Plan 01: Auth.js adapter schema + 0004_auth migration Summary

**Extends `users` with `emailVerified`/`image`, adds `accounts`/`sessions`/`verification_tokens` with uuid FK cascade, lands the hand-authored `0004_auth.sql` on the live Neon dev branch while preserving the Plan 03-01 HNSW index.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-04-23T12:04:00Z
- **Completed:** 2026-04-23T13:52:00Z (wall-clock includes the human-action checkpoint pause between Tasks 2 and 3)
- **Tasks:** 3 (including 1 BLOCKING checkpoint)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Drizzle schema extended: `users.emailVerified` (timestamptz null), `users.image` (text null), plus three new Auth.js adapter tables (`accounts`, `sessions`, `verificationTokens`) with uuid userId FKs to `users.id` CASCADE.
- Hand-authored `drizzle/0004_auth.sql` mirroring the Phase 3 precedent; `drizzle/meta/_journal.json` updated with idx=4 tag `0004_auth`.
- Live Neon dev branch migrated and verified: all 5 post-migration invariants (accounts.userId uuid, sessions.sessionToken text, verification_tokens.identifier, users.email_verified timestamptz, users.image text) return PASS.
- Plan 03-01's `items_embedding_hnsw_idx` is still intact post-migration (verified via `pnpm check:hnsw`).
- Wave 0 red-state stubs flipped green: `tests/unit/schema-auth.test.ts` (6 tests) and `tests/unit/schema-users-extension.test.ts` (3 tests), all passing — the Nyquist feedback signal for Wave 1 start is lit.

## Task Commits

1. **Task 1: Extend users + add Auth.js adapter tables to Drizzle schema** — `2874463` (feat)
2. **Task 2: Hand-author drizzle/0004_auth.sql + update journal** — `55364df` (feat)
3. **Task 3: [BLOCKING] Apply 0004_auth migration to live Neon dev branch** — `a81c098` (chore; adds scripts/apply-0004-auth.ts)

_Plan metadata commit follows (docs: complete plan)._

## Files Created/Modified

- `src/lib/db/schema.ts` — added 2 users columns + 3 new pgTable exports (accounts, sessions, verificationTokens)
- `drizzle/0004_auth.sql` — new migration with 2 ALTER TABLE + 3 CREATE TABLE + 2 CREATE INDEX statements; idempotent via IF NOT EXISTS
- `drizzle/meta/_journal.json` — appended idx=4 entry tag 0004_auth
- `tests/unit/schema-auth.test.ts` — fleshed out from red-state stub into 6 shape assertions via getTableConfig (composite PK checks, FK cascade checks, column types)
- `tests/unit/schema-users-extension.test.ts` — fleshed out from red-state stub into 3 shape assertions (emailVerified timestamptz nullable, image text nullable, existing-columns preserved)
- `scripts/apply-0004-auth.ts` — one-shot runner substituting for psql (not installed on host); reads the .sql file, executes via Neon HTTP driver, runs 5 information_schema verification queries

## Decisions Made

- **psql-equivalent runner over drizzle-kit push.** drizzle-kit push was non-TTY-blocked (same as Phase 3 Plan 03-01) AND its divergence plan proposed `DROP INDEX items_embedding_hnsw_idx` — a silent regression of Phase 3 CLUST-02. Writing the committed SQL via the project's Neon driver bypasses both problems. Since psql is not installed locally, the runner lives in `scripts/apply-0004-auth.ts`.
- **camelCase quoted identifiers scoped to Auth.js adapter tables only.** Explicitly documented in a comment block at `src/lib/db/schema.ts` adjacent to the three new pgTable exports. Rest of the schema stays snake_case.
- **uuid userId FK (not text).** Required because `users.id` is `uuid` with `defaultRandom()`. Auth.js docs default to `text()` — silently pasting that would produce a CASCADE FK type mismatch at runtime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-kit push non-TTY + proposed DROP of HNSW index**
- **Found during:** Task 3 (BLOCKING migration apply)
- **Issue:** `pnpm drizzle-kit push` rejected the non-TTY environment with an interactive-prompt error AND the divergence it pulled from Neon proposed `DROP INDEX "items_embedding_hnsw_idx"` (the Phase 3 CLUST-02 index). Drizzle's index DSL cannot represent HNSW + vector_cosine_ops, so it sees the live index as "drift" and tries to drop it.
- **Fix:** Used the Phase 3 precedent (psql fallback). Since psql is not installed on this host, wrote `scripts/apply-0004-auth.ts` — a tsx runner that executes the committed .sql statements via the project's Neon HTTP driver and then runs 5 information_schema verification queries. This path applies ONLY what's in the migration file (no drizzle-kit diff).
- **Files modified:** scripts/apply-0004-auth.ts (new)
- **Verification:** All 5 post-migration checks PASS. `pnpm check:hnsw` still PASS (HNSW index preserved). `pnpm vitest run tests/unit/schema-auth.test.ts tests/unit/schema-users-extension.test.ts` PASS (9/9 green).
- **Committed in:** a81c098

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Deviation was architectural (drizzle-kit DSL gap vs live pgvector index) and was resolved by falling back to the already-documented Phase 3 precedent. No scope creep. The plan's preferred path (drizzle-kit push) was unsafe to execute for reasons not knowable at plan-write time; the fallback path was pre-authorized in the plan text itself.

## Issues Encountered

- **drizzle-kit push non-TTY failure** (same as Phase 3). Handled per Deviations §1.
- **drizzle-kit's divergence plan would silently regress Plan 03-01's HNSW index.** This is worth flagging for ALL future Phase 5+ migrations: any future `drizzle-kit push` run on this database MUST be audited for a proposed `DROP INDEX items_embedding_hnsw_idx` statement before being approved. Long-term fix is to either (a) represent HNSW in Drizzle's DSL (blocked on drizzle-orm upstream), or (b) keep hand-authoring migrations for the foreseeable future.
- **Wave 0 stubs for non-01 plans still typecheck RED** (feed-card-actions, session-payload, user-chip, vote-honest-copy) — these are the expected Nyquist feedback signals for Plans 05-04, 05-05, 05-07. Plan 05-00 SUMMARY already documented this. Out of scope for this plan.

## User Setup Required

None — migration applied to the Neon dev branch via the committed runner. Production branch migrations remain a future Vercel/CI concern (Phase 6 operational hardening).

## Next Phase Readiness

- **Plan 05-02 (Wave 2: Auth.js config + DrizzleAdapter wiring) is unblocked.** The three adapter tables exist on Neon dev; the Drizzle TS exports match the adapter contract; `users.emailVerified` and `users.image` are present for the OAuth + magic-link flows to populate.
- **Wave 0 schema tests green** — Plan 05-02 executor can rely on these as pre-conditions rather than re-verifying.
- **Flag for future executors:** `scripts/apply-0004-auth.ts` is a one-shot; future migrations should follow the same pattern (`scripts/apply-NNNN-*.ts`) OR switch back to psql when it becomes available on the developer host. Do NOT run bare `drizzle-kit push` until the HNSW-DSL gap is resolved.

## Self-Check: PASSED

- [x] `src/lib/db/schema.ts` contains `export const accounts` (grep -c → 1)
- [x] `src/lib/db/schema.ts` contains `emailVerified:` (grep -c → 1)
- [x] `drizzle/0004_auth.sql` exists with 3 CREATE TABLE + 2 ALTER TABLE + 2 CREATE INDEX
- [x] `drizzle/meta/_journal.json` contains `"tag": "0004_auth"`
- [x] Commits 2874463, 55364df, a81c098 exist in `git log`
- [x] `pnpm vitest run tests/unit/schema-auth.test.ts tests/unit/schema-users-extension.test.ts` → 9/9 green
- [x] Live Neon dev branch passes all 5 migration-invariant checks
- [x] `pnpm check:hnsw` → PASS (HNSW index from Plan 03-01 preserved)

---
*Phase: 05-auth-user-interactions*
*Completed: 2026-04-23*
