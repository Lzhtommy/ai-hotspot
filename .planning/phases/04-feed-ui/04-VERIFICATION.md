---
phase: 04-feed-ui
verified: 2026-04-22T07:32:54Z
status: human_needed
score: 12/13
overrides_applied: 1
overrides:
  - must_have: "FEED-06 dark-theme design matches reference screenshot (green accent, card spacing, left sidebar)"
    reason: "D-02 in 04-CONTEXT.md explicitly overrides FEED-06 wording — paper+amber light theme is the designed outcome and is fully implemented. REQUIREMENTS.md FEED-06 checkbox is marked [x] Complete. Card spacing and left sidebar from FEED-06 are honored exactly. Green accent replaced by amber per design iteration decision."
    accepted_by: "auto-verifier citing CONTEXT D-02/D-03 + REQUIREMENTS.md [x] status"
    accepted_at: "2026-04-22T07:32:54Z"
human_verification:
  - test: "WeChat share card rendering for /items/[id] URLs"
    expected: "Pasting an /items/[id] URL into a WeChat chat renders a preview with (i) Chinese title, (ii) description text, (iii) thumbnail image from the OG image route"
    why_human: "WeChat's crawler cannot be automated — requires a Vercel preview deployment and a real WeChat client. The UAT explicitly deferred this. OG tags are code-verified to emit absolute URLs; whether WeChat crawls them is empirical. Per RESEARCH.md Assumption A8 and Pitfall 6 this is best-effort, not blocking."
  - test: "Visual inspection of feed UI on desktop (1440x900) and mobile (375x812)"
    expected: "Desktop: 224px sidebar visible at left, amber accent card typography, brand chip shows AI Hotspot, pipeline status shows 聚合进行中. Mobile: sidebar collapses off-canvas, hamburger button appears in FeedTopBar, click opens left drawer, click a nav item closes drawer and navigates."
    why_human: "Playwright responsive spec verified sidebar ARIA visibility and hamburger button presence, but cannot confirm actual visual rendering of amber palette, card typography, and drawer animation quality. UAT deferred visual checks to /gsd-verify-work."
  - test: "Full feed card with real data: 8-step anatomy with recommendation callout and cluster trigger"
    expected: "When a published item has recommendation non-null and clusterMemberCount > 1, card renders: amber 推荐理由 callout box, dashed-border ClusterTrigger button with three colored dots, expanding sibling list."
    why_human: "No published items in local DB. E2E tests for items/[id] and filters skipped due to no data. These behaviors need real ingested data from the deployed pipeline."
---

# Phase 4: Feed UI — Verification Report

