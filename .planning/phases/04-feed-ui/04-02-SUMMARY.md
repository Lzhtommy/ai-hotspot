---
phase: 04-feed-ui
plan: 02
subsystem: ui
tags: [rsc, layout, sidebar, feed-top-bar, feed-tabs, empty-state, mobile-drawer, pipeline-status]

# Dependency graph
requires: [04-01]
provides:
  - 224px desktop sidebar shell (RSC) with brand chip, search stub, reader/admin navs
  - SidebarMobileDrawer Client wrapper with SidebarDrawerContext for mobile toggle
  - PipelineStatusCard RSC with live sources COUNT + MAX(last_fetched_at) query
  - UserChip Client component dispatching open-login-modal custom event
  - NavRow RSC with disabled/active/V2-chip states
  - SectionLabel RSC for 动态 / 管理 headers
  - FeedTopBar RSC with view H1, subtitle, FeedTabs, action buttons
  - FeedTabs RSC with pathname-derived active state and aria-current
  - EmptyState RSC with href or onClick CTA (consumed by pages, not-found)
affects: [04-03, 04-04, 04-05, 04-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RSC-first: only UserChip and SidebarMobileDrawer have 'use client'
    - PipelineStatusCard uses drizzle sql`` template with try/catch error guard (T-04-02-01)
    - SidebarDrawerContext exposes { isOpen, toggle, close } for FeedTopBar hamburger
    - EmptyState accepts href XOR onClick CTA — onClick consumers need a Client boundary

key-files:
  created:
    - src/components/layout/nav-row.tsx
    - src/components/layout/section-label.tsx
    - src/components/layout/pipeline-status-card.tsx
    - src/components/layout/user-chip.tsx
    - src/components/layout/sidebar.tsx
    - src/components/layout/sidebar-mobile-drawer.tsx
    - src/components/feed/feed-top-bar.tsx
    - src/components/feed/feed-tabs.tsx
    - src/components/feed/empty-state.tsx
  modified: []

key-decisions:
  - "NavRow uses CSS :hover via nav-row-hover class + style object for active — no JS hover state (RSC safe)"
  - "SidebarMobileDrawer owns isOpen state; auto-closes on pathname change via usePathname effect"
  - "PipelineStatusCard wraps query in try/catch logging only error.message (T-04-02-01 compliance)"
  - "Sidebar is async RSC to await PipelineStatusCard's DB query inline"
  - "EmptyState onClick CTA path documented: consumers must provide Client boundary when handler is passed"

requirements-completed: [FEED-06, FEED-07]

# Metrics
duration: ~4min
completed: 2026-04-22
---

# Phase 4 Plan 02: Layout Shell Summary

**224px desktop sidebar RSC + mobile drawer client wrapper + PipelineStatusCard live DB query + UserChip + FeedTopBar + FeedTabs + EmptyState — all 9 shell components matching UI-SPEC pixel-exact with correct Chinese copy**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-22T06:25:11Z
- **Completed:** 2026-04-22T06:29:18Z
- **Tasks:** 2
- **Files created:** 9

## Accomplishments

- Built complete 224px sidebar RSC with brand chip (amber flame SVG), search stub (disabled + ⌘K kbd), reader/admin nav sections, PipelineStatusCard, and UserChip
- PipelineStatusCard performs a live RSC Drizzle `sql` query (COUNT FILTER + MAX) on the sources table with error guard that logs only `error.message` (T-04-02-01 security requirement)
- SidebarMobileDrawer provides `SidebarDrawerContext` with `{ isOpen, toggle, close }` for FeedTopBar hamburger integration; auto-closes on route change via `usePathname`
- UserChip dispatches `open-login-modal` custom event for LoginPromptModal (Plan 04) without any state
- FeedTopBar renders sticky top bar with correct H1/subtitle copy per view (精选/全部 AI 动态/收藏), disabled 导出/手动同步 with "Phase 6 开放" title, enabled 过滤 only on view==='all'
- FeedTabs uses `next/link` with pathname-derived active state + `aria-current="page"` for accessibility
- EmptyState centered layout with optional href (Link-wrapped) or onClick CTA

## Task Commits

1. **Task 1: NavRow, SectionLabel, PipelineStatusCard, UserChip, Sidebar, SidebarMobileDrawer** - `70f1f41` (feat)
2. **Task 2: FeedTabs, FeedTopBar, EmptyState** - `9d06d95` (feat)

## Files Created

### `src/components/layout/`
- `nav-row.tsx` — RSC 30px nav row with icon, label, V2 chip, badge count, disabled/active states
- `section-label.tsx` — RSC 10px uppercase tracked header for 动态 / 管理 sections
- `pipeline-status-card.tsx` — RSC live DB query; error-guarded; displays N 个信源 · 上次同步 M 分钟前
- `user-chip.tsx` — Client component; ghost Button dispatching `open-login-modal` custom DOM event
- `sidebar.tsx` — Async RSC 224px shell; brand chip + search stub + nav loops + PipelineStatusCard + UserChip
- `sidebar-mobile-drawer.tsx` — Client wrapper; SidebarDrawerContext; auto-close on pathname; backdrop overlay

### `src/components/feed/`
- `feed-tabs.tsx` — RSC 3-tab nav; pathname-derived active tab; aria-current; next/link navigation
- `feed-top-bar.tsx` — RSC sticky top bar; correct H1 per view; disabled action buttons with tooltips
- `empty-state.tsx` — RSC centered layout; href XOR onClick CTA; max-width 480px; 96px padding

## Decisions Made

- **NavRow hover**: CSS :hover class (not JS state) — keeps NavRow as RSC; Link component preserves routing semantics
- **Sidebar async**: Sidebar is `async function` to await PipelineStatusCard (which does an RSC DB query inline); this is the idiomatic RSC pattern — the parent component `await`s the child's async render
- **SidebarDrawerContext design**: Context provides `toggle()` so FeedTopBar's hamburger (Plan 05) doesn't need prop drilling through the layout
- **EmptyState onClick boundary**: documented in JSDoc — consumers passing onClick must render inside a Client boundary; the /favorites page (Plan 05) will use a client wrapper dispatching `open-login-modal` event

## Deviations from Plan

None — plan executed exactly as written. All 9 component files created with correct RSC/Client split, copy, and DB query pattern.

## Known Stubs

None — all components are fully implemented. PipelineStatusCard's `68%` progress bar fill is a visual constant from the design (sidebar.jsx line 262), not a calculated value. This is correct behavior per the design — the bar represents a decorative progress indicator, not a real percentage. No data-blocking stubs.

## Threat Flags

None. PipelineStatusCard queries the `sources` table server-side with no user input. Error handling logs only `error.message` (T-04-02-01 mitigated). All nav copy is hardcoded constants with no XSS surface (T-04-02-02 accepted). Disabled search input has no form submission path (T-04-02-03 mitigated).

---
*Phase: 04-feed-ui*
*Completed: 2026-04-22*

## Self-Check: PASSED

Files verified:
- `src/components/layout/nav-row.tsx` — FOUND
- `src/components/layout/section-label.tsx` — FOUND
- `src/components/layout/pipeline-status-card.tsx` — FOUND
- `src/components/layout/user-chip.tsx` — FOUND
- `src/components/layout/sidebar.tsx` — FOUND
- `src/components/layout/sidebar-mobile-drawer.tsx` — FOUND
- `src/components/feed/feed-tabs.tsx` — FOUND
- `src/components/feed/feed-top-bar.tsx` — FOUND
- `src/components/feed/empty-state.tsx` — FOUND

Commits verified:
- `70f1f41` — FOUND in git log
- `9d06d95` — FOUND in git log
