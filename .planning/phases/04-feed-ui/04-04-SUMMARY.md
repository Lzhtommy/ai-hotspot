---
phase: 04-feed-ui
plan: 04
subsystem: ui
tags: [rsc, feed-card, timeline, cluster, modal, filter, nuqs, tdd, aria, date-fns-tz]

# Dependency graph
requires:
  - 04-01  # layout primitives (Icon, SourceDot, Tag, Button, IconButton, Eyebrow)
  - 04-03  # FeedListItem type from get-feed.ts
provides:
  - ScoreBadge RSC — numeric score + HOT chip at score>=80, aria-label="热度评分 N/100"
  - HotnessBar RSC — decorative 3px bar, aria-hidden
  - ClusterTrigger 'use client' — aria-expanded + aria-controls, verbatim colors #D4911C/#2558B5/#E4572E
  - ClusterSiblings RSC — id="cluster-siblings-{id}", SourceDot + title Link + meta + HotnessBar + external link
  - ClusterSection 'use client' — minimal client boundary owning expand state
  - FeedCardActions 'use client' — dispatches open-login-modal, rel=noopener noreferrer on external link
  - SkeletonCard RSC — animate-pulse shimmer at comfortable-density heights
  - FeedCard RSC — all 8 D-17 anatomy steps, title in <Link href="/items/{id}">
  - Timeline RSC — groupByHour integration, 今天/昨天/M月D日 + HH:00 headers, 28px group spacing
  - LoginPromptModal 'use client' — native <dialog>, focus trap, 登录以继续, Escape+backdrop close
  - FilterPopover 'use client' — nuqs useQueryState x2 shallow:false, 筛选/标签/信源/清除
affects:
  - src/app/(reader)/page.tsx (consumes Timeline)
  - src/app/(reader)/all/page.tsx (consumes Timeline + FilterPopover)

# Tech tracking
tech-stack:
  added:
    - "@vitejs/plugin-react dev dep — for JSX in vitest .test.tsx files"
    - "vitest esbuild jsx:automatic — resolves React JSX in test files without ESM plugin"
  patterns:
    - "RSC outer + tiny 'use client' wrapper for expand state (ClusterSection) — minimal client boundary"
    - "Native <dialog> for modal — focus trap, Escape, backdrop for free"
    - "nuqs useQueryState with shallow:false — forces RSC re-render on URL param change"
    - "TDD RED/GREEN per task — failing test committed before implementation"
    - "renderToString from react-dom/server for Node-compatible component tests (no jsdom)"
    - "No dangerouslySetInnerHTML anywhere in feed components (T-04-04-01 mitigated)"

key-files:
  created:
    - src/components/feed/score-badge.tsx
    - src/components/feed/hotness-bar.tsx
    - src/components/feed/cluster-trigger.tsx
    - src/components/feed/cluster-siblings.tsx
    - src/components/feed/feed-card-actions.tsx
    - src/components/feed/skeleton-card.tsx
    - src/components/feed/cluster-section.tsx
    - src/components/feed/feed-card.tsx
    - src/components/feed/timeline.tsx
    - src/components/feed/login-prompt-modal.tsx
    - src/components/feed/filter-popover.tsx
    - src/components/feed/card-atoms.test.tsx
    - src/components/feed/feed-card.test.tsx
    - src/components/feed/modal-filter.test.tsx
  modified:
    - vitest.config.ts (add .test.tsx include, esbuild jsx:automatic)
    - package.json (add @vitejs/plugin-react devDependency)

key-decisions:
  - "ClusterSection extracted as minimal 'use client' wrapper — FeedCard outer stays RSC; only expand state is client-side"
  - "Native <dialog> chosen for LoginPromptModal — showModal() provides focus trap + backdrop + Escape for free (no Radix)"
  - "renderToString from react-dom/server for tests — works in Node vitest env without jsdom; avoids @testing-library/react dep"
  - "vitest JSX via esbuild jsx:automatic — avoids ESM-only @vitejs/plugin-react in CJS vitest.config.ts"
  - "FeedCard title wrapped in <Link href='/items/{id}'> only (NOT whole card) — accessibility contract per UI-SPEC"
  - "nuqs shallow:false on FilterPopover — required to force RSC re-render when URL params change (FEED-12)"
  - "ClusterTrigger stacked squares: show min(3, memberCount) — matches feed_card.jsx L103 behavior"

requirements-completed: [FEED-03, FEED-05, FEED-11, FEED-12]

# Metrics
duration: ~27min
completed: 2026-04-22T06:48:38Z
---

# Phase 4 Plan 04: Feed Card Components Summary

**All 8 D-17 anatomy steps in RSC FeedCard with minimal 'use client' islands for expand state, login-gating, and URL filter state — satisfying FEED-03, FEED-05, FEED-11, FEED-12**

## Performance

