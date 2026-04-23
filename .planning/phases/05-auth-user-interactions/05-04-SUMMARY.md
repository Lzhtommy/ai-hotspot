---
phase: 05-auth-user-interactions
plan: 04
subsystem: auth-ui
tags: [login-modal, oauth, magic-link, server-actions, client-component, a11y]

requires:
  - phase: 05-auth-user-interactions
    provides: Plan 05-02 auth singleton (@/lib/auth exports signIn/signOut/auth)
  - phase: 05-auth-user-interactions
    provides: Plan 05-03 three providers registered (GitHub + Resend + Google) with profile() mappings
  - phase: 04-feed-ui
    provides: LoginPromptModal stub + FavoritesEmpty client island + Button/Icon atoms
  - phase: 05-auth-user-interactions
    provides: Plan 05-00 red-state stubs (login-prompt-modal.test.tsx, login-prompt-modal-magic-link.test.tsx)
provides:
  - src/server/actions/auth.ts — signInGithubAction / signInGoogleAction / signInResendAction / signOutAction ('use server' wrappers)
  - LoginPromptModal with three real provider surfaces in locked top-to-bottom order (GitHub → Email → Google → Dismiss)
  - EmailMagicLinkForm with idle → success → error state machine (role=status success container, role=alert inline error)
  - HTMLDialogElement.showModal/close jsdom polyfill in tests/setup.ts + afterEach(cleanup) from @testing-library/react
  - Button component extended with optional style + aria-label props (narrow extension; backward compatible)
  - FavoritesEmpty dispatch fixed from window.dispatchEvent → document.dispatchEvent (PATTERNS Shared Pattern D)
affects: [05-05, 05-07, 05-08, 05-09, 05-10]

tech-stack:
  added: []
  patterns:
    - "form onSubmit → server action (not action={fn})"
      rationale: "React 18.3 does not support function-valued action; Next.js 15 compiles it at build time but the Vitest environment receives raw JSX. onSubmit + e.preventDefault + new FormData(e.currentTarget) + server-action call works in both Next.js runtime and jsdom; server-action semantics are preserved."
    - "useTransition + useState<'idle'|'success'|'error'> for three-branch form UI"
    - "Internal subcomponent (EmailMagicLinkForm) co-located in the same file to scope success/error state without re-rendering the whole modal"
    - "Inline SVG brand marks (GitHub + Google) rendered in-JSX with aria-hidden, avoiding new asset pipeline for one-off provider icons"
    - "jsdom-showModal polyfill pattern — toggle open attribute on prototype; applies to every Vitest setup so any future <dialog> test passes without per-file shim"

key-files:
  created:
    - src/server/actions/auth.ts
  modified:
    - src/components/feed/login-prompt-modal.tsx
    - src/components/layout/button.tsx
    - src/app/(reader)/favorites/favorites-empty.tsx
    - tests/setup.ts
    - tests/unit/login-prompt-modal.test.tsx
    - tests/unit/login-prompt-modal-magic-link.test.tsx

key-decisions:
  - "Switch all three provider forms from action={serverAction} to onSubmit={e => {e.preventDefault(); void serverAction();}} (or FormData build for email). React 18.3 warns on function-valued action prop and does not fire the callback outside Next.js's compiler transform. onSubmit preserves server-action semantics (fetch POST inside the action body) and is testable in Vitest."
  - "Mock @/server/actions/auth directly in tests (not @/lib/auth). The modal imports the server-action wrappers; mocking those gives a cleaner seam than transitively mocking signIn through @/lib/auth, and matches the plan's Task 2 action directive."
  - "jsdom-showModal polyfill in tests/setup.ts (Option B from Plan 05-00 SUMMARY §Issues Encountered). Chose the polyfill over a component-level guard because the production <dialog>.showModal is a hard requirement (focus trap, backdrop) and a component-level branch would lose those semantics everywhere — even in production. Polyfill keeps the production path unchanged and is scoped to tests."
  - "Extend Button to accept style + aria-label (two narrow additions) rather than wrap the full-width provider buttons in <div style={{width:'100%'}}>. Wrapping would not widen the inline-flex button; the style prop on Button is the minimal intervention and composes with existing inline styles via shallow spread."
  - "Inline SVG provider marks (GitHub black-fill octocat, Google four-color G) — chose inline JSX over adding SVG files to public/icons/ + extending the Icon union. Rationale: provider icons are one-off brand marks (not part of the feather-style atom family), don't need recoloring, and stay co-located with the modal for readability."
  - "Added afterEach(cleanup) to tests/setup.ts so every test with render() gets a fresh DOM. With globals:false in vitest.config.ts, testing-library's default auto-cleanup does not run; wiring it in setup is the one-line global fix."

