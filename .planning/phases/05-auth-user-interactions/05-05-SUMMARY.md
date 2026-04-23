---
phase: 05-auth-user-interactions
plan: 05
subsystem: auth-ui
tags: [user-chip, session, popover, sign-out, avatar, monogram, a11y, rsc-prop-drill]

requires:
  - phase: 05-auth-user-interactions
    provides: Plan 05-02 @/lib/auth singleton (auth, signIn, signOut)
  - phase: 05-auth-user-interactions
    provides: Plan 05-04 signOutAction server action
  - phase: 04-feed-ui
    provides: UserChip Phase 4 stub (anonymous 登录 chip + open-login-modal dispatch); Sidebar/ReaderShell/SidebarMobileDrawer architecture; Button/Icon atoms; (reader) layout
provides:
  - UserChip three-state render per CONTEXT D-18 (anonymous / authenticated-with-image / authenticated-without-image)
  - Sign-out popover (role=menu + role=menuitem) that invokes signOutAction via form onSubmit
  - `log-out` + `user` entries in IconName union with matching feather-style 24x24 SVGs under public/icons/
  - RSC-to-Client session prop-drill (layout.tsx `await auth()` → ReaderShell → Sidebar → UserChip); UserChip never calls useSession()
  - Name truncation (>8 chars → ellipsis) and monogram fallback (first char, amber --accent-100 bg / --accent-700 text) for magic-link users
affects: [05-07, 05-08, 05-09, 05-10]

tech-stack:
  added: []
  patterns:
    - "Session prop-drill from RSC layout → Client shell → client leaf (UserChip) instead of useSession hook"
    - "AuthenticatedChip split into child component so useState/useEffect are not conditionally called when the parent branches on anonymous vs authenticated"
    - "Server-action form pattern — onSubmit + preventDefault + void signOutAction() instead of action={signOutAction} (Plan 05-04 canonical pattern; React 18.3 does not fire function-valued action outside Next.js compiler transform)"
    - "Monogram fallback mirrors SourceDot anatomy at 32px with amber palette (reuse existing tokens; no new CSS vars)"

key-files:
  created:
    - public/icons/log-out.svg
    - public/icons/user.svg
  modified:
    - src/components/layout/icon.tsx
    - src/components/layout/user-chip.tsx
    - src/components/layout/sidebar.tsx
    - src/components/layout/reader-shell.tsx
    - src/app/(reader)/layout.tsx
    - tests/unit/user-chip.test.tsx
    - tests/unit/user-chip-signout.test.tsx

key-decisions:
  - "Adopted Plan 05-04's onSubmit-not-action form pattern for the sign-out form. Consistent with LoginPromptModal; avoids React 18.3 function-valued action warning in Vitest and production."
  - "Extracted AuthenticatedChip as a sibling component. UserChip still owns the single entry point, but useState/useEffect live only in the authenticated branch — complies with rules-of-hooks without an awkward always-true initial state."
  - "Session prop-drilled from the RSC layout (`await auth()` in src/app/(reader)/layout.tsx) through ReaderShell → Sidebar → UserChip. Sidebar downgraded from `async` to synchronous — it cannot remain async because its parent ReaderShell is a Client Component. Prop-drill is the canonical RSC-to-Client session pattern per CLAUDE.md §11 + RESEARCH §Anti-Patterns."
  - "UserChip's SessionUser interface requires `id` + `email`. When Auth.js Session omits either (defensive), Sidebar maps to null and UserChip renders the anonymous 登录 chip — matches the semantics of a genuinely anonymous user."
  - "Monogram fallback uses the existing --accent-100 / --accent-700 tokens (amber palette) and reuses SourceDot anatomy at 32px per UI-SPEC §UserChip Monogram. No new color variables introduced."
  - "Icons authored as 24×24 viewBox feather-style SVGs matching the existing pack (check / x / star / etc). user.svg sourced from .design/feed-ui/project/ds/icons/user.svg; log-out.svg hand-authored to match feather's log-out path data."

requirements-completed: [AUTH-06, AUTH-08]

duration: 7 min
completed: 2026-04-23
---

