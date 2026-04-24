---
quick: 260424-g2y
title: Wire sidebar 管理 section to real Phase 6 admin routes + role-gate
date: 2026-04-24
requirements:
  - QUICK-260424-g2y
files_modified:
  - src/components/layout/sidebar.tsx
files_created:
  - tests/unit/sidebar-admin-nav.test.tsx
commits:
  - adf0baa  # test: RED — failing tests for role-gated sidebar admin nav
  - 4b4fd9a  # feat: GREEN — role-gated admin section, real /admin hrefs
tags:
  - sidebar
  - admin-nav
  - role-gate
  - phase-6-followup
---

# Quick 260424-g2y: Wire Sidebar 管理 Section to Real /admin Routes

**One-liner:** Replaced 5 disabled Phase-4 admin stubs with 4 real NavRows pointing to `/admin/{sources,users,costs,dead-letter}` and role-gated the entire 管理 section on `session.user.role === 'admin'`.

## Why

The reader sidebar still carried the Phase 4 placeholder admin block — 5 grayed-out "即将开放" entries (信源 / 信源提报 / 策略 / 用户 / 后台) shown to every user regardless of session state. Phase 6 shipped the real admin shell (`src/components/admin/admin-nav.tsx`) and routes (`/admin/sources`, `/admin/users`, `/admin/costs`, `/admin/dead-letter`), so the stubs were both misleading (non-admins saw admin UI) and broken (disabled rows with dead tooltips). This quick closes the Phase-4-to-Phase-6 loop.

## Changes

### `src/components/layout/sidebar.tsx`

1. **`NAV_ADMIN` constant replaced** — dropped 5-item Phase 4 stub (submissions / strategies / backend removed), now 4 items with real `href` fields aligned byte-identically with `admin-nav.tsx`:
   - 信源 → `/admin/sources` (icon `globe`)
   - 用户 → `/admin/users` (icon `users`)
   - 成本 → `/admin/costs` (icon `settings`)
   - 死信 → `/admin/dead-letter` (icon `alert-circle`)
2. **Role flag derivation** — `const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';` — same cast pattern already used on the `userChipSession` branch to avoid importing a new type.
3. **Admin block wrapped in `{isAdmin && (...)}`** — `SectionLabel "管理"` + `<nav aria-label="管理导航">` are conditionally rendered. Anonymous and non-admin sessions render nothing for that region.
4. **Per-item active state** — same rule as `admin-nav.tsx`: `pathname === href || pathname.startsWith(\`${href}/\`)`, so `/admin/sources/123` still highlights 信源.
5. **Header JSDoc + NAV_ADMIN comment** updated to reference the quick ID and the Phase 6 wiring.
6. **NAV_READER untouched** — 精选 / 全部 AI 动态 / 低粉爆文 (V2 disabled) / 收藏 render byte-identically for every session state (verified by regression-guard test case).

### `tests/unit/sidebar-admin-nav.test.tsx` (new)

Vitest + `@testing-library/react` suite with 4 cases:

1. **anonymous** (`session=null`) → no 管理 label, no `/admin/*` link.
2. **non-admin** (`role: 'user'`) → no 管理 label, no `/admin/*` link.
3. **admin** (`role: 'admin'`) → 管理 label present; exactly 4 links with canonical hrefs and labels in order 信源 / 用户 / 成本 / 死信.
4. **reader-nav regression guard** — 精选 / 全部 AI 动态 / 收藏 visible for all three session states.

Mock surface: `@/server/actions/auth` (signOutAction), `next/image` (pass-through img), `next/link` (pass-through anchor so query-by-href works without a router). No `vitest.config.ts` changes needed — existing inline list (`voyageai`, `next-auth`, `@auth/core`) already resolves Sidebar's transitive imports.

## Verification

| Check | Result |
|-------|--------|
| `pnpm test --run tests/unit/sidebar-admin-nav.test.tsx` | 4/4 PASS |
| `pnpm typecheck` | zero errors |
| `pnpm lint src/components/layout/sidebar.tsx tests/unit/sidebar-admin-nav.test.tsx` | zero warnings |
| `pnpm test --run` (full) | 288/294 passing; 3 failing test files (client.test.ts, etc.) are **pre-existing** — identical failure count before our change (verified via `git stash`) |
| Grep gate `session?.user as { role?: string }` | 1 match (line 86) |
| Grep gate `role === 'admin'` | 2 matches (line 8 doc + line 86 derivation) |
| Grep gates `/admin/{sources,users,costs,dead-letter}` | all 4 match inside NAV_ADMIN |
| Grep negative: `即将开放` inside NAV_ADMIN (lines 43–49) | 0 matches |

## Deviations from Plan

None — plan executed as written. Prettier reformatted the inline `next/image` mock arrow body (`=>` paren style) during pre-commit lint-staged; no semantic change.

## STATE.md — Quick Tasks Completed line

```
| 260424-g2y | Wire sidebar 管理 section to real /admin routes (Phase 6) + role-gate on session.user.role==='admin' | 2026-04-24 | 4b4fd9a | [260424-g2y-wire-sidebar-admin-nav-to-real-admin-rou](./quick/260424-g2y-wire-sidebar-admin-nav-to-real-admin-rou/) |
```

## Self-Check: PASSED

- `src/components/layout/sidebar.tsx` — MODIFIED (verified via `git log --oneline`)
- `tests/unit/sidebar-admin-nav.test.tsx` — EXISTS
- Commit `adf0baa` — FOUND in `git log`
- Commit `4b4fd9a` — FOUND in `git log`