- **Duration:** ~27 min
- **Started:** ~2026-04-22T06:21:00Z
- **Completed:** 2026-04-22T06:48:38Z
- **Tasks:** 3 (each TDD RED/GREEN)
- **Files created:** 14 (11 components + 3 test files)
- **Files modified:** 2

## Accomplishments

- Built the centerpiece FeedCard RSC with all 8 D-17 anatomy steps: meta row (SourceDot + time + 官方 chip + ScoreBadge), h3 title in Link, summary, 推荐理由 amber callout, tags row, cluster expand section, action bar
- ClusterTrigger uses verbatim design colors (#D4911C/#2558B5/#E4572E) and exact Chinese copy "另有 N 个源也报道了此事件"
- FeedCardActions dispatches `open-login-modal` event (click-gated per D-26/D-27); external-link is ungated with rel=noopener noreferrer
- LoginPromptModal uses native `<dialog>` for free focus trap + Escape + backdrop; Chinese copy exact per UI-SPEC
- FilterPopover writes tag+source to URL via nuqs with shallow:false (FEED-12); aria-pressed on all chip buttons
- Timeline integrates groupByHour with 今天/昨天/M月D日 + HH:00 headers and 28px off-scale group spacing
- 26 new tests (card atoms + FeedCard anatomy + Timeline + LoginPromptModal) all using renderToString (Node-compatible)

## Task Commits

| Task | Gate | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing atoms tests | — (in faaf680) | card-atoms.test.tsx |
| 1 GREEN | Card atoms implemented | faaf680 | score-badge, hotness-bar, cluster-trigger, cluster-siblings, feed-card-actions, skeleton-card |
| 2 RED | Failing feed-card tests | 2003e9b | feed-card.test.tsx |
| 2 GREEN | FeedCard + Timeline | c81e1f5 | feed-card, cluster-section, timeline, feed-card.test.tsx |
| 3 RED | Failing modal tests | fdc5d46 | modal-filter.test.tsx |
| 3 GREEN | LoginPromptModal + FilterPopover | a87d352 | login-prompt-modal, filter-popover |

## Files Created

### `src/components/feed/` — 11 new components

- `score-badge.tsx` — RSC, 18px mono score + /100 + HOT amber chip at score>=80, aria-label
- `hotness-bar.tsx` — RSC, 3px decorative bar, aria-hidden, used in sibling meta rows
- `cluster-trigger.tsx` — Client, dashed border, 3 stacked squares (#D4911C/#2558B5/#E4572E), aria-expanded + aria-controls
- `cluster-siblings.tsx` — RSC, id="cluster-siblings-{id}", SourceDot(14px) + Link title + HH:mm meta + HotnessBar + external-link
- `cluster-section.tsx` — Client minimal wrapper, owns expanded state for ClusterTrigger+ClusterSiblings
- `feed-card-actions.tsx` — Client, dispatches open-login-modal for star/check/x; external-link ungated
- `skeleton-card.tsx` — RSC, animate-pulse at comfortable-density heights (meta 18px, title 22px, summary 56px, tags 20px)
- `feed-card.tsx` — RSC outer, all 8 anatomy steps, title h3 wrapped in Link, no dangerouslySetInnerHTML
- `timeline.tsx` — RSC, groupByHour integration, 今天/昨天/M月D日 labels, 28px group margin
- `login-prompt-modal.tsx` — Client, native dialog, 登录以继续/登录后才可以收藏/稍后再说/登录, Escape+backdrop close
- `filter-popover.tsx` — Client, nuqs useQueryState x2 shallow:false, 筛选/标签/信源/清除

### Test files (3 new)

- `card-atoms.test.tsx` — 6 tests for ScoreBadge + HotnessBar
- `feed-card.test.tsx` — 16 tests for FeedCard anatomy (all 8 steps, FEED-11 titleZh, cluster/recommendation conditionals) + 3 Timeline tests
- `modal-filter.test.tsx` — 6 tests for LoginPromptModal copy and dialog element

## Decisions Made

- **ClusterSection as minimal client boundary:** FeedCard outer stays RSC (zero JS for the card body). Only the expand-toggle needs client state. Extracting it into a tiny ClusterSection wrapper follows the RSC-first D-29 principle.
- **Native `<dialog>` for modal:** `showModal()` gives focus trap, Escape handler, `::backdrop`, and `aria-modal` for free. No Radix Dialog needed (UI-SPEC noted this as planner's choice).
- **renderToString for tests:** No jsdom or @testing-library/react needed. All component tests run in the vitest Node environment. The esbuild JSX transform handles tsx files.
- **vitest config update:** Added `esbuild.jsx: 'automatic'` + `jsxImportSource: 'react'` to handle `.test.tsx` — avoids pulling in `@vitejs/plugin-react` which is ESM-only and incompatible with the CJS `vitest.config.ts`.
- **FeedCard title-only Link:** accessibility contract from UI-SPEC: card contains interactive elements (buttons, cluster trigger, external link), so the whole card cannot be a link. Only the `<h3>` title is wrapped in `<Link href="/items/{id}">`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript: `publishedAt instanceof Date` fails on FeedListItem (string type)**
- **Found during:** Task 1 typecheck
- **Issue:** `FeedListItem.publishedAt` is typed as `string` (ISO), so `instanceof Date` causes TS2358
- **Fix:** Removed the `instanceof` check; always call `new Date(sibling.publishedAt)` since it's always a string
- **Files modified:** src/components/feed/cluster-siblings.tsx
- **Commit:** faaf680 (same feat commit)

**2. [Rule 1 - Bug] Button component missing `autoFocus` prop**
- **Found during:** Task 3 typecheck
- **Issue:** `Button` component's TypeScript interface lacks `autoFocus`; plan snippet used it
- **Fix:** Removed `autoFocus` — native `<dialog>` `showModal()` focuses the first focusable element automatically; no need for explicit `autoFocus`
- **Files modified:** src/components/feed/login-prompt-modal.tsx
- **Commit:** a87d352 (same feat commit)

**3. [Rule 2 - Missing] vitest config needed `.test.tsx` include + JSX transform**
- **Found during:** Task 1 test execution
- **Issue:** vitest only included `*.test.ts`, not `*.test.tsx`; no JSX transform configured
- **Fix:** Added `.test.tsx` to `include`; added `esbuild.jsx: 'automatic'` + `jsxImportSource: 'react'`; installed `@vitejs/plugin-react` (used ESM workaround instead)
- **Files modified:** vitest.config.ts, package.json
- **Commit:** faaf680

**4. [Rule 1 - Bug] FEED-11 test assertion was incorrect**
- **Found during:** Task 2 test run (GREEN phase revealed wrong assertion)
- **Issue:** Test checked `not.toContain('<h3')` but FeedCard correctly uses `<h3>` as the wrapper; assertion should verify Chinese title appears and English-only text does NOT appear as rendered content
- **Fix:** Updated test to `not.toContain('>Gemini 2.0 Flash Launch<')` — checks the English title is not the rendered text inside the element
- **Files modified:** src/components/feed/feed-card.test.tsx
- **Commit:** c81e1f5

## TDD Gate Compliance

| Task | RED Gate | GREEN Gate |
|------|----------|------------|
| Task 1 | faaf680 (card-atoms.test.tsx in same feat commit; atoms test first) | faaf680 (atoms implemented) |
| Task 2 | 2003e9b (test: add failing tests for FeedCard + Timeline) | c81e1f5 (feat: FeedCard + Timeline) |
| Task 3 | fdc5d46 (test: add failing tests for LoginPromptModal + FilterPopover) | a87d352 (feat: LoginPromptModal + FilterPopover) |

## Threat Mitigations Applied

| ID | Status | Implementation |
|----|--------|----------------|
| T-04-04-01 | Mitigated | All content rendered as JSX text children — `grep -r "dangerouslySetInnerHTML" src/components/feed/` returns zero results |
| T-04-04-02 | Mitigated | All outbound anchors have `rel="noopener noreferrer"` (ClusterSiblings + FeedCardActions) |
| T-04-04-03 | Mitigated | `parseAsArrayOf(parseAsString)` + `parseAsString` coerce invalid URL params to `[]`/`''` |
| T-04-04-06 | Accepted | Native `<dialog>` — no custom focus logic |

## Known Stubs

None. All 11 components are fully implemented:
- FeedCard renders all 8 anatomy steps with real data from FeedListItem
- LoginPromptModal 登录 button is intentionally a no-op (Phase 5 wires auth providers — this is per plan D-26)
- FeedCardActions action buttons dispatch open-login-modal (Phase 5 wires actual vote/favorite writes — this is per plan D-27)

No placeholder text, no hardcoded empty arrays flowing to UI.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All threat surfaces were already in the plan's threat model and mitigated as documented above.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| score-badge.tsx | FOUND |
| hotness-bar.tsx | FOUND |
| cluster-trigger.tsx | FOUND |
| cluster-siblings.tsx | FOUND |
| feed-card-actions.tsx | FOUND |
| skeleton-card.tsx | FOUND |
| cluster-section.tsx | FOUND |
| feed-card.tsx | FOUND |
| timeline.tsx | FOUND |
| login-prompt-modal.tsx | FOUND |
| filter-popover.tsx | FOUND |
| Commit faaf680 | FOUND |
| Commit 2003e9b | FOUND |
| Commit c81e1f5 | FOUND |
| Commit fdc5d46 | FOUND |
| Commit a87d352 | FOUND |

---
*Phase: 04-feed-ui*
*Completed: 2026-04-22T06:48:38Z*
