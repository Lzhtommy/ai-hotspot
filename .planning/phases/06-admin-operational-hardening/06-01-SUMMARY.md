---
phase: 06-admin-operational-hardening
plan: "01"
subsystem: database
tags: [drizzle, neon, postgres, schema, migration, admin, soft-delete, audit-trail]

# Dependency graph
requires:
  - phase: 05-auth-user-interactions
    provides: users table (uuid PK) + 0004_auth migration journal baseline (adapter tables for session-revocation FK targets)
  - phase: 06-admin-operational-hardening (self, plan 00)
    provides: /admin route gate so future admin UIs can safely read the new columns behind auth
provides:
  - sources.deleted_at TIMESTAMPTZ NULL column (supports ADMIN-05 soft-delete)
  - sources.category TEXT NULL column (supports ADMIN-03 source-creation classification)
  - users.banned_at TIMESTAMPTZ NULL column (supports ADMIN-08 ban audit trail)
  - users.banned_by UUID NULL column + self-referencing FK users_banned_by_fk ON DELETE SET NULL
  - sources_deleted_at_idx btree index for soft-delete-aware source list filtering
  - scripts/apply-0005-admin-ops.ts non-TTY migration runner + pnpm db:apply:0005 alias
  - Live Neon dev branch upgraded — all four columns + FK present and idempotent