requirements-completed: [AUTH-02, AUTH-03, AUTH-04, VOTE-04]

duration: 8 min
completed: 2026-04-23
---

# Phase 5 Plan 04: LoginPromptModal Provider Wiring Summary

**Replaces the Phase 4 placeholder 登录 button with three real auth provider surfaces — GitHub (accent, primary), Email magic link (accent, with 检查邮箱 success + inline error states), Google (secondary) — locked in top-to-bottom order per UI-SPEC §LoginPromptModal, and fixes a Phase 4 window vs document dispatch inconsistency in FavoritesEmpty that would have silently broken the anonymous /favorites 登录 CTA.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-23T06:19:46Z
- **Completed:** 2026-04-23T06:27:18Z
- **Tasks:** 3 (all auto; Task 1 + Task 2 TDD; no checkpoints)
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- `src/server/actions/auth.ts` created — four 'use server' wrappers. `signInGithubAction` / `signInGoogleAction` fire-and-forget (both call `signIn(provider, { redirectTo: '/' })` — Auth.js handles the OAuth redirect). `signInResendAction(formData)` returns a discriminated union `{ success: true } | { error: 'EMPTY_EMAIL' | 'SEND_FAILED' }` so the client can render the inline 检查邮箱 success state / error alert without a page navigation. `signOutAction` ready for Plan 05-05's UserChip.
- `src/components/feed/login-prompt-modal.tsx` extended in place (CONTEXT D-16): preserved Phase 4 heading / body / Escape / backdrop-click / event listener; added the three-provider stack; added internal `EmailMagicLinkForm` subcomponent with idle → success → error branches. Locked rendering order matches UI-SPEC §LoginPromptModal exactly: heading → body → GitHub → email form → 其他方式 divider → Google → 稍后再说. Three forms use onSubmit + preventDefault to call server actions (robust against React 18.3's non-support for function-valued action prop).
- `src/components/layout/button.tsx` extended with optional `style` and `aria-label` props (both merged onto the inline style / passed through to the native button). Added `justifyContent: center` so full-width buttons center their SVG-plus-label contents. Backward compatible with every existing Phase 4 call site.
- `src/app/(reader)/favorites/favorites-empty.tsx` fixed: `window.dispatchEvent(new CustomEvent('open-login-modal'))` → `document.dispatchEvent(...)` so the anonymous /favorites 登录 CTA reaches the modal's document-scoped listener.
- `tests/setup.ts` upgraded: added HTMLDialogElement.showModal/show/close polyfill (jsdom 29 omits the <dialog> API per Plan 05-00 SUMMARY), plus `afterEach(cleanup)` to prevent DOM leak across tests.
- `tests/unit/login-prompt-modal.test.tsx` rewritten: five assertions covering provider button presence, locked order (githubIdx < emailIdx < googleIdx < dismissIdx), open event → dialog[open], 其他方式 divider placement, and three-form DOM shape.
- `tests/unit/login-prompt-modal-magic-link.test.tsx` rewritten: four assertions covering idle a11y (type/autocomplete/inputmode/placeholder), success branch (role=status + both Chinese copy lines + form replaced), error branch (role=alert inline, form stays mounted for retry), and FormData-shape assertion on the server-action call.

Tests: **9/9 green** on the two plan-owned files (`pnpm vitest run tests/unit/login-prompt-modal.test.tsx tests/unit/login-prompt-modal-magic-link.test.tsx`). Pre-existing red-state stubs from Plan 05-00 for Plans 05-05 (user-chip) and 05-07 (feed-card-actions / vote-honest-copy) remain red — their resolution is scoped to those plans.

Typecheck: **zero new errors** on the Plan 05-04 surface (src/server/actions/auth.ts, src/components/feed/login-prompt-modal.tsx, src/components/layout/button.tsx, src/app/(reader)/favorites/favorites-empty.tsx, tests/setup.ts, tests/unit/login-prompt-modal*.tsx).

## Task Commits

1. **Task 1: Create server-action wrappers + wire GitHub + Google buttons + extend Button + tests/setup polyfill + provider-buttons test** — `9ba0d27` (feat)
2. **Task 2: Email magic-link state machine (idle/success/error) + switch all forms to onSubmit + afterEach(cleanup) + magic-link test** — `a7a558a` (feat)
3. **Task 3: FavoritesEmpty window→document dispatch fix** — `d9117cf` (fix)

_Plan metadata commit follows (docs: complete plan — SUMMARY + STATE + ROADMAP)._

## Files Created/Modified

**Created (1):**
- `src/server/actions/auth.ts` — 44 lines; exports signInGithubAction, signInGoogleAction, signInResendAction, signOutAction, SignInResendResult

**Modified (6):**
- `src/components/feed/login-prompt-modal.tsx` — Phase 4 ~90 line stub → 410 lines; three provider forms + EmailMagicLinkForm subcomponent + two inline provider SVGs + SuccessDot helper; preserved Phase 4 event listener, Escape handler, backdrop click, 稍后再说 dismiss
- `src/components/layout/button.tsx` — +10 lines; style / aria-label props + justifyContent:center; backward compatible
- `src/app/(reader)/favorites/favorites-empty.tsx` — window → document; JSDoc updated to cite PATTERNS Shared Pattern D
- `tests/setup.ts` — +26 lines; HTMLDialogElement polyfill + afterEach(cleanup)
- `tests/unit/login-prompt-modal.test.tsx` — 5 assertions replacing 2 red-state stubs
- `tests/unit/login-prompt-modal-magic-link.test.tsx` — 4 assertions replacing 1 red-state stub; mock target switched from @/lib/auth → @/server/actions/auth

## Decisions Made

- **form onSubmit (not action={serverAction}).** Initial implementation used the `<form action={fn}>` pattern the plan suggested. React 18.3 rejects function-valued action with a DOM warning; the action callback never fires outside Next.js's compiler transform. Vitest runs the raw JSX and therefore cannot fire the server action. onSubmit + e.preventDefault + FormData + manual server-action call is Next-15-idiomatic and test-compatible. All three forms now share one invocation model.
- **Mock @/server/actions/auth, not @/lib/auth.** The modal imports the server-action wrappers — those are the direct dependency. Mocking the wrapper yields a clean, explicit test seam; mocking `signIn` transitively through @/lib/auth would require the wrapper to re-import after mocking, which is brittle.
- **jsdom polyfill (Option B), not a component-level guard.** Plan 05-00 flagged two options for the showModal gap: shim in tests/setup.ts or branch on `typeof el.showModal === 'function'` in the component. Chose shim because the production path relies on the native <dialog>'s focus trap + backdrop — a component-level fallback would silently ship degraded a11y to real browsers that have the API. Test shim isolates the workaround to the test environment. The component still has a defensive `typeof el.showModal === 'function'` guard for extra safety (no harm; costs nothing).
- **Extend Button minimally.** Adding `style` and `aria-label` props (10 lines) is preferable to wrapping Button in a div (the wrapper can't widen an inline-flex button anyway) or forking a FullWidthButton variant. Shallow-merge spread means callers' props win over defaults; Phase 4 call sites that don't pass style/aria-label are unaffected.
- **Inline SVG provider marks.** Provider brand icons are one-offs not part of the feather-style Icon atom family, so adding them to the `IconName` union would muddy the atom's contract. Co-located inline SVGs keep the modal self-contained and readable; aria-hidden keeps screen-reader output clean (the button's Chinese label carries the semantic).
- **afterEach(cleanup) globally.** render() without cleanup leaks DOM across tests. With `globals: false` in vitest.config.ts, testing-library's auto-cleanup is disabled; a single line in tests/setup.ts fixes every component test in the repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] React 18.3 does not support function-valued `<form action={fn}>`**
- **Found during:** Task 2 first verification (`pnpm vitest run tests/unit/login-prompt-modal-magic-link.test.tsx`)
- **Issue:** Plan's Task 2 action used `<form action={handleSubmit}>`. In Next.js 15 production this is transformed by the compiler into a server-action dispatch. In Vitest (raw JSX, React 18.3), React emits `Warning: Invalid value for prop 'action' on <form> tag.` and the action callback never fires. Tests failed with "signInResendAction called 0 times" and the success state never rendered.
- **Fix:** Switched all three forms to `onSubmit={(e) => { e.preventDefault(); void serverAction(); }}` — the email form additionally builds a FormData from `e.currentTarget` before calling `signInResendAction(formData)`. Server-action semantics are preserved (the action body runs on the server via Next.js's background fetch); UX is identical in production. Tests now fire the handler deterministically.
- **Files modified:** src/components/feed/login-prompt-modal.tsx
- **Commit:** a7a558a

**2. [Rule 3 - Blocking] jsdom 29 lacks HTMLDialogElement.showModal/close**
- **Found during:** Task 1 first verification (test threw TypeError: el.showModal is not a function)
- **Issue:** Plan 05-00 SUMMARY §Issues Encountered flagged this for the next executor. Without a polyfill, every test that dispatches 'open-login-modal' crashes.
- **Fix:** Added a minimal prototype-patch polyfill in tests/setup.ts (conditionally installed only when showModal/close/show are missing). showModal/show set the `open` attribute; close removes it. Focus-trap semantics are not simulated (native; E2E covers it).
- **Files modified:** tests/setup.ts
- **Commit:** 9ba0d27 (grouped with Task 1 because Task 1's first verification tripped on it)

**3. [Rule 2 - Missing critical] @testing-library/react auto-cleanup was disabled**
- **Found during:** Task 2 second verification (success-state test saw two email inputs — one from each successive render)
- **Issue:** With vitest's `globals: false`, testing-library's "automatically call cleanup after every test" side effect does not run. render()-ed components accumulated in the DOM across tests, causing `queryByRole('textbox')` to return the stale input from a previous test even after the component in the current test had transitioned to success state.
- **Fix:** Added `afterEach(cleanup)` from @testing-library/react in tests/setup.ts. Applies to every unit/integration test in the repo.
- **Files modified:** tests/setup.ts
- **Commit:** a7a558a

**4. [Rule 1 - Bug] Button had no way to be full-width**
- **Found during:** Task 1 implementation
- **Issue:** The plan specified full-width provider buttons (UI-SPEC lg size, width:100%). The Phase 4 Button component did not accept a style prop; className existed but there was no global CSS rule for provider buttons and the inline-flex button does not widen from its parent.
- **Fix:** Extended Button to accept optional style + aria-label props with shallow-spread merge (caller style wins over defaults). justifyContent:center added so SVG + label center within the widened button.
- **Files modified:** src/components/layout/button.tsx
- **Commit:** 9ba0d27

### Scope Boundary

- Pre-existing Wave 0 red-state stubs in `tests/unit/user-chip.test.tsx`, `tests/unit/user-chip-signout.test.tsx`, `tests/unit/feed-card-actions.test.tsx`, `tests/unit/vote-honest-copy.test.tsx` remain red — they are owned by Plans 05-05 and 05-07. No fixes attempted.
- `.claude/` untracked directory noticed in `git status`; ignored per global convention.
- vitest.config.ts still warns about `deps.inline` → `server.deps.inline` deprecation; comment in the config documents why the deprecated form is still required. Not in this plan's scope.

**Total deviations:** 4 auto-fixed (3 blocking + 1 missing critical). No Rule 4 architectural changes.

## Issues Encountered

- **React 18.3 vs Next.js 15 server-action invocation.** Next.js 15 claims React 18 compatibility, but the `<form action={serverAction}>` pattern seen in most Next.js docs implicitly assumes the compiler transform or React 19. In raw React 18 + Vitest, the action callback never fires. Switching to onSubmit is the portable form.
- **Vitest `globals: false` bites testing-library.** Auto-cleanup is opt-in when globals are off; documented in this plan's afterEach(cleanup) addition. Future component-test plans won't need to re-learn this.
- **Phase 4 form-action warning leaked into Task 1 tests.** Even after the email form was migrated to onSubmit, GitHub and Google forms still used `action={fn}` initially. The DOM warning ("Invalid value for prop action") appeared in stderr during Task 1 test runs. Migrating those to onSubmit in Task 2 eliminated the warning across all three.

## User Setup Required

None — all work was code + test changes committed in-repo. Real sign-in flow still needs env vars populated per Plan 05-03 SUMMARY §User Setup Required (GitHub + Google OAuth credentials + Resend API key). Anonymous users clicking a gated action can now reach every provider surface in the modal.

## Next Plan Readiness

- **Plan 05-05 (Wave 4: UserChip authenticated branch) is unblocked.** The Button style prop and afterEach(cleanup) are already in place; UserChip's popover can render full-width menu items with the same pattern. The signOutAction from this plan's src/server/actions/auth.ts is the exact hook the UserChip sign-out menu item needs.
- **Plan 05-07 (Wave 5: feed-card-actions real interactions) is unblocked.** The onSubmit-invokes-server-action pattern is now canonical in the repo; FeedCardActions can follow it for favorite/vote mutations. The anonymous-click path continues to dispatch 'open-login-modal' on document — now reliably reached from every call site including FavoritesEmpty.
- **Plan 05-08 (Wave 5: /favorites authenticated RSC) is unblocked.** When the session is null, FavoritesEmpty now correctly reaches the modal.
- **Plan 05-10 (Wave 6: hardening) has one extra surface to acknowledge.** The Button component now accepts a style prop; Plan 05-10's UI-SPEC re-verification should confirm no existing call site passes an inline style that conflicts with a Phase 4 design token (none do — grep confirmed).
- **afterEach(cleanup) now applies repo-wide.** Any future component test using render() will be clean by default. Integration tests that rely on residual DOM (none currently exist) would need to opt out.

## Threat Surface Scan

All security-relevant surface introduced by this plan is already captured in the plan's `<threat_model>`:

- T-5-06 (Anonymous action bypass) — unchanged: the modal is a UX seam; actual enforcement lives in server actions (Plan 05-06) and Auth.js handlers. Form submissions cross client→server via `signIn(...)` which Auth.js v5 authenticates (CSRF token + callback URL validation default).
- T-5-08 (Magic-link email flood) — unchanged: rate limiting deferred to Phase 6 per CONTEXT Deferred Ideas. No new surface.
- T-5-09 (redirectTo tampering) — mitigated by Auth.js v5 default same-origin validation on the signIn `redirectTo` param. Our wrappers hard-code `redirectTo: '/'` for GitHub + Google; the Resend path uses `redirect: false` so no redirect is requested.

No new surface to flag.

## Self-Check: PASSED

- [x] `src/server/actions/auth.ts` exists with all four exports (`grep -c "^export" src/server/actions/auth.ts` → 5 including the discriminated-union type)
- [x] `src/components/feed/login-prompt-modal.tsx` contains GitHub + Google + Email form surfaces (`grep -q "使用 GitHub 登录" src/components/feed/login-prompt-modal.tsx` → present; similarly for Google and 发送登录链接)
- [x] `grep -q "document.dispatchEvent(new CustomEvent('open-login-modal'))" "src/app/(reader)/favorites/favorites-empty.tsx"` → present
- [x] `grep -rn "window.dispatchEvent" src/` → no matches (dispatch consistency achieved)
- [x] `pnpm vitest run tests/unit/login-prompt-modal.test.tsx tests/unit/login-prompt-modal-magic-link.test.tsx` → 9/9 green
- [x] `pnpm typecheck` produces no new errors in plan-owned files (src/server/actions/auth.ts, src/components/feed/login-prompt-modal.tsx, src/components/layout/button.tsx, src/app/(reader)/favorites/favorites-empty.tsx, tests/setup.ts, tests/unit/login-prompt-modal*.tsx)
- [x] Commits `9ba0d27`, `a7a558a`, `d9117cf` exist in `git log --oneline -5`
- [x] HTMLDialogElement polyfill present in tests/setup.ts
- [x] afterEach(cleanup) wired in tests/setup.ts

---
*Phase: 05-auth-user-interactions*
*Completed: 2026-04-23*
