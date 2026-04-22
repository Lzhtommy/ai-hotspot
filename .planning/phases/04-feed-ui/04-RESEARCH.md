# Phase 4: Feed UI — Research

**Researched:** 2026-04-22
**Domain:** Next.js 15 App Router RSC + ISR, Tailwind v4 theme tokens, self-hosted CJK fonts, nuqs URL state, dynamic OG images via `next/og`, Upstash Redis cache layering, WeChat link-preview behavior
**Confidence:** HIGH (primary stack paths) / MEDIUM (WeChat OG behavior — empirical, not officially documented)

## Summary

Phase 4 is a relatively well-trod path: Next.js 15 App Router with RSC-first pages, per-route ISR via `export const revalidate`, URL state via `nuqs` (server-side `createSearchParamsCache`), a Redis warm-start cache behind ISR, and dynamic OG images via `next/og` `ImageResponse` with an explicitly-loaded CJK font buffer. The stack is fully locked by CLAUDE.md and CONTEXT.md; there are no open tech-choice questions. The research surface is narrow and mostly concerns **correctness traps** — async `params`/`searchParams` in Next.js 15, `next/og` + Chinese character glyph loading, the searchParams-disables-static-generation trap, how to invalidate ISR from a Trigger.dev worker, and the empirical behavior of WeChat's link-preview crawler (which is not officially documented).

The single real unknown is **WeChat share-card behavior**. Industry consensus splits: some sources claim WeChat ignores OG entirely (JS-SDK required), others observe WeChat does crawl a subset of OG tags for regular URL sharing (not Official Account articles). The pragmatic path — emit standards-compliant OG tags, accept that consistent rendering requires JS-SDK which is out of v1 scope — matches the phase boundary (FEED-09 says "OG tags present on item detail pages for WeChat share cards"; it does not require pixel-perfect WeChat rendering).

**Primary recommendation:** Build the feed and detail routes as pure RSC with route-level `revalidate`; put filter/pagination state in `nuqs` cache on the server; emit standards-compliant OG tags via `generateMetadata` + a dynamic `opengraph-image.tsx` per item; self-host Geist + JetBrains Mono + Noto Sans SC via `@font-face` declarations in `globals.css`; gate the "search params disable ISR" trap by using `generateStaticParams` on `/all` sparingly or accepting per-page dynamic rendering behind a tight Redis TTL.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Design authority & conflict resolution**
- **D-01:** The vendored Claude Design bundle at `.design/feed-ui/` is the authoritative visual contract. Recreate pixel-perfectly in Next.js 15 RSC + Tailwind v4; do not copy the prototype's UMD React / window globals / text/babel setup.
- **D-02:** Paper+amber is the default theme; dark mode is deferred. Light/paper ships as the sole theme. Dark-mode token block is preserved in code behind an unused `:root[data-theme="dark"]` selector. **This supersedes FEED-06's "dark theme" text.**
- **D-03:** Green accent in REQUIREMENTS.md is overridden by honey-amber `--accent-500: #D4911C`. `--success-500: #2F7D4F` is reserved for semantic success role only.

**Visual primitives**
- **D-04:** Tokens copied verbatim from `.design/feed-ui/project/ds/colors_and_type.css` into `src/app/globals.css` inside a Tailwind v4 `@theme` block. Preserve `--paper`, `--paper-deep`, `--surface-0/1/2`, `--line-weak/line/line-strong`, `--ink-900..300`, `--accent-50..900`, `--success-500/50`, `--danger-500/50`, `--info-500/50`, `--fg-1..4`, shadows, radii, spacing (4pt base), motion tokens.
- **D-05:** Self-host Geist Variable + Noto Sans SC Variable + JetBrains Mono Variable in `public/fonts/`. `@font-face` in `globals.css`. Font stack: `'Geist', 'Noto Sans SC', ui-sans-serif, system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`. **Delete `next/font/google` import in `src/app/layout.tsx`.** **Zero requests to `fonts.googleapis.com` or `fonts.gstatic.com`.**
- **D-06:** Icons from vendored `.design/feed-ui/project/ds/icons/` subset (21 icons) copied to `public/icons/`, rendered via typed `<Icon name size />`.
- **D-07:** Source visual identity = colored-monogram `<SourceDot>` hardcoded in `src/lib/feed/source-palette.ts`. No external logo files in v1.

**Layout shell**
- **D-08..D-12:** 224px fixed left sidebar + top bar + main scroll column; reader nav (精选/全部/低粉爆文-V2/收藏); admin nav (all Phase 6 placeholders); pipeline-status card RSC-fetches live; user chip renders "登录" ghost button (anonymous state).

**Routes & rendering**
- **D-13:** `/` (精选) — RSC with `export const revalidate = 300`. Query: `status='published'` AND `is_cluster_primary=true` AND `score >= 70` ORDER BY `published_at DESC`.
- **D-14:** `/all` — RSC with `export const revalidate = 300`. **Numbered pagination, 50 items/page**, not infinite scroll. URL params via `nuqs`: `?page=N&tags=a,b&source=c`.
- **D-15:** `/items/[id]` — RSC with `export const revalidate = 3600`. `generateMetadata` returns `og:title/og:description/og:image`.
- **D-16:** `/favorites` — RSC with `export const dynamic = 'force-dynamic'`; Phase 4 renders empty-state "登录后可查看收藏".

**Card anatomy (D-17):** 8-step locked: top meta row / title / summary / 推荐理由 amber callout / tags row / cluster trigger / expanded sibling list (client island) / action bar.
- **D-18:** Card density fixed to "comfortable" (`padding: 18px 22px`).
- **D-19:** Score badge style fixed to "numeric".

**Timeline grouping (D-20, D-21):** Group by hour within day, newest-first, items within hour sorted by score DESC. Day labels `今天/昨天/M月D日`. Use `items.published_at` converted to `Asia/Shanghai`. Pure `src/lib/feed/group-by-hour.ts`.

**Top bar (D-22, D-23):** `FeedTopBar` layout from design; `[导出]` and `[手动同步]` buttons visual-only (disabled); `[过滤]` opens popover on `/all` writing to URL params; view tabs are `<Link>` navigation.

**Caching & OG**
- **D-24:** Redis feed cache. Keys: `feed:featured:page:{N}`, `feed:all:page:{N}:tags:{csv}:source:{id|all}`. TTL 300s. Invalidator `src/lib/feed/cache-invalidate.ts` called from Trigger.dev `refresh-clusters` post-success callback. **Layer order:** CDN ISR → RSC → `getFeed()` → Redis → Neon.
- **D-25:** OG image via dynamic `next/og` at `/items/[id]/opengraph-image.tsx` rendering 1200×630 PNG. Static fallback at `public/og-default.png`.

**Interaction gates**
- **D-26:** Action buttons render but click-gated to `<LoginPromptModal>`. Modal component is real; only provider handlers stubbed.
- **D-27:** Favorite/like/dislike UI state **not** persisted in Phase 4 (no localStorage).

**File layout (D-28, D-29):** Planner's discretion on exact file names within `src/components/feed/`, `src/components/layout/`, `src/app/(reader)/`, `src/lib/feed/`. **RSC-first**: client boundaries restricted to login modal, cluster expand, tag filter chips.

### Claude's Discretion

- Exact Tailwind v4 `@theme` adaptation of CSS variables (class names vs `--` tokens)
- Whether to inline 21 icons as sprite vs individual `/icons/*.svg`
- Three-color cluster-trigger stacked monograms — **resolved in UI-SPEC: keep design's verbatim `#D4911C / #2558B5 / #E4572E`**
- Exact copy for "登录" / empty-state / modal strings — **resolved in UI-SPEC**
- Mobile responsive tactic: left-drawer behind menu icon vs grid collapse — **resolved in UI-SPEC: left-drawer**
- Noto Sans SC: full 2200-glyph common subset vs dynamic per-corpus subsetting — **resolved in UI-SPEC: full 2200-glyph common subset**
- Null-recommendation items: skip amber callout (obvious from D-17 step 4)

### Deferred Ideas (OUT OF SCOPE)

