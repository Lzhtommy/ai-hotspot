---
phase: quick-260425-kg7
plan: 01
subsystem: feed-ui
tags:
  - phase-5
  - ux-fix
  - anonymous-flow
  - login-modal
  - quick-task
requirements:
  - QUICK-260425-kg7
provides:
  - "FeedTabs anonymous 收藏 tab → button + open-login-modal CustomEvent"
  - "FeedTopBar.isAuthenticated prop forwarded to FeedTabs"
  - "Three reader pages thread session.isAuthenticated through to FeedTopBar"
requires:
  - "Phase 4 D-26 seam: LoginPromptModal listens on document for 'open-login-modal'"
  - "Phase 5 Plan 05-08: server-side redirect('/') in /favorites for unauth users"
affects:
  - src/components/feed/feed-tabs.tsx
  - src/components/feed/feed-top-bar.tsx
  - src/app/(reader)/page.tsx
  - src/app/(reader)/all/page.tsx
  - src/app/(reader)/favorites/page.tsx
  - tests/unit/feed-tabs.test.tsx
tech_stack_added: []
patterns:
  - "Anonymous-default-safe boolean prop (default false) — RSC parents that haven't been updated still render the safer modal-prompt path rather than the broken redirect-bounce"
  - "Mirror feed-card-actions D-26 seam — same CustomEvent name, same document target — keeps anonymous UX uniform across all auth-gated entry points"
  - "Shared inline tabStyle const in render map — prevents button vs Link style drift"
key_files_created:
  - tests/unit/feed-tabs.test.tsx
key_files_modified:
  - src/components/feed/feed-tabs.tsx
  - src/components/feed/feed-top-bar.tsx
  - src/app/(reader)/page.tsx
  - src/app/(reader)/all/page.tsx
  - src/app/(reader)/favorites/page.tsx
decisions:
  - "FeedTabs upgraded RSC → Client Component ('use client'). Tradeoff acknowledged: a tiny client-bundle delta (one component, no extra deps) in exchange for inline event-dispatch handling. RSC parents calling FeedTopBar are unaffected — Next.js App Router happily imports client components from RSC."
  - "isAuthenticated default = false (anonymous-safe). If a future caller forgets to wire the prop, the worst case is rendering the modal path — never the broken redirect-bounce."
  - "Server redirect('/') in /favorites kept as deep-link fallback. The tab fix is purely a UX refinement; the redirect remains the security/auth boundary."
  - "Component duplicates `openLoginModal()` helper from feed-card-actions.tsx — intentionally kept self-contained so feed-tabs has no extra import surface, and the D-26 seam is documented in both consumers."
metrics:
  completed: "2026-04-25"
  duration: 8min
  tasks_completed: 2
  files_modified: 5
  files_created: 1
  commits:
    - "1c5d583  test(quick-260425-kg7-01): add failing tests for FeedTabs anonymous favorites tab"
    - "0e1dfcf  feat(quick-260425-kg7-01): unify anonymous favorites tab with card-star D-26 seam"
    - "2eb8023  feat(quick-260425-kg7-02): thread isAuthenticated from reader pages through FeedTopBar to FeedTabs"
---

# Quick Task 260425-kg7: Favorites Tab Anonymous Login Modal Unification — Summary

**One-liner:** Anonymous click on top-bar 收藏 tab now opens the existing LoginPromptModal in place (mirroring the card-star D-26 seam) instead of navigating to /favorites and being server-redirected back to /.

## What Changed

The feed top-bar's 收藏 tab was the last anonymous-flow entry point that produced a redirect-bounce: an unauthenticated user clicked the tab, the server `redirect('/')` in `/favorites` immediately threw them back to the featured page, and they had no clue why. Every other anonymous-gated action on the page (card star, vote, etc.) already opens `LoginPromptModal` via the Phase 4 D-26 seam — `document.dispatchEvent(new CustomEvent('open-login-modal'))`, which the modal mounted in `(reader)/layout.tsx` listens for. This task aligns the tab with that same pattern.

## Implementation