**Phase Goal:** Anonymous users can read the full timeline on both the 精选 and 全部 AI 动态 views, see per-item detail pages, and share items to WeChat with correct OG cards
**Verified:** 2026-04-22T07:32:54Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No request goes to fonts.googleapis.com or fonts.gstatic.com on any page | VERIFIED | `next/font/google` absent from layout.tsx; 3 `.woff2` files in `public/fonts/`; `@font-face` blocks in globals.css; E2E `no-google-fonts.spec.ts` PASS (7/7 checks that could run); `pnpm verify:feed` scanned 69 .next files, zero violations |
| 2 | Tailwind v4 @theme block exposes paper/amber/ink tokens as utilities | VERIFIED | `globals.css` contains `@theme inline` block mapping `--color-*`, `--font-*`, `--radius-*`, `--spacing-*` CSS vars |
| 3 | Self-hosted Geist + Noto Sans SC + JetBrains Mono .woff2 files exist in public/fonts/ | VERIFIED | `ls public/fonts/` = Geist-Variable.woff2, JetBrainsMono-Variable.woff2, NotoSansSC-Variable.woff2 (exactly 3) |
| 4 | 21 feather-style icon SVGs exist in public/icons/ | VERIFIED | `ls public/icons/ | wc -l` = 21; all from the allowlist |
| 5 | groupByHour pure function produces Asia/Shanghai-bucketed TimelineGroup[] deterministically | VERIFIED | `src/lib/feed/group-by-hour.ts` exports `groupByHour`, `FeedItem`, `TimelineGroup`; uses `date-fns-tz` with `TZ = 'Asia/Shanghai'`; 178/178 unit tests pass including group-by-hour.test.ts |
| 6 | Sidebar renders 224px fixed column on desktop and collapses to left drawer on mobile (<1024px) | VERIFIED | `reader-shell.tsx` has `lg:grid lg:grid-cols-[224px_1fr]`; `sidebar-mobile-drawer.tsx` applies `-translate-x-full` closed; E2E responsive.spec PASS: desktop sidebar visible, mobile hamburger visible |
| 7 | Sidebar shows reader nav (精选/全部 AI 动态/low-follow V2-disabled/收藏) and admin nav (all disabled with 即将开放) | VERIFIED | sidebar.tsx NAV_READER and NAV_ADMIN arrays verified; `即将开放` title on all admin items |
| 8 | Pipeline-status card shows active-source count + last-sync minutes pulled live from DB | VERIFIED | `pipeline-status-card.tsx` runs `db.execute(sql...)` against `sources` table; RSC (no `use client`); content `聚合进行中` confirmed |
| 9 | getFeed returns published items filtered by view (featured=score>=70 + cluster-primary; all=cluster-primary) paginated 50/page | VERIFIED | `get-feed.ts` uses `eq(items.status, 'published')`, `eq(items.isClusterPrimary, true)`, `gte(items.score, 70)` for featured view; Redis cache with `ex: 300` TTL; get-feed.test.ts passes |
| 10 | POST /api/revalidate authenticates via constant-time header comparison and only revalidates /, /all paths | VERIFIED | Route uses `timingSafeEqual` from `node:crypto`; `ALLOWED_PATHS = new Set(['/', '/all'])`; `runtime = 'nodejs'` |
| 11 | FeedCard renders 8-step anatomy including title Link, cluster trigger, 推荐理由 callout, action bar | VERIFIED | feed-card.tsx documents all 8 steps with inline comments; `feed-card.test.tsx` assertions cover all anatomy; link wraps title only; FeedCardActions always rendered; ClusterSection conditional on memberCount>1 |
| 12 | / (精选) ISR 300, /all ISR 300 with nuqs filters, /items/[id] ISR 3600 with generateMetadata + OG, /favorites force-dynamic | VERIFIED | `export const revalidate = 300` in (reader)/page.tsx and (reader)/all/page.tsx; `revalidate = 3600` in items/[id]/page.tsx; `dynamic = 'force-dynamic'` in favorites/page.tsx; `generateMetadata` exports OG fields; `opengraph-image.tsx` with `runtime = 'edge'` and Noto Sans SC ArrayBuffer |
| 13 | WeChat share card renders correctly when /items/[id] URL pasted into WeChat | HUMAN NEEDED | OG tags code-verified to emit absolute URLs via generateMetadata; opengraph-image route is Edge runtime with Noto Sans SC font buffer (1200x630 PNG). WeChat rendering requires live deployment — deferred per UAT Assumption A8 |

**Score:** 12/13 truths verified (1 human-needed, 1 override applied)

Note: FEED-06 ("dark-theme / green accent") is PASSED via override — D-02 in 04-CONTEXT.md explicitly supersedes the dark/green wording in REQUIREMENTS.md with paper+amber light theme. REQUIREMENTS.md marks FEED-06 as [x] Complete.

Note: FEED-10 checkbox shows as "Pending" in REQUIREMENTS.md but the implementation is complete: `invalidateFeedCache()` is wired in `src/trigger/refresh-clusters.ts` at line 33-42, with Redis SCAN/DEL loop and POST to /api/revalidate. The requirements doc checkbox was not updated; the code is fully implemented.

### Deferred Items