- Runtime dark-mode toggle (token block preserved in code behind unused selector)
- Featured-view "当前生效策略" bar (STRAT-01 is v2)
- Infinite scroll for `/all` (rejected in favor of numbered pagination)
- Tweaks panel (density/badge-style/show-reason toggles)
- User-facing theme/density toggles
- Source logos / favicons (monogram dots used instead)
- Command palette ⌘K search (SEARCH-01 is v2 — visual stub only)
- 信源提报 (v2)
- 低粉爆文 (v2 — nav renders with V2 chip)
- Detail-page side drawer (Phase 4 ships full `/items/[id]` page)
- Realtime / push updates (out of scope)
- English UI toggle (I18N-01 is v2)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEED-01 | `/` (精选) renders top-scoring items with ISR (5-min revalidate), grouped by time | `export const revalidate = 300` on RSC page; `group-by-hour.ts` module; query via `getFeed({view: 'featured'})` with Redis cache behind ISR |
| FEED-02 | `/all` renders full chronological feed with pagination | RSC + `nuqs` `createSearchParamsCache` on server; numbered pagination (50/page); each page gets its own ISR entry |
| FEED-03 | Item card shows source+badge, title, Chinese summary, hotness score, 推荐理由, tags, cluster count | 8-step card anatomy locked in D-17; all columns already populated on `items` from Phase 3 |
| FEED-04 | Item detail page shows full summary, cluster members, original link | RSC at `/items/[id]` with `revalidate = 3600`; joins `items` on `cluster_id` for siblings |
| FEED-05 | Timeline groups items by HH:MM within a day; day headers | `group-by-hour.ts` pure module; Asia/Shanghai conversion via `date-fns-tz` |
| FEED-06 | Design matches reference (overridden by D-02/D-03: paper+amber, not dark+green) | Recreate `.design/feed-ui/` bundle pixel-perfect in Tailwind v4 |
| FEED-07 | Responsive ≥375px mobile + desktop | Left-drawer sidebar on <1024px; card padding/buttons drop to compact at <sm |
| FEED-08 | CJK fonts self-hosted; never loaded from Google Fonts | `@font-face` in `globals.css` → `/fonts/*.woff2`; delete `next/font/google` Geist import; verification via network-request assertion |
| FEED-09 | OG tags on item detail pages for WeChat share cards | `generateMetadata` returns absolute-URL og:*; dynamic `/items/[id]/opengraph-image.tsx`; WeChat crawler behavior is empirical (see Pitfall 6) |
| FEED-10 | Redis feed cache (5-min TTL) invalidated on cluster refresh | Upstash SCAN+DEL on `feed:*` prefix from Trigger.dev worker post-success callback |
| FEED-11 | Chinese-only UI; English items show Chinese-translated title and summary | `title_zh` / `summary_zh` columns already populated by Phase 3; card component reads `title_zh ?? title` |
| FEED-12 | Source filter / tag filter controls on `/all` | `nuqs` URL state; `FilterPopover` client component; query builder concatenates WHERE clauses |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Feed rendering (精选/全部/详情) | Frontend Server (RSC) | CDN (ISR) | RSC-first per CLAUDE.md §1; ISR caches rendered HTML at CDN edge |
| Data access (items/clusters/sources) | API/Backend (server-only `src/lib/feed/`) | Database (Neon pgvector) | Core-logic/adapter split from Phase 2 — pure modules consumed by RSC pages |
| URL state (filters, pagination, cursor) | Browser | Frontend Server (nuqs cache parses on RSC) | `nuqs/server` reads server-side; `nuqs` client hook writes to URL without re-roundtripping |
| Feed cache (pre-ISR warm) | Backend (Upstash Redis HTTP) | — | Redis is belt-and-suspenders behind ISR; HTTP-only so edge-compatible |
| OG metadata | Frontend Server (`generateMetadata`) | — | Runs at route prerender; emits static `<meta>` tags that WeChat (and Facebook/Twitter/LinkedIn/Slack) crawlers consume |
| OG image generation | Frontend Server (Edge runtime `ImageResponse`) | CDN | `next/og` renders on edge; PNG cached by CDN until ISR invalidation |
| Cluster-expand toggle | Browser (client island) | — | Minimal `'use client'` wrapper around expanded sibling list |
| Login-prompt modal | Browser (client component) | — | Focus trap + escape-to-close requires client JS |
| Filter popover | Browser (client component) | Frontend Server (nuqs reads URL) | Writing URL state requires client router hook; RSC reads the resulting params |
| Font delivery | CDN (Vercel static) | — | `public/fonts/*.woff2` served by Vercel CDN with long-cache headers |
| Pipeline-status card data | Frontend Server (RSC query to `sources`/`pipeline_runs`) | — | RSC-fetched live per-request; no cache (fresh sync-minutes display) |
| Feed cache invalidation | Backend (Trigger.dev worker → Upstash HTTP → Next.js `/api/revalidate`) | — | Crosses process boundary; single HTTP call from worker |

## Standard Stack

### Core (all already installed per `package.json`)

| Library | Version (installed) | Version (latest) | Purpose | Why Standard |
|---------|---------------------|------------------|---------|--------------|
| `next` | `^15` (15.x) | 16.2.4 `[VERIFIED: npm view]` | App Router framework | Locked by CLAUDE.md; Phase 1 pinned to 15.x |
| `react` / `react-dom` | `^18` | — | UI runtime | Locked by Phase 1 |
| `drizzle-orm` | `^0.45.2` | 0.45.2 `[VERIFIED: package.json]` | DB access | Locked; `drizzle-orm/neon-serverless` driver (Pool) in use |
| `@upstash/redis` | `^1.37.0` | 1.37.0 `[VERIFIED]` | Feed cache | Already wired in `src/lib/redis/` |
| `tailwindcss` | `^4` | 4.2.4 `[VERIFIED: npm view]` | Styling | Locked; `@tailwindcss/postcss` v4 installed |
| `@anthropic-ai/sdk` | `^0.90.0` | — | — | Not used in Phase 4 (Phase 3 responsibility) |

### New additions required for Phase 4

| Library | Version (verified latest) | Purpose | Why Standard |
|---------|---------------------------|---------|--------------|
| `nuqs` | 2.8.9 `[VERIFIED: npm view nuqs version]` | Type-safe URL search params (server + client) | CLAUDE.md §11 explicitly names nuqs. Supports RSC via `createSearchParamsCache` (Next.js 15 async-searchParams compatible) `[CITED: nuqs.47ng.com/docs/server-side]` |
| `date-fns-tz` | 3.2.0 `[VERIFIED: npm view date-fns-tz version]` | Timezone conversion (UTC → Asia/Shanghai) for hour grouping | `date-fns` 4.x already listed in CLAUDE.md §Supporting Libraries; `-tz` sibling package handles `formatInTimeZone` |
| `date-fns` | 4.1.0 `[VERIFIED: npm view]` | Date formatting (day labels, relative time) | CLAUDE.md-approved |
| `clsx` or `class-variance-authority` | — | Conditional className composition (shadcn-standard) | Planner's choice; trivial utility |

### Optional (planner discretion — install only if elected per UI-SPEC)

| Library | Version | Purpose | Use When |
|---------|---------|---------|----------|
| `@radix-ui/react-dialog` | — | Login-prompt modal — focus trap + accessible | UI-SPEC allows installing shadcn `dialog` instead |
| `@radix-ui/react-popover` | — | Filter popover on `/all` | UI-SPEC allows installing shadcn `popover` instead |
| shadcn/ui CLI — `dialog`, `popover` components | — | Pre-wrapped Radix primitives with Tailwind v4 tokens | Planner may run `npx shadcn@latest add dialog popover` if time-boxed; otherwise hand-port Radix directly |

### Fonts to vendor (into `public/fonts/`)

| File | Source | Subset | Size |
|------|--------|--------|------|
| `Geist-Variable.woff2` | https://github.com/vercel/geist-font/releases (SIL OFL 1.1) `[CITED: .design/feed-ui/project/ds/fonts/README.md]` | Latin + extended Latin | ~95KB |
| `JetBrainsMono-Variable.woff2` | https://github.com/JetBrains/JetBrainsMono/releases (SIL OFL 1.1) | Latin | ~90KB |
| `NotoSansSC-Variable.woff2` | https://fonts.google.com/noto/specimen/Noto+Sans+SC — **download the .woff2, do NOT use the CSS link** | Full 2200-glyph common subset (per UI-SPEC D-28 resolution) | ~1.3MB |

**CRITICAL:** `next/font/google` Geist import currently at `src/app/layout.tsx:2` must be deleted. This is the sole FEED-08 violation in the current codebase. `[VERIFIED: Read src/app/layout.tsx]`

### Alternatives Considered

| Instead of | Could Use | Why Not | Tradeoff |
|------------|-----------|---------|----------|
| `nuqs` for URL state | Raw `searchParams` destructuring | nuqs gives type-safe parsers + default values + `useQueryState` client hook; raw prop is strings-only and Next.js 15 async | CLAUDE.md already mandates nuqs |
| Infinite scroll for `/all` | IntersectionObserver + client-fetched pagination | Defeats RSC + ISR — the whole point is each page is statically generated and CDN-cached | D-14 locked: numbered pagination |
| `next/og` Edge runtime for OG image | Static `opengraph-image.png` file | Static would need per-item PNGs (144k items). Dynamic `ImageResponse` + CDN cache is the standard | Edge runtime required; Node runtime does NOT support `ImageResponse` correctly |
| Storing feed cache in Next.js `unstable_cache` | Upstash Redis | Redis is belt-and-suspenders + multi-instance coherent + explicit invalidation from Trigger.dev worker; `unstable_cache` is per-deployment and opaque | D-24 locked: Redis |
| Client-side pagination controls | Server-routed links with `<Link href="?page=N">` | Client-side loses URL-as-state + ISR; server-routed gets SSR + CDN cache for free | Use `<Link>` |
| Rendering item detail at Node runtime | Rendering at Edge runtime | Item detail page itself can stay Node (Drizzle+Neon Pool). **Only the `opengraph-image.tsx` route must be Edge.** | Route-level `export const runtime = 'edge'` on the OG image route only |

**Installation:**
```bash
pnpm add nuqs date-fns date-fns-tz
# Optional (per planner discretion):
pnpm add clsx
# If elected — adds shadcn dialog + popover + their Radix peers:
pnpm dlx shadcn@latest init  # only if not already initialized
pnpm dlx shadcn@latest add dialog popover
```

**Version verification performed 2026-04-22** via `npm view <pkg> version`:
- `nuqs` 2.8.9
- `date-fns` 4.1.0
- `date-fns-tz` 3.2.0
- `next` 16.2.4 (locked to `^15` by Phase 1 — do NOT upgrade)
- `tailwindcss` 4.2.4
- `@upstash/redis` 1.37.0
- `drizzle-orm` 0.45.2

## Architecture Patterns

### System Architecture Diagram

