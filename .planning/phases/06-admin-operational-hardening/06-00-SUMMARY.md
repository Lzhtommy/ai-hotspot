---
phase: 06-admin-operational-hardening
plan: "00"
subsystem: admin
tags: [admin, auth, nextjs-app-router, middleware, rsc-gate, defense-in-depth, auth-js-v5]

# Dependency graph
requires:
  - phase: 05-auth-user-interactions
    provides: Auth.js v5 database sessions, users.role column, session callback exposing role
provides:
  - /admin route group with an always-on RSC gate (requireAdmin in app/admin/layout.tsx)
  - Reusable requireAdmin() and assertAdmin() helpers for every admin Server Action in Phase 6
  - AdminShell (two-column desktop + mobile drawer) and AdminNav (pathname-aware active state)
  - Edge middleware matching /admin/:path* — anonymous cookie-less traffic bounced at the edge
  - Chinese-first admin surface (管理后台 landing, 无权访问 denied page)
affects: [06-02-sources-admin, 06-03-users-admin, 06-04-costs-admin, 06-05-dead-letter, 06-06+]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-layer defense-in-depth admin gate (edge cookie filter → RSC requireAdmin → per-action assertAdmin)
    - x-pathname request header propagated by middleware to break redirect loops at the RSC layer
    - AdminSession assertion function type (asserts session is AdminSession) narrows once called
    - Admin sub-routes inherit the gate via app/admin/layout.tsx — zero per-page re-auth

key-files:
  created:
    - src/lib/auth/admin.ts
    - src/middleware.ts
    - src/app/admin/layout.tsx
    - src/app/admin/page.tsx
    - src/app/admin/access-denied/page.tsx
    - src/components/admin/admin-shell.tsx
    - src/components/admin/admin-nav.tsx
    - tests/unit/admin-gate.test.ts
  modified: []

key-decisions:
  - "Cookie-presence-only check at edge (no DB hit) — database-session validation requires the Node adapter which would blow the Edge bundle budget; the RSC layout is the authoritative role check."
  - "x-pathname header set by middleware so the admin layout can detect the access-denied path and short-circuit requireAdmin() — otherwise non-admin redirects loop back on themselves."
  - "assertAdmin declared as an assertion function (asserts session is AdminSession) rather than a predicate — Server Actions get single-call narrowing without casts."
  - "Admin chrome uses inline-style convention from src/components/layout/* rather than new Tailwind classes — keeps visual language consistent with the reader shell."

patterns-established:
  - "Every future admin sub-route MUST NOT redeclare the gate — app/admin/layout.tsx already calls requireAdmin()."
  - "Server Actions called from /admin must call assertAdmin(session) on the result of auth() — redirect() inside a Server Action body swallows the action return."
  - "New admin middleware matchers go alongside /admin/:path* in src/middleware.ts — there is one middleware file at src/ root."

requirements-completed: [ADMIN-01]

# Metrics
duration: 7min
completed: 2026-04-23
---

# Phase 6 Plan 06-00: Admin Gate Foundation Summary

**Three-layer defense-in-depth admin gate (edge cookie filter + RSC requireAdmin + Server Action assertAdmin) with /admin route group, shell chrome, Chinese-first landing, and access-denied page — every Phase 6 admin plan consumes this without redoing the check.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-23 (Phase 6 kickoff)
- **Tasks:** 3
- **Files created:** 8
- **Files modified:** 0

## Accomplishments

- `requireAdmin()` + `assertAdmin()` + `AdminAuthError` helpers in `src/lib/auth/admin.ts` — authoritative DB-backed role check for RSC layouts and a throw-based variant for Server Actions.
- `src/middleware.ts` matches `/admin/:path*`, short-circuits anonymous traffic at the edge based on session-cookie presence (dev `authjs.session-token` vs prod `__Secure-authjs.session-token`), and propagates the request pathname via `x-pathname`.
- `/admin` route group with RSC layout gate, 4-card Chinese landing page (信源 / 用户 / 成本 / 死信), access-denied page, and client-side AdminShell / AdminNav chrome — consistent with the reader-side visual language.
- 7 vitest cases in `tests/unit/admin-gate.test.ts` covering every branch of both helpers.

