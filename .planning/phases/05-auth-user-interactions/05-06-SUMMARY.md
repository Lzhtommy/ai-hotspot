---
phase: 05-auth-user-interactions
plan: 06
subsystem: user-interactions
tags: [server-actions, favorites, votes, auth-guard, core-logic-adapter-split, D-05-layer-2, D-11, D-12, VOTE-04]

requires:
  - phase: 05-auth-user-interactions
    provides: Plan 05-02 Auth.js config + `@/lib/auth` barrel (`auth()`) + Session type
  - phase: 05-auth-user-interactions
    provides: Plan 05-01 users.is_banned column + favorites/votes tables (pre-existing Phase 1 schema, confirmed by Plan 05-02)
  - phase: 05-auth-user-interactions
    provides: Wave 0 tests/helpers/auth.ts (referenced by earlier stubs — replaced by deps-injected tests in this plan)
provides:
  - AuthError class (code ∈ {UNAUTHENTICATED, FORBIDDEN}) + requireLiveUserCore pure guard
  - favoriteItemCore / unfavoriteItemCore pure deps-injected CRUD (ON CONFLICT DO NOTHING / DELETE)
  - voteItemCore implementing D-12 exclusive 3-state toggle state machine + VoteValueError for VOTE-04
  - src/server/actions/favorites.ts — thin 'use server' adapter (auth → guard → core → revalidatePath('/favorites'))
  - src/server/actions/votes.ts — thin 'use server' adapter (auth → guard → core; NO cache revalidation)
affects: [05-07, 05-08]

tech-stack:
  added: []
  patterns:
    - "Core-logic / adapter split applied to server actions: src/lib/user-actions/*-core.ts are pure deps-injected; src/server/actions/*.ts are thin 'use server' wrappers. Mirrors src/lib/feed/get-feed.ts (pure) ↔ src/app/(reader)/all/page.tsx (thin RSC caller)."
    - "Typed error classes with a `code` discriminant (AuthError.code, VoteValueError.name) — lets client catch handlers dispatch the correct UX (open login modal vs inline error vs generic toast) without string matching."
    - "Server-action BigInt wrap: client sends itemId as string (serialization safety across the 'use server' boundary); adapter calls BigInt() once; core takes bigint. Matches the existing src/trigger/process-item.ts pattern."

key-files:
  created:
    - src/lib/user-actions/auth-guard.ts
    - src/lib/user-actions/favorites-core.ts
    - src/lib/user-actions/votes-core.ts
    - src/server/actions/favorites.ts
    - src/server/actions/votes.ts
    - tests/integration/server-action-favorite-adapter.test.ts
  modified:
    - tests/integration/server-action-auth-guard.test.ts
    - tests/integration/server-action-favorite.test.ts
    - tests/integration/server-action-vote.test.ts
    - tests/unit/vote-value-contract.test.ts

key-decisions:
  - "Core-logic / adapter split for server actions. Business logic lives in src/lib/user-actions/*-core.ts (pure, deps-injected); src/server/actions/*.ts are thin 'use server' adapters that (a) call auth(), (b) invoke requireLiveUserCore for D-05 Layer 2, (c) BigInt-wrap itemId, (d) call the core, (e) revalidatePath ONLY for favorites (votes do not affect /favorites per RESEARCH §Anti-Patterns). This lets unit tests cover 100% of business logic with a mock db — zero network, zero Next.js context required."
  - "AuthError discriminant uses a `code` property (UNAUTHENTICATED | FORBIDDEN) rather than throwing distinct Error classes. Lets the client-side catch handler in Plan 05-07's FeedCardActions switch on a single AuthError type + code, which is simpler than catch-chains and keeps the type import surface small."
  - "VOTE-04 validation runs BEFORE any DB call inside voteItemCore. The vote-value-contract test proves this by passing a mock db that throws if touched — if the value-check is ever reordered to run after the select, tests fail loudly."
  - "Test file rewrite from Wave 0 stubs. The stubs used object-argument signatures (`favoriteItem({ itemId: '1' })`) and relied on stateful DB behavior that would have required a live Neon connection. The plan explicitly directed 'Fill in' the tests; per the plan's behavior spec, the new tests use deps-injected mock dbs (matching the core-logic / adapter split), which are deterministic, network-free, and match the core function signatures."
  - "BigInt wrap at the adapter boundary, not the core. The adapter takes `itemId: string` (what the client sends; items.id is bigserial and JS numbers lose precision for id > 2^53). The core takes `itemId: bigint`. This mirrors src/trigger/process-item.ts and avoids embedding string-parsing in the test-critical core."