# Phase 5 Plan 05: UserChip Three-State Authenticated Render Summary

**Extends UserChip in place with two new authenticated-state renders (32px avatar OR amber monogram + truncated name + chevron + sign-out popover role=menu) on top of the preserved Phase 4 anonymous 登录 chip, and wires the RSC `await auth()` session through ReaderShell → Sidebar → UserChip as a prop so the component never calls useSession().**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-23T06:30:00Z
- **Completed:** 2026-04-23T06:37:11Z
- **Tasks:** 3 (Task 1 icons + union; Task 2 TDD three-state render + popover; Task 3 session prop-drill)
- **Files modified:** 7 (2 created — log-out.svg + user.svg; 5 modified — icon.tsx + user-chip.tsx + sidebar.tsx + reader-shell.tsx + (reader)/layout.tsx) + 2 test files updated

## Accomplishments

- **UserChip renders three states end-to-end** per CONTEXT D-18 + UI-SPEC §UserChip:
  - Anonymous (session=null): ghost 登录 chip, `document.dispatchEvent(new CustomEvent('open-login-modal'))` — verbatim from Phase 4.
  - Authenticated with image: 32px next/image avatar + truncated name + chevron-down; clicking toggles chevron + aria-expanded and opens sign-out popover.
  - Authenticated without image (magic-link users): amber monogram (--accent-100 bg + --accent-700 text, 32px circle, first char uppercased for Latin / passthrough for CJK) + truncated name + chevron.