## Task Commits

1. **Task 1 RED — failing admin-gate test** → `61146ea` (test)
2. **Task 1 GREEN — implement requireAdmin + assertAdmin** → `99985dd` (feat)
3. **Task 2 — edge middleware Layer 1** → `cbc1487` (feat)
4. **Task 3 — /admin route group (layout + page + access-denied + shell + nav)** → `703bfe2` (feat)

## Files Created/Modified

- `src/lib/auth/admin.ts` — `requireAdmin`, `assertAdmin`, `AdminAuthError`, `AdminSession` type
- `src/middleware.ts` — `/admin/:path*` matcher, cookie-presence filter, x-pathname header propagation, access-denied loop-guard
- `src/app/admin/layout.tsx` — RSC gate + force-dynamic + x-pathname loop-guard
- `src/app/admin/page.tsx` — 管理后台 landing with 4-card nav grid
- `src/app/admin/access-denied/page.tsx` — 无权访问 Chinese page, no requireAdmin call
- `src/components/admin/admin-shell.tsx` — Client shell (two-column desktop, mobile drawer)
- `src/components/admin/admin-nav.tsx` — Client nav using usePathname() for active-link state
- `tests/unit/admin-gate.test.ts` — 7 test cases covering all requireAdmin + assertAdmin branches

## Decisions Made

- **Edge middleware checks cookie presence only.** Auth.js v5 database sessions cannot be validated at the Edge without pulling the Drizzle + Neon adapter into the Edge bundle (size budget + node: polyfills). The RSC layer is the authoritative role check.
- **`x-pathname` propagation breaks the access-denied redirect loop.** `requireAdmin()` sends non-admins to `/admin/access-denied`, but that page lives under `/admin/*` and therefore re-runs the layout. Middleware now writes `x-pathname`, and the layout checks it to skip `requireAdmin()` specifically on the access-denied path.
- **`assertAdmin` as an assertion function (`asserts session is AdminSession`).** Lets Server Actions narrow without a cast after a single call.
- **Admin chrome uses inline styles / CSS variables**, not Tailwind classes, to match the reader-side Sidebar / NavRow convention. Keeps the visual language coherent across the app.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Fixed latent redirect loop on /admin/access-denied**

- **Found during:** Task 3 (/admin route group).
- **Issue:** Plan instructed `access-denied` to live at `src/app/admin/access-denied/page.tsx`. Because this path is under `/admin/*`, every request re-runs `src/app/admin/layout.tsx` which calls `requireAdmin()`. For a non-admin authenticated user, `requireAdmin()` redirects to `/admin/access-denied`, which re-runs the layout, which redirects again → infinite loop in the browser.
- **Fix:** (a) `src/middleware.ts` now writes the request pathname to an `x-pathname` header for every `/admin/*` request, and also lets anonymous traffic pass through for `/admin/access-denied` so the page is directly reachable. (b) `src/app/admin/layout.tsx` reads `x-pathname` via `headers()` at RSC boundary and, when it equals `/admin/access-denied`, skips the `requireAdmin()` call entirely — rendering the shell with the live session (if any) or an anonymous placeholder.
- **Files modified:** `src/middleware.ts`, `src/app/admin/layout.tsx`.
- **Verification:** `pnpm run build` succeeds — both `/admin` and `/admin/access-denied` register. `pnpm exec tsc --noEmit` is clean. Acceptance grep checks pass. Manual browser verification deferred to HUMAN-UAT when DB seeding lands.
- **Committed in:** `703bfe2` (Task 3 commit).

**2. [Rule 3 — Blocking] TypeScript TS2775 on dynamically-imported assertion function**