```
Anonymous reader
      │
      ▼  HTTPS
┌─────────────────────────────────────┐
│  Vercel Edge (CDN)                  │
│  - serves public/fonts/*.woff2      │
│  - serves public/icons/*.svg        │
│  - serves ISR HTML for /, /all,     │
│    /items/[id] (300s / 300s / 3600s)│
└──────────────┬──────────────────────┘
               │ ISR miss / stale
               ▼
┌─────────────────────────────────────┐
│  Next.js RSC page render            │
│  ─ reads URL params via             │
│    createSearchParamsCache (nuqs)   │
│  ─ calls getFeed / getItem /        │
│    getCluster from src/lib/feed/    │
│  ─ returns Server Component tree    │
│    with embedded small Client       │
│    islands (cluster-expand,         │
│    filter-popover, login-modal)     │
└──────────────┬──────────────────────┘
               │
               ├────── generateMetadata (per-route) ──► HTML <head> og:* meta tags
               │
               ├────── opengraph-image.tsx (/items/[id], Edge runtime) ──►
               │                  ImageResponse  → 1200×630 PNG cached by CDN
               │
               ▼
┌─────────────────────────────────────┐
│  src/lib/feed/get-feed.ts           │
│  1. Redis GET feed:*:page:N:...     │────► Upstash Redis HTTP
│  2. On miss, query Neon via Drizzle │────► Neon Postgres
│  3. Redis SETEX with 300s TTL       │
│  4. Return items[]                  │
└─────────────────────────────────────┘

Cache invalidation path (out-of-band):
Trigger.dev refresh-clusters task (Phase 3) ─────┐
    │ post-success callback                      │
    ▼                                            ▼
cache-invalidate.ts: Upstash SCAN feed:*     fetch('/api/revalidate',
    → DEL each key                            { headers: 'x-secret': ... })
                                                  │
                                                  ▼
                                              revalidateTag('feed')
                                              revalidatePath('/')
                                              revalidatePath('/all')
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (reader)/                   # route group — shared layout renders sidebar shell
│   │   ├── layout.tsx              # RSC — renders <Sidebar> + <main>{children}</main>
│   │   ├── page.tsx                # /  (精选)  — export const revalidate = 300
│   │   ├── all/
│   │   │   └── page.tsx            # /all — export const revalidate = 300
│   │   ├── favorites/
│   │   │   └── page.tsx            # /favorites — export const dynamic = 'force-dynamic'
│   │   └── items/
│   │       └── [id]/
│   │           ├── page.tsx              # /items/[id] — export const revalidate = 3600
│   │           └── opengraph-image.tsx   # Edge runtime, dynamic OG PNG
│   ├── api/
│   │   └── revalidate/
│   │       └── route.ts            # POST from Trigger.dev worker w/ shared secret
│   ├── layout.tsx                  # ROOT — self-hosted @font-face via globals.css
│   │                                 NOTE: delete next/font/google import
│   └── globals.css                 # @theme block + @font-face declarations
├── components/
│   ├── layout/                     # shell primitives (ported from design)
│   │   ├── sidebar.tsx             # RSC shell
│   │   ├── sidebar-mobile-drawer.tsx  # Client — drawer open/close state
│   │   ├── nav-row.tsx
│   │   ├── section-label.tsx
│   │   ├── pipeline-status-card.tsx  # RSC — live data
│   │   ├── user-chip.tsx           # Client — opens LoginPromptModal
│   │   ├── source-dot.tsx
│   │   ├── icon.tsx
│   │   ├── tag.tsx
│   │   ├── button.tsx
│   │   ├── icon-button.tsx
│   │   ├── divider.tsx
│   │   └── eyebrow.tsx
│   └── feed/                       # feed-specific
│       ├── feed-card.tsx           # RSC outer wrapper
│       ├── feed-card-actions.tsx   # Client island — click-gate + cluster expand
│       ├── cluster-trigger.tsx     # Client — owns expand state
│       ├── cluster-siblings.tsx    # RSC — gets hidden toggled via parent
│       ├── timeline.tsx            # RSC
│       ├── feed-top-bar.tsx        # RSC
│       ├── feed-tabs.tsx           # RSC (Link-driven)
│       ├── filter-popover.tsx      # Client — nuqs URL state
│       ├── score-badge.tsx
│       ├── hotness-bar.tsx
│       ├── empty-state.tsx
│       ├── login-prompt-modal.tsx  # Client — modal component (provider-stubbed)
│       └── skeleton-card.tsx       # loading.tsx fallback
├── lib/
│   └── feed/
│       ├── get-feed.ts             # Redis-cached feed reader
│       ├── get-item.ts             # item + cluster-mate reader
│       ├── source-palette.ts       # static map of sourceId → { color, initial }
│       ├── tag-tones.ts            # tag-string → tone map
│       ├── group-by-hour.ts        # pure utility
│       ├── cache-invalidate.ts     # Upstash SCAN+DEL + fetch /api/revalidate
│       ├── og-payload.ts           # assembles og:{title,description,image}
│       └── search-params.ts        # nuqs createSearchParamsCache singleton
public/
├── fonts/
│   ├── Geist-Variable.woff2
│   ├── JetBrainsMono-Variable.woff2
│   └── NotoSansSC-Variable.woff2
├── icons/
│   └── {sparkles,inbox,arrow-up-right,...}.svg  # 21 icons
└── og-default.png
```

### Pattern 1: RSC page with ISR + nuqs searchParams

**What:** Top-level App Router page reads URL search params server-side (typed via nuqs), calls a data access function, and returns a Server Component tree. `export const revalidate = 300` caches the rendered HTML at Vercel's CDN for 5 minutes.

**When to use:** `/` and `/all` — anything where the same URL serves the same content for all users in a 5-min window.

**Gotcha:** In Next.js 15, `searchParams` is `Promise<SearchParams>` — you MUST await it before passing to the nuqs parser `[CITED: nextjs.org/docs/messages/sync-dynamic-apis]`.

**Gotcha:** Using `searchParams` at all makes a route default to dynamic rendering. To keep ISR working with search params, we use `nuqs` with `createSearchParamsCache` AND keep `revalidate = 300`, which Next.js honors — each unique param combination gets its own ISR cache entry (bounded by how many combinations are requested) `[CITED: nextjs.org/docs/app/guides/incremental-static-regeneration]`. This is the standard pattern.

**Example:**
```typescript
// src/app/(reader)/all/page.tsx
// Source: https://nuqs.47ng.com/docs/server-side
import { createSearchParamsCache, parseAsInteger, parseAsArrayOf, parseAsString } from 'nuqs/server';
import { getFeed } from '@/lib/feed/get-feed';
import { Timeline } from '@/components/feed/timeline';
import { FeedTopBar } from '@/components/feed/feed-top-bar';

export const revalidate = 300;

const feedParamsCache = createSearchParamsCache({
  page: parseAsInteger.withDefault(1),
  tags: parseAsArrayOf(parseAsString).withDefault([]),
  source: parseAsString.withDefault(''),
});

export default async function AllFeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const { page, tags, source } = feedParamsCache.parse(await searchParams);
  const { items, totalPages } = await getFeed({
    view: 'all',
    page,
    tags,
    sourceId: source || null,
  });
  return (
    <>
      <FeedTopBar view="all" count={items.length} />
      <Timeline items={items} />
      {/* paginator component */}
    </>
  );
}
```

### Pattern 2: generateMetadata + dynamic OG image on item detail

**What:** `/items/[id]/page.tsx` exports both a `generateMetadata` async function (emits HTML `<meta>` tags) and a sibling `opengraph-image.tsx` route (Edge runtime, returns PNG).

**When to use:** Every item detail page — mandatory for FEED-09.

**Gotcha:** `params` is also a Promise in Next.js 15 — await before destructuring.

**Gotcha:** `opengraph-image.tsx` REQUIRES Edge runtime (Node runtime cannot run `ImageResponse` correctly). Add `export const runtime = 'edge'`.

**Gotcha:** `ImageResponse` ships with Noto Sans as the only included font. For Chinese characters, you MUST fetch the font buffer and pass it to `ImageResponse({ fonts: [...] })` — otherwise Chinese characters render as tofu squares `[CITED: nextjs.org/docs/app/api-reference/functions/image-response]`.

**Example:**
```typescript
// src/app/(reader)/items/[id]/page.tsx
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
import type { Metadata } from 'next';
import { getItem } from '@/lib/feed/get-item';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.VERCEL_URL}`;
  return {
    title: `${item.titleZh ?? item.title} | AI Hotspot`,
    description: (item.summaryZh ?? '').slice(0, 160),
    openGraph: {
      title: item.titleZh ?? item.title,
      description: (item.summaryZh ?? '').slice(0, 160),
      url: `${siteUrl}/items/${id}`,
      siteName: 'AI Hotspot',
      type: 'article',
      // Do NOT set 'images' here — Next.js auto-detects opengraph-image.tsx in the same route folder
      // and prepends it to openGraph.images with an absolute URL.
    },
  };
}

// (page body below)
```

```typescript
// src/app/(reader)/items/[id]/opengraph-image.tsx
// Source: https://nextjs.org/docs/app/api-reference/functions/image-response
import { ImageResponse } from 'next/og';
import { getItem } from '@/lib/feed/get-item';

export const runtime = 'edge';
export const alt = 'AI Hotspot item';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: { id: string } }) {
  const item = await getItem(params.id);
  const notoSansSC = await fetch(
    new URL('../../../../../public/fonts/NotoSansSC-Variable.woff2', import.meta.url)
  ).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#FAF8F4', padding: 56, fontFamily: '"NotoSansSC"' }}>
        <div style={{ width: 6, background: '#D4911C', marginRight: 32 }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
          <div style={{ fontSize: 38, fontWeight: 600, color: '#0B0B0C', lineHeight: 1.35, maxWidth: 1000 }}>
            {item?.titleZh ?? item?.title ?? 'AI Hotspot'}
          </div>
          {item && <div style={{ fontSize: 16, color: '#3A3833', marginTop: 16 }}>{item.sourceName}</div>}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'NotoSansSC', data: notoSansSC, style: 'normal', weight: 500 }],
    },
  );
}
```

### Pattern 3: Self-hosted fonts via `@font-face` in globals.css

**What:** Declare `@font-face` blocks inside `src/app/globals.css` pointing to `/fonts/*.woff2` files in `public/`. Register as Tailwind v4 theme variables via `@theme { --font-sans: ... }`.

**When to use:** Always, per FEED-08. Delete any `next/font/google` imports.

**Example:**
```css
/* src/app/globals.css */
/* Source: https://tailwindcss.com/docs/theme + https://tailwindcss.com/docs/adding-custom-styles */
@import 'tailwindcss';

@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Variable.woff2') format('woff2-variations');
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Noto Sans SC';
  src: url('/fonts/NotoSansSC-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+4E00-9FFF, U+3000-303F, U+FF00-FFEF; /* CJK core ranges */
}

@theme {
  --font-sans: 'Geist', 'Noto Sans SC', ui-sans-serif, system-ui, -apple-system,
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace;

  /* Paper + amber palette tokens (abbreviated — port full set from design) */
  --color-paper: #FAF8F4;
  --color-paper-deep: #F2ECE0;
  --color-surface-0: #FFFFFF;
  --color-surface-1: #F6F3EC;
  --color-accent-50: #FCF3E0;
  --color-accent-500: #D4911C;
  --color-accent-700: #8F5D0A;
  --color-ink-900: #0B0B0C;
  --color-ink-700: #3A3833;
  /* ...continue with full token set from .design/feed-ui/project/ds/colors_and_type.css */
}
```

### Pattern 4: Redis cache-aside with Trigger.dev invalidation

**What:** `getFeed()` does a Redis GET; on miss, queries Neon, SETEX with 300s TTL. When Trigger.dev's `refresh-clusters` task succeeds, it calls `cache-invalidate.ts` which SCANs `feed:*` and DELs, then POSTs to `/api/revalidate` with a shared secret to trigger `revalidatePath('/')` + `revalidatePath('/all')`.

**When to use:** All feed-list queries (not item detail — that's rare enough to rely on ISR alone).

**Example:**
```typescript
// src/lib/feed/get-feed.ts
import { redis } from '@/lib/redis/client';
import { db, schema } from '@/lib/db/client';
import { and, eq, desc, inArray, gte } from 'drizzle-orm';

