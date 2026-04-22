---
phase: 04-feed-ui
plan: 01
subsystem: ui
tags: [tailwind-v4, next-js, fonts, icons, rsc, design-tokens, date-fns-tz]

# Dependency graph
requires: []
provides:
  - Self-hosted Geist + JetBrains Mono + Noto Sans SC .woff2 fonts in public/fonts/
  - Tailwind v4 @theme block with paper/ink/accent/line/surface design tokens as utility classes
  - 21 feather-style icon SVGs in public/icons/ with TypeScript IconName union
  - source-palette.ts, tag-tones.ts, group-by-hour.ts pure utility modules
  - 7 RSC layout primitive components (Icon, SourceDot, Tag, Button, IconButton, Divider, Eyebrow)
  - FEED-08 fix: layout.tsx no longer imports next/font/google
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

# Tech tracking
tech-stack:
  added: [date-fns, date-fns-tz, fonttools (Python — dev-only for subsetting)]
  patterns:
    - Tailwind v4 @theme inline with CSS custom properties — no tailwind.config.js
    - RSC-first components — only client component owns interactive state (hover in IconButton)
    - @font-face self-hosting pattern — FEED-08 prohibits any next/font/google import
    - Pure utility modules with dependency injection for testability (groupByHour accepts now: Date)
    - Vitest colocated test files for feed utilities

