---
phase: 05-auth-user-interactions
plan: 02
subsystem: auth
tags: [auth.js, next-auth-v5, drizzle-adapter, database-session, ban-enforcement]

requires:
  - phase: 05-auth-user-interactions
    provides: Plan 05-01 Auth.js adapter tables + users.{emailVerified,image} columns on Neon dev branch
  - phase: 05-auth-user-interactions
    provides: Plan 05-00 test helper tests/helpers/auth.ts (fakeSession) used by Task 1 + Task 2 tests
provides:
  - authConfig singleton with DrizzleAdapter + session.strategy='database' + redirectProxyUrl wiring (D-19)
  - Session callback enforcing D-05 Layer 1 ban check (returns null for isBanned=true) and D-08 payload shape (id/role/image)
  - events.signIn → lastSeenAt touch (D-09); events.linkAccount → avatar_url mirror (D-04)
  - @/lib/auth barrel exporting {handlers, auth, signIn, signOut, GET, POST}
  - src/lib/auth/session.ts helpers (getSession, requireSession)
  - /api/auth/[...nextauth]/route.ts mounted with runtime='nodejs'
  - .env.example documenting all 9 Phase 5 auth vars including AUTH_REDIRECT_PROXY_URL + RESEND_FROM
  - vitest.config.ts inline next-auth + @auth/core to make the test runner resolve bare-subpath imports
affects: [05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10]

tech-stack:
  added:
    - next-auth@5.0.0-beta.31
    - "@auth/drizzle-adapter@1.11.2"
  patterns:
    - "Split authConfig (config.ts) from NextAuth() singleton (index.ts) — mirrors src/lib/db/{schema,client}.ts split for testability"
    - "Inline next-auth + @auth/core in vitest.config.deps to resolve Next.js bare-subpath imports (next/server) that Node's ESM resolver rejects — same class of fix as voyageai inline"
    - "Session callback reads `user` as DB row (database strategy) — no second query needed for Layer 1 ban check"

key-files:
  created:
    - src/lib/auth/config.ts
    - src/lib/auth/index.ts
    - src/lib/auth/session.ts
    - "src/app/api/auth/[...nextauth]/route.ts"
  modified:
    - package.json
    - pnpm-lock.yaml
    - vitest.config.ts
    - .env.example
    - tests/unit/auth-config.test.ts
    - tests/unit/session-payload.test.ts
    - tests/integration/ban-enforcement.test.ts

key-decisions:
  - "Inlined next-auth + @auth/core in vitest.config.ts deps to bypass Node's strict ESM bare-subpath resolver. next-auth@5.0.0-beta.31 imports `next/server` (no .js extension) from lib/env.js; Node's ESM resolver fails without the extension even though next's exports map is well-formed. Vite's resolver reads the exports map correctly when the package is inlined. Same class of fix as the existing voyageai entry."
  - "Ban-enforcement integration test uses the unit-style variant (plain object for user) rather than a seeded Neon row. Plan explicitly permits this fallback; the pure callback doesn't query the DB (database strategy passes the row as a pre-fetched param), so the test exercises the full Layer 1 branch deterministically without a Neon branch dependency. A real Neon-branch integration test for the sign-in→session-refresh loop can come with Plan 05-06 server-action Layer 2."
  - "Providers array ships empty. Plan 03 populates GitHub + Resend + Google; Plan 02 isolates the adapter + callback + route concerns, which matches the plan's explicit scope split."
  - "redirectProxyUrl assigned from process.env.AUTH_REDIRECT_PROXY_URL explicitly in authConfig. Auth.js v5 would auto-pickup the env var, but the explicit assignment makes the D-19 wiring self-documenting and testable (auth-config.test.ts asserts the binding)."

requirements-completed: [AUTH-01, AUTH-07]

duration: 5 min
completed: 2026-04-23
---

# Phase 5 Plan 02: Auth.js v5 config + DrizzleAdapter wiring Summary

**Installs next-auth@5.0.0-beta.31 + @auth/drizzle-adapter@1.11.2, lands the Auth.js singleton with database session strategy, two-layer ban enforcement (Layer 1: session callback returns null for banned users, D-05), D-08 session payload shaping (id/role/image; never is_banned), and mounts the thin /api/auth/[...nextauth] route handler. Providers stay empty[] for Plan 03 to fill in.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-23T05:54:57Z
- **Completed:** 2026-04-23T06:00:22Z
- **Tasks:** 3 (all auto; no checkpoints)
- **Files modified:** 11 (4 created, 7 modified)

## Accomplishments