- **Sign-out popover** opens beneath the chip with `role="menu"` and a single `role="menuitem"` (退出登录 + log-out icon 16px). Form uses onSubmit → preventDefault → `void signOutAction()` (Plan 05-04's canonical pattern). Click-outside and Escape close the popover.
- **Name truncation** at 8 chars with ellipsis (both CJK and Latin); fallback to email local-part when name is null; monogram initial falls back to email local-part similarly.
- **IconName union extended** with `'log-out'` and `'user'`; both SVGs dropped under `public/icons/` as 24×24 feather-compatible outline (stroke-width 1.5, currentColor, round linecaps) matching the existing pack style.
- **Session prop-drill** wired through the RSC boundary: `src/app/(reader)/layout.tsx` becomes `async`, calls `await auth()`, and passes `session` → `ReaderShell` → `Sidebar` → `UserChip`. Sidebar downgraded from `async` to sync (it never needed to be async — its parent is a Client Component). UserChip never imports useSession.
- **Tests green:** 7/7 (user-chip.test.tsx: 5, user-chip-signout.test.tsx: 2). Covers anonymous dispatch, image-avatar render, monogram fallback, name truncation, aria-haspopup/aria-expanded toggling, form submission invokes signOutAction, menu/menuitem a11y contract.

Typecheck on Plan 05-05 surface files: zero errors. Pre-existing Plan 05-07 red-state stubs (`tests/unit/feed-card-actions.test.tsx`, `tests/unit/vote-honest-copy.test.tsx`) remain typecheck-red — out of scope.

## Task Commits

1. **Task 1: Add log-out + user icons + extend IconName union** — `9b8dc4e` (feat)
2. **Task 2 RED: Expand UserChip tests for three-state + sign-out** — `ec49f04` (test)
3. **Task 2 GREEN: UserChip three-state authenticated render + sign-out popover** — `b101258` (feat)
4. **Task 3: Wire Auth.js session from RSC layout to UserChip via prop-drill** — `dacf86f` (feat)

_Plan metadata commit follows (docs: complete plan — SUMMARY + STATE + ROADMAP)._

## Files Created/Modified

**Created (2):**
- `public/icons/log-out.svg` — feather-style log-out icon, 24×24 viewBox, currentColor stroke
- `public/icons/user.svg` — feather-style user icon, sourced from `.design/feed-ui/project/ds/icons/user.svg`

**Modified (7):**
- `src/components/layout/icon.tsx` — IconName union extended with `'log-out'` + `'user'` (append-only, no reordering).
- `src/components/layout/user-chip.tsx` — Phase 4 ~30-line stub → ~222-line three-state component. Anonymous branch preserved verbatim; AuthenticatedChip sub-component renders avatar/monogram + popover. Exports `UserChipSessionUser` + `UserChipProps` types for parent consumption.
- `src/components/layout/sidebar.tsx` — Added Session import, accepts session prop, maps to UserChip SessionUser shape (requires id + email; falls back to null otherwise), passes to UserChip. Removed `async` keyword (no longer needed — session comes in via prop).
- `src/components/layout/reader-shell.tsx` — Accepts `session: Session | null` prop, forwards to Sidebar. `'use client'` preserved.
- `src/app/(reader)/layout.tsx` — Becomes `async`; calls `await auth()` at the RSC boundary and passes `session` to ReaderShell.
- `tests/unit/user-chip.test.tsx` — Replaced 3 red-state stubs with 5 fully-typed assertions (anonymous dispatch, image avatar, monogram, truncation, a11y toggle). Mocks @/server/actions/auth + next/image.
- `tests/unit/user-chip-signout.test.tsx` — Replaced 1 red-state stub with 2 assertions (signOutAction invocation on menuitem click; menu/menuitem a11y).

## Decisions Made

- **onSubmit pattern over `action={signOutAction}`.** Plan 05-04 already established this as the canonical pattern for server-action forms in this codebase: React 18.3 does not reliably fire function-valued `<form action={fn}>` outside Next.js 15's compiler transform, and the Vitest environment sees raw JSX. Initial implementation included both `action={signOutAction}` and onSubmit; a React warning ("Invalid value for prop `action` on <form> tag") surfaced in stderr during the first test run. Removed `action={}` and kept only the onSubmit path — semantics identical in production, tests deterministic.
- **AuthenticatedChip child component for hooks-order compliance.** The UserChip entry has always-branching logic (anonymous vs authenticated); putting useState/useEffect at the top-level would violate rules-of-hooks if the anonymous path returns before they execute. Splitting the authenticated branch into a child component keeps the entry function hooks-free and each child has a consistent hooks order. Rejected alternative: putting `const [open, setOpen] = useState(false)` before the anonymous early-return would work but couples anonymous renders to unnecessary state initialization.
- **Session prop-drill, not useSession.** RESEARCH §Anti-Patterns explicitly forbids useSession in this component; CLAUDE.md §11 prefers RSC auth() + prop-drill. `src/app/(reader)/layout.tsx` is the natural RSC boundary — it already routes to all (reader) pages. Making it `async` and calling `await auth()` once per request is cheap under Auth.js v5 database sessions (one index lookup) and avoids a client-side session fetch flicker. ReaderShell is already a Client Component so it accepts the session as a prop and forwards it.
- **UserChipSessionUser requires id + email; defensive null-cast in Sidebar.** Auth.js types declare Session.user fields as optional. When id or email is missing (shouldn't happen in practice with our DB-session callback, but TypeScript forces the narrow), Sidebar maps to `null` and UserChip renders the anonymous chip. Rejected alternative: downgrading UserChip's contract to optional fields — would push null-handling into UserChip and complicate the render logic.
- **Sidebar downgraded from async to sync.** Sidebar was declared `async` in Phase 4 but never actually awaited anything; the decoration was presumably aspirational. Since its parent ReaderShell is a Client Component, keeping it async would be a latent runtime bug (React does not support async Client Components). Removing `async` makes the type honest.
- **Icons sized 24×24 viewBox matching existing pack.** Phase 4 icons use `viewBox="0 0 24 24"` with `width=24/height=24` at source (rendered at any pixel size via the Icon component's `size` prop). user.svg was copied directly from the design bundle's 24×24 source; log-out.svg was hand-authored with the feather log-out path data at the same 24×24 scale. Both pass through the existing `<Icon name={...}>` → `<img src="/icons/{name}.svg">` pipeline without modification.
- **Popover anchored to the chip with `position: absolute; bottom: calc(100% + 4px)`.** UI-SPEC §UserChip: popover opens upward (sidebar is at bottom of the sidebar column). `bottom: calc(100% + 4px)` leaves a 4px gap between chip and popover. `min-width: 160px` + `left: 0; right: 0` makes the popover match the chip's width on the 224px sidebar. Rejected native `<dialog>` — not needed here (no backdrop, no focus trap required by UI-SPEC); a simple absolute-positioned `<div role="menu">` with click-outside + Escape handlers is lighter and more flexible.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `<form action={signOutAction}>` triggered React 18.3 warning**
- **Found during:** Task 2 first test run after GREEN implementation
- **Issue:** Initial implementation included both `action={signOutAction}` and `onSubmit={...}` on the sign-out form. React 18.3 emits `Warning: Invalid value for prop 'action' on <form> tag` because the function-valued action prop is not supported outside Next.js's compiler transform. Tests passed (because onSubmit fires first) but stderr pollution is a real bug.
- **Fix:** Removed the `action={signOutAction}` prop. Kept only `onSubmit={(e) => { e.preventDefault(); void signOutAction(); setOpen(false); }}`. The JSDoc comment cites Plan 05-04 Decisions for context.
- **Files modified:** src/components/layout/user-chip.tsx
- **Verification:** Re-ran tests — zero stderr output, 7/7 green.
- **Commit:** b101258 (grouped with Task 2 GREEN — the fix was applied before committing)

**2. [Rule 3 - Blocking] Sidebar was declared async but parent is Client Component**
- **Found during:** Task 3 (Sidebar session wiring)
- **Issue:** Phase 4's Sidebar was declared `export async function Sidebar(...)` but never awaited anything. Its parent ReaderShell is a `'use client'` component, which cannot render an async child (React does not support async Client Components; it would surface at runtime). The decoration was a latent bug.
- **Fix:** Removed the `async` keyword. Session now comes in via prop from the RSC layout — no component-local await needed. Updated JSDoc to reflect the new signature.
- **Files modified:** src/components/layout/sidebar.tsx
- **Verification:** `grep -q "await auth()" "src/app/(reader)/layout.tsx"` → PASS (the await moved to the RSC boundary where it belongs); typecheck passes on Sidebar.
- **Commit:** dacf86f

**3. [Rule 2 - Missing critical] Layout missed the `await auth()` call**
- **Found during:** Task 3 design
- **Issue:** Plan Task 3 said "inspect sidebar; if it is an RSC add auth()". Inspection showed Sidebar is called from a Client Component, so the auth() call belongs at the nearest RSC ancestor (the route-group layout). Without this, no session ever reaches UserChip.
- **Fix:** `src/app/(reader)/layout.tsx` now `async` and calls `await auth()` before rendering ReaderShell. Session is passed down the component tree as a prop.
- **Files modified:** src/app/(reader)/layout.tsx, reader-shell.tsx (accepts session), sidebar.tsx (accepts + forwards session)
- **Verification:** `grep -q "session={userChipSession}" src/components/layout/sidebar.tsx` → PASS; `grep -rn "useSession" src/components/layout/user-chip.tsx` → only matches in JSDoc anti-pattern comments (no actual hook usage).
- **Commit:** dacf86f

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing-critical). No Rule 4 architectural changes.
**Impact on plan:** All auto-fixes necessary. The React warning (deviation 1) and the async-in-Client latent bug (deviation 2) would have surfaced as production issues if not addressed now. The layout auth() call (deviation 3) was technically implied by the plan but not spelled out as a separate task — rolled into Task 3 as the RSC-boundary fix.

### Scope Boundary

- Pre-existing red-state stubs `tests/unit/feed-card-actions.test.tsx` and `tests/unit/vote-honest-copy.test.tsx` continue to typecheck-red. These are owned by Plan 05-07 (Wave 5 feed-card-actions real interactions). No fixes attempted.
- Vitest `deps.inline` deprecation warning unchanged (documented in vitest.config.ts — Plan 05-04 scope).
- `.claude/` untracked directory unchanged (global convention; not repo state).

## Issues Encountered

- **React 18.3 form action warning leaked from Plan 05-04 pattern.** Plan 05-04 established onSubmit-only as canonical; initial UserChip implementation added `action={signOutAction}` AND onSubmit "for belt-and-suspenders" which reintroduced the warning. Fixed by strictly following Plan 05-04's pattern — onSubmit alone, no action prop. Future server-action forms should not dual-wire.
- **Sidebar async-in-Client latent bug found during wiring.** Phase 4 Sidebar was `async function` but its Client Component parent would have rejected the RSC signature at runtime. Caught and fixed as part of Task 3 — no behavior change in production because Sidebar never actually awaited anything.

## User Setup Required

None — all work was code + test changes committed in-repo. No env vars, no DB migration, no third-party config. The sign-out path calls `signOutAction` (from Plan 05-04) which in turn calls Auth.js `signOut()`; real sign-out requires the prior auth setup (Plan 05-01..05-04) which is already in place.

## Next Plan Readiness

- **Plan 05-07 (Wave 5: feed-card-actions real interactions) is unblocked.** The session prop-drill pattern established here (RSC layout → Client shell → client leaf) is directly reusable: FeedCard / FeedListItem can receive `isAuthenticated: boolean` or a minimal user-state prop from the same layout.tsx `await auth()` call, following RESEARCH §Anti-Patterns.
- **Plan 05-08 (Wave 5: /favorites authenticated RSC) is unblocked.** `/favorites/page.tsx` can call `await auth()` directly (it's an RSC page) without affecting this plan's architecture. UserChip will reflect the authenticated state consistently across the site because the session lookup is cached per-request in Auth.js v5.
- **Plan 05-10 (Wave 6 hardening) inherits two surfaces.** (1) A reader layout that calls `await auth()` on every request — Plan 05-10 should spot-check that Auth.js v5's session-lookup caching (per-request memoization) is active; if not, wire `unstable_cache` or re-validate. (2) A three-state UserChip that interpolates `users.name` as text — React auto-escapes, but the monogram fallback reads `name.charAt(0)` which is also auto-escaped. No XSS surface beyond what T-5-07 already mitigated.

## Threat Surface Scan

All security-relevant surface introduced by this plan is captured in the plan's `<threat_model>`:

- **T-5-07 (XSS via session.user.name / image)** — mitigated: React auto-escapes the name in the chip label; next/image validates src against next.config.ts remotePatterns (set to `avatars.githubusercontent.com` + `lh3.googleusercontent.com` per Plan 05-01); monogram reads `initialOf(name, email).charAt(0)` which is also auto-escaped.
- **T-5-12 (SSRF via next/image on session.user.image)** — mitigated: remotePatterns allowlist is the sole SSRF boundary; no wildcard.
- **T-5-08 (Session prop tampering)** — accepted: session is serialized server → client once per request; any client-side mutation is local-only because signOutAction re-calls `auth()` server-side before invalidating the session.

No new surface to flag.

## Self-Check: PASSED

- [x] `test -f public/icons/log-out.svg && test -f public/icons/user.svg` → both exist
- [x] `grep -q "'log-out'" src/components/layout/icon.tsx && grep -q "'user'" src/components/layout/icon.tsx` → union extended
- [x] `pnpm vitest run tests/unit/user-chip.test.tsx tests/unit/user-chip-signout.test.tsx` → 7/7 green
- [x] `grep -q "await auth()" "src/app/(reader)/layout.tsx"` → PASS
- [x] `grep -q "session={userChipSession}" src/components/layout/sidebar.tsx` → PASS
- [x] No `useSession(` hook call inside src/components/layout/user-chip.tsx (only negative references in JSDoc)
- [x] Commits `9b8dc4e`, `ec49f04`, `b101258`, `dacf86f` exist in `git log --oneline -6`
- [x] Typecheck on plan-owned files (icon.tsx, user-chip.tsx, sidebar.tsx, reader-shell.tsx, layout.tsx, user-chip test files) clean — sidebar.tsx's `Property 'session' is missing` error resolved by Task 3
- [x] AUTH-06 (anonymous read unchanged) preserved — anonymous branch logic is identical to Phase 4
- [x] AUTH-08 (sign out from any page) implemented — UserChip is mounted on every (reader) page via sidebar

---
*Phase: 05-auth-user-interactions*
*Completed: 2026-04-23*