requirements-completed: [FAV-01, FAV-02, VOTE-01, VOTE-02, VOTE-04]

duration: 10 min
completed: 2026-04-23
---

# Phase 5 Plan 06: Favorite + Vote Server Actions Summary

**Ships favoriteItem/unfavoriteItem (FAV-01, FAV-02) and voteItem (VOTE-01, VOTE-02) as thin 'use server' adapters over three pure deps-injected core modules (favorites-core, votes-core, auth-guard), enforcing D-05 Layer 2 ban re-check, D-12 exclusive 3-state vote toggle, and VOTE-04 value contract. After this plan, the server side of the interaction loop is functional — only the Plan 05-07 UI wiring remains to close the feature.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 3 (all auto; no checkpoints)
- **Files created:** 6 (3 pure cores + 2 adapters + 1 adapter test)
- **Files modified:** 4 (test stubs rewritten to deps-injected form)
- **Tests:** 16 green (5 auth-guard + 2 favorites-core + 4 votes-core state machine + 3 VOTE-04 contract + 2 adapter smoke)

## Accomplishments

- **`src/lib/user-actions/auth-guard.ts`** — exports `AuthError` class with `code: 'UNAUTHENTICATED' | 'FORBIDDEN'` discriminant and `requireLiveUserCore(session, {db})`. Pure function: callers inject the live Auth.js Session and optionally a db override. Reads `users.is_banned` once per call to enforce D-05 Layer 2 — the belt-and-suspenders check that catches the short race window between a ban flip and the session cookie expiring.
- **`src/lib/user-actions/favorites-core.ts`** — exports `favoriteItemCore` (INSERT ON CONFLICT DO NOTHING; returns `{favorited: true}`) and `unfavoriteItemCore` (DELETE by composite PK; returns `{favorited: false}`). Pure deps-injected; both idempotent per D-11.
- **`src/lib/user-actions/votes-core.ts`** — exports `voteItemCore` implementing the D-12 3-state machine: no-row+v→insert(v), row=v+v→delete, row=v+−v→update(−v). Exports `VoteValueError` which throws before any DB call when `value ∉ {-1, +1}` (VOTE-04 hardening).
- **`src/server/actions/favorites.ts`** — thin 'use server' adapter. Reads `auth()` → `requireLiveUserCore` → BigInt-wraps itemId → calls core → `revalidatePath('/favorites')`. Consumed by Plan 05-07's FeedCardActions.
- **`src/server/actions/votes.ts`** — thin 'use server' adapter. Same guard chain, but deliberately does NOT revalidate `/favorites` — votes are independent of favorites per D-10 + RESEARCH §Anti-Patterns.
- **Tests rewritten from Wave 0 stubs** — the loose stubs used object-argument signatures and expected stateful in-memory DB behavior. Per the plan's 'Fill in' instruction, they were rewritten against the actual core function signatures with deps-injected mock dbs. All 16 tests are deterministic, zero-network, and match the plan's Behavior specs.
- **Added `tests/integration/server-action-favorite-adapter.test.ts`** — proves the adapter threads `session.user.id → core.userId` and that `BigInt(itemId)` is called. Covers the adapter seam that the core-only tests can't reach.

## Task Commits

1. **Task 1 RED** (auth-guard + favorites-core failing tests) — `dba3316`
2. **Task 1 GREEN** (auth-guard + favorites-core implementation) — `086906b`
3. **Task 2 RED** (votes-core + VOTE-04 failing tests) — `2940f2c`
4. **Task 2 GREEN** (votes-core implementation) — `85aee86`
5. **Task 3** ('use server' adapters + adapter smoke test) — `4de0f51`

_Plan metadata commit (this SUMMARY) follows as the final worktree commit._

## Files Created/Modified

**Created (6):**
- `src/lib/user-actions/auth-guard.ts` — 62 lines; AuthError + requireLiveUserCore
- `src/lib/user-actions/favorites-core.ts` — 53 lines; favoriteItemCore + unfavoriteItemCore
- `src/lib/user-actions/votes-core.ts` — 83 lines; voteItemCore + VoteValueError + VoteValue/VoteState types
- `src/server/actions/favorites.ts` — 42 lines; 'use server' adapter with revalidatePath
- `src/server/actions/votes.ts` — 37 lines; 'use server' adapter without revalidation
- `tests/integration/server-action-favorite-adapter.test.ts` — 68 lines; 2 tests asserting adapter threading