affects: [06-02-sources-admin, 06-03-users-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Hand-written idempotent SQL migration (ALTER TABLE ADD COLUMN IF NOT EXISTS + DO $$ constraint guard) applied via scripts/apply-NNNN-*.ts — precedent from 03-01 and 05-01 re-applied
    - Self-referencing FK declared in raw SQL (not Drizzle DSL) to sidestep TS circularity on users.banned_by → users.id
    - Verification-script-as-applier: scripts/apply-0005-admin-ops.ts performs applied-state verification queries after execution and exits non-zero on drift (6/6 checks)

key-files:
  created:
    - drizzle/0005_admin_ops.sql
    - scripts/apply-0005-admin-ops.ts
    - tests/unit/schema-admin-ops.test.ts
  modified:
    - src/lib/db/schema.ts
    - drizzle/meta/_journal.json
    - package.json

key-decisions:
  - "banned_by declared as plain uuid in Drizzle (no .references()) to avoid TS self-referencing circularity; FK enforced by raw SQL — mirrors precedent from 0003 / 0004 migrations that hand-wrote structural constraints outside the DSL"
  - "category stored as free-form TEXT in v1 rather than a pg enum — UI enforces the allowed set {lab, social, forum, cn_media, other}; avoids an ALTER TYPE migration when the set evolves"
  - "Applier script mirrors scripts/apply-0004-auth.ts pattern (neon HTTP + readFileSync + unsafe multi-statement); same non-TTY-safe model continues to be the Phase 6 migration default"
  - "sources_deleted_at_idx added proactively — Plan 06-02 WHERE deleted_at IS NULL is the hot path for the sources list; adding the index here keeps the migration atomic and avoids a second push when 06-02 hits live traffic"

patterns-established:
  - "Every future Phase 6 schema push uses scripts/apply-NNNN-*.ts (non-TTY) — never drizzle-kit push (TTY-blocked + HNSW DROP risk per 03-01)"
  - "Idempotent migrations: ADD COLUMN IF NOT EXISTS + DO $$ IF NOT EXISTS constraint guard + CREATE INDEX IF NOT EXISTS — safe to rerun on dev and production alike"
  - "Self-referencing FK columns declared as plain column types in Drizzle; FK enforced in hand-written SQL; tests assert Drizzle column object presence only, not FK shape (which lives in DB)"

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-04-23
---

# Phase 6 Plan 06-01: Admin Schema Migration Summary

**Schema-only plan: sources gains deleted_at + category + btree index; users gains banned_at + banned_by with self-referencing ON DELETE SET NULL FK; 0005_admin_ops.sql applied idempotently to live Neon dev branch via non-TTY runner — unblocks all Wave 2 Phase 6 admin plans.**

Migration applied: YES — verified via verification script (6/6 checks passed, idempotent second run also passed)

## Performance

- **Duration:** ~15 min (across RED + GREEN + applier + live apply + metadata)
- **Started:** 2026-04-23 (Phase 6 Wave 1)
- **Completed:** 2026-04-23
- **Tasks:** 3 (1 TDD split into RED + GREEN)
- **Files created:** 3 (`drizzle/0005_admin_ops.sql`, `scripts/apply-0005-admin-ops.ts`, `tests/unit/schema-admin-ops.test.ts`)
- **Files modified:** 3 (`src/lib/db/schema.ts`, `drizzle/meta/_journal.json`, `package.json`)

## Accomplishments

- Drizzle schema extended with 4 new columns on sources and users — matches ADMIN-03 / ADMIN-05 / ADMIN-08 field contracts without touching existing columns.
- Raw SQL migration `drizzle/0005_admin_ops.sql` hand-written as an idempotent bundle (ALTER TABLE ADD COLUMN IF NOT EXISTS × 4 + DO $$ IF NOT EXISTS constraint guard + CREATE INDEX IF NOT EXISTS).
- Non-TTY applier `scripts/apply-0005-admin-ops.ts` + `pnpm db:apply:0005` alias — mirrors the 05-01 apply-0004-auth precedent and extends it with 6 post-apply verification queries.
- Live Neon dev branch migrated and verified: `pnpm db:apply:0005` reports `6 statements executed, all 6 verify checks PASS, [result] ALL PASS`; second run reports the same (idempotent).
- `tests/unit/schema-admin-ops.test.ts` asserts Drizzle column definitions (`sources.deletedAt`, `sources.category`, `users.bannedAt`, `users.bannedBy`) exist as truthy column objects and the journal length advanced.
- `pnpm typecheck` clean.

## Task Commits

1. **Task 1 RED — failing admin-schema test** → `7697812` (test)
2. **Task 1 GREEN — extend schema + write 0005_admin_ops migration** → `7665e5b` (feat)
3. **Task 2 — apply-0005-admin-ops runner + pnpm script** → `90ee4b6` (feat)
4. **Task 3 — [BLOCKING] apply migration to live Neon dev branch** → human-verified (no code commit; verification reported `6/6 ALL PASS`, idempotent second run also `ALL PASS`, `pnpm typecheck` exit 0)

**Plan metadata:** pending at end of this summary (docs: complete admin schema migration plan)

## Files Created/Modified

- `src/lib/db/schema.ts` — Added `deletedAt` + `category` to `sources` pgTable; added `bannedAt` + `bannedBy` to `users` pgTable
- `drizzle/0005_admin_ops.sql` — Idempotent SQL: 4× ADD COLUMN IF NOT EXISTS, DO $$ constraint guard for `users_banned_by_fk` (self-ref ON DELETE SET NULL), `sources_deleted_at_idx` btree
- `drizzle/meta/_journal.json` — Appended idx=5, tag='0005_admin_ops' entry (snapshot file omitted — follows the 0004 precedent where snapshots are only needed for drizzle-kit push, which Phase 5+ avoids in favor of hand-written SQL + scripts/apply-NNNN-*.ts runners)
- `scripts/apply-0005-admin-ops.ts` — Non-TTY applier; reads SQL, executes via neon() HTTP client, runs 6 post-apply verification queries, exits non-zero on drift
- `package.json` — Added `"db:apply:0005": "tsx --env-file=.env.local scripts/apply-0005-admin-ops.ts"`
- `tests/unit/schema-admin-ops.test.ts` — Drizzle column object assertions + journal length assertion

## Decisions Made

- **Self-referencing FK in raw SQL, not Drizzle DSL.** `users.banned_by → users.id` triggers TS self-referencing circularity if declared with `.references(() => users.id)` at the Drizzle layer. The column is declared as plain `uuid('banned_by')` and the FK is enforced only in the hand-written SQL via a `DO $$ IF NOT EXISTS` constraint guard. Same precedent as Plan 03-01 (HNSW index) and 05-01 (adapter-table camelCase identifiers).
- **`category` as free-form TEXT, not a pg enum.** v1 values `{lab, social, forum, cn_media, other}` are enforced at the UI layer in Plan 06-02. Keeping it TEXT avoids `ALTER TYPE ... ADD VALUE` migrations if the taxonomy evolves.
- **`sources_deleted_at_idx` added proactively in 06-01.** Plan 06-02's sources-list SELECT will include `WHERE deleted_at IS NULL`. Adding the index with the column keeps the schema migration atomic — no second push when 06-02 hits prod traffic.
- **Applier script doubles as verification harness.** Rather than a separate `verify:admin-schema` script, `scripts/apply-0005-admin-ops.ts` runs 6 post-apply assertions (all 4 columns present, FK present, index present) and exits non-zero on any drift. Single tool for `db:apply:0005` and idempotency check.

## Deviations from Plan

### Auto-fixed Issues

None of material scope. The plan specified that the applier script might need to split DO $$ blocks if `neon().unsafe()` rejected multi-statement input; at runtime this was not needed — `neon()` HTTP accepted the migration as a single payload. The applier was also extended with 6 post-apply verification queries (not required by the plan, but within the applier-script scope) to make `pnpm db:apply:0005` self-verifying.

---

**Total deviations:** 0 auto-fixed (applier-verification is an in-scope enhancement, not a deviation).
**Impact on plan:** None. Plan executed as written.

## Issues Encountered

None. The TDD RED signal came through cleanly (test imported column references that did not exist on schema.ts until Task 1 GREEN), and GREEN cleared tsc + vitest in one pass.

## Gate Verification (Task 3 — [BLOCKING])

Per plan `<resume-signal>`, user reported:

- `pnpm db:apply:0005` → exit 0, `6 statements executed, all 6 verify checks PASS, [result] ALL PASS`
- `pnpm db:apply:0005` (second run) → exit 0, same `ALL PASS` output (idempotent)
- `pnpm typecheck` → exit 0

This satisfies:

- ✅ `pnpm db:apply:0005` exits 0
- ✅ Live Neon dev branch `information_schema.columns` has sources.deleted_at, sources.category, users.banned_at, users.banned_by (covered by the applier's built-in verification)
- ✅ Live Neon dev branch `pg_constraint` has `users_banned_by_fk` (covered by the applier's built-in verification)
- ✅ Re-running `pnpm db:apply:0005` exits 0 (idempotent)
- ✅ `pnpm typecheck` exits 0

## TDD Gate Compliance

Task 1 followed the TDD RED → GREEN gate:

1. **RED:** `test(06-01): add failing tests for admin schema extensions` → commit `7697812`. Test run failed with expected property-not-found errors on `sources.deletedAt` / `users.bannedAt` (column references did not yet exist).
2. **GREEN:** `feat(06-01): extend schema + add 0005_admin_ops migration` → commit `7665e5b`. Test run: all schema-admin-ops test cases passing; `pnpm exec tsc --noEmit` clean.
3. No REFACTOR phase — implementation was minimal.

Task 2 was `type="auto"` (not TDD); Task 3 was `type="checkpoint:human-verify"` (gate, not code).

## Next Phase Readiness

- **Wave 2 of Phase 6 unblocked.** Plans 06-02 (sources management) and 06-03 (user management + ban) can safely reference the new columns — the live Neon dev branch has them.
- **No Phase-6 plan depends on a separate migration for these columns.** 06-04 (costs) and 06-05 (dead-letter) read from pre-existing `pipeline_runs`; 06-06/07/08 are observability + docs and require no further schema changes.
- **Production promotion:** a Phase-6-final step will re-run `pnpm db:apply:0005` against production `DATABASE_URL` as part of the release runbook (tracked in 06-08 observability docs).
- **No user setup required** for this plan — developer ran the migration using their own `DATABASE_URL`.

## Self-Check: PASSED

Verified:

- `src/lib/db/schema.ts` — FOUND (extended with deletedAt + category + bannedAt + bannedBy)
- `drizzle/0005_admin_ops.sql` — FOUND
- `drizzle/meta/_journal.json` — FOUND (idx=5 entry present)
- `drizzle/meta/0005_snapshot.json` — OMITTED (follows 0004 precedent — Phase 5+ migrations are hand-written SQL + apply-NNNN-*.ts runners; snapshot files are only needed by drizzle-kit push, which is not used)
- `scripts/apply-0005-admin-ops.ts` — FOUND
- `package.json` — FOUND (`db:apply:0005` script present)
- `tests/unit/schema-admin-ops.test.ts` — FOUND
- Commit `7697812` (test RED Task 1) — FOUND on `gsd/phase-06-admin-operational-hardening`
- Commit `7665e5b` (feat GREEN Task 1) — FOUND on `gsd/phase-06-admin-operational-hardening`
- Commit `90ee4b6` (feat Task 2) — FOUND on `gsd/phase-06-admin-operational-hardening`
- Task 3 gate — user-confirmed `ALL PASS` + idempotent re-run + typecheck clean

---

*Phase: 06-admin-operational-hardening*
*Completed: 2026-04-23*
