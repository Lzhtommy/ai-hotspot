# Phase 4: Feed UI - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the anonymous reader web UI for AI Hotspot — the three reader views (精选 / 全部 AI 动态 / 收藏-placeholder), the per-item detail page, the 224px left sidebar + top bar shell, and the WeChat-shareable OG cards, using the **Claude Design bundle vendored at `.design/feed-ui/`** as the authoritative visual contract. All surfaces render real enriched data from Phase 3 (`items` rows in `status='published'`) via RSC + ISR, with a Redis feed cache invalidated on cluster refresh.

**In scope:** global layout shell (sidebar + top bar + main scroll column); `/` (精选, ISR 300s, score≥threshold filter + cluster-primary only); `/all` (full chronological timeline, pagination/infinite scroll); `/items/[id]` (detail with cluster members + original link + OG meta); timeline grouping by hour; feed card anatomy (source dot · title · 中文摘要 · 推荐理由 amber callout · tags · hotness score · cluster trigger with inline-expandable siblings); admin-nav items rendered as disabled/V2 placeholders (Phase 6 ships them for real); action icons on cards rendered but click-gated with a stub login prompt modal (Phase 5 wires auth); Noto Sans SC self-host strategy to satisfy FEED-08; Redis feed-level cache keyed by view + page + filters; dynamic OG image via `next/og` for item detail pages; source-dot monogram rendering (no external logo files in v1); tag filter chips on `/all` via URL search params; CJK-safe font stack including the design's Geist + system Chinese fallback.

**Out of scope (later phases):**
- Auth providers, session handling, magic-link flow, sign-in modal real wiring (Phase 5 — AUTH-*)
- `/favorites` functioning as a real user page (Phase 5 — FAV-03); in Phase 4 the route exists and renders a "登录后可查看收藏" empty state
- Favorite/like/dislike persistence to DB (Phase 5 — FAV-01..03, VOTE-01..04); in Phase 4 the icons render and clicking opens the stub login prompt
- Admin CRUD, 信源 health table, 策略 toggle UI, 用户 list, 后台 dashboard (Phase 6 — ADMIN-*); in Phase 4 the sidebar shows these items with disabled styling + "V2"-like marker (design uses V2 chip; Phase 4 uses a "即将开放" marker to avoid overpromising)
- 信源提报 and 低粉爆文 nav items (Phase 4 renders them as V2-disabled exactly per design — no route, no handler)
- FeaturedStrategyBar visible "当前生效策略" chips (design file shows this on `/featured`, but STRAT-01 is a v2 requirement — Phase 4 hides this bar; the `精选` view uses a hardcoded score≥70 + cluster-primary filter as its "strategy" stand-in)
- Command palette (⌘K search) — sidebar renders the visual stub from the design but pressing `⌘K` is a no-op in Phase 4 (SEARCH-01 is v2)
- Tweaks panel (theme/density/badge-style/show-reason localStorage toggles from `app.jsx`) — design's EDITMODE tooling is not shipping; Phase 4 picks a single canonical rendering (light theme default, comfortable density, numeric score badge, reason always shown) and doesn't expose runtime toggles
- Sentry / Langfuse / Vercel Analytics instrumentation at the UI layer (Phase 6 — OPS-01, OPS-02, OPS-05); RSC routes need no client-side SDK in Phase 4

</domain>

<decisions>
## Implementation Decisions

### Design authority & conflict resolution
- **D-01:** **The vendored Claude Design bundle at `.design/feed-ui/` is the authoritative visual contract for Phase 4.** Downstream planner and executor treat `.design/feed-ui/project/index.html`, `.design/feed-ui/project/src/*.jsx`, and `.design/feed-ui/project/ds/colors_and_type.css` as pixel-and-token specs to be **recreated**, not copied. The design medium is HTML/CSS/React-UMD prototypes; the target medium is Next.js 15 RSC + Tailwind v4. Match the visual output; do not lift the prototype's `window.SOURCES` / `window.FEED` globals or its `text/babel` UMD setup.
- **D-02:** **Theme decision: paper+amber is the default, dark mode is deferred.** The design bundle's chat transcript deliberately overrides PROJECT.md's "dark theme, green accent" reference with Testify's paper-warm + honey-amber (`--accent-500: #D4911C`) palette and offers dark mode as a runtime `data-theme="dark"` toggle in `index.html` only. For Phase 4 we ship **light/paper as the sole theme**; we do **not** ship a runtime theme toggle. Dark-mode token block from `index.html` lines 44–71 is **preserved in code as CSS variables** but gated behind an unused selector so a later phase can re-enable it without re-authoring. This decision supersedes FEED-06's "dark-theme design matches reference screenshot (green accent, card spacing, left sidebar)" — REQUIREMENTS.md FEED-06 is read as "matches the design we iterated on" which is now the paper+amber design. Card spacing + left sidebar from FEED-06 remain binding and are honored exactly.
- **D-03:** **Green accent in REQUIREMENTS.md/PROJECT.md is overridden by amber.** The design's honey-amber `--accent-500: #D4911C` is the sole brand accent. The `--success-500: #2F7D4F` green is used **only** for the success semantic role (pipeline-status dot, active-strategy green dots in admin placeholders). No green surfaces, no green accent.