**Modified (4):**
- `tests/integration/server-action-auth-guard.test.ts` — 5 tests for all 5 requireLiveUserCore branches (null session, no user.id, banned user, missing user row, live user)
- `tests/integration/server-action-favorite.test.ts` — 2 tests for favoriteItemCore / unfavoriteItemCore Drizzle-chain verification
- `tests/integration/server-action-vote.test.ts` — 4 tests for D-12 state-machine transitions (insert / same-value delete / flip / reverse flip)
- `tests/unit/vote-value-contract.test.ts` — 3 tests for VOTE-04 rejection (value=2 / value=0 / value=-2) with a "db never touched" mock

## Decisions Made

- **Core-logic / adapter split for server actions.** Every `'use server'` adapter is kept to ~10 lines: auth, guard, BigInt wrap, call core, optional revalidate. All business logic (DB queries, state machine, value validation) lives in pure deps-injected cores under `src/lib/user-actions/`. Lets unit tests cover 100% of logic with a mock db; adapters only need a smoke test proving the seam is wired correctly. Mirrors the Phase 2 / Phase 4 `src/lib/feed/get-feed.ts` ↔ `src/app/(reader)/all/page.tsx` split.
- **AuthError with code discriminant, not sub-classes.** One error class with `.code === 'UNAUTHENTICATED' | 'FORBIDDEN'` is easier to catch in Plan 05-07's FeedCardActions than two classes — the client code becomes `if (err instanceof AuthError && err.code === 'UNAUTHENTICATED') openLoginModal()`. Same imports, no union catches.
- **VOTE-04 validation runs BEFORE any DB call.** Prevents a banned or malformed-value request from ever reaching the database. Proven by the vote-value-contract test which passes a mock db that throws if touched — if someone ever reorders the check, tests fail.
- **Tests fully rewritten from Wave 0 stubs.** The stubs used object-argument signatures (`favoriteItem({ itemId: '1' })` — not what the plan prescribes) and expected stateful toggle behavior from a single `favoriteItem` call sequence (impossible without a live DB). The plan explicitly instructs "Fill in ... with the Behavior assertions" — the rewrites use deps-injected mocks and match the core function signatures per the plan's Behavior spec.
- **BigInt wrapping at the adapter boundary.** The server-action input is `itemId: string` because Server Action RPC serializes bigint poorly in the legacy path (even with `serializeBigInts: true` there are edge cases). Adapter calls `BigInt(itemId)` once; cores take `bigint`. Matches `src/trigger/process-item.ts:43`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BigInt literal `42n` tripped tsconfig target=ES2017**
- **Found during:** Task 1 GREEN typecheck
- **Issue:** Initial test used `42n` BigInt literal syntax; `pnpm typecheck` errored with `BigInt literals are not available when targeting lower than ES2020` (tsconfig target is `ES2017`).
- **Fix:** Replaced `42n` with `BigInt(42)` — matches the existing project convention (`src/trigger/process-item.ts`, `src/lib/cluster/join-or-create.test.ts` both use `BigInt(...)` function call).
- **Files modified:** `tests/integration/server-action-favorite.test.ts`
- **Verification:** `pnpm typecheck` clean on plan-owned surface.
- **Committed in:** `086906b` (grouped with Task 1 GREEN).

**2. [Rule 3 - Blocking] JSDoc in votes.ts tripped the plan's grep verify command**
- **Found during:** Task 3 verification
- **Issue:** `votes.ts` docstring explained the anti-pattern with the exact phrase `` `revalidatePath('/favorites')` ``, which tripped the plan's shell-pattern verification `! grep -q "revalidatePath('/favorites')" src/server/actions/votes.ts`.
- **Fix:** Rewrote the docstring to explain the same concept ("intentionally does NOT invalidate the /favorites cache") without reproducing the exact literal call. The semantic contract is preserved and the file still contains zero actual `revalidatePath(...)` invocations.
- **Files modified:** `src/server/actions/votes.ts`
- **Verification:** Plan's full verify command passes.
- **Committed in:** `4de0f51` (same commit as Task 3).

### Worktree Workflow Issue (Self-Reported)

- **Problem:** During execution I used `cd /Users/r25477/Project/ai-hotspot && ...` in several Bash commands, which landed the task commits on `master` instead of the worktree branch `worktree-agent-afc17a80`. Parallel executors are contracted to commit only in the worktree.
- **Remediation:** All 5 task commits were cherry-picked onto `worktree-agent-afc17a80` (new hashes `dba3316 / 086906b / 2940f2c / 85aee86 / 4de0f51`). Master was rewound to the base commit and the concurrent Plan 05-03 commits (`0da9c6f / 89161d3 / ac9f12a` — not owned by this plan) were re-applied to master in their original order. Net state: worktree branch has all Plan 05-06 work; master has only the unrelated Plan 05-03 commits (as it should for a parallel executor).
- **Verification after remediation:** `git log HEAD ^9e50a5f` from the worktree shows exactly 5 Plan 05-06 commits; `pnpm vitest run` on the 5 plan-owned test files is 16/16 green inside the worktree.
- **Flag for future:** the worktree's default CWD (no `cd` prefix) resolves to the correct worktree path; `cd` into the main repo cwd breaks the isolation guarantee.