- Installed `next-auth@5.0.0-beta.31` + `@auth/drizzle-adapter@1.11.2` via pnpm (package.json + pnpm-lock.yaml committed).
- `src/lib/auth/config.ts` exports `authConfig` wired to DrizzleAdapter(db, { usersTable: users, accountsTable, sessionsTable, verificationTokensTable }), `session.strategy: 'database'`, `redirectProxyUrl` bound to `AUTH_REDIRECT_PROXY_URL`, empty `providers: []`, session callback enforcing D-05 Layer 1 (banned → null) and D-08 (expose id/role/image), events.signIn touching `lastSeenAt` (D-09), events.linkAccount mirroring OAuth avatar → `avatar_url` (D-04).
- `src/lib/auth/index.ts` exports `{ handlers, auth, signIn, signOut, GET, POST }` from `NextAuth(authConfig)` — single-surface barrel.
- `src/lib/auth/session.ts` exports `getSession()` + `requireSession(redirectTo='/')` helpers.
- `src/app/api/auth/[...nextauth]/route.ts` re-exports `GET` + `POST` with `runtime = 'nodejs'`.
- `.env.example` now documents all 9 Phase 5 auth vars with scope-matrix comments. "placeholders; implemented in Phase 5" qualifier removed from the heading.
- `vitest.config.ts` updated to inline `next-auth` + `@auth/core` so the test runner resolves `next/server` bare-subpath imports via Vite's resolver (same class of fix as the existing `voyageai` entry).
- Wave 0 stubs flipped green: `tests/unit/auth-config.test.ts` (2 tests), `tests/unit/session-payload.test.ts` (2 tests), `tests/integration/ban-enforcement.test.ts` (2 tests) — 6/6 green.
- `pnpm typecheck` passes for all Plan 05-02 surface (no new errors in src/lib/auth/**, tests/unit/auth-config.test.ts, tests/unit/session-payload.test.ts, tests/integration/ban-enforcement.test.ts). Pre-existing Wave 0 red stubs for Plans 05-04/05-05/05-07 remain untouched.

## Task Commits

1. **Task 1: Install next-auth + drizzle-adapter, create config.ts + index.ts** — `68476d9` (feat)
2. **Task 2: Session helpers + /api/auth/[...nextauth] route + ban-enforcement integration test** — `b29a268` (feat)
3. **Task 3: Add AUTH_REDIRECT_PROXY_URL + RESEND_FROM to .env.example** — `0123c08` (docs)

_Plan metadata commit follows (docs: complete plan)._

## Files Created/Modified

**Created (4):**
- `src/lib/auth/config.ts` — 75 lines; authConfig export with adapter + database session + redirectProxyUrl + session callback + events
- `src/lib/auth/index.ts` — 19 lines; NextAuth(authConfig) singleton + route verb re-exports
- `src/lib/auth/session.ts` — 34 lines; getSession + requireSession helpers
- `src/app/api/auth/[...nextauth]/route.ts` — 14 lines; thin GET/POST re-export with runtime='nodejs'

**Modified (7):**
- `package.json` + `pnpm-lock.yaml` — next-auth@5.0.0-beta.31 + @auth/drizzle-adapter@1.11.2
- `vitest.config.ts` — deps.inline adds next-auth + @auth/core
- `.env.example` — AUTH_REDIRECT_PROXY_URL + RESEND_FROM added; placeholder qualifier removed; scope-matrix comments added for AUTH_SECRET
- `tests/unit/auth-config.test.ts` — asserts barrel exports (handlers/auth/signIn/signOut/GET/POST) + authConfig shape (adapter, session.strategy, providers=[], redirectProxyUrl, callbacks.session)
- `tests/unit/session-payload.test.ts` — 2 tests: id/role/image surfaced + image mirrored from avatarUrl fallback; is_banned NEVER surfaced
- `tests/integration/ban-enforcement.test.ts` — 2 tests: banned → null; non-banned → populated session

## Decisions Made

- **Split config.ts + index.ts.** Mirrors the `src/lib/db/{schema,client}.ts` split — lets tests import the raw `authConfig` for shape assertions without invoking `NextAuth()`. Only the barrel (`index.ts`) invokes `NextAuth()`, which is the module that transitively pulls Next.js runtime bits.
- **Vitest inline next-auth + @auth/core.** next-auth@5.0.0-beta.31 imports `next/server` (no .js extension) from its lib/env.js in ESM mode; Node's strict ESM resolver rejects the bare subpath even though Next.js's exports map is well-formed. Vite's resolver (via vite-node inline) reads the exports map correctly. Same class of fix as the existing voyageai inline entry — documented inline in vitest.config.ts.
- **Ban-enforcement test uses unit-style variant.** Plan fallback explicitly permits this when Neon branch isn't available. The session callback with database strategy receives the DB row as a pre-fetched param, so exercising it with a plain object covers the full Layer 1 branch without seeding Neon. A real Neon-branch integration test can follow with Plan 05-06 Layer 2 server-action guards.
- **Providers ship empty.** Plan 03's scope. The 05-02 shape tests explicitly assert `providers.length === 0` to document the scope boundary.
- **redirectProxyUrl explicit assignment.** Auth.js v5 auto-picks up `AUTH_REDIRECT_PROXY_URL` from env, but the explicit `redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL` makes the D-19 wiring self-documenting and testable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] next-auth transitive import of `next/server` fails Node ESM resolver in vitest**
- **Found during:** Task 1 verification (`pnpm vitest run tests/unit/auth-config.test.ts`)
- **Issue:** After installing next-auth + DrizzleAdapter and creating config.ts + index.ts, the barrel-import test (`await import('@/lib/auth')`) failed with `Cannot find module '.../next/server' imported from .../next-auth/lib/env.js` ... `Did you mean to import "next/server.js"?`. The second test (pure `authConfig` shape assertions, no NextAuth() call) passed — confirming the issue was isolated to runtime resolution of the NextAuth() invocation path.
- **Fix:** Added `next-auth` + `@auth/core` to `vitest.config.ts` `deps.inline`. This routes these packages through Vite's resolver instead of Node's, and Vite correctly honours Next.js's exports map.
- **Files modified:** vitest.config.ts
- **Verification:** `pnpm vitest run tests/unit/auth-config.test.ts` → 2/2 green after the fix; the full plan test suite (6 tests across 3 files) runs green.
- **Committed in:** 68476d9 (same commit as Task 1 work; the vitest.config fix is a direct prerequisite for the test assertions to pass and is properly grouped with the install)

### Scope Boundary

- The env-remote-patterns.test.ts stub (owned by Plan 05-10) was inspected but required **no changes** from this plan. The stub already asserts all 9 Phase 5 env var names — which is exactly what Task 3 intended to enforce. The first assertion (next.config remotePatterns) remains red as designed for Plan 05-10. No action taken.
- Pre-existing Wave 0 red typecheck errors in `tests/unit/feed-card-actions.test.tsx`, `tests/unit/user-chip.test.tsx`, `tests/unit/vote-honest-copy.test.tsx` are **out of scope** (Plans 05-04, 05-05, 05-07 — documented in Plan 05-01 SUMMARY "Issues Encountered"). Not touched.

**Total deviations:** 1 auto-fixed (1 blocking). No architectural changes.

## Issues Encountered

- **next-auth v5 beta + Node ESM resolver:** documented above; fixed via vitest.config.ts inline. Worth flagging to future plan authors: any module that transitively imports `next-auth` inside a vitest test will hit this; the inline entry must stay in place until either next-auth ships a fix (pin subpath to `next/server.js`) or Node's ESM resolver learns to use exports maps for bare subpaths.
- **pnpm peer-dep warning** on `@vitejs/plugin-react` unmet peer `vite@^8.0.0` (found `5.4.21`) — pre-existing, unrelated to this plan. Out of scope.

## User Setup Required

None — Plan 02 is pure config + tests. Provider wiring (requiring real GitHub/Google OAuth apps + Resend API key) starts in Plan 03, at which point the `.env.example`-documented vars need real values.

## Next Plan Readiness

- **Plan 05-03 (Wave 3: provider wiring — GitHub/Resend/Google) is unblocked.** The `authConfig.providers` array is an empty slot ready to receive provider objects; the adapter + callbacks + events are fully wired and tested.
- **`@/lib/auth` barrel is stable** — `auth()`, `signIn()`, `signOut()`, `handlers.GET`, `handlers.POST` all exist and are importable from any RSC / server action / route file in the project. Future plans should import exclusively from `@/lib/auth` (never from `'next-auth/react'`, per RESEARCH §Anti-Patterns).
- **Vitest green baseline** for auth tests — `pnpm vitest run tests/unit/auth-config.test.ts tests/unit/session-payload.test.ts tests/integration/ban-enforcement.test.ts` → 6/6 green. Use as the pre-flight check before any future edit to the auth surface.
- **Flag for Plan 05-06:** when implementing the server-action Layer 2 re-check pattern, consider upgrading `ban-enforcement.test.ts` to a full Neon-branch integration that exercises the Auth.js session-refresh loop (sign-in → read session → flip is_banned → re-read session → expect null). The current unit-variant test is sufficient for the Layer 1 contract; the full-loop test gives belt-and-suspenders coverage for the 2-layer model.

## Self-Check: PASSED

- [x] `src/lib/auth/config.ts` exists with `export const authConfig` (grep confirmed)
- [x] `src/lib/auth/index.ts` exists with `export const { handlers, auth, signIn, signOut }` (grep confirmed)
- [x] `src/lib/auth/session.ts` exists with `export async function getSession` + `export async function requireSession` (grep confirmed)
- [x] `src/app/api/auth/[...nextauth]/route.ts` exists with `export { GET, POST }` + `export const runtime = 'nodejs'` (grep confirmed)
- [x] `.env.example` contains all 9 Phase 5 auth vars (AUTH_SECRET, AUTH_URL, AUTH_REDIRECT_PROXY_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY, RESEND_FROM) (grep confirmed)
- [x] `.env.example` does NOT contain "placeholders; implemented in Phase 5" (grep confirmed)
- [x] Commits 68476d9, b29a268, 0123c08 exist in `git log` (git log confirmed)
- [x] `pnpm vitest run tests/unit/auth-config.test.ts tests/unit/session-payload.test.ts tests/integration/ban-enforcement.test.ts` → 6/6 green
- [x] `pnpm typecheck` produces no new errors in src/lib/auth/** or plan-owned test files (pre-existing red stubs for 05-04/05-05/05-07 remain as intended)

---
*Phase: 05-auth-user-interactions*
*Completed: 2026-04-23*