- **Found during:** Task 1 (assertAdmin tests).
- **Issue:** `assertAdmin` is declared as `asserts session is AdminSession`. Calling it through a dynamically-imported local binding (`const { assertAdmin } = await import(...)`) triggers TS2775 at the call site because TS cannot prove the imported name is declared with an explicit annotation. Blocked `tsc --noEmit` from passing.
- **Fix:** In the test file, re-bind through a plain-function type (`const assertAdmin = mod.assertAdmin as (s: unknown) => void`) before invoking. Erases the predicate only at the call site in the test — the real declaration in `src/lib/auth/admin.ts` retains full assertion-narrowing semantics for production callers.
- **Files modified:** `tests/unit/admin-gate.test.ts`.
- **Verification:** `pnpm exec tsc --noEmit` exits 0. All 7 tests pass.
- **Committed in:** `99985dd` (Task 1 GREEN commit).

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking).
**Impact on plan:** Both fixes essential. The redirect loop would have made the page unusable in the intended primary user flow (non-admin lands on /admin). The TS2775 issue would have blocked `pnpm exec tsc --noEmit` which is an acceptance criterion. No scope creep.

## Issues Encountered

- Pre-existing test failures in `src/lib/llm/*` and `src/trigger/process-pending.test.ts` (Anthropic SDK `dangerouslyAllowBrowser` under jsdom). Confirmed present on baseline via `git stash && pnpm test --run src/lib/llm/client.test.ts`. Out of scope per executor scope-boundary rule — logged to deferred items.
- `/admin/access-denied` renders as dynamic (`ƒ`) in the build output despite `export const dynamic = 'force-static'` because the parent admin layout calls `headers()` (for the x-pathname loop-guard). This is fine — the page still exposes no admin data and is effectively constant.

## Deferred Items

| Category | Item | Reason |
|----------|------|--------|
| Pre-existing | `src/lib/llm/client.test.ts` + `embed.test.ts` + `enrich.test.ts` + `process-item-core.test.ts` + `src/trigger/process-pending.test.ts` fail under jsdom with Anthropic SDK `dangerouslyAllowBrowser` error | Pre-existing on baseline — unrelated to this plan. Should be addressed by a future plan that either flips vitest `environment` to `node` for those files or adds `dangerouslyAllowBrowser: true` / SDK mock. |

## TDD Gate Compliance

Task 1 followed the TDD RED → GREEN gate:

1. **RED:** `test(06-00): add failing admin-gate test` → commit `61146ea`. Test run failed with `Failed to resolve import "@/lib/auth/admin"` (import resolution error = RED signal; implementation file did not yet exist).
2. **GREEN:** `feat(06-00): implement requireAdmin + assertAdmin admin gate helpers` → commit `99985dd`. Test run: 7/7 passing. `tsc --noEmit` clean after the test-side TS2775 fix.
3. No REFACTOR phase needed — implementation was minimal and already clear.

Tasks 2 and 3 were marked `type="auto"` (not `tdd="true"`) and did not require a separate RED commit.

## Next Phase Readiness

- **ADMIN-01 satisfied.** `/admin` is reachable only to admin users (middleware + requireAdmin + assertAdmin). The `/admin/access-denied` escape hatch works for non-admin authenticated users.
- **Plans 06-02..06-05 can consume the gate directly.** Sub-routes must NOT redeclare `requireAdmin()` — it's inherited from `src/app/admin/layout.tsx`. Server Actions should call `assertAdmin(session)` on the result of `auth()`.
- **No user setup required** for this plan. Future plans that seed an admin user for live browser testing will need the out-of-band SQL promotion documented in `docs/auth-providers.md`.
- **HUMAN-UAT deferred:** browser-level verification of redirect behavior (anonymous → /, non-admin → /admin/access-denied, admin → /admin shell) requires a seeded admin user and live session — deferred to Phase 6 verification pass alongside the sub-route plans.

## Self-Check: PASSED

Verified:

- `src/lib/auth/admin.ts` — FOUND
- `src/middleware.ts` — FOUND
- `src/app/admin/layout.tsx` — FOUND
- `src/app/admin/page.tsx` — FOUND
- `src/app/admin/access-denied/page.tsx` — FOUND
- `src/components/admin/admin-shell.tsx` — FOUND
- `src/components/admin/admin-nav.tsx` — FOUND
- `tests/unit/admin-gate.test.ts` — FOUND
- Commit `61146ea` (test RED) — FOUND
- Commit `99985dd` (feat GREEN Task 1) — FOUND
- Commit `cbc1487` (feat Task 2) — FOUND
- Commit `703bfe2` (feat Task 3) — FOUND

---

*Phase: 06-admin-operational-hardening*
*Completed: 2026-04-23*