**FeedTabs (`src/components/feed/feed-tabs.tsx`)**
- Upgraded to a Client Component (`'use client'`).
- Added optional prop `isAuthenticated?: boolean` (default `false` — anonymous-safe fallback).
- 收藏 tab renders as a `<button type="button">` that calls `openLoginModal()` when `isAuthenticated !== true`; renders as the original `<Link href="/favorites">` otherwise.
- Shared inline `tabStyle` const used by both branches so visuals (`borderBottom`, `color`, `aria-current="page"`) cannot drift.
- 精选 / 全部动态 always remain Links — only 收藏 swaps.

**FeedTopBar (`src/components/feed/feed-top-bar.tsx`)**
- `FeedTopBarProps` gained `isAuthenticated?: boolean` (default `false`).
- Forwards the prop to `<FeedTabs/>` unchanged.

**Reader pages**
- `(reader)/page.tsx` (精选) and `(reader)/all/page.tsx`: reused the existing `isAuthenticated` boolean already derived from `auth()` and threaded it into `<FeedTopBar/>`.
- `(reader)/favorites/page.tsx`: passes `isAuthenticated={true}` literally — by the time the page renders, the server redirect has already excluded anonymous users.

**Test coverage (`tests/unit/feed-tabs.test.tsx`, new)**
- 6 cases covering: button-vs-link rendering by branch, `href` absence in button branch, `open-login-modal` dispatch via spy, default-anonymous semantics when prop is omitted, `aria-current="page"` preserved across both branches, and 精选/全部动态 unchanged.

## Anonymous Behaviour Unification Rationale

Before this change, the page presented two different responses to anonymous interaction:
- Card star → modal opens in place (good: same URL, undismissed scroll position).
- Tab 收藏 → redirect-bounce (bad: full navigation cycle, no signal what happened).

After: both paths emit the same `open-login-modal` CustomEvent on `document`, handled by the same `LoginPromptModal` instance mounted at the layout level. There is exactly one anonymous prompt surface in the reader, and every gated entry point uses it.

## /favorites Server Redirect Retained

The `redirect('/')` in `(reader)/favorites/page.tsx` is **untouched**. It remains the authoritative auth boundary for the route — the tab fix is a UX refinement layered on top, not a replacement. Users who paste `/favorites` directly into the URL bar (deep-link, bookmark, share) still hit the redirect. The visible tab simply no longer triggers that path under normal navigation.

## Test Coverage Notes

- Anonymous branch queried via `screen.getByRole('button', { name: /收藏/ })` — confirms the tag swap.
- Authenticated branch queried via `screen.getByRole('link', { name: /收藏/ })` plus `getAttribute('href') === '/favorites'`.
- Event-dispatch verified with a `vi.fn()` spy attached via `document.addEventListener('open-login-modal', spy)` and torn down in `afterEach` to prevent cross-test leakage.
- 精选 / 全部动态 explicitly asserted as Links in both branches — guards against accidental over-broad refactors.

## Verification

- `pnpm vitest run tests/unit/feed-tabs.test.tsx` → 6/6 pass.
- `pnpm vitest run tests/unit` → 137/137 pass across 27 files (no regressions in LoginPromptModal, FeedCardActions, UserChip, sidebar-admin-nav, etc.).
- `pnpm tsc --noEmit` → clean.

## Out-of-Scope Pre-existing Failures (Deferred)

Five test files in `src/lib/llm/` and `src/trigger/` fail outside this task's scope (Voyage embedding rate-limit timing, Anthropic env-key resolution, etc.). Confirmed pre-existing by running the same files against the unmodified working tree. Documented in `.planning/STATE.md` Deferred Items as ongoing v1.0 doc/tooling debt; not introduced by this task.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed in the planned commit shape (RED → GREEN for Task 1, single feat commit for Task 2).

## Self-Check: PASSED

- File `tests/unit/feed-tabs.test.tsx` — FOUND
- File `src/components/feed/feed-tabs.tsx` — FOUND (modified)
- File `src/components/feed/feed-top-bar.tsx` — FOUND (modified)
- File `src/app/(reader)/page.tsx` — FOUND (modified)
- File `src/app/(reader)/all/page.tsx` — FOUND (modified)
- File `src/app/(reader)/favorites/page.tsx` — FOUND (modified)
- Commit 1c5d583 (RED tests) — FOUND
- Commit 0e1dfcf (GREEN feat for Task 1) — FOUND
- Commit 2eb8023 (Task 2 wire-through) — FOUND