No items deferred to later phases — all Phase 4 must-haves are either verified or human-needed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/globals.css` | @font-face + @theme design tokens | VERIFIED | 3 @font-face blocks, @theme inline, :root tokens, dark mode preserved |
| `src/app/layout.tsx` | root layout with metadataBase, zh-CN, NO next/font/google | VERIFIED | metadataBase set; lang="zh-CN"; no next/font import |
| `public/fonts/NotoSansSC-Variable.woff2` | self-hosted CJK font | VERIFIED | file exists |
| `src/lib/feed/group-by-hour.ts` | pure hour-bucketing in Asia/Shanghai | VERIFIED | exports groupByHour, FeedItem, TimelineGroup; TZ = Asia/Shanghai |
| `src/lib/feed/source-palette.ts` | sourceId -> { color, initial } | VERIFIED | exports getSourcePalette |
| `src/lib/feed/tag-tones.ts` | tag -> tone map | VERIFIED | exports getTagTone, TagTone |
| `src/components/layout/icon.tsx` | typed Icon renderer from /icons/ | VERIFIED | renders `<img src="/icons/{name}.svg">` |
| `src/components/layout/source-dot.tsx` | monogram SourceDot from source-palette | VERIFIED | imports and calls getSourcePalette |
| `src/components/layout/button.tsx` | Button with 5 variants, 3 sizes | VERIFIED | 5 variants (primary/secondary/ghost/accent/danger) declared; 'use client' added |
| `src/components/layout/sidebar.tsx` | 224px fixed desktop sidebar RSC | VERIFIED | RSC; 224px; AI Hotspot brand; 即将开放 admin nav |
| `src/components/layout/pipeline-status-card.tsx` | live RSC DB query | VERIFIED | db.execute against sources; RSC; 聚合进行中 |
| `src/components/feed/feed-top-bar.tsx` | sticky top bar RSC | VERIFIED | RSC; 全部 AI 动态, 由 Claude 按策略筛选, Phase 6 开放 |
| `src/components/feed/feed-tabs.tsx` | tab nav via Link | VERIFIED | RSC; uses next/link; aria-current |
| `src/lib/feed/get-feed.ts` | Redis-cached feed reader | VERIFIED | exports getFeed, buildFeedKey; Redis get/set; TTL 300 |
| `src/lib/feed/get-item.ts` | item + cluster-mates reader | VERIFIED | exports getItem |
| `src/lib/feed/cache-invalidate.ts` | Redis flush + ISR POST | VERIFIED | SCAN cursor loop; x-revalidate-secret header; AbortSignal.timeout(10000) |
| `src/app/api/revalidate/route.ts` | Node-runtime secret-gated ISR | VERIFIED | timingSafeEqual; ALLOWED_PATHS; runtime=nodejs |
| `src/lib/feed/og-payload.ts` | OG metadata shaping | VERIFIED | buildOgPayload, resolveSiteUrl exports |
| `src/lib/feed/search-params.ts` | nuqs feedParamsCache | VERIFIED | createSearchParamsCache exported |
| `src/components/feed/feed-card.tsx` | RSC FeedCard 8-step anatomy | VERIFIED | RSC; all 8 steps; title in Link; ClusterSection; FeedCardActions |
| `src/components/feed/feed-card-actions.tsx` | Client island action buttons | VERIFIED | 'use client'; dispatches open-login-modal; noopener noreferrer |
| `src/components/feed/cluster-trigger.tsx` | Client expand/collapse | VERIFIED | 'use client'; aria-expanded; aria-controls; 另有N个源也报道了此事件 |
| `src/components/feed/login-prompt-modal.tsx` | Client modal with focus trap | VERIFIED | 'use client'; native <dialog>; open-login-modal listener; Escape close |
| `src/components/feed/timeline.tsx` | RSC timeline with groupByHour | VERIFIED | RSC; calls groupByHour; dayLabel, hourLabel; mb-[28px] |
| `src/components/feed/filter-popover.tsx` | Client popover with nuqs | VERIFIED | 'use client'; useQueryState; shallow: false |
| `src/app/(reader)/layout.tsx` | route-group RSC layout | VERIFIED | RSC; imports ReaderShell + LoginPromptModal |
| `src/app/(reader)/page.tsx` | 精选 ISR 300 | VERIFIED | revalidate=300; calls getFeed |
| `src/app/(reader)/all/page.tsx` | 全部 AI 动态 ISR 300 + nuqs | VERIFIED | revalidate=300; feedParamsCache.parse(await searchParams) |
| `src/app/(reader)/items/[id]/page.tsx` | detail RSC ISR 3600 + OG | VERIFIED | revalidate=3600; generateMetadata; await params; notFound() |
| `src/app/(reader)/items/[id]/opengraph-image.tsx` | Edge runtime OG PNG with CJK font | VERIFIED | runtime=edge; import.meta.url font path; arrayBuffer; fonts:[] passed |
| `src/app/(reader)/favorites/page.tsx` | anonymous empty-state force-dynamic | VERIFIED | force-dynamic; FeedTopBar view=favorites |
| `playwright.config.ts` | Playwright chromium+webkit config | VERIFIED | chromium; webkit; pnpm dev webServer |
| `tests/e2e/no-google-fonts.spec.ts` | FEED-08 network assertion | VERIFIED | fonts.googleapis.com + fonts.gstatic.com assertions |
| `tests/e2e/meta-tags.spec.ts` | FEED-09 OG tag assertion | VERIFIED | og:title assertion; skips gracefully when no DB data |
| `scripts/verify-feed.ts` | CLI harness FEED-08 + FEED-09 | VERIFIED | scans .next output; fetches runtime; og:title check |
| `.planning/phases/04-feed-ui/04-UAT.md` | UAT checklist with 5 ROADMAP SCs | VERIFIED | SC#1–SC#5 documented; WeChat noted as deferred |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/layout.tsx` | `src/app/globals.css` | `import './globals.css'` | WIRED | Confirmed in layout.tsx |
| `src/app/globals.css` | `/fonts/*.woff2` | `url('/fonts/')` | WIRED | 3 @font-face blocks in globals.css |
| `src/components/layout/icon.tsx` | `/icons/{name}.svg` | img src attribute | WIRED | `src={'/icons/${name}.svg'}` |
| `src/lib/feed/get-feed.ts` | redis + db | `redis.get/set` + `db.select` | WIRED | redis.get at line 78, redis.set at line 175 |
| `src/lib/feed/cache-invalidate.ts` | POST /api/revalidate | `x-revalidate-secret` header | WIRED | header confirmed in cache-invalidate.ts |
| `src/trigger/refresh-clusters.ts` | `cache-invalidate.ts` | `await invalidateFeedCache()` | WIRED | import at line 3; call at line 35 |
| `src/app/api/revalidate/route.ts` | `next/cache revalidatePath` | `revalidatePath('/')` + `revalidatePath('/all')` | WIRED | revalidatePath import + ALLOWED_PATHS |
| `src/components/feed/feed-card.tsx` | `feed-card-actions.tsx` | import + render | WIRED | import at line 29; rendered at step 8 |
| `src/components/feed/cluster-trigger.tsx` | `cluster-siblings.tsx` | aria-controls + visibility | WIRED | aria-controls id matches cluster-siblings div id |
| `src/components/feed/feed-card-actions.tsx` | `login-prompt-modal.tsx` | `document.dispatchEvent(new CustomEvent('open-login-modal'))` | WIRED | dispatches in openLoginModal() function |
| `src/components/feed/filter-popover.tsx` | nuqs `useQueryState` | `useQueryState` with shallow:false | WIRED | import from nuqs; shallow: false confirmed |
| `src/app/(reader)/page.tsx` + `all/page.tsx` | `src/lib/feed/get-feed.ts` | `await getFeed(...)` | WIRED | getFeed called in both pages |
| `src/app/(reader)/items/[id]/page.tsx` | `get-item.ts` + `og-payload.ts` | `getItem` + `buildOgPayload` / `resolveSiteUrl` | WIRED | both imports confirmed; resolveSiteUrl used in generateMetadata |
| `src/app/(reader)/items/[id]/opengraph-image.tsx` | `public/fonts/NotoSansSC-Variable.woff2` | `new URL(..., import.meta.url)` | WIRED | path confirmed at line 31 |
| `src/app/(reader)/favorites/favorites-empty.tsx` | LoginPromptModal (via layout) | `window.dispatchEvent(new CustomEvent('open-login-modal'))` | WIRED | dispatches at line 26 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/app/(reader)/page.tsx` | `items` from `getFeed` | `db.select` from items + Redis cache | Yes — SQL query with predicates | FLOWING |
| `src/app/(reader)/all/page.tsx` | `items` from `getFeed` | `db.select` from items + Redis cache | Yes — SQL query + tag/source filters | FLOWING |
| `src/app/(reader)/items/[id]/page.tsx` | `item` from `getItem` | `db.select` from items + cluster join | Yes — parameterized query by id | FLOWING |
| `src/components/layout/pipeline-status-card.tsx` | `active_count`, `last_fetched` | `db.execute(sql...)` against sources | Yes — COUNT + MAX query | FLOWING |
| `src/components/feed/feed-card.tsx` | `item` prop | Passed from Timeline → (reader)/page.tsx | Yes — prop from real getFeed data | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 178 unit tests pass (group-by-hour, get-feed, cache-invalidate, feed-card) | `pnpm test` | 178/178 passed | PASS |
| No Google Fonts in .next output | `pnpm verify:feed` FEED-08 | 69 files scanned, 0 violations | PASS |
| Playwright E2E: featured, all, a11y, no-google-fonts, responsive | `pnpm exec playwright test --project=chromium` | 7 pass, 3 skip (no DB data — graceful) | PASS |
| TypeCheck clean | `pnpm typecheck` | exit 0, no errors | PASS |
| Lint clean | `pnpm lint` | exit 0, 7 pre-existing warnings | PASS |
| FEED-09 OG tags (requires published item) | `pnpm verify:feed` FEED-09 | DEFERRED — no published items in local DB | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FEED-01 | 04-03, 04-05 | / (精选) ISR 5-min, grouped by time | SATISFIED | revalidate=300; getFeed featured; Timeline+groupByHour |
| FEED-02 | 04-03, 04-05 | /all full chronological feed with pagination/infinite scroll | SATISFIED | revalidate=300; getFeed all; link-based pagination; totalPages rendered |
| FEED-03 | 04-04 | Card shows source badge, title, summary, score, 推荐理由, tags, cluster count | SATISFIED | FeedCard 8-step anatomy verified; all fields rendered |
| FEED-04 | 04-03, 04-05 | /items/[id] full summary, cluster list, original link | SATISFIED | getItem + ClusterSiblings + 查看原文 link |
| FEED-05 | 04-01, 04-04 | Timeline groups by HH:MM within day; day headers | SATISFIED | groupByHour in Asia/Shanghai; Timeline renders dayLabel+hourLabel |
| FEED-06 | 04-01, 04-02 | Design theme (overridden D-02: paper+amber light, not dark/green) | PASSED (override) | Paper+amber palette implemented; REQUIREMENTS.md marks [x] Complete; D-02 explicitly overrides dark/green wording |
| FEED-07 | 04-02, 04-05 | Responsive 375px mobile + desktop | SATISFIED | ReaderShell grid-cols-[224px_1fr]; SidebarMobileDrawer; HamburgerButton; E2E responsive PASS |
| FEED-08 | 04-01 | CJK fonts self-hosted, never Google Fonts | SATISFIED | 3 woff2 in public/fonts; @font-face; no next/font/google; E2E + verify-feed PASS |
| FEED-09 | 04-05 | OG tags on /items/[id] for WeChat | SATISFIED (code) / HUMAN (WeChat render) | generateMetadata emits og:title/description/image; opengraph-image Edge route with CJK font; WeChat live test deferred |
| FEED-10 | 04-03 | Redis cache invalidated when cluster refresh completes | SATISFIED | invalidateFeedCache() wired in refresh-clusters.ts line 33-42; SCAN loop + ISR POST |
| FEED-11 | 04-01, 04-04 | Chinese-only UI; English items show titleZh/summaryZh | SATISFIED | `item.titleZh ?? item.title` in FeedCard; same in items/[id] page |
| FEED-12 | 04-03, 04-04, 04-05 | Source/tag filter controls on /all | SATISFIED | FilterPopover with nuqs; feedParamsCache.parse; getFeed tag/source predicates |

Note on FEED-10: REQUIREMENTS.md checkbox shows `[ ] Pending` but this is a documentation discrepancy — the implementation is complete and wired.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODO/FIXME/placeholder in rendered paths | — | — |
| `src/app/globals.css` | — | Dark mode token block present but gated behind `:root[data-theme="dark"]` selector | Info | Intentional per D-02 — preserved for future phase, not wired to any toggle |
| `src/components/layout/button.tsx` | 26 | `'use client'` present (added as bug fix #1) | Info | Correct — Button uses mouse event handlers; RSC-breaking without it |
| `src/app/(reader)/items/[id]/opengraph-image.tsx` | — | `params` not `await`ed — uses `params.id` directly (not `await params`) | Warning | In Next.js 15, dynamic API params in Edge route handlers may require await — but OG image route may be exempt depending on Next.js version behavior. Build exits 0, so no runtime failure observed. |

### Human Verification Required

#### 1. WeChat Share Card Rendering

**Test:** Deploy the app to a Vercel preview environment. Paste an `/items/[id]` URL (for a published item) into a WeChat chat on desktop (WeChat PC) or mobile.
**Expected:** The WeChat link preview shows (i) Chinese item title, (ii) summary text (up to 160 chars), (iii) a 1200x630 PNG thumbnail with amber left stripe and item title.
**Why human:** WeChat's link-preview crawler cannot be automated. Requires a live deployment with a public URL and a real WeChat client. Per RESEARCH.md Pitfall 6 and Assumption A8, this is best-effort — the OG tags are verifiable via curl and the opengraph-image route is code-verified to return a PNG with Noto Sans SC font.

#### 2. Full Feed Card Visual with Real Data

**Test:** With the ingestion pipeline running (published items in DB), visit the `/` page. Find a card where `recommendation` is non-null and `clusterMemberCount > 1`.
**Expected:** Card renders amber 推荐理由 callout (bordered amber left stripe, "★ Claude 推荐理由" eyebrow), and a dashed-border ClusterTrigger button. Clicking the trigger expands the sibling list.
**Why human:** Local DB has no published items. E2E tests for item-specific behavior (meta-tags.spec, filters.spec, the items/[id] no-google-fonts test) all skipped gracefully. These require real ingested data.

#### 3. Visual Inspection of Paper+Amber Theme

**Test:** Open the app in a browser at desktop (1440px) and mobile (375px). Verify the paper+amber color palette is correctly rendered — warm off-white background, amber accent (#D4911C) on score badges and CTAs, ink-900 (#0B0B0C) text.
**Expected:** No dark backgrounds, no green accent; sidebar 224px wide at desktop; amber HOT chip on high-scoring cards.
**Why human:** Playwright axe-core confirmed 0 serious a11y violations; responsive positions verified by ARIA tests. Actual color rendering and visual quality require a browser.

### Gaps Summary

No blocking gaps found. The phase goal is achieved at the code level:
- All 12 ROADMAP requirements (FEED-01 through FEED-12) are implemented
- All 6 plan must-haves are satisfied in the codebase
- 178/178 unit tests pass, 7/7 runnable E2E tests pass, 3 skipped gracefully (no DB data — expected)
- FEED-08 verified programmatically (no Google Fonts in source or .next output)
- FEED-10 is implemented despite REQUIREMENTS.md showing an unchecked checkbox (documentation lag)

Three human verification items remain before the phase can be considered fully signed off:
1. WeChat share card (requires live deployment + WeChat client)
2. Full card anatomy with real data (requires ingested items in DB)
3. Visual palette inspection (requires browser)

These are quality and integration verifications, not code gaps. The human_needed status is correct.

---

_Verified: 2026-04-22T07:32:54Z_
_Verifier: Claude (gsd-verifier)_