key-files:
  created:
    - src/app/globals.css
    - src/app/layout.tsx
    - public/fonts/Geist-Variable.woff2
    - public/fonts/JetBrainsMono-Variable.woff2
    - public/fonts/NotoSansSC-Variable.woff2
    - public/icons/*.svg (21 files)
    - src/lib/feed/source-palette.ts
    - src/lib/feed/tag-tones.ts
    - src/lib/feed/group-by-hour.ts
    - src/lib/feed/group-by-hour.test.ts
    - src/components/layout/icon.tsx
    - src/components/layout/source-dot.tsx
    - src/components/layout/tag.tsx
    - src/components/layout/button.tsx
    - src/components/layout/icon-button.tsx
    - src/components/layout/divider.tsx
    - src/components/layout/eyebrow.tsx
  modified:
    - .env.example

key-decisions:
  - "Noto Sans SC woff2 produced by subsetting 10MB TTF via fonttools to ~1.2MB covering U+4E00-7000 + ASCII + punctuation"
  - "JetBrains Mono variable font sourced from @fontsource-variable/jetbrains-mono CDN (official releases only have static weights)"
  - "Dark-mode token block preserved in globals.css under :root[data-theme='dark'] but NOT wired to any toggle (D-02 deferred)"
  - "Icon component uses <img> not next/image — SVG icons are tiny/static, optimization adds no benefit and triggers CLS"
  - "groupByHour accepts now: Date parameter for deterministic testability (dependency injection pattern)"

patterns-established:
  - "RSC default: zero JS shipped from layout primitives unless component owns interactive state"
  - "Design token reference: all pixel values and color values traced to primitives.jsx source lines in comments"
  - "Font loading: @font-face in globals.css + rel=preload for NotoSansSC in layout.tsx <head>"
  - "Tone resolution: getTagTone(label) resolves tag strings to TagTone enum; getSourcePalette(id) resolves source IDs to color+initial"

requirements-completed: [FEED-05, FEED-06, FEED-08, FEED-11]

# Metrics
duration: ~90min
completed: 2026-04-22
---

# Phase 4 Plan 01: UI Foundation Summary

**Self-hosted Geist + Noto Sans SC + JetBrains Mono fonts, Tailwind v4 @theme design tokens, 21 vendored SVG icons, and 7 RSC layout primitives resolving FEED-08 (no Google Fonts requests)**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-04-22T04:30:00Z
- **Completed:** 2026-04-22T06:21:38Z
- **Tasks:** 4
- **Files modified:** 23

## Accomplishments

- Eliminated all Google Fonts network requests (FEED-08): deleted `next/font/google` from layout.tsx, replaced with self-hosted `@font-face` declarations in globals.css
- Established complete Tailwind v4 `@theme` design token system: paper, ink-{700,800,900}, accent-{50,100,500,700}, surface-{0,1}, line-{weak}, fg-{1,2,3}, shadow-focus, and typography variables all available as Tailwind utilities
- Delivered 13 passing Vitest tests for `groupByHour` including Asia/Shanghai bucket ordering, score-desc sorting, relative time labels, and "更早" overflow bucket

## Task Commits

Each task was committed atomically:

1. **Task 1: Vendor fonts, icons, env vars, deps** - `0061399` (feat)
2. **Task 2: globals.css @theme + FEED-08 layout.tsx fix** - `3b01db7` (feat)
3. **Task 3: Pure utility modules + tests** - `305e960` (feat)
4. **Task 4: 7 layout primitive components** - `77d28a8` (feat)

## Files Created/Modified

- `public/fonts/Geist-Variable.woff2` — 68KB variable font (100-900 weight axis)
- `public/fonts/JetBrainsMono-Variable.woff2` — 39KB variable font from @fontsource-variable
- `public/fonts/NotoSansSC-Variable.woff2` — 1.2MB variable font subsetted via fonttools from full 10MB TTF
- `public/icons/*.svg` — 21 feather-style SVGs copied from .design/feed-ui/project/ds/icons/
- `src/app/globals.css` — Complete rewrite: @font-face + full Tailwind v4 @theme token block + dark tokens + reduced-motion media query
- `src/app/layout.tsx` — Complete rewrite removing next/font/google; rel=preload for NotoSansSC; bg-paper text-ink-900 body classes
- `src/lib/feed/source-palette.ts` — SourcePalette interface, 9-entry PALETTE map, getSourcePalette() with nameHint fallback
- `src/lib/feed/tag-tones.ts` — TagTone type, 20-entry TONE_MAP, getTagTone() resolver
- `src/lib/feed/group-by-hour.ts` — groupByHour() with Asia/Shanghai bucketing, score-desc sort, relative labels (今天/昨天/N天前/更早)
- `src/lib/feed/group-by-hour.test.ts` — 13 Vitest tests, all passing
- `src/components/layout/icon.tsx` — RSC, 21-name IconName union, renders /icons/{name}.svg
- `src/components/layout/source-dot.tsx` — RSC avatar dot with color+initial from getSourcePalette()
- `src/components/layout/tag.tsx` — RSC chip, 5 tones via getTagTone(), active state inverts to ink-900
- `src/components/layout/button.tsx` — RSC, 5 variants × 3 sizes, all values traced to primitives.jsx L186-238
- `src/components/layout/icon-button.tsx` — Client component, useState hover, required title+aria-label enforced at TypeScript level
- `src/components/layout/divider.tsx` — RSC, horizontal (full-width) / vertical (16px tall) 1px hairline
- `src/components/layout/eyebrow.tsx` — RSC, 10px uppercase 600-weight with default/accent variant
- `.env.example` — Added NEXT_PUBLIC_SITE_URL and REVALIDATE_SECRET keys

## Decisions Made

- **Noto Sans SC subsetting**: Google Fonts serves NotoSansSC as ~100 small unicode-range chunks; no single consolidated variable .woff2 is available. Used fonttools `pyftsubset` to produce a 1.2MB file covering U+4E00-7000 (most-common CJK), ASCII, and CJK punctuation. Covers ~9500 characters sufficient for v1.
- **JetBrains Mono source**: Official JetBrains Mono v2.304 releases only include static weights. Used @fontsource-variable package CDN for the variable font file.
- **Dark mode tokens deferred**: Full dark token block preserved in `:root[data-theme='dark']` per D-02 — present in CSS but no toggle wired. Future plan wires next-themes.
- **Icon component uses `<img>` not `next/image`**: SVG icons are ≤1KB static files, no optimization benefit, and `next/image` adds unnecessary complexity for icons. ESLint `no-img-element` warning suppressed intentionally.
- **groupByHour dependency injection**: Accepts optional `now: Date` parameter so tests can assert deterministic bucket labels without mocking system clock.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NotoSansSC single-file woff2 not available on CDN**
- **Found during:** Task 1 (font vendoring)
- **Issue:** No public CDN offers a consolidated single-file NotoSansSC variable woff2; Google Fonts serves 100+ small unicode-range chunks
- **Fix:** Downloaded full 10MB TTF from Google Fonts API, installed fonttools + brotli (Python), subsetted to 1.2MB woff2 covering U+4E00-7000 + ASCII + CJK punctuation
- **Files modified:** public/fonts/NotoSansSC-Variable.woff2
- **Verification:** File exists 1.2MB, @font-face declaration references it, typecheck passes
- **Committed in:** 0061399 (Task 1 commit)

**2. [Rule 3 - Blocking] JetBrains Mono official releases lack variable font**
- **Found during:** Task 1 (font vendoring)
- **Issue:** JetBrains Mono v2.304 official release only ships static weight files; no variable woff2 in the release archive
- **Fix:** Sourced variable woff2 from @fontsource-variable/jetbrains-mono@5 CDN (cdn.jsdelivr.net), 39KB latin-wght-normal variant
- **Files modified:** public/fonts/JetBrainsMono-Variable.woff2
- **Verification:** File exists 39KB, @font-face declaration references it, typecheck passes
- **Committed in:** 0061399 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both fixes required to deliver the plan's font vendoring objective. No scope creep.

## Issues Encountered

- FontTools `Merger` for variable fonts fails with `AttributeError: type object 'VarStore' has no attribute 'mergeMap'` — variable font tables are not supported by the font merger. Resolved by subsetting a single source TTF rather than merging multiple subsets.
- Worktree base mismatch on initialization — reset with `git reset --hard 855c9f4` to correct base.

## Known Stubs

None — all components are fully implemented. No hardcoded empty values or placeholder text.

## Threat Flags

None — this plan creates no network endpoints, auth paths, file access patterns, or schema changes.

## Next Phase Readiness

- All 7 layout primitives ready for consumption by FEED-02 (feed card) and FEED-03 (sidebar, top bar)
- Design token system complete — all downstream components should use `var(--token)` CSS custom properties via Tailwind utilities
- Icon set complete — `IconName` TypeScript union enforces valid icon names at compile time
- `groupByHour` ready for FEED-04 (timeline page server component)
- FEED-08 resolved — no Google Fonts imports will appear in any future plan

---
*Phase: 04-feed-ui*
*Completed: 2026-04-22*

## Self-Check: PASSED

All 17 key files found. All 4 task commits (0061399, 3b01db7, 305e960, 77d28a8) verified in git log.