### Visual primitives — tokens, fonts, icons
- **D-04:** **Design tokens come from `.design/feed-ui/project/ds/colors_and_type.css` verbatim (modulo Tailwind v4 adaptation).** Port the CSS custom properties under `:root` into `src/app/globals.css` inside a Tailwind v4 `@theme` block so utilities like `bg-surface-0`, `text-ink-700`, `border-line-weak` work. Token names preserved: `--paper`, `--paper-deep`, `--surface-0/1/2`, `--line-weak/line/line-strong`, `--ink-900..300`, `--accent-50..900`, `--success-500/50`, `--danger-500/50`, `--info-500/50`, `--fg-1..4`, `--bg-app/surface/sunken/pressed`. Shadows, radii (`--radius-xs/sm/md/lg/pill`), spacing (4pt base, `--space-1..24`), motion (`--ease`, `--dur-micro/180/240`), z-index stack — all preserved.
- **D-05:** **Font strategy resolving FEED-08.** Self-host **Geist Variable** (the design's primary font — see `.design/feed-ui/project/ds/fonts/README.md`) AND **Noto Sans SC** (for CJK coverage that Geist lacks) in `public/fonts/`. `@font-face` declarations in `globals.css` reference `/fonts/Geist-Variable.woff2` and `/fonts/NotoSansSC-Variable.woff2`. The font stack is: `'Geist', 'Noto Sans SC', ui-sans-serif, system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`. The current `src/app/layout.tsx` Geist-from-Google-Fonts import (`next/font/google`) is **removed**. JetBrains Mono is self-hosted the same way. **No request ever goes to `fonts.googleapis.com` or `fonts.gstatic.com`.**
- **D-06:** **Icons come from the vendored set at `.design/feed-ui/project/ds/icons/`** (46 feather-style SVGs). Copy the subset actually used by Phase 4 components into `public/icons/` and render via a typed `<Icon name="..." size={n} />` component that maps to `/icons/{name}.svg`. Inline-SVG sprite is a planner's-discretion alternative if tree-shaking becomes a concern. `icon-invert` utility class from the design (for future dark mode) is carried forward but unused in Phase 4.
- **D-07:** **Source visual identity = colored-monogram `<SourceDot>`** (design's `primitives.jsx` lines 18–32). A `source_palette` column or a static map keyed by `sources.id` provides `{ color, initial }` — each source picks a brand-ish hex + a 1-2 char Chinese/Latin initial. Phase 4 ships a hardcoded palette in `src/lib/feed/source-palette.ts` matching the seeded Phase 2 sources; Phase 6 can migrate it to a DB column. **No external logo files in v1** (CLAUDE.md note about `public/logos/` is superseded — monograms avoid the dependency).

### Layout shell — sidebar + top bar + main
- **D-08:** **224px fixed-width left sidebar + top bar + main scroll column.** Exact layout from `.design/feed-ui/project/src/sidebar.jsx` lines 74–196 and `feed_views.jsx` `FeedTopBar` lines 6–68. Sidebar contains: brand chip (26×26 amber square + "AI Hotspot" title + "中文 AI 动态聚合" subtitle), search stub with ⌘K kbd (visual only in v1 — no handler wired), section label "动态" + reader nav, section label "管理" + admin nav (all disabled/placeholder in v1), pipeline-status card at bottom, user chip at bottom.
- **D-09:** **Reader nav items (all functional in Phase 4):**
  - 精选 → `/` (icon `sparkles`)
  - 全部 AI 动态 → `/all` (icon `inbox`)
  - 低粉爆文 → **V2-disabled** (icon `arrow-up-right`, design already marks as V2)
  - 收藏 → `/favorites` (icon `star`) — route exists; in Phase 4 it renders "登录后可查看收藏" empty-state because auth is Phase 5
- **D-10:** **Admin nav items (all placeholder-disabled in Phase 4):**
  - 信源, 信源提报, 策略, 用户, 后台 all render with the design's disabled styling (opacity 0.55, `cursor: not-allowed`, "即将开放" title tooltip) since Phase 6 ships them. 信源提报 additionally carries a "V2" chip per design. This keeps the information architecture honest and matches the design's treatment of buzz/submissions.
- **D-11:** **Pipeline-status card at sidebar bottom.** Shows "聚合进行中" + active-source count + "上次同步 N 分钟前" + a `--accent-500` progress bar. The counts are **RSC-fetched live** from `sources` + last `ingest-hourly` run timestamp (Trigger.dev exposes `last_fetched_at` aggregates in Phase 2). Percentage bar is cosmetic in Phase 4 (fixed 68% like the design) until Phase 6 wires real progress.
- **D-12:** **User chip at sidebar bottom.** In Phase 4 (anonymous-only), this renders a single **"登录"** ghost-style chip (not the design's "CL / 陈立" avatar+name — that's Phase 5's authenticated state). Clicking opens the stub login prompt modal.

### Routes & rendering strategy
- **D-13:** **`/` (精选) — Server Component with `export const revalidate = 300` (5 min ISR).** Query: `items` where `status='published'` AND `is_cluster_primary=true` AND `score >= 70`, ordered by `published_at DESC`, limit 184-ish (matches design). Hidden from anonymous-unfavoriteable state: all cards show action icons, clicks gate through login modal.
- **D-14:** **`/all` — Server Component with `export const revalidate = 300`.** Query: `items` where `status='published'` AND `is_cluster_primary=true`, ordered by `published_at DESC`. Pagination via URL search params (`?page=N&tags=a,b&source=c`) using `nuqs` (CLAUDE.md-recommended). **Pagination approach: numbered pagination with 50 items/page**, not infinite scroll. Reason: RSC + ISR composes cleanly with discrete paginated URLs (each page gets its own static HTML); infinite-scroll client components defeat ISR. FEED-02 allows "pagination or infinite scroll" — we choose pagination. Load-more button below page-N is a planner's-discretion enhancement.
- **D-15:** **`/items/[id]` — Server Component with `export const revalidate = 3600` (1 hr ISR, matches CLAUDE.md item-detail guidance).** Query: the item itself + all cluster-mates joined on `cluster_id` ordered by `published_at ASC` (primary first by earliest-seen). Renders full summary, cluster member list with source-dot + title + time + score + external-link, original article link at top. `generateMetadata` returns `og:title` (title_zh), `og:description` (summary_zh first 160 chars), `og:image` (dynamic `next/og` route — see D-25).
- **D-16:** **`/favorites` — Server Component, `export const dynamic = 'force-dynamic'`** but in Phase 4 just renders `<EmptyState title="登录后可查看收藏" body="..." cta="登录" />`. Phase 5 replaces the body with the authenticated RSC query (`favorites` JOIN `items`).

### Card anatomy — the centerpiece
- **D-17:** **FeedCard layout locked to `.design/feed-ui/project/src/feed_card.jsx` (lines 86–233):**
  1. **Top meta row** (gap 10, mb 10-ish): 18×18 `SourceDot` → source name (ink-700, 12.5px, 500) → middot → time (fg-3, 12px, mono) → optional `官方` mini-chip when `source.kind === 'official'` → right-push → `ScoreBadge` (numeric 18px mono + "/100" fg-3 10px, plus "HOT" amber chip when score ≥ 80).
  2. **Title** (h3, 15.5px/600, ink-900, letter-spacing -0.01em, line-height 1.35).
  3. **Summary** (p, 14px/1.6, ink-700, `text-wrap: pretty`).
  4. **推荐理由 amber callout** (when `item.recommendation` is non-null): padding 10/14, `bg-accent-50`, `border-left: 2px solid var(--accent-500)`, radius `0 6px 6px 0`; tiny amber-700 uppercase eyebrow "Claude 推荐理由" with the 5-point-star glyph; body 13px/1.55 ink-800.
  5. **Tags row** (gap 5, flex-wrap): `<Tag>` chips driven by `item.tags` array. Tag component has 5 tone variants (accent/success/info/danger/neutral) — Phase 4 maps specific tag strings to tones in `src/lib/feed/tag-tones.ts` (fallback: neutral).
  6. **Cluster trigger** (when `cluster.member_count > 1` AND `is_cluster_primary`): dashed-border button "[3 stacked colored squares] 另有 **N** 个源也报道了此事件 [chevron]". `ClusterTrigger` from `feed_card.jsx` lines 52–84.
  7. **Expanded sibling list** (when cluster trigger clicked — Client Component): bordered list of cluster-mates showing `SourceDot` + title (12.5px/500) + source·time·热度N meta + external-link. From `ClusterSiblings` lines 7–50.
  8. **Action bar** (mt 14, pt 12, border-top `--line-weak`): `<IconButton>` star (收藏 tone=accent) + check (like tone=accent) + x (dislike tone=danger) → right-push → source URL text (11.5px fg-4) + external-link IconButton opening `item.url` in a new tab.
- **D-18:** **Card density is fixed to "comfortable"** (`padding: 18px 22px`, title 15.5px, summary 14px). The design's density tweak (compact/comfortable/spacious from `TWEAK_DEFAULTS`) is not exposed to users in v1. Planner keeps the density map in code so a future phase can toggle it.
- **D-19:** **Score badge style is fixed to "numeric"** (the `ScoreBadge` full variant from `primitives.jsx` lines 75–111). Design's "bar" + "flame" alternates are carried in code but not selectable at runtime. `HotnessBar` is still used inside the cluster sibling list meta.

### Timeline grouping
- **D-20:** **Group by hour within day, sorted newest-first, items within each hour sorted by score DESC.** Exact algo from `feed_views.jsx` `groupByHour` (lines 71–82) and `hourLabel` (84–96). Group header is `[今天/昨天/4月19日] [HH:00 mono 15px] [divider rule] [N 条 mono fg-4]`. "今天" / "昨天" relative-day labels computed server-side from the request's UTC day in `Asia/Shanghai` timezone (Chinese-audience default); everything else shows as `M月D日`. Implement in a pure `src/lib/feed/group-by-hour.ts` that accepts an `items` array and the "today" anchor — easily unit-testable.
- **D-21:** **Hour grouping uses `items.published_at` (UTC column) converted to `Asia/Shanghai` before computing the `YYYY-MM-DDTHH` bucket key.** `items.published_at_source_tz` (Phase 2 D-11) is **not** used for grouping — we want audience-local time, not source-local. The `published_at_source_tz` value is available for the item detail page's "原文发布时间 @ source tz" display if the planner chooses to surface it (Claude's discretion).

### Top bar per view
- **D-22:** **`FeedTopBar` layout from `feed_views.jsx` lines 6–68.** Sticky top, `backdrop-filter: blur(8px) saturate(140%)`, bg `color-mix(in oklab, var(--paper) 92%, transparent)`. Contains: view title (22px/600) + subtitle (12.5px fg-3 with item count + last-sync minutes) → right: `[过滤]` ghost button, `[导出]` secondary button, `[手动同步]` primary button. In Phase 4: `[导出]` and `[手动同步]` are **visual only** (disabled or no-op) — admin actions are Phase 6. `[过滤]` opens a popover listing source/tag filters that write to URL search params via `nuqs`.
- **D-23:** **View tabs below the title row:** 精选 / 全部动态 / 收藏 with item counts. Active tab styled with 2px ink-900 underline; clicking tabs navigates between routes (`Link`, not in-place state swap — matches RSC routing). The design's `onViewChange` client-state swap is adapted to Next.js `<Link>` navigation.

### Caching & OG
- **D-24:** **Redis feed cache (FEED-10) using Upstash SDK.**
  - Cache keys: `feed:featured:page:{N}`, `feed:all:page:{N}:tags:{sorted,csv}:source:{id|all}`.
  - Value: serialized JSON of the items array (primary-only, with their cluster-mate count) for that page.
  - TTL: 300s (matches ISR revalidate).
  - **Invalidation trigger:** Trigger.dev's `refresh-clusters` task (Phase 3) calls a new thin invalidator (`src/lib/feed/cache-invalidate.ts`) after each debounced refresh — flushes all keys with prefix `feed:`. Cheap; cluster refreshes are already debounced so flushes don't cascade.
  - **Layer ordering:** Request → CDN/Vercel (ISR cache) → RSC → `getFeed()` → Redis lookup → Neon fallback. ISR is the primary cache; Redis is the warm-start layer for cache-miss RSC requests and for future per-user variations. In practice ISR handles most hits — Redis is belt-and-suspenders for initial cache warm after a deploy or invalidation.
- **D-25:** **OG image strategy (FEED-09) — dynamic via `next/og`.** `/items/[id]/opengraph-image.tsx` renders a 1200×630 PNG server-side via `ImageResponse`: paper background, amber accent bar on the left, title (38px/600 ink-900) + source-name line (16px fg-2) + `HOT` chip for score≥80. WeChat share cards require `og:title`, `og:description`, `og:image` (absolute URL) on the page — Next.js `generateMetadata` returns those. Static fallback PNG at `public/og-default.png` for any route lacking its own OG image (rare — only the feed list routes).

### Interaction gates (Phase 5 handoff)
- **D-26:** **Action buttons render but are click-gated.** The star / check / x IconButtons on every card and the "登录" chip in the sidebar, when clicked, open a stub `<LoginPromptModal>` showing "登录以继续" + a placeholder primary button. The actual provider wiring (GitHub OAuth, magic link) is Phase 5. The modal component is **real** and Phase 4 ships with it; only the "continue with provider" handlers are stubbed. This lets anonymous users see the full design without Phase 5 code leaking in. Modal component lives at `src/components/feed/login-prompt-modal.tsx`.
- **D-27:** **Favorite / like / dislike UI state is **not** persisted in Phase 4.** The design's `localStorage` persistence (`LS_KEY = 'ai-hotspot-state-v1'` from `app.jsx`) is **not** shipped — since clicks are gated by the login modal, there is no state to persist. In Phase 5 these actions write to `favorites` / `votes` tables via server actions; React's `useOptimistic` drives the immediate visual response (per CLAUDE.md §11).

### Component file layout
- **D-28:** **Planner's discretion on exact file names**, but the boundary rule is firm:
  - `src/components/feed/` — reader UI: `feed-card.tsx`, `feed-card-client.tsx` (for cluster expand/action-click state), `timeline.tsx`, `feed-top-bar.tsx`, `login-prompt-modal.tsx`, `score-badge.tsx`, `cluster-trigger.tsx`
  - `src/components/layout/` — shell: `sidebar.tsx`, `nav-row.tsx`, `pipeline-status-card.tsx`, `source-dot.tsx`, `icon.tsx`, `tag.tsx`, `button.tsx`, `icon-button.tsx`
  - `src/app/(reader)/` route group with shared `layout.tsx` that renders the sidebar shell around `{children}`
  - `src/lib/feed/` — data: `get-feed.ts` (cached reader), `source-palette.ts`, `tag-tones.ts`, `group-by-hour.ts`, `cache-invalidate.ts`, `og-payload.ts`
  - `public/fonts/` — Geist-Variable.woff2, JetBrainsMono-Variable.woff2, NotoSansSC-Variable.woff2 (or subset variants)
  - `public/icons/` — used-only subset from `.design/feed-ui/project/ds/icons/`
- **D-29:** **RSC-first.** Everything is Server Component by default. Client boundaries restricted to: login-prompt modal, cluster expand toggle, tag filter chips (URL state), and any element using `useOptimistic` (Phase 5 — not Phase 4). Card itself stays RSC where possible — put the expand-toggle into a small nested Client Component.

### Claude's Discretion (explicit)
- Exact Tailwind v4 `@theme` adaptation of CSS variables (class names vs `--` tokens)
- Whether to inline the 46 icons as a sprite vs individual `/icons/*.svg` files
- The 3 colors in the stacked-monogram cluster trigger indicator (design uses `#D4911C / #2558B5 / #E4572E` — keep these verbatim or use cluster-member source colors?)
- Exact copy of "登录" / "登录后可查看收藏" / "即将开放" / modal heading/body strings (planner iterates; keep Chinese)
- Desktop-first vs mobile-first responsive tactic — FEED-07 requires both ≥375px mobile and desktop work; design is desktop-only (224px sidebar assumes ≥1024px). Planner's call: collapse sidebar into a top-drawer menu below 1024px, or use a `lg:grid-cols-[224px_1fr]` pattern
- Whether to cache the Noto Sans SC subset by glyph (Chinese characters used in current items) vs ship the full 2200-char common set
- Handling of items where `recommendation` is null (skip the amber callout entirely — that's obvious from D-17 step 4)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design contract (authoritative — read first)
- `.design/feed-ui/README.md` — Claude Design bundle handoff instructions. "Recreate them pixel-perfectly in whatever technology makes sense." Do not render in browser / take screenshots.
- `.design/feed-ui/chats/chat1.md` — the designer's reasoning. Explains **why** amber overrides green, **why** hour grouping over minute, **why** V2-disabled nav items; lists all tweakable parameters with defaults.
- `.design/feed-ui/project/index.html` — the runnable prototype; read top to bottom. Lines 8–72 contain the non-obvious global CSS + the full dark-mode token block (preserved in code but gated per D-02).
- `.design/feed-ui/project/ds/colors_and_type.css` — **token authority.** Every Phase 4 color/type/radius/spacing value traces back to this file. Do not invent new tokens; add them here if absolutely needed and justify in the plan.
- `.design/feed-ui/project/ds/fonts/README.md` — font strategy (Geist + JetBrains Mono, self-hosted; `fonts.googleapis.com` fallback is **rejected** per FEED-08).
- `.design/feed-ui/project/ds/icons/README.md` — icon naming conventions.

### Prototype component files (behavior + layout reference)
- `.design/feed-ui/project/src/primitives.jsx` — `Icon`, `SourceDot`, `SourceChip`, `Tag`, `ScoreBadge` (full/compact), `HotnessBar`, `Button`, `IconButton`, `Divider`, `Eyebrow`. Port each to `src/components/layout/` or `src/components/feed/`.
- `.design/feed-ui/project/src/feed_card.jsx` — `FeedCard`, `ClusterTrigger`, `ClusterSiblings`. The centerpiece; visual contract for D-17.
- `.design/feed-ui/project/src/feed_views.jsx` — `FeedTopBar`, `Timeline`, `groupByHour`, `hourLabel`, `FeedView`, `EmptyState`. D-20..D-23 reference this.
- `.design/feed-ui/project/src/sidebar.jsx` — `Sidebar`, `NavRow`, `SectionLabel`, `NAV_READER`, `NAV_ADMIN`. D-08..D-12 reference this.
- `.design/feed-ui/project/src/app.jsx` — root `App` component; shows theme toggle + localStorage persistence model. **Ignore** the tweaks/localStorage plumbing for Phase 4 (D-18, D-27).
- `.design/feed-ui/project/src/data.jsx` — demo `SOURCES`, `TAGS`, `FEED` fixtures. Use as **shape reference** for the real DB-backed query; do not ship this data.
- `.design/feed-ui/project/src/admin_views.jsx` — Phase 6 material; skim for nav-IA consistency, otherwise skip.
- `.design/feed-ui/project/src/tweaks.jsx` — EDITMODE tooling; **not shipping** (D-18, D-19).

### Project truth
- `.planning/REQUIREMENTS.md` §Feed UI — FEED-01..FEED-12 are the Phase 4 acceptance bar. Note D-02 explicitly overrides FEED-06's "green accent" text.
- `.planning/ROADMAP.md` §"Phase 4: Feed UI" — Goal + 5 Success Criteria (anonymous read on both views, detail page, WeChat OG, 375px mobile + desktop, Noto Sans SC self-hosted).
- `.planning/PROJECT.md` — Constraints + Key Decisions. Note D-02 explicitly overrides the "dark theme, green accent" design anchor.
- `.planning/STATE.md` §Decisions — captures Drizzle + Neon HTTP driver locked; RSC-first pattern from CLAUDE.md §1.
- `CLAUDE.md` §1 Rendering Strategy, §10 Styling (Tailwind v4 + shadcn), §11 State Management, §12 Image handling — the default-to-RSC + nuqs + useOptimistic patterns are binding.

### Prior phase artifacts (locked decisions Phase 4 depends on)
- `.planning/phases/03-llm-pipeline-clustering/03-CONTEXT.md` — clustering semantics (D-03 threshold 0.82, D-05 primary-item selection by earliest timestamp). `is_cluster_primary` + `member_count` + cluster join pattern live here.
- `.planning/phases/02-ingestion-pipeline/02-CONTEXT.md` — source schema (`sources.name`, `is_active`, health counters), item schema (`published_at` UTC, `published_at_source_tz`, `content_hash`). Phase 4 reads; does not modify.
- `.planning/phases/01-infrastructure-foundation/01-CONTEXT.md` — Upstash Redis client singleton at `src/lib/redis.ts`; Drizzle+Neon client at `src/lib/db/client.ts`. Phase 4 feed-cache layer (D-24) imports both.

### Existing code Phase 4 extends
- `src/lib/db/schema.ts` — `items`, `clusters`, `sources`, `tags` tables. Every column Phase 4 needs exists.
- `src/lib/db/client.ts` — Drizzle+Neon HTTP singleton.
- `src/lib/redis.ts` — Upstash client singleton. Phase 4 adds `src/lib/feed/cache-invalidate.ts` that calls into it.
- `src/app/layout.tsx` — **must be rewritten.** Current `next/font/google` Geist import violates FEED-08. Replace with self-hosted font `@font-face` declarations in `globals.css` (D-05).
- `src/app/page.tsx` — **must be replaced.** Currently the Next.js scaffold. Phase 4 replaces with the 精选 RSC.
- `src/app/globals.css` — extend with the full design-token block (D-04) and `@font-face` declarations (D-05). Keep `@import 'tailwindcss';` at top; replace the scaffold's light/dark `@media (prefers-color-scheme)` with D-02's light-only regime.
- `src/trigger/refresh-clusters.ts` (Phase 3) — extended with a post-success call to `invalidateFeedCache()` (D-24).

### External docs (planner should fetch via Context7 or web at research time)
- Next.js 15 App Router — `generateMetadata`, `opengraph-image.tsx`, route groups `(reader)` — https://nextjs.org/docs/app
- `next/og` `ImageResponse` API — https://nextjs.org/docs/app/api-reference/functions/image-response
- Tailwind v4 `@theme` directive + shadcn v4 setup — https://tailwindcss.com/docs/v4-beta
- `nuqs` URL state — https://nuqs.47ng.com/
- Upstash Redis client — https://upstash.com/docs/redis/sdks/ts/overview
- WeChat OG card requirements — absolute URL required for `og:image`; 5:2.6 ratio recommended (1200×630 standard works)
- Noto Sans SC subset tooling — `fonttools pyftsubset` for glyph-level subsetting if the full font is too large

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/redis.ts`** — Upstash client singleton. Phase 4's `cache-invalidate.ts` + `get-feed.ts` import this directly.
- **`src/lib/db/client.ts`** + **`src/lib/db/schema.ts`** — Drizzle+Neon HTTP. Phase 4 uses `drizzle-orm`'s relational queries (`db.query.items.findMany({ with: { cluster: true, source: true, tags: true } })`) or explicit joins — planner's choice.
- **`src/trigger/refresh-clusters.ts`** (Phase 3) — Trigger.dev task that runs after each ingest wave. Phase 4 adds a post-success callback to invalidate the Redis feed cache (D-24).
- **Pre-commit UUID hook** (Phase 1 D-08) — scans for ACCESS_KEY-shaped patterns. No Phase 4 surface should log secrets, but the hook is the backstop.

### Established Patterns
- **Drizzle migration naming:** `drizzle/0000_*`, `0001_*`, `0002_*`, `0003_*`. Phase 4 **does not need a new migration** — every column already exists (verified against `src/lib/db/schema.ts`).
- **Core-logic / adapter split** (Phase 2 pattern): pure modules in `src/lib/feed/` with injected DB client; thin Next.js page/route adapters consume them. `getFeed({ db, redis, view, page, tags })` rather than baking the Drizzle client into the page.
- **Env var naming:** `SCREAMING_SNAKE_CASE`, documented in `.env.example`. Phase 4 likely needs: `NEXT_PUBLIC_SITE_URL` (for absolute OG image URLs) — confirm planner adds if missing.
- **UTC timestamps:** `published_at` is TIMESTAMPTZ, stored UTC. Phase 4 converts to `Asia/Shanghai` only at render-time in `groupByHour` (D-20/D-21). Use `date-fns-tz` for the conversion (adds one dep; CLAUDE.md §Supporting Libraries already lists `date-fns`).

### Integration Points
- **No auth yet (Phase 5).** Every Phase 4 page assumes anonymous; the login prompt modal is the seam where Phase 5 plugs its providers in.
- **No admin surfaces (Phase 6).** Sidebar admin nav items are visual-only placeholders.
- **Vercel deployment environment** — provides `NEXT_PUBLIC_VERCEL_URL` automatically on previews, which feeds the absolute-URL requirement for `og:image`. Fall back to `NEXT_PUBLIC_SITE_URL` on production.
- **Trigger.dev `refresh-clusters` task** — Phase 4 hooks into its success path to invalidate Redis. This crosses the process boundary (Trigger.dev worker → Upstash) but it's a single HTTP call.
- **ISR + Redis layering** — Vercel's ISR sits in front of the RSC; Redis sits behind it. Cache-busting on cluster refresh must invalidate both: Redis flush + `revalidateTag('feed')` (or `revalidatePath`) called from the Trigger.dev worker via a Next.js internal endpoint (`/api/revalidate` with a shared-secret header). Planner researches the cleanest revalidate-from-worker pattern.

</code_context>

<specifics>
## Specific Ideas

- **"Recreate, don't copy"** is the design bundle's core instruction. The `.jsx` files use inline-style objects; the Next.js port should express the same visual output via Tailwind v4 utilities (or CSS Modules where utilities get gnarly). The prototype's `window.*` globals, UMD React, and Babel-standalone setup are **not** ported.
- The design's honey-amber feels intentional — the chat transcript called it "brand consistency with Testify." Treat this as the brand. Later phases should not reintroduce green; any success-semantic UI uses `--success-500` specifically because it is *not* the brand accent.
- **"另有 N 个源也报道了此事件"** is the exact string (from `feed_card.jsx` line 81). Do not paraphrase — it is the product's differentiator wording and matches PROJECT.md.
- **"Claude 推荐理由"** eyebrow (uppercase, amber-700, with the 5-point-star glyph) is a visual signature — keep exactly.
- The sidebar's pipeline-status card turns this product into something that feels *alive*. That feels worth preserving even though it's not in any FEED-* requirement. D-11 keeps it.
- ⌘K in the sidebar is a visual promise — not wiring it in v1 is acceptable (SEARCH-01 is v2) but keep the visual so users know it's coming.
- Design's `tweaks` panel model (density / badge style / show-reason) is valuable admin tooling for Phase 6's 后台 dashboard — defer exposure, preserve the variants in code (D-18, D-19).

</specifics>

<deferred>
## Deferred Ideas

- **Runtime dark-mode toggle.** Design's `data-theme="dark"` block is preserved in code but not exposed. Revisit when a user asks, or in v2 when multi-theme becomes worth the test-matrix cost.
- **Featured-view "当前生效策略" bar.** Design includes this, but active strategies are STRAT-01 (v2). Phase 4 hides the bar; Phase 6 or v2 can wire it up.
- **Infinite scroll for `/all`.** Rejected in favor of numbered pagination (D-14) because RSC+ISR composition. Can be revisited if product analytics show drop-off at page 2.
- **Tweaks panel (density / badge style / show-reason).** Deferred to Phase 6's admin dashboard — the variants remain in code.
- **User-facing theme/density/badge-style toggles in the UI.** Not in v1 scope; no requirement pulls for them.
- **Source logos / favicons.** Design uses monogram dots, which avoids the per-source asset pipeline. Keep the monogram model in v1; revisit if branding pressure arises.
- **Command palette (⌘K search).** SEARCH-01 is v2. Visual stub only in v4.
- **信源提报 (user-submitted source reports).** Explicitly v2 per PROJECT.md "Out of Scope"; nav renders with V2 chip.
- **低粉爆文 section.** Explicitly v2; nav renders with V2 chip.
- **Detail-page side drawer** (mentioned as "next steps" in the chat transcript). Phase 4 keeps a full page at `/items/[id]`; drawer pattern can be a later UX polish phase.
- **Realtime / push updates.** Out of scope per REQUIREMENTS.md "Real-time (<5 min) ingestion" row.
- **English UI toggle.** I18N-01 is v2.

</deferred>

---

*Phase: 04-feed-ui*
*Context gathered: 2026-04-22*