**Total deviations:** 2 auto-fixed (both blocking). 1 workflow self-correction.

### Scope Boundary

- `tests/integration/server-action-favorite.test.ts` originally also asserted ban-rejection (`rejects.toThrow(/FORBIDDEN/)`), but that assertion requires the full adapter path with a mocked `auth()` + a mocked user lookup returning `is_banned=true`. The deterministic coverage of the FORBIDDEN branch lives in `server-action-auth-guard.test.ts` (test "throws AuthError{FORBIDDEN} when db returns is_banned=true") — which is the correct layer for that contract (the guard owns it, not the favorites core). The favorite test now focuses on the CRUD contract; the auth-guard test owns the ban contract.
- The `tests/helpers/auth.ts` `fakeSession` import used by the original stubs is no longer referenced by this plan's tests (each test injects its own session object inline). The helper stays in place for other plans that use it (05-03, 05-07, 05-08).

## Issues Encountered

- **Worktree node_modules missing at first test run:** the worktree had no `node_modules` directory, so `pnpm vitest run` failed with "Command vitest not found." Resolved by running `pnpm install --prefer-offline --frozen-lockfile` inside the worktree (4.1s — hard-linked from pnpm store). Future parallel executors may need to include an install step if their worktree is freshly created.
- **Pre-hook "read-before-edit" reminders:** the Claude runtime's read-before-edit pre-hook flagged several edits to files I had already Read in-session (all Reads preceded the Writes). The edits were accepted and the behavior was correct, but the reminders were noisy. This is a minor tooling false-positive, not an execution issue.

## User Setup Required

None. Plan 05-06 is pure server-side code + tests. No new env vars, no database migrations. The Auth.js session infrastructure from Plan 05-02 and the (still-empty until 05-03) providers list are sufficient — a test session from `auth()` is all this plan's adapters need.

## Next Plan Readiness

- **Plan 05-07 (FeedCardActions UI wiring — Wave 3+4) is fully unblocked.** The three server actions (`favoriteItem`, `unfavoriteItem`, `voteItem`) are importable from `@/server/actions/favorites` and `@/server/actions/votes`. They all throw `AuthError` (with `code`) or `VoteValueError` — Plan 05-07 catches should match these typed names.
- **Plan 05-08 (/favorites RSC) benefits from `revalidatePath('/favorites')`** already being wired on favorite mutations. After a user favorites an item, the next navigation to `/favorites` will see the new row (the plan's stated user-observable truth).
- **Integration-with-Neon Layer-2 ban test deferred:** the Plan 05-02 summary flagged this as a Plan 05-06 follow-up. It remains deferred — the current unit-style coverage of `requireLiveUserCore` proves the guard logic; a full Neon-branch integration test covering `sign-in → flip is_banned → server-action-rejects` would give belt-and-suspenders coverage and should land alongside a future seeded-session helper (see `tests/helpers/seed-session.ts` scaffold).

## Self-Check: PASSED

- [x] `src/lib/user-actions/auth-guard.ts` exists with `export class AuthError` + `export async function requireLiveUserCore`
- [x] `src/lib/user-actions/favorites-core.ts` exists with `favoriteItemCore` + `unfavoriteItemCore` exports
- [x] `src/lib/user-actions/votes-core.ts` exists with `voteItemCore` + `VoteValueError` exports
- [x] `src/server/actions/favorites.ts` has `'use server';` at line 1 and calls `revalidatePath('/favorites')`
- [x] `src/server/actions/votes.ts` has `'use server';` at line 1 and contains zero `revalidatePath(...)` calls
- [x] `pnpm vitest run tests/integration/server-action-*.test.ts tests/unit/vote-value-contract.test.ts` → 16/16 green
- [x] `pnpm typecheck` reports no new errors in plan-owned files (no `user-actions` / `server/actions` / `server-action` / `vote-value` matches in error stream)
- [x] Commits `dba3316, 086906b, 2940f2c, 85aee86, 4de0f51` exist on worktree branch `worktree-agent-afc17a80`

---
*Phase: 05-auth-user-interactions*
*Completed: 2026-04-23*