const TTL_SECONDS = 300;

export async function getFeed(params: {
  view: 'featured' | 'all';
  page: number;
  tags?: string[];
  sourceId?: number | null;
}) {
  const key = buildFeedKey(params);
  const cached = await redis.get(key);
  if (cached) return cached as FeedPage;

  const items = await db
    .select(/* ... */)
    .from(schema.items)
    .where(
      and(
        eq(schema.items.status, 'published'),
        eq(schema.items.isClusterPrimary, true),
        params.view === 'featured' ? gte(schema.items.score, 70) : undefined,
        // ...tag/source filters via EXISTS subqueries or array overlap
      )
    )
    .orderBy(desc(schema.items.publishedAt))
    .limit(50)
    .offset((params.page - 1) * 50);

  const result = { items, page: params.page };
  await redis.set(key, result, { ex: TTL_SECONDS });
  return result;
}

function buildFeedKey(p: { view: string; page: number; tags?: string[]; sourceId?: number | null }) {
  const tags = (p.tags ?? []).sort().join(',');
  const source = p.sourceId ?? 'all';
  return p.view === 'featured'
    ? `feed:featured:page:${p.page}`
    : `feed:all:page:${p.page}:tags:${tags}:source:${source}`;
}
```

```typescript
// src/lib/feed/cache-invalidate.ts
import { redis } from '@/lib/redis/client';

export async function invalidateFeedCache() {
  // Upstash @upstash/redis supports SCAN via cursor iteration
  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: 'feed:*', count: 200 });
    if (keys.length > 0) await redis.del(...keys);
    cursor = Number(nextCursor);
  } while (cursor !== 0);

  // Trigger on-demand ISR invalidation in the Next.js app
  const revalidateSecret = process.env.REVALIDATE_SECRET;
  if (revalidateSecret && process.env.NEXT_PUBLIC_SITE_URL) {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': revalidateSecret, 'content-type': 'application/json' },
      body: JSON.stringify({ paths: ['/', '/all'] }),
    }).catch(() => { /* log, don't fail the cluster refresh */ });
  }
}
```

```typescript
// src/app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = request.headers.get('x-revalidate-secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { paths } = (await request.json()) as { paths: string[] };
  for (const path of paths ?? []) revalidatePath(path);
  return NextResponse.json({ ok: true, revalidated: paths });
}
```

### Anti-Patterns to Avoid

- **Using `force-dynamic` on `/all` to silence searchParams errors.** This defeats ISR and removes CDN caching. Instead: keep `revalidate = 300`; each unique `?page=N&tags=a,b` combination becomes its own ISR entry. The total cache universe is bounded (≤ 50 pages × reasonable tag combos). `[CITED: buildwithmatija.com/blog/nextjs-searchparams-static-generation-fix]`
- **Infinite scroll via `'use client'` component fetching more pages.** Breaks ISR, ships more JS, breaks back-button navigation. Pagination is the standard.
- **`next/font/google` for Geist or Noto Sans SC.** Violates FEED-08. The current `src/app/layout.tsx` Geist import is the only current violation — delete it in Phase 4.
- **Skipping the `fonts` param in `ImageResponse` for Chinese content.** Renders Chinese as tofu squares. Pass `fonts: [{ name, data: ArrayBuffer, ... }]` explicitly.
- **Client-side fetching of feed data from RSC pages.** Defeats the whole RSC model. Pass data as props from server pages down to client islands; client islands receive data, they don't fetch it.
- **Fetching the font file from a URL inside `ImageResponse`.** Works in dev, can 404 in production if the URL resolution is wrong. Use `new URL('../../../../../public/fonts/...', import.meta.url)` relative path, which Next.js bundles at build. `[CITED: dev.to/apicrud/using-custom-fonts-vercel-open-graph-og-image-generation-29co]`
- **Reading `searchParams` / `params` synchronously.** Next.js 15 deprecation; becomes a hard error in 15.4+. Always `await params` / `await searchParams`. `[CITED: nextjs.org/docs/messages/sync-dynamic-apis]`
- **Using `new Date().toLocaleString('zh-CN')` in Server Components for timeline labels.** Server runs in UTC; client runs in local tz; results diverge during hydration. Use `date-fns-tz formatInTimeZone(date, 'Asia/Shanghai', 'yyyy-MM-dd HH:mm')` everywhere — deterministic across server + client.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe URL search params parsing | Manual `searchParams.page` → `parseInt` | `nuqs` | Handles arrays, defaults, async `Promise<SearchParams>`, and has a client hook for the filter popover to write back |
| Dynamic OG PNG rendering | HTML-to-canvas server-side lib | `next/og` `ImageResponse` (Edge) | Official, Satori+Resvg under the hood, auto-detected by Next.js at the route folder |
| CJK timezone conversion | Manual `new Date` + UTC offset math | `date-fns-tz formatInTimeZone` | DST-safe, locale-safe, documented |
| Focus-trap modal | Custom `KeyboardEvent` listener | Radix `Dialog` (via shadcn or direct) | Accessibility compliance; handles ESC, focus return, scroll lock |
| Popover positioning | Custom `getBoundingClientRect` + CSS | Radix `Popover` | Handles viewport edges, keyboard navigation |
| Cursor pagination | Homegrown OFFSET/LIMIT with synthetic cursors | Start with OFFSET+LIMIT (50/page) | Phase 4 scale is small; add a cursor parser later only if pagination-at-deep-page becomes slow |
| Feed caching | Manual Map cache in module scope | `@upstash/redis` via `getFeed()` | Module-scope caches don't survive deployments; aren't coherent across Vercel's multi-region functions |
| Intersection-based card "in-view" tracking | IntersectionObserver + state | — (not needed in Phase 4) | Analytics are OPS-05, Phase 6 |

**Key insight:** Phase 4 is mostly composition of well-trod primitives. The only novel bit is the **OG image generation with Chinese font loading** — and that's a single function with a known gotcha. Everything else is pure assembly work.

## Runtime State Inventory

*Not applicable — Phase 4 is greenfield implementation of new pages/components + editing one existing file (`src/app/layout.tsx`). No renames, no migrations, no running services to reconfigure. Nothing stored/registered outside git that needs touching.*

**Exception:** Replacing `next/font/google` with self-hosted fonts in `src/app/layout.tsx` and `src/app/globals.css` is a **code edit only**. Vercel's static CDN picks up `public/fonts/*.woff2` automatically on deploy. No build-artifact cleanup needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres | `getFeed` / `getItem` | ✓ (Phase 1) | pgvector 0.8+ | — |
| Upstash Redis | `getFeed` cache + `cache-invalidate` | ✓ (Phase 1) | — | Cache-miss falls through to Neon (graceful) |
| Trigger.dev worker | `refresh-clusters` calls `cache-invalidate` | ✓ (Phase 3) | v4.4.4 | — |
| Vercel Edge runtime | `opengraph-image.tsx` | ✓ (implicit — platform) | — | — |
| `fonttools pyftsubset` (optional) | Dynamic Noto SC subsetting | ✗ | — | Full 2200-glyph subset (per UI-SPEC resolution); no tool needed |
| Anthropic API | — | — (Phase 3) | — | Not used in Phase 4 |
| Font source: github.com/vercel/geist-font | Download Geist-Variable.woff2 | ✓ (public) | — | Vendored to `public/fonts/` at task time |
| Font source: fonts.google.com/noto (.woff2 download) | Download NotoSansSC-Variable.woff2 | ✓ (public) | — | — |
| `NEXT_PUBLIC_SITE_URL` env var | Absolute URLs for og:url / canonical | ⚠ Not yet set | — | Falls back to `process.env.VERCEL_URL` (auto-set on preview deploys) — **planner MUST add to `.env.example`** |
| `REVALIDATE_SECRET` env var | `/api/revalidate` endpoint auth | ⚠ Not yet set | — | **Planner MUST add to `.env.example`** + wire into Trigger.dev secrets |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** `NEXT_PUBLIC_SITE_URL` and `REVALIDATE_SECRET` — add to `.env.example`; Phase 4 plan must include a task to register these in Vercel + Trigger.dev env UIs before the revalidate loop goes live.

## Common Pitfalls

### Pitfall 1: Next.js 15 async `params` / `searchParams`

**What goes wrong:** Code compiled from Next.js 14 patterns does `const { id } = params` synchronously; in Next.js 15 this emits a deprecation warning, in 15.4+ becomes a hard error.
**Why it happens:** Next.js 15 made `params` and `searchParams` `Promise<...>` to enable streaming + `PPR` (partial prerendering).
**How to avoid:** Always `const { id } = await params`. TypeScript types from Next.js 15 enforce this if your types are up to date.
**Warning signs:** `Error: Route "/items/[id]" used params.id. params should be awaited before using its properties.`
`[CITED: nextjs.org/docs/messages/sync-dynamic-apis]`

### Pitfall 2: `next/og` Chinese characters render as tofu (□□□)

**What goes wrong:** `ImageResponse` only ships with Noto Sans Latin by default; any CJK glyphs render as missing-glyph boxes.
**Why it happens:** Satori (the renderer) has no built-in CJK font; the `@vercel/og` package ships a single Latin font.
**How to avoid:** Fetch a CJK-capable WOFF2 into an ArrayBuffer and pass it via `fonts: [{ name, data, weight, style }]`. Use `new URL('../../../../public/fonts/NotoSansSC-Variable.woff2', import.meta.url)` + `fetch().arrayBuffer()` — Next.js bundles this into the Edge runtime bundle at build. Using a remote URL works in dev but can fail on deploy.
**Warning signs:** OG image renders title as `□□□□` in WeChat/Twitter preview.
`[CITED: github.com/vercel/next.js/issues/45080 + vercel.com/docs/og-image-generation/og-image-api]`

### Pitfall 3: `export const revalidate` silently disabled by dynamic APIs

**What goes wrong:** Adding any dynamic API (`cookies()`, `headers()`, `searchParams` read without nuqs cache, `dynamic = 'force-dynamic'`) in a page disables ISR; `revalidate` is ignored and every request re-renders.
**Why it happens:** Next.js assumes if you read dynamic input you need per-request rendering.
**How to avoid:** For `/all` with `?page=N&tags=...`, use `nuqs createSearchParamsCache` — each unique param combo becomes its own ISR variant. Do NOT use `cookies()`/`headers()` in feed routes. Check the build output ("○ Static" vs "ƒ Dynamic") to confirm routes are pre-rendered/ISR, not dynamic.
**Warning signs:** Vercel build log marks `/all` as `ƒ Dynamic`; response times per-request are ~200-500ms instead of <50ms.
`[CITED: buildwithmatija.com/blog/nextjs-searchparams-static-generation-fix]`

### Pitfall 4: ISR vs Redis cache-invalidation race

**What goes wrong:** Trigger.dev worker calls `cache-invalidate.ts` (flushes Redis) — but Vercel ISR still serves the stale HTML from CDN until its own TTL expires (or until `revalidatePath` fires).
**Why it happens:** Two-layer cache with only one layer invalidated.
**How to avoid:** `cache-invalidate.ts` must do **both** — flush Redis AND POST to `/api/revalidate` endpoint which calls `revalidatePath('/')` + `revalidatePath('/all')`. Shared secret in headers for auth. Graceful failure if the POST fails (log; don't fail the cluster refresh task).
**Warning signs:** New items appear in Redis cache but UI still shows stale feed for up to 5 minutes after cluster refresh.
`[CITED: nextjs.org/docs/app/api-reference/functions/revalidatePath]`

### Pitfall 5: Hydration mismatch from Date formatting

**What goes wrong:** Server renders timestamps in UTC or server-local tz; client re-hydrates with browser-local tz; React throws `Text content does not match`.
**Why it happens:** `new Date().toLocaleString()` uses different timezones on server vs client.
**How to avoid:** Use `date-fns-tz formatInTimeZone(date, 'Asia/Shanghai', 'HH:mm')` consistently — deterministic regardless of runtime tz. Never pass raw `Date` objects to `new Intl.DateTimeFormat()` without an explicit `timeZone` option.
**Warning signs:** Console warning `Hydration failed because the initial UI does not match...` on first load; timestamps visibly flicker from one string to another after hydration.

### Pitfall 6: WeChat link-preview crawler behavior is undocumented and non-standard

**What goes wrong:** Pasting the item URL into a WeChat chat may render a bare URL with no preview card, or render with the first inline image instead of `og:image`, or ignore `og:description`. Behavior is observed to vary between WeChat app versions and Official Account vs regular chat.
**Why it happens:** WeChat does not publish its crawler specification. Community observation (2024-2025):
- For **plain URL paste in chat**, WeChat's crawler DOES read some Open Graph meta tags (`og:title`, `og:image`) but the mapping is inconsistent.
- For **Official Account article embedding**, WeChat requires its **JS-SDK (`wx.updateAppMessageShareData`)** to customize title/description/thumbnail — OG tags are ignored. JS-SDK requires registering a WeChat Official Account, a verified business entity, and domain whitelist config.
- WeChat aggressively caches link previews server-side; changes to OG tags may take hours to days to propagate. There is no public "re-scrape" button like Facebook's Sharing Debugger.
**How to avoid:** Ship standards-compliant OG tags (og:title, og:description, og:image absolute URL, og:url, og:type='article', og:site_name, twitter:card). Accept that WeChat rendering will be best-effort in v1. FEED-09's acceptance criterion is "og:title and og:description render" — testable via `curl` of the HTML source, not via WeChat UI screenshot. The JS-SDK path is explicitly out of scope (requires Chinese business entity per PROJECT.md "Out of Scope: Mainland-China-hosted infrastructure").
**Warning signs:** Product tester reports "my WeChat preview shows no image" — investigate whether it's the cache, whether they're in a Group vs 1:1 chat, whether the domain has been used before.
**Testing:** `curl -s https://site/items/[id] | grep -E '(og:|twitter:)'` verifies the tags exist; visual verification in WeChat requires an actual Chinese phone + manual inspection and is accepted as empirical best-effort.
`[ASSUMED: based on community reports — WeChat behavior is not officially documented]`

### Pitfall 7: Upstash Redis SCAN cursor type

**What goes wrong:** `redis.scan()` returns `[cursor, keys]` — but Upstash's TS SDK returns `cursor` as a string OR number depending on version. Wrong comparison (`cursor !== 0` vs `cursor !== '0'`) creates infinite loop OR premature termination.
**Why it happens:** Upstash's `@upstash/redis` 1.37 types `scan()` return as `[string, string[]]`.
**How to avoid:** Cast explicitly: `cursor = Number(nextCursor)` and compare `cursor !== 0`. Verified on `@upstash/redis@1.37.0` `[CITED: package.json]`.

### Pitfall 8: Large Noto Sans SC WOFF2 blocks LCP

**What goes wrong:** 1.3MB font blocks page render; FCP/LCP regress.
**Why it happens:** Font file is large; even with `font-display: swap` there's a visible FOUT.
**How to avoid:**
1. `font-display: swap` ensures system fallback renders immediately (already specified).
2. Preload the critical font variant in `<head>`: `<link rel="preload" href="/fonts/NotoSansSC-Variable.woff2" as="font" type="font/woff2" crossorigin />`.
3. The ordered font stack puts `'PingFang SC'` (macOS/iOS system) and `'Microsoft YaHei'` (Windows) before Noto — Chinese users with those fonts installed skip the download entirely.
4. Accept the 1.3MB cost per UI-SPEC; Phase 6 can revisit dynamic subsetting if analytics show LCP regression.

### Pitfall 9: `opengraph-image.tsx` running at Node runtime fails silently

**What goes wrong:** Forgetting `export const runtime = 'edge'` on `opengraph-image.tsx` — the route builds but `ImageResponse` may throw at runtime or render corrupt PNG.
**Why it happens:** `ImageResponse` depends on Web APIs (`TextEncoder`, Streams) that are Edge-runtime natives; Node shims exist but are incomplete.
**How to avoid:** Always add `export const runtime = 'edge'` at the top of `opengraph-image.tsx`. Verify via build output: route should be marked `○ Edge` not `○ Node`.

### Pitfall 10: Monorepo / absolute-URL misconfigure of og:image

**What goes wrong:** `og:image` content is `/items/123/opengraph-image` (relative) — WeChat, Twitter, Slack all reject relative OG URLs.
**Why it happens:** Next.js auto-detects `opengraph-image.tsx` but will only emit an absolute URL if `metadataBase` is set in the root layout.
**How to avoid:** In `src/app/layout.tsx`: `export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ai-hotspot.vercel.app'), ... }`. Then Next.js auto-prefixes OG image URLs with it. Verify with `curl` on a deployed URL that og:image starts with `https://`.
`[CITED: nextjs.org/docs/app/api-reference/functions/generate-metadata]`

## Code Examples

### Timeline grouping (pure function, unit-testable)

```typescript
// src/lib/feed/group-by-hour.ts
// Source: port of .design/feed-ui/project/src/feed_views.jsx groupByHour/hourLabel (lines 71-96)
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { startOfDay, differenceInCalendarDays } from 'date-fns';

export type FeedItem = {
  id: string;
  publishedAt: Date;
  score: number;
  // ...
};

export type TimelineGroup = {
  bucketKey: string;        // 'YYYY-MM-DDTHH' in Asia/Shanghai
  dayLabel: string;         // '今天' | '昨天' | 'M月D日'
  hourLabel: string;        // 'HH:00'
  items: FeedItem[];
};

const TZ = 'Asia/Shanghai';

export function groupByHour(items: FeedItem[], now: Date = new Date()): TimelineGroup[] {
  const nowZoned = toZonedTime(now, TZ);
  const today = startOfDay(nowZoned);

  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    const key = formatInTimeZone(item.publishedAt, TZ, "yyyy-MM-dd'T'HH");
    const arr = buckets.get(key) ?? [];
    arr.push(item);
    buckets.set(key, arr);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1)) // newest first
    .map(([bucketKey, groupItems]) => {
      const when = new Date(bucketKey + ':00:00+08:00');
      const diffDays = differenceInCalendarDays(today, startOfDay(toZonedTime(when, TZ)));
      const dayLabel =
        diffDays === 0 ? '今天' : diffDays === 1 ? '昨天' : formatInTimeZone(when, TZ, 'M月d日');
      const hourLabel = formatInTimeZone(when, TZ, 'HH:00');
      const sortedItems = [...groupItems].sort((a, b) => b.score - a.score);
      return { bucketKey, dayLabel, hourLabel, items: sortedItems };
    });
}
```

### Filter popover (client, writes to URL via nuqs)

```typescript
// src/components/feed/filter-popover.tsx
// Source: port of .design/feed-ui/project/src/feed_views.jsx filter row (lines 98-127)
'use client';

import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs';
import * as Popover from '@radix-ui/react-popover';

export function FilterPopover({ availableTags, availableSources }: { /* ... */ }) {
  const [tags, setTags] = useQueryState('tags', parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: false }));
  const [source, setSource] = useQueryState('source', parseAsString.withDefault(''));
  // shallow: false triggers a server-side re-render (RSC re-fetch) on change

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="...">过滤</button>
      </Popover.Trigger>
      <Popover.Content>
        {/* tag chips with aria-pressed, source select */}
      </Popover.Content>
    </Popover.Root>
  );
}
```

### Root layout with metadataBase and self-hosted fonts

```typescript
// src/app/layout.tsx (REPLACES current file)
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
import type { Metadata } from 'next';
import './globals.css';

// NOTE: next/font/google imports REMOVED per FEED-08 + CONTEXT D-05.
// Fonts loaded via @font-face in globals.css from /public/fonts/.

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.VERCEL_URL ?? 'localhost:3000'}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'AI Hotspot',
  description: 'AI 资讯热点聚合 — 每小时抓取、LLM 评分、事件聚合的中文 AI 时间线。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        {/* Preload the critical font variant to reduce FOUT on Chinese-heavy surfaces */}
        <link rel="preload" href="/fonts/NotoSansSC-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink-900 font-sans">
        {children}
      </body>
    </html>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next/font/google` for Chinese | Self-hosted WOFF2 via `@font-face` | GFW-reality driven | Mandatory per FEED-08 |
| `tailwind.config.js` with `fontFamily` object | Tailwind v4 `@theme { --font-sans: ... }` in CSS | Tailwind v4 (early 2025) | Config-in-CSS; no JS config file needed |
| `searchParams` typed `Record<string, string>` | `Promise<Record<string, string>>` (must await) | Next.js 15 | async everywhere; PPR enablement |
| Zustand / Redux for filter state | `nuqs` with URL as state | 2024 App Router maturity | No client state libs needed |
| Hand-rolled `@vercel/og` invocations | `opengraph-image.tsx` route convention | Next.js 13.3+ | Auto-wired into `generateMetadata.openGraph.images` |
| `revalidate` + dynamic APIs → silent downgrade to dynamic | `generateStaticParams` + nuqs cache + explicit `revalidate` | Next.js 14+ hardening | Predictable ISR; searchParams-as-ISR-cache-keys |
| Infinite scroll as default | Numbered pagination for RSC routes | 2024 RSC ecosystem consensus | SEO + CDN cacheability wins |

**Deprecated/outdated:**
- `tailwindcss-animate` — deprecated March 2025; use `tw-animate-css` or inline keyframes. Phase 4 uses only simple CSS transitions (120ms hover) so no animation lib needed. `[CITED: CLAUDE.md §10]`
- Sync `params` destructuring — deprecated in Next.js 15, hard error in 15.4+. `[CITED: nextjs.org/docs/messages/sync-dynamic-apis]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WeChat link-preview crawler reads a subset of Open Graph tags for plain URL paste in chat (not Official Account article embedding). | Pitfall 6 | If WeChat ignores OG entirely, the item preview will render as plain URL with no card. FEED-09 acceptance shifts from "og:title/og:description render in WeChat" to "og:title/og:description exist in HTML source." Phase 4's plan should explicitly state FEED-09 is verified via `curl`-based assertion, with WeChat UI render being best-effort. |
| A2 | Vercel Edge runtime supports `fetch(new URL(..., import.meta.url)).arrayBuffer()` at build-time for font loading into `ImageResponse`. | Pattern 2 + Pitfall 2 | If not, fallback to `fetch(absolute URL)` at runtime — works but adds latency on every OG image cache miss. |
| A3 | Upstash `@upstash/redis@1.37.0` SCAN cursor returns string that can be `Number()`-converted to compare with `0`. | Pitfall 7 | Potential infinite loop on invalidation. Planner should write a unit test. |
| A4 | 50 items/page is a reasonable pagination size. | D-14 | Design bundle doesn't specify. If 50 is too many for mobile scroll-depth or too few for desktop scan, revisit — but D-14 is locked. |
| A5 | `public/fonts/NotoSansSC-Variable.woff2` at ~1.3MB is acceptable page-weight cost. | Pitfall 8 | If LCP regresses beyond an acceptable threshold (> 2.5s on mobile), Phase 6 must revisit dynamic subsetting. No Phase 4 mitigation other than preload. |
| A6 | The current `.env.example` already has `DATABASE_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, Trigger.dev, Anthropic, etc. from Phase 3; Phase 4 only needs to add `NEXT_PUBLIC_SITE_URL` and `REVALIDATE_SECRET`. | Environment Availability | Planner verifies during plan task definition. |
| A7 | `drizzle-orm/neon-serverless` Pool driver (already in use per `src/lib/db/client.ts`) works from RSC and from the `/api/revalidate` Node-runtime route. | Pattern 4 | Confirmed — Phase 3 already uses Pool; works in Node runtime. Edge runtime would require `neon-http` driver but Phase 4 RSC routes run Node by default, which is fine. |
| A8 | WeChat sharing behavior does not require the JS-SDK for the FEED-09 acceptance criterion. | User Constraints / FEED-09 | If product owner clarifies "FEED-09 means the share card must render with thumbnail in WeChat," we need JS-SDK + Official Account + verified business — which is Out of Scope per PROJECT.md. FEED-09 will have to be re-scoped. |

**Risk mitigation:** Each assumption above should be referenced in the plan's "Known Gotchas" section; A1/A2/A8 warrant explicit discussion-phase clarification before implementation begins, but CONTEXT.md has already been approved so the planner should proceed on A1/A2/A8 as written and flag at verify-work if issues arise.

## Open Questions (RESOLVED)

1. **Should `/items/[id]` use `generateStaticParams` to pre-build the top-N most-trafficked item pages?**
   - What we know: Each item page is `revalidate = 3600`; first visit triggers generation, subsequent visits hit CDN until TTL.
   - What's unclear: Whether to pre-build top-50 cluster-primary item pages at build time for faster first-visit.
   - **RESOLVED:** Skip in Phase 4. ISR on first-visit is fast enough. `generateStaticParams` adds build-time coupling to DB state.

2. **Tailwind v4 `@theme` block size.**
   - What we know: The design bundle has ~60 CSS tokens; Tailwind v4 auto-generates a utility per `--color-*`, `--font-*`, `--spacing-*`.
   - What's unclear: Whether to port EVERY token or just the subset actively used — the design carries `--accent-50..900` (10 shades) but only 4 are referenced.
   - **RESOLVED:** Port the full set in `@theme`. Cheap to do; planner discretion.

3. **Shadcn `dialog` + `popover` — install now or hand-roll?**
   - What we know: UI-SPEC permits installation. shadcn components ship Tailwind v3 classes by default; v4 compatibility may require manual class adjustments.
   - What's unclear: Whether the planner's time-budget favors `npx shadcn add dialog popover` (fast) or hand-roll Radix directly (cleaner control).
   - **RESOLVED:** Install shadcn `dialog` + `popover`; accept minor v3→v4 class adjustments (trivially auto-convertible). Saves ~1 hour of focus-trap + keyboard plumbing.

4. **Search-params ISR cache universe size.**
   - What we know: Each `?page=N&tags=a,b,c&source=X` combination is a separate ISR entry.
   - What's unclear: How many combinations will Vercel's ISR store without thrashing? ~50 pages × 10 sources × 2^10 tag subsets is intractable — but real usage concentrates on a few.
   - **RESOLVED:** Accept the "long tail" assumption — Vercel auto-evicts LRU. Add `generateStaticParams` returning `[]` for explicit "ISR for any param combo" if needed.

5. **Dismiss / re-scrape of WeChat share card after content changes.**
   - What we know: WeChat caches previews server-side; no public debugger tool.
   - What's unclear: Whether item edits (which shouldn't happen in v1 — items are immutable after publish per LLM-05) would ever need re-scrape.
   - **RESOLVED:** Non-issue in v1 since items are immutable. Document for Phase 6.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres + pgvector | `getFeed`, `getItem`, `PipelineStatusCard` | ✓ | 0.8+ | — |
| Upstash Redis | feed cache | ✓ | 1.37.0 | Graceful cache-miss → Neon |
| Trigger.dev v4 | `refresh-clusters` → `cache-invalidate` | ✓ | 4.4.4 | — |
| Vercel Edge runtime | `opengraph-image.tsx` | ✓ | — | — |
| `NEXT_PUBLIC_SITE_URL` env | `metadataBase`, absolute og:image | ✗ | — | `VERCEL_URL` auto-set on preview; **add to `.env.example`** |
| `REVALIDATE_SECRET` env | `/api/revalidate` auth | ✗ | — | **Add to `.env.example`** + Trigger.dev secrets |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** `NEXT_PUBLIC_SITE_URL`, `REVALIDATE_SECRET` — add to `.env.example` as part of Phase 4 plan.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (already installed) + Playwright (to be added for E2E) |
| Config file | `vitest.config.ts` (exists; Phase 2 pattern) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test && pnpm typecheck && pnpm lint` |
| E2E command (new) | `pnpm test:e2e` → `playwright test` |
| Network-assertion command | `pnpm verify:feed` → `tsx scripts/verify-feed.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEED-01 | `/` renders top-scored items with ISR + hour-grouping | integration (RSC render) + visual (Playwright) | `pnpm test -- src/app/(reader)/page.test.tsx` + `pnpm test:e2e -- tests/e2e/featured.spec.ts` | ❌ Wave 0 |
| FEED-02 | `/all` renders full chronological feed with pagination | integration + e2e | `pnpm test -- src/app/(reader)/all/page.test.tsx` + `pnpm test:e2e -- tests/e2e/all.spec.ts` | ❌ Wave 0 |
| FEED-03 | Feed card has all 8 anatomy elements | unit (component) | `pnpm test -- src/components/feed/feed-card.test.tsx` | ❌ Wave 0 |
| FEED-04 | `/items/[id]` shows full summary + cluster members + original link | integration | `pnpm test -- src/app/(reader)/items/[id]/page.test.tsx` | ❌ Wave 0 |
| FEED-05 | Hour grouping + day labels correct in Asia/Shanghai | unit (pure function) | `pnpm test -- src/lib/feed/group-by-hour.test.ts` | ❌ Wave 0 |
| FEED-06 | Paper+amber theme tokens applied (overridden from original dark+green) | visual regression | `pnpm test:e2e -- tests/e2e/visual.spec.ts` (Playwright screenshot diff) | ❌ Wave 0 |
| FEED-07 | 375px mobile + desktop layouts render | visual + a11y | `pnpm test:e2e -- tests/e2e/responsive.spec.ts` | ❌ Wave 0 |
| FEED-08 | No request to fonts.googleapis.com or fonts.gstatic.com | network assertion | `pnpm test:e2e -- tests/e2e/no-google-fonts.spec.ts` (Playwright `page.on('request')`) + `scripts/verify-no-google-fonts.ts` (static grep of built output) | ❌ Wave 0 |
| FEED-09 | og:title, og:description, og:image present and absolute | integration + curl | `pnpm test -- tests/meta-tags.test.ts` + manual `curl -sI` of deployed URL | ❌ Wave 0 |
| FEED-10 | Redis feed cache TTL 300s + invalidation on cluster refresh | integration | `pnpm test -- src/lib/feed/cache-invalidate.test.ts` (mocked Redis) | ❌ Wave 0 |
| FEED-11 | English-source items render Chinese title + summary | unit | `pnpm test -- src/components/feed/feed-card.test.tsx` (fixture with English title + populated title_zh) | shared file |
| FEED-12 | Source + tag filter on `/all` reflects in URL | e2e | `pnpm test:e2e -- tests/e2e/filters.spec.ts` | ❌ Wave 0 |

### Dimensions

| Dimension | Scope | Tooling |
|-----------|-------|---------|
| **Unit** | Pure modules: `group-by-hour.ts`, `source-palette.ts`, `tag-tones.ts`, `og-payload.ts` | Vitest |
| **Integration** | RSC page render with mocked `db` + `redis`; `generateMetadata` returns correct object | Vitest + @testing-library/react (RSC via `renderToString`) |
| **E2E** | Real browser flows: nav between pages, filter popover writes URL, pagination, mobile drawer toggle, login modal opens on action click | Playwright |
| **Network assertions** | No request to `fonts.googleapis.com` or `fonts.gstatic.com` during any page load | Playwright `page.on('request')` + post-build static grep of `.next/` output |
| **Visual regression** | Feed card matches design pixel-perfect at 1440×900 desktop + 375×812 mobile | Playwright screenshot diff (vs. baseline in `tests/e2e/baselines/`) |
| **A11y** | Focus-ring visible on all interactive; tab order linear; aria-labels on IconButtons; color contrast WCAG AA | Playwright + `@axe-core/playwright` |
| **Meta-tag** | `generateMetadata` output has absolute URLs, og:title, og:description, og:image | Vitest integration + `curl -sI` on deployed URL |

### Sampling Rate (Nyquist)

- **Per task commit:** `pnpm test && pnpm typecheck && pnpm lint` (< 15 seconds expected after Phase 4 tests exist)
- **Per wave merge:** Full suite including `pnpm test:e2e -- --project=chromium` (local Playwright; ~2 min)
- **Phase gate:** Full suite green including `pnpm test:e2e -- --project=webkit --project=chromium --project=firefox` and `pnpm verify:feed` (network-assertion script), before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/e2e/` directory — does not exist; Phase 4 is the first E2E phase
- [ ] `playwright.config.ts` — needs creation; pins `@playwright/test` version, configures `baseURL` + viewports + projects
- [ ] `playwright` install: `pnpm add -D @playwright/test` + `pnpm exec playwright install chromium webkit`
- [ ] `@axe-core/playwright` install: `pnpm add -D @axe-core/playwright`
- [ ] `vitest.config.ts` — `setupFiles` may need extension for RSC render mocking (DB client + Redis client mocks)
- [ ] `tests/e2e/baselines/` directory for visual regression screenshots
- [ ] `scripts/verify-feed.ts` — CLI harness (port of Phase 2's `verify-ingest.ts` pattern) asserting FEED-09 meta tags + FEED-08 no-google-fonts-in-built-output
- [ ] `pnpm test:e2e` script entry in `package.json`
- [ ] `pnpm verify:feed` script entry in `package.json`
- [ ] CI workflow (`.github/workflows/ci.yml`) — extend to run E2E tests against Vercel preview URL
- [ ] `src/components/feed/*.test.tsx` and `src/lib/feed/*.test.ts` — all new, no shared fixtures yet
- [ ] Shared test fixtures (`tests/fixtures/items.ts`) with sample published items covering: high-score cluster-primary, no-recommendation, English-source with title_zh, cluster sibling set

## Security Domain

Phase 4 has minimal security surface (anonymous read-only; no auth; no write paths; no user input to DB). Still applicable:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Deferred to Phase 5 (Auth.js) |
| V3 Session Management | no | Phase 5 |
| V4 Access Control | partial | `/favorites` renders empty-state only; Phase 5 auth-gates the real content. `/api/revalidate` requires shared secret in header (`REVALIDATE_SECRET`) |
| V5 Input Validation | yes | URL search params via `nuqs` parsers (typed, defaulted); `[id]` route validates via `getItem` returning `notFound()` on invalid IDs; NO user-generated content ingested in Phase 4 |
| V6 Cryptography | no | No crypto operations in Phase 4 |
| V10 Malicious Code | yes | Dependencies: `nuqs`, `date-fns-tz`, Radix UI (via shadcn) — all widely-used npm packages; Phase 1's pre-commit UUID-pattern scan remains the backstop |
| V11 Business Logic | yes | Claude 推荐理由 / summary_zh are rendered from DB; values came from Phase 3 LLM pipeline which wraps input in `<untrusted_content>`. Phase 4 renders them as plain text (no `dangerouslySetInnerHTML`). |
| V12 Files & Resources | partial | Static font/icon files served via Vercel CDN. `next/og` Edge runtime fetches font buffer from `new URL(..., import.meta.url)` — build-time resolution, no runtime fetch from user-controlled URLs |
| V14 Configuration | yes | `NEXT_PUBLIC_SITE_URL`, `REVALIDATE_SECRET` env vars; secret never logged |

### Known Threat Patterns for Next.js 15 RSC UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via Claude-generated content (title_zh, summary_zh, recommendation) | Tampering/Info | React auto-escapes text content in JSX. NEVER use `dangerouslySetInnerHTML` for any `items.*` column. Phase 3 already wraps input in `<untrusted_content>` delimiters per LLM-09. `[CITED: Phase 3 CONTEXT]` |
| Open redirect on `/api/revalidate` | Tampering | Shared-secret header auth; validate `paths` param is allowlisted (`/`, `/all` only — reject arbitrary paths) |
| ImageResponse SSRF (font fetch) | Info | Font fetch uses `new URL(..., import.meta.url)` → resolves at build to a bundled path; no user-controlled URL |
| WeChat crawler OG manipulation | — | N/A — Phase 4 does not consume WeChat inputs; only emits OG tags for their crawler to consume |
| Rate-limit bypass on ISR miss | DoS | Phase 4 relies on Vercel's ISR + Upstash cache; per-request DB load is bounded. No per-user rate limit needed (anonymous, bounded page count) |
| Cache poisoning via URL param fuzzing | Tampering | nuqs parsers reject invalid shapes (coerce to defaults); pagination clamped to max-page (defensive — planner's discretion) |
| PII in logs | Info | No user PII in Phase 4 (anonymous). Phase 1's `REVALIDATE_SECRET` log scrubbing still applies. |
| Supply-chain attack (new deps) | Tampering | `pnpm install --frozen-lockfile` in CI; pin versions; `nuqs`, `date-fns-tz`, `@radix-ui/*` are well-known maintained packages |

### Specific controls Phase 4 must implement

1. **`/api/revalidate` route:**
   - Validate `x-revalidate-secret` header matches `process.env.REVALIDATE_SECRET`; 401 otherwise.
   - Allowlist `paths` — reject anything not in `{'/', '/all'}`.
   - Rate-limit (optional — not strictly required since it's shared-secret-gated).

2. **`items.summaryZh` / `items.recommendation` rendering:**
   - ALWAYS as JSX text children; never `dangerouslySetInnerHTML`.
   - If planner elects to support any markdown (not in CONTEXT), route through `react-markdown` + sanitize — but CONTEXT does not mention markdown, so plain text is the expected default.

3. **External links (cluster siblings, `items.url`):**
   - `target="_blank" rel="noopener noreferrer"` — per UI-SPEC.

4. **OG image generation:**
   - No user-controlled input in the Edge function body. `params.id` is validated by `getItem()` (returns null on not-found); nullable path ends with default fallback render.

## Sources

### Primary (HIGH confidence)

- **Project decisions (authoritative):**
  - `.planning/phases/04-feed-ui/04-CONTEXT.md` — phase boundary, locked decisions (D-01..D-29)
  - `.planning/phases/04-feed-ui/04-UI-SPEC.md` — visual/interaction contract, copy, component inventory
  - `.planning/REQUIREMENTS.md` §Feed UI (FEED-01..FEED-12)
  - `CLAUDE.md` §1 Rendering, §10 Styling, §11 State, §12 Images
  - `.design/feed-ui/project/ds/fonts/README.md` — Geist + JetBrains Mono licensing (SIL OFL 1.1)
  - `.design/feed-ui/project/src/*.jsx` — visual reference for ports
- **Next.js official:**
  - [App Router: ISR](https://nextjs.org/docs/app/guides/incremental-static-regeneration) — `revalidate`, `generateStaticParams`, `revalidatePath`
  - [Next.js 15: Dynamic APIs are Asynchronous](https://nextjs.org/docs/messages/sync-dynamic-apis) — `await params` / `await searchParams`
  - [generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) — `metadataBase`, `openGraph`, auto-detection of `opengraph-image.tsx`
  - [ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response) — `fonts` parameter, Edge runtime
  - [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- **Tailwind v4 official:**
  - [Theme variables](https://tailwindcss.com/docs/theme) — `@theme` directive
  - [Functions and directives](https://tailwindcss.com/docs/functions-and-directives)
- **nuqs official:**
  - [Server-Side usage](https://nuqs.47ng.com/docs/server-side) — `createSearchParamsCache`
- **Upstash official:**
  - [Upstash Redis TypeScript SDK](https://upstash.com/docs/redis/sdks/ts/overview)
- **Verified via `npm view`:**
  - `nuqs@2.8.9`, `next@16.2.4` (not used — locked to `^15`), `tailwindcss@4.2.4`, `date-fns@4.1.0`, `date-fns-tz@3.2.0`, `@upstash/redis@1.37.0`, `drizzle-orm@0.45.2`

### Secondary (MEDIUM confidence — verified against 1+ authoritative source)

- [buildwithmatija: Next.js searchParams + static generation](https://www.buildwithmatija.com/blog/nextjs-searchparams-static-generation-fix) — searchParams+ISR interaction
- [logrocket: Managing search parameters with nuqs](https://blog.logrocket.com/managing-search-parameters-next-js-nuqs/) — nuqs patterns
- [aurorascharff: Advanced search param filtering](https://aurorascharff.no/posts/managing-advanced-search-param-filtering-next-app-router/) — RSC + nuqs production patterns
- [flexyui: Multiple custom fonts in Tailwind v4](https://www.flexyui.com/blogs/multiple-custom-fonts-in-tailwindcss) — `@font-face` + `@theme` pattern
- [harrisonbroadbent: Custom fonts in Tailwind v4 and v3](https://harrisonbroadbent.com/blog/tailwind-custom-fonts/) — self-hosted fonts
- [apicrud: Using Custom Fonts Vercel OG Image Generation](https://dev.to/apicrud/using-custom-fonts-vercel-open-graph-og-image-generation-29co) — `ImageResponse` + non-Latin font buffer loading
- [vercel/next.js#45080](https://github.com/vercel/next.js/issues/45080) — Noto Sans JP + next/font issue referenced for CJK patterns

### Tertiary (LOW confidence — empirical / flagged A1)

- [shadowfaxrodeo / DEV.to: Tested every link preview meta tag](https://dev.to/shadowfaxrodeo/i-tested-every-link-preview-meta-tag-on-every-social-media-and-messaging-app-so-you-dont-have-to-it-was-super-boring-39c0) — OG behavior across platforms (does not cover WeChat specifically)
- WeChat link-preview behavior for plain-chat URL paste — **ASSUMED behavior based on community reports**, not officially documented. See Assumptions Log A1/A8.

## Project Constraints (from CLAUDE.md)

The following directives from `./CLAUDE.md` constrain Phase 4 plan construction and MUST be honored:

1. **Tech stack is locked:**
   - Next.js 15 App Router + TypeScript (pinned to `^15` per Phase 1)
   - Neon Postgres + Drizzle ORM (already wired)
   - Tailwind v4 + shadcn/ui
   - Upstash Redis (already wired)
   - Auth.js v5 — NOT Phase 4 (Phase 5)

2. **§1 Rendering Strategy — binding:**
   - Feed pages (`/`, `/all`): ISR `revalidate = 300`
   - Item detail (`/items/[id]`): ISR `revalidate = 3600`
   - User pages (`/favorites`): Dynamic RSC (`force-dynamic`)
   - Server Components by default; Client Components for interaction only

3. **§10 Styling — binding:**
   - Tailwind v4, no `tailwind.config.js` (CSS-first via `@theme`)
   - `tailwindcss-animate` is deprecated — use `tw-animate-css` or inline keyframes
   - `next-themes` NOT required in Phase 4 (dark mode deferred per CONTEXT D-02)

4. **§11 State Management — binding:**
   - No global state library
   - URL state via `nuqs`
   - `useOptimistic` for action UI (Phase 5 concern, not Phase 4)
   - `next-themes` only if dark mode enabled (not in Phase 4)

5. **§12 Image / Avatar Handling — binding:**
   - Source logos: static files in `public/` — but CONTEXT D-07 supersedes with monogram `<SourceDot>`; no external logos in v1
   - User avatars: not applicable in Phase 4 (anonymous)

6. **GSD Workflow Enforcement — binding:**
   - All edits go through a GSD command flow
   - Phase 4 execution will use `/gsd-execute-phase`

7. **§"What NOT to Use" — binding:**
   - NOT Prisma, NOT Supabase, NOT Clerk, NOT Vercel cron alone, NOT Redux/Zustand, NOT separate vector DB, NOT WeChat OAuth in v1, NOT MinHash, NOT `tailwindcss-animate`, NOT real-time subscriptions. Phase 4 does not introduce any of these.

8. **Font constraint (cross-cutting — FEED-08):**
   - NEVER load from `fonts.googleapis.com` or `fonts.gstatic.com`. Delete existing `next/font/google` import at `src/app/layout.tsx:2`.

## Scope Discipline

Items in UI-SPEC.md or implicit in the design bundle that are **NOT** in the Phase 4 requirement IDs, so the planner MUST defer:

| Item | UI-SPEC Section | Defer to |
|------|----------------|----------|
| Real auth provider wiring in `LoginPromptModal` | Copy contract `登录` CTA | Phase 5 (AUTH-*) |
| Real `/favorites` content | D-16 | Phase 5 (FAV-03) |
| Persistence of favorite/like/dislike state | D-27 | Phase 5 (FAV-01..03, VOTE-01..04) |
| Admin nav items functional (信源/策略/用户/后台) | D-10 | Phase 6 (ADMIN-*) |
| Export + manual-sync buttons functional | D-22 | Phase 6 (ADMIN-* or OPS-*) |
| Command palette ⌘K behavior | Copy contract `⌘K` kbd | v2 (SEARCH-01) |
| Tweaks panel (density/badge-style/show-reason) | D-18, D-19 | Not shipping |
| Runtime dark-mode toggle | D-02 | v2 |
| `FeaturedStrategyBar` "当前生效策略" chips | Scope | v2 (STRAT-01) |
| Infinite scroll | D-14 override | Not shipping (numbered pagination) |
| User-submitted 信源提报 | D-10 | v2 (SOCIAL-02) |
| 低粉爆文 section | D-09 | v2 (SOCIAL-01) |
| Sentry/Langfuse/Analytics instrumentation | Phase boundary | Phase 6 (OPS-*) |
| WeChat JS-SDK integration for reliable share-card rendering | Pitfall 6 / Assumption A8 | Out of v1 scope (requires Chinese business entity) |

**Single scope-boundary signal to the planner:** UI-SPEC and CONTEXT together describe the *full* reader experience. The Phase 4 plan must ship everything visually, gating behavior that depends on Phase 5/6 work through the disabled-button + login-prompt-modal affordances. Do not silently skip any visual element from UI-SPEC. Do not silently ship any interactive behavior beyond what FEED-01..FEED-12 require.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in `package.json` or trivially added; versions verified via `npm view`
- Architecture: HIGH — CLAUDE.md + CONTEXT.md lock every major decision; Phase 4 is assembly
- Next.js 15 async APIs + ISR: HIGH — official docs cite directly
- Tailwind v4 `@theme`: HIGH — official docs
- `next/og` + CJK fonts: MEDIUM — official docs + validated community pattern; untested in this codebase
- nuqs + RSC: MEDIUM — official docs + multiple blog validations; untested here
- WeChat OG behavior: LOW / ASSUMED — no official WeChat crawler spec; community observations contradict. See A1/A8.
- Redis feed cache + `revalidatePath` two-layer invalidation: MEDIUM — standard pattern; worth unit-testing explicitly
- Pitfalls catalog: HIGH — all traceable to documented issues

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — Next.js + Tailwind ecosystems evolve quickly; re-verify before Phase 4 late starts)

---

## RESEARCH COMPLETE

**Phase:** 04 - feed-ui
**Confidence:** HIGH on primary stack; MEDIUM on OG image font loading; LOW / ASSUMED on WeChat share-card crawler behavior (flagged as A1/A8)

### Key Findings

1. **Stack is 100% locked by CLAUDE.md + CONTEXT.md + UI-SPEC** — Phase 4 is pure assembly of Next.js 15 RSC + Tailwind v4 `@theme` + `nuqs` URL state + `@upstash/redis` cache + `next/og` for OG images. Three new deps: `nuqs`, `date-fns`, `date-fns-tz` (+ optional `@playwright/test` + `@axe-core/playwright` for tests; optional shadcn `dialog`/`popover`).
2. **Only current codebase violation:** `src/app/layout.tsx` imports Geist from `next/font/google` — MUST be deleted in Phase 4 per FEED-08.
3. **WeChat share-card behavior is the single real unknown.** Community evidence contradicts: some say OG is ignored (JS-SDK required), others say OG `title`/`image` are honored for plain-URL-in-chat paste. FEED-09 acceptance is phrased as "tags present on page" which is curl-testable — that's the Phase 4 bar; pixel-perfect WeChat rendering is empirical best-effort and may fail tests requiring visual WeChat screenshot. Flagged as assumption A1/A8.
4. **Two correctness traps worth highlighting in the plan:** (a) Next.js 15 `await params` / `await searchParams`, (b) `next/og` `ImageResponse` requires explicit CJK font `ArrayBuffer` passed via `fonts` parameter, else Chinese renders as tofu squares.
5. **Two-layer cache invalidation is cross-cutting.** Trigger.dev worker must flush Redis AND POST to `/api/revalidate` (shared-secret) which calls `revalidatePath`. Needs a new Node-runtime API route + `REVALIDATE_SECRET` env var.
6. **RSC + nuqs + ISR compose cleanly** with numbered pagination (locked by D-14). Each `?page=N&tags=a,b&source=X` combination becomes its own ISR entry. No `force-dynamic` needed.

### File Created

`/Users/r25477/Project/ai-hotspot/.planning/phases/04-feed-ui/04-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Libraries + versions verified via `npm view`; all decisions locked in CONTEXT |
| Architecture | HIGH | CLAUDE.md §1/§10/§11 + CONTEXT D-13..D-29 prescribe everything |
| Pitfalls | HIGH | 10 pitfalls all traceable to official docs, tracked GitHub issues, or verified code |
| Validation Architecture | HIGH | Playwright + Vitest + network-assertion approach is standard for Next.js 15 UI phases |
| WeChat behavior | LOW / ASSUMED | No official crawler spec; flagged A1/A8 in Assumptions Log |
| Security | HIGH | Minimal surface (anonymous read); threats enumerated; controls standard |

### Open Questions

1. Whether to pre-build top-N item pages via `generateStaticParams` (recommend: skip; rely on ISR first-visit)
2. Whether to install shadcn `dialog`/`popover` vs hand-roll Radix (recommend: install shadcn)
3. WeChat share card rendering quality in v1 — may require product-owner signoff that FEED-09 is curl-testable and WeChat UI rendering is best-effort (recommend: plan around this; document in UAT)
4. Need to add `NEXT_PUBLIC_SITE_URL` and `REVALIDATE_SECRET` to `.env.example` (recommend: first task in Phase 4 plan)

### Ready for Planning

Research complete. The planner can now create PLAN.md files for Phase 4. Suggested plan decomposition (planner's authority — ballpark only):

- **Plan 04-01:** Foundation — self-hosted fonts, `globals.css` @theme block, layout primitives (Icon, SourceDot, Tag, Button, IconButton, Divider, Eyebrow), env var additions
- **Plan 04-02:** Layout shell — Sidebar + SidebarMobileDrawer, NavRow, PipelineStatusCard, UserChip, FeedTopBar, FeedTabs
- **Plan 04-03:** Data access layer — `get-feed.ts` (Redis cache), `get-item.ts`, `cache-invalidate.ts`, `/api/revalidate` endpoint, Trigger.dev `refresh-clusters` hook
- **Plan 04-04:** Feed card — FeedCard, ScoreBadge, HotnessBar, ClusterTrigger, ClusterSiblings, FeedCardActions (client island), LoginPromptModal
- **Plan 04-05:** Routes — `(reader)/layout`, `(reader)/page` (精选), `(reader)/all/page` (+ FilterPopover), `(reader)/items/[id]/page`, `(reader)/favorites/page`, `opengraph-image.tsx`
- **Plan 04-06:** Validation harness — Playwright setup, `tests/e2e/*.spec.ts`, `scripts/verify-feed.ts`, network-assertion for no-google-fonts, visual regression baselines, UAT checklist
