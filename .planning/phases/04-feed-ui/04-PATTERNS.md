# Phase 4: Feed UI — Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** ~36 (new/modified across `src/app/`, `src/components/`, `src/lib/feed/`, `public/`, `src/trigger/`)
**Analogs found:** 9 exact / 18 role-match / 9 greenfield

Phase 4 is the first substantial UI surface in the repo. Prior phases (1–3) shipped pure backend code (Drizzle schema, ingestion pipelines, Trigger.dev workers, Redis client, health route). That means:

- Data-access helpers (`src/lib/feed/*`) have **strong analogs** in `src/lib/ingest/fetch-source-core.ts` and `src/lib/cluster/refresh.ts` — the core-logic / adapter split, the Drizzle query style, the `db: typeof realDb` dependency-injection pattern, the file header doc block, and the `sql\`...\`` template usage all carry forward verbatim.
- RSC pages, layout, components, fonts, Tailwind v4 `@theme` — **greenfield.** The only existing UI files are scaffolded placeholders (`src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`) that Phase 4 rewrites. The prototype at `.design/feed-ui/project/src/*.jsx` is the **visual** contract (not an engineering analog — it is inline-style React in UMD, must be recreated as Tailwind v4 + RSC).
- API route for cache revalidation has an **exact analog** in `src/app/api/health/route.ts` (runtime exports, error handling, `Response.json`).
- Trigger.dev task extension has an **exact analog** in `src/trigger/refresh-clusters.ts` (how to wire a post-success callback).

---

## File Classification

### New files (RSC page / layout / route)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/layout.tsx` **(REWRITE)** | root layout | request-response (RSC) | existing `src/app/layout.tsx` (scaffold) | exact (file shape) / greenfield (fonts) |
| `src/app/(reader)/layout.tsx` | route-group layout | request-response (RSC) | — | greenfield |
| `src/app/(reader)/page.tsx` | RSC page + ISR | request-response | existing `src/app/page.tsx` (scaffold) | role-match (Next.js page default-export shape) |
| `src/app/(reader)/all/page.tsx` | RSC page + ISR | request-response (searchParams) | `(reader)/page.tsx` | role-match |
| `src/app/(reader)/favorites/page.tsx` | RSC page (dynamic) | request-response | `(reader)/page.tsx` | role-match |
| `src/app/(reader)/items/[id]/page.tsx` | RSC dynamic page + generateMetadata | request-response (params) | — | greenfield |
| `src/app/(reader)/items/[id]/opengraph-image.tsx` | Edge OG image | streaming | — | greenfield |
| `src/app/api/revalidate/route.ts` | API route (auth by shared secret) | request-response | `src/app/api/health/route.ts` | exact |

### Modified existing files

| File | Reason |
|------|--------|
| `src/app/layout.tsx` | Delete `next/font/google` import (FEED-08); emit `<html>` with `lang="zh-CN"` and base class hooks for self-hosted fonts. |
| `src/app/page.tsx` | Replace scaffold content — moves into `src/app/(reader)/page.tsx` route group. File itself may be deleted once route group is in place (Next.js resolves `/` through `(reader)/page.tsx`). |
| `src/app/globals.css` | Add `@theme` block porting `.design/feed-ui/project/ds/colors_and_type.css`; add `@font-face` declarations for Geist / JetBrains Mono / Noto Sans SC; add `prefers-reduced-motion`; preserve dark-mode token block behind unused selector. |
| `src/trigger/refresh-clusters.ts` | Add post-success callback calling `invalidateFeedCache()` (D-24). |
| `drizzle/seed-sources.ts` (if present) | No change required; `source-palette.ts` is static map keyed by seeded `sources.id`. |
| `.env.example` | Add `NEXT_PUBLIC_SITE_URL` and `REVALIDATE_SECRET` entries. |

### New files — components (shell primitives, `src/components/layout/`)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/components/layout/icon.tsx` | component (RSC) | request-response | — | greenfield (port from `primitives.jsx` L7–16) |
| `src/components/layout/source-dot.tsx` | component (RSC) | request-response | — | greenfield (port from `primitives.jsx` L18–44) |
| `src/components/layout/tag.tsx` | component (RSC) | request-response | — | greenfield (port from `primitives.jsx` L66–98) |
| `src/components/layout/button.tsx` | component (RSC) | request-response | — | greenfield (port from `primitives.jsx` L186–238) |
| `src/components/layout/icon-button.tsx` | component (Client — owns hover state) | request-response | — | greenfield (port from `primitives.jsx` L240–273) |
| `src/components/layout/divider.tsx` | component (RSC) | request-response | — | greenfield (port from `primitives.jsx` L275–282) |
| `src/components/layout/eyebrow.tsx` | component (RSC) | request-response | — | greenfield (port from `primitives.jsx` L284–296) |
| `src/components/layout/sidebar.tsx` | component (RSC shell) | request-response | — | greenfield (port from `sidebar.jsx` L99–302) |
| `src/components/layout/sidebar-mobile-drawer.tsx` | component (Client — open/close state) | event-driven | — | greenfield |
| `src/components/layout/nav-row.tsx` | component (RSC) | request-response | — | greenfield (port from `sidebar.jsx` L19–82) |
| `src/components/layout/section-label.tsx` | component (RSC) | request-response | — | greenfield (port from `sidebar.jsx` L84–97) |
| `src/components/layout/pipeline-status-card.tsx` | component (RSC — live DB query) | CRUD (read) | `src/app/api/health/route.ts` `checkNeon()` | role-match (Drizzle query shape) |
| `src/components/layout/user-chip.tsx` | component (Client — opens modal) | event-driven | — | greenfield |

### New files — components (feed, `src/components/feed/`)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/components/feed/feed-card.tsx` | component (RSC outer) | request-response | — | greenfield (port from `feed_card.jsx` L124–352) |
| `src/components/feed/feed-card-actions.tsx` | component (Client island) | event-driven | — | greenfield |
| `src/components/feed/cluster-trigger.tsx` | component (Client — expand state) | event-driven | — | greenfield (port from `feed_card.jsx` L74–122) |
| `src/components/feed/cluster-siblings.tsx` | component (RSC — toggled hidden) | request-response | — | greenfield (port from `feed_card.jsx` L7–72) |
| `src/components/feed/timeline.tsx` | component (RSC) | transform | — | greenfield (port from `feed_views.jsx` L158–237) |
| `src/components/feed/feed-top-bar.tsx` | component (RSC) | request-response | — | greenfield (port from `feed_views.jsx` L6–127) |
| `src/components/feed/feed-tabs.tsx` | component (RSC — Link-driven) | request-response | — | greenfield |
| `src/components/feed/filter-popover.tsx` | component (Client — nuqs URL state) | event-driven | — | greenfield |
| `src/components/feed/score-badge.tsx` | component (RSC) | request-response | — | greenfield (port from `primitives.jsx` L101–165) |
| `src/components/feed/hotness-bar.tsx` | component (RSC) | request-response | — | greenfield (port from `primitives.jsx` L167–184) |
| `src/components/feed/empty-state.tsx` | component (RSC) | request-response | — | greenfield (port from `feed_views.jsx` L377–401) |
| `src/components/feed/login-prompt-modal.tsx` | component (Client — focus trap) | event-driven | — | greenfield |
| `src/components/feed/skeleton-card.tsx` | component (RSC) | request-response | — | greenfield |
| `src/app/(reader)/loading.tsx` | Suspense fallback | request-response | — | greenfield |

### New files — library modules (`src/lib/feed/`)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/lib/feed/get-feed.ts` | service (Redis-cached reader) | CRUD (read) + cache | `src/lib/ingest/fetch-source-core.ts` | exact (core-logic/adapter + DI pattern) |
| `src/lib/feed/get-item.ts` | service | CRUD (read) | `src/lib/cluster/refresh.ts` | role-match (Drizzle + sql\`\`) |
| `src/lib/feed/source-palette.ts` | utility (static map) | — | — | greenfield (pure TS constant) |
| `src/lib/feed/tag-tones.ts` | utility (static map) | — | — | greenfield (pure TS constant) |
| `src/lib/feed/group-by-hour.ts` | utility (pure transform) | transform | — | greenfield (pure function) |
| `src/lib/feed/cache-invalidate.ts` | service (Upstash + fetch) | event-driven | `src/lib/redis/client.ts` + `fetch` in `api/health` | role-match |
| `src/lib/feed/og-payload.ts` | utility (URL assembly) | transform | — | greenfield |
| `src/lib/feed/search-params.ts` | utility (nuqs cache) | transform | — | greenfield |

### New files — assets

| File | Role | Analog |
|------|------|--------|
| `public/fonts/Geist-Variable.woff2` | font asset | — |
| `public/fonts/JetBrainsMono-Variable.woff2` | font asset | — |
| `public/fonts/NotoSansSC-Variable.woff2` | font asset | — |
| `public/icons/*.svg` (21 files) | icon assets | copy verbatim from `.design/feed-ui/project/ds/icons/` |
| `public/og-default.png` | OG image fallback | — |

---

## Pattern Assignments

### `src/lib/feed/get-feed.ts` (service, CRUD read + cache)

**Analog:** `src/lib/ingest/fetch-source-core.ts`

**File-header doc-block pattern** (fetch-source-core.ts lines 1–15):
```typescript
/**
 * Core ingestion orchestrator — Phase 2 D-06 / D-08 / D-14.
 *
 * Given a source row (id + rssUrl), this module:
 *   1. fetchRSSHub(rssUrl) → Response
 *   2. parseRSS(res) → RssEntry[]
 *   3. For each entry: normalizeUrl → urlFingerprint → contentHash → insert ON CONFLICT DO NOTHING
 *   4. Update the source row per D-08 counter semantics
 *
 * Extracted from src/trigger/fetch-source.ts so it is unit-testable without the
 * Trigger.dev runtime. The Trigger.dev task file is a thin adapter.
 *
 * Consumed by:
 *   - src/trigger/fetch-source.ts (Plan 03 Trigger.dev task)
 */
```

**Imports + DI pattern** (fetch-source-core.ts lines 16–46):
```typescript
import { sql, eq } from 'drizzle-orm';
import { db as realDb } from '@/lib/db/client';
import { items, sources } from '@/lib/db/schema';
// ... domain imports

export interface FetchSourceDeps {
  db?: typeof realDb;
  fetchRSSHub?: typeof realFetchRSSHub;
  now?: () => Date;
}

export async function runFetchSource(params: {
  sourceId: number;
  rssUrl: string;
  deps?: FetchSourceDeps;
}): Promise<FetchSourceResult> {
  const db = params.deps?.db ?? realDb;
  const fetchFn = params.deps?.fetchRSSHub ?? realFetchRSSHub;
  const now = params.deps?.now ?? (() => new Date());
```

**Pattern to replicate for `getFeed`:**
```typescript
export interface GetFeedDeps {
  db?: typeof realDb;
  redis?: typeof realRedis;
  now?: () => Date;
}

export async function getFeed(
  params: { view: 'featured' | 'all'; page: number; tags?: string[]; sourceId?: number | null },
  deps?: GetFeedDeps,
): Promise<GetFeedResult> { ... }
```

Rationale: every Phase 2/3 core-logic module uses this exact DI shape so vitest can substitute a mock db. Phase 4 should match byte-for-byte for consistency.

---

### `src/lib/feed/get-item.ts` (service, CRUD read)

**Analog:** `src/lib/cluster/refresh.ts`

**Drizzle `sql\`\`` query pattern** (refresh.ts lines 39–49):
```typescript
const dirty = (await db.execute(sql`
  SELECT c.id AS cluster_id
  FROM clusters c
  WHERE EXISTS (
    SELECT 1 FROM items i
    WHERE i.cluster_id = c.id
      AND i.status = 'published'
      AND i.processed_at IS NOT NULL
      AND (c.latest_seen_at IS NULL OR i.processed_at > c.latest_seen_at)
  )
`)) as unknown as { rows: Array<{ cluster_id: string }> };
```

**Pattern to replicate:** use raw `db.execute(sql\`...\`)` with explicit `as unknown as { rows: Array<...> }` casts when the query is non-trivial (multi-table joins, pgvector ops). Use the Drizzle query builder (`db.select().from(items).where(...)`) for simple single-table reads — the codebase uses both depending on query complexity.

**BigInt handling** (refresh.ts lines 52–53, 74–75):
```typescript
const clusterId = BigInt(clusterIdStr);
const newPrimaryId = BigInt(primRes.rows[0].id);
```

Items and clusters use `bigserial` / `bigint` ids — they come back as strings from `db.execute` raw SQL and must be wrapped in `BigInt()` if you need the typed value. For URL params and JSON responses, pass them as strings.

---

### `src/lib/feed/cache-invalidate.ts` (service, event-driven)

**Analog:** `src/lib/redis/client.ts` + `src/app/api/health/route.ts` fetch usage

**Redis client import pattern** (redis/client.ts):
```typescript
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

**Fetch-with-timeout pattern** (api/health/route.ts lines 77–80):
```typescript
const res = await fetch('https://api.trigger.dev/api/v1/whoami', {
  headers: { Authorization: `Bearer ${key}` },
  signal: AbortSignal.timeout(10_000),
});
```

**Pattern to replicate for cache-invalidate.ts:**
```typescript
import { redis as realRedis } from '@/lib/redis/client';

export async function invalidateFeedCache(deps?: { redis?: typeof realRedis; fetch?: typeof globalThis.fetch }) {
  const redis = deps?.redis ?? realRedis;
  // Upstash SCAN over keys with prefix 'feed:*'
  // DEL matched keys in batches
  // POST to NEXT_PUBLIC_SITE_URL/api/revalidate with x-revalidate-secret header
}
```

---

### `src/app/api/revalidate/route.ts` (API route, request-response)

**Analog:** `src/app/api/health/route.ts` — EXACT MATCH (same file shape, same Response pattern).

**Runtime + dynamic exports pattern** (health/route.ts lines 23–25):
```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

**Response pattern** (health/route.ts line 128):
```typescript
return Response.json({ ok: allOk, services }, { status: allOk ? 200 : 503 });
```

**Error sanitization** (health/route.ts lines 92–99):
```typescript
function sanitize(err: unknown): string {
  if (err instanceof Error) {
    return err.name + ': ' + err.message.replace(/postgres(ql)?:\/\/[^\s]+/gi, '[redacted-db-url]');
  }
  return 'Unknown error';
}
```

**Pattern to replicate:**
```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = req.headers.get('x-revalidate-secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  revalidatePath('/');
  revalidatePath('/all');
  return Response.json({ ok: true });
}
```

---

### `src/app/(reader)/page.tsx` (page, RSC + ISR)

**Analog:** existing `src/app/page.tsx` (scaffold — gives the Next.js page default-export shape only). No existing RSC/ISR pattern in repo.

**Current scaffold (to be replaced)** (page.tsx lines 3–4):
```typescript
export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center ...">
```

**New pattern (greenfield):**
```typescript
// src/app/(reader)/page.tsx — 精选
import { Timeline } from '@/components/feed/timeline';
import { FeedTopBar } from '@/components/feed/feed-top-bar';
import { EmptyState } from '@/components/feed/empty-state';
import { getFeed } from '@/lib/feed/get-feed';

export const revalidate = 300;

export default async function FeaturedPage() {
  const { items, lastSyncMinutes } = await getFeed({ view: 'featured', page: 1 });
  if (items.length === 0) {
    return <EmptyState title="暂无精选动态" body="当 Claude 筛出热度 70 以上的新动态,它们会出现在这里。" cta="查看全部动态" ctaHref="/all" />;
  }
  return (
    <>
      <FeedTopBar view="featured" count={items.length} lastSyncMinutes={lastSyncMinutes} pathname="/" />
      <Timeline items={items} />
    </>
  );
}
```

---

### `src/app/(reader)/all/page.tsx` (page, RSC + ISR + searchParams)

**Analog:** none in repo — fully greenfield. Research document (RESEARCH.md lines 313–360) provides the canonical nuqs + searchParams pattern.

**Greenfield pattern (from RESEARCH.md Pattern 1):**
```typescript
import { createSearchParamsCache, parseAsInteger, parseAsArrayOf, parseAsString } from 'nuqs/server';

export const revalidate = 300;

const feedParamsCache = createSearchParamsCache({
  page: parseAsInteger.withDefault(1),
  tags: parseAsArrayOf(parseAsString).withDefault([]),
  source: parseAsString.withDefault(''),
});

export default async function AllFeedPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[]>> }) {
  const { page, tags, source } = feedParamsCache.parse(await searchParams);
  const { items, totalPages } = await getFeed({ view: 'all', page, tags, sourceId: source || null });
  return <>{/* ... */}</>;
}
```

---

### `src/app/(reader)/items/[id]/page.tsx` (page, RSC + ISR + generateMetadata)

**Analog:** none — greenfield. Research doc (RESEARCH.md lines 376–400) gives canonical pattern.

**Greenfield pattern:**
```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getItem } from '@/lib/feed/get-item';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return {};
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.VERCEL_URL}`;
  return {
    title: `${item.titleZh ?? item.title} | AI Hotspot`,
    description: (item.summaryZh ?? '').slice(0, 160),
    openGraph: { title: ..., description: ..., url: `${siteUrl}/items/${id}`, siteName: 'AI Hotspot', type: 'article' },
  };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();
  return <>{/* detail render */}</>;
}
```

---

### `src/app/(reader)/items/[id]/opengraph-image.tsx` (edge route, streaming)

**Analog:** none — fully greenfield. Must be Edge runtime (RESEARCH.md line 370).

**Critical export:**
```typescript
export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
```

**Chinese font buffer requirement:** `ImageResponse` only ships Noto Sans by default; for Chinese characters must `await fetch(fontUrl).then(r => r.arrayBuffer())` and pass via `fonts: [...]`. See RESEARCH.md for full pattern; fetch `/fonts/NotoSansSC-Variable.woff2` at request time or embed at build.

---

### `src/app/layout.tsx` (root layout — REWRITE)

**Existing file (to be replaced):**
```typescript
import { Geist, Geist_Mono } from 'next/font/google';  // ← DELETE THIS LINE (FEED-08 violation)

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
```

**Pattern to replicate:**
```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Hotspot',
  description: 'AI 资讯热点聚合 — 每小时抓取、LLM 评分、事件聚合的中文 AI 时间线。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--paper)] text-[var(--ink-900)] font-sans">
        {children}
      </body>
    </html>
  );
}
```

The font-family is applied via `globals.css` `@font-face` + the CSS variable `--font-sans` declared in the `@theme` block. Do NOT re-introduce `next/font/*` imports.

---

### `src/app/globals.css` (stylesheet — REWRITE)

**Existing file (lines 1–27):**
```css
@import 'tailwindcss';

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);    /* ← references deleted next/font */
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) { ... }  /* ← remove per D-02 light-only */

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

**Pattern to replicate (structure):**
```css
@import 'tailwindcss';

@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'Noto Sans SC';
  src: url('/fonts/NotoSansSC-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Variable.woff2') format('woff2-variations');
  font-weight: 100 800;
  font-display: swap;
}

:root {
  /* Port every token from .design/feed-ui/project/ds/colors_and_type.css verbatim.
     --paper, --surface-0..2, --line-weak/line/line-strong, --ink-900..300,
     --accent-50..900, --success-*, --danger-*, --info-*, --fg-1..4,
     --shadow-*, --radius-*, --space-1..24, --font-sans, --font-mono,
     --ease, --dur-*, --z-* */
}

:root[data-theme='dark'] {
  /* Dark mode tokens from index.html lines 44-71 — preserved but unused in v1 (D-02). */
}

@theme inline {
  --color-paper: var(--paper);
  --color-ink-900: var(--ink-900);
  /* ... map all design tokens into Tailwind v4 @theme so `bg-paper`, `text-ink-900` etc. work */
  --font-sans: 'Geist', 'Noto Sans SC', ui-sans-serif, system-ui, -apple-system,
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}
```

---

### Component ports — `src/components/**/*.tsx`

**Source authority:** `.design/feed-ui/project/src/primitives.jsx`, `feed_card.jsx`, `feed_views.jsx`, `sidebar.jsx`.

**Recreation rules (from CONTEXT D-01):**
1. **Do NOT copy the UMD/Babel/`window.*` globals pattern.** Port each component as a standard TSX default-export module.
2. **Do NOT use inline `style={{}}` objects.** Replace with Tailwind v4 utilities referencing `@theme` tokens (e.g. `bg-[var(--surface-0)]`, `text-[var(--ink-900)]`). Where utilities get gnarly (e.g. nested pseudo-states, `backdrop-filter`), CSS Modules or a `style={}` fallback is acceptable — planner's choice per D-28.
3. **Preserve literal pixel values** even when off-scale (18px card py, 12.5px fractional type, 28px timeline group margin). Encode as arbitrary Tailwind (`py-[18px]`, `text-[12.5px]`) with a code comment citing the design source file + line.
4. **SourceDot, Tag, SourceChip:** replace `window.SOURCES[sourceId]` / `window.TAGS[id]` lookups with imports from `src/lib/feed/source-palette.ts` and `src/lib/feed/tag-tones.ts`.
5. **State-owning components** (cluster expand toggle, mobile drawer open/close, modal open/close) MUST be `'use client'`. Split cards into an RSC outer + client `feed-card-actions.tsx` island so the body of the card stays Server Component.
6. **Icon component:** render `<img src="/icons/{name}.svg" />` (SVG files copied to `public/icons/`) OR inline-SVG sprite. Planner's discretion — CONTEXT notes either is acceptable. The prototype's `src="ds/icons/{name}.svg"` path is prototype-local and does not carry over.

**Concrete example — `<Tag>` port** (source `primitives.jsx` L66–98):
```jsx
// Prototype (NOT to copy literally):
const Tag = ({ id, onClick, active }) => {
  const t = window.TAGS[id];
  const tones = { accent: {...}, success: {...}, ... }[t.tone] || { ... };
  return <span style={{ height: 20, padding: '0 8px', background: active ? 'var(--ink-900)' : tones.bg, ... }}>{t.label}</span>;
};
```
```tsx
// Port (target):
// src/components/layout/tag.tsx
import { getTagTone, type TagTone } from '@/lib/feed/tag-tones';

export function Tag({ label, tone: toneOverride, active }: { label: string; tone?: TagTone; active?: boolean }) {
  const tone = toneOverride ?? getTagTone(label);
  const palette = TONE_PALETTE[tone]; // bg / fg / bd CSS variables
  return (
    <span
      className="inline-flex items-center h-[20px] px-2 rounded-[4px] text-[11.5px] font-medium whitespace-nowrap border"
      style={{
        background: active ? 'var(--ink-900)' : palette.bg,
        color: active ? 'var(--paper)' : palette.fg,
        borderColor: active ? 'var(--ink-900)' : palette.bd,
      }}
    >
      {label}
    </span>
  );
}
```

---

### `src/components/layout/pipeline-status-card.tsx` (RSC, CRUD read)

**Analog:** `src/app/api/health/route.ts` `checkNeon()` function — shape of a Drizzle + `sql\`\`` live query.

**Query pattern to implement** (live per-request, no cache):
```typescript
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sources } from '@/lib/db/schema';

export async function PipelineStatusCard() {
  const [{ count }] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM sources WHERE is_active = true
  `) as unknown as { rows: { count: number }[] }.rows;
  const [{ last_fetched }] = await db.execute(sql`
    SELECT MAX(last_fetched_at) AS last_fetched FROM sources
  `) as unknown as { rows: { last_fetched: string | null }[] }.rows;
  const minutes = last_fetched ? Math.floor((Date.now() - new Date(last_fetched).getTime()) / 60_000) : null;
  return <>...</>;
}
```

---

### `src/trigger/refresh-clusters.ts` (MODIFY)

**Analog:** existing file is its own template.

**Current file (lines 22–26):**
```typescript
export const refreshClusters = task({
  id: 'refresh-clusters',
  maxDuration: 180,
  run: async (): Promise<RefreshClustersResult> => runRefreshClusters(),
});
```

**Modification:**
```typescript
import { invalidateFeedCache } from '@/lib/feed/cache-invalidate';

export const refreshClusters = task({
  id: 'refresh-clusters',
  maxDuration: 180,
  run: async (): Promise<RefreshClustersResult> => {
    const result = await runRefreshClusters();
    if (result.updated > 0) {
      await invalidateFeedCache();
    }
    return result;
  },
});
```

Only invalidate when `updated > 0` to avoid cascade flushes on no-op debounce runs.

---

## Shared Patterns

### Dependency Injection for Testability
**Source:** `src/lib/ingest/fetch-source-core.ts` lines 24–46; `src/lib/cluster/refresh.ts` lines 30–36.
**Apply to:** All `src/lib/feed/*.ts` modules.
```typescript
export interface XxxDeps {
  db?: typeof realDb;
  redis?: typeof realRedis;
  now?: () => Date;
  fetch?: typeof globalThis.fetch;
}

export async function doThing(params: { ... }, deps?: XxxDeps) {
  const db = deps?.db ?? realDb;
  const redis = deps?.redis ?? realRedis;
  const now = deps?.now ?? (() => new Date());
  // ...
}
```
Every Phase 2/3 core module follows this exact shape so vitest can inject mocks. Phase 4 must match.

### File-Header Doc-Block
**Source:** every file under `src/lib/ingest/`, `src/lib/cluster/`, `src/lib/llm/`.
**Apply to:** All new `src/lib/feed/*.ts` modules and RSC pages.

Template:
```typescript
/**
 * {one-line purpose} — Phase 4 {FEED-XX references}.
 *
 * {2-4 lines explaining what the module does and any non-obvious invariants.}
 *
 * Consumed by:
 *   - {caller file} ({context})
 */
```

### API Route Shape
**Source:** `src/app/api/health/route.ts` lines 23–25, 101–129.
**Apply to:** `src/app/api/revalidate/route.ts`.
- `export const runtime = 'nodejs'` (exception: `opengraph-image.tsx` uses `'edge'`).
- `export const dynamic = 'force-dynamic'` for anything that reads secrets or writes state.
- Return `Response.json({...}, { status })` — do not use `NextResponse.json` (codebase prefers stdlib `Response`).
- Sanitize errors before returning — no connection strings, no secrets (pattern from `sanitize()` at L92–99).

### Drizzle Query Styles
**Source:** `src/lib/cluster/refresh.ts`.
**Apply to:** `src/lib/feed/get-feed.ts`, `src/lib/feed/get-item.ts`.
- Use raw `db.execute(sql\`...\`)` for multi-table joins or pgvector operations.
- Cast results as `as unknown as { rows: Array<{...}> }`.
- Use query builder (`db.select().from(...).where(...)`) for simple single-table reads.
- Wrap bigserial ids in `BigInt()` when passing as Drizzle-typed values; pass as string for URL params / JSON.

### Redis Client Usage
**Source:** `src/lib/redis/client.ts`; consumer in `src/app/api/health/route.ts` lines 44–51.
**Apply to:** `src/lib/feed/get-feed.ts`, `src/lib/feed/cache-invalidate.ts`.
```typescript
import { redis } from '@/lib/redis/client';
const cached = await redis.get(key);
// ...
await redis.set(key, value, { ex: 300 });  // TTL via { ex } Upstash option
```

### Path Alias `@/`
**Source:** used throughout Phase 2/3 files (e.g. `@/lib/db/client`, `@/lib/redis/client`).
**Apply to:** All new Phase 4 imports. `tsconfig.json` already configures `@/*` → `src/*`.

### Vitest Colocated `*.test.ts`
**Source:** `src/lib/ingest/fetch-source-core.test.ts`, `src/lib/cluster/refresh.test.ts`, `src/lib/cluster/threshold.test.ts`, etc.
**Apply to:** `src/lib/feed/group-by-hour.test.ts`, `src/lib/feed/get-feed.test.ts`, `src/lib/feed/cache-invalidate.test.ts`. Pure-logic modules (`group-by-hour`, `tag-tones`, `source-palette`) get tests; data-access modules with mockable DI (`get-feed`, `cache-invalidate`) also get tests.

---

## No Analog Found

Files with no existing codebase analog — the planner must lean on the design bundle + RESEARCH.md patterns directly. Budget extra care/review for these:

| File | Role | Data Flow | Greenfield Reason |
|------|------|-----------|--------------------|
| `src/app/(reader)/layout.tsx` | route-group layout | RSC | No prior route groups in repo |
| `src/app/(reader)/items/[id]/opengraph-image.tsx` | Edge OG image | streaming | No `next/og` usage; Edge runtime first appearance |
| `src/app/(reader)/items/[id]/page.tsx` | dynamic page + generateMetadata | RSC | No prior `generateMetadata` or dynamic params |
| `src/app/(reader)/loading.tsx` | Suspense fallback | RSC | No prior loading boundary |
| `src/components/feed/login-prompt-modal.tsx` | modal (focus trap) | event-driven | No prior dialog/modal |
| `src/components/feed/filter-popover.tsx` | popover (nuqs URL state) | event-driven | No prior client-writes-URL pattern |
| `src/components/layout/sidebar-mobile-drawer.tsx` | drawer (client state) | event-driven | No prior responsive/drawer pattern |
| All shell + feed component ports (~20 files) | component | request-response | No prior React components; entire component layer is new |
| `src/lib/feed/group-by-hour.ts` | pure transform | transform | No prior timezone/grouping utility; `date-fns-tz` is a new dependency |
| `src/lib/feed/og-payload.ts` | utility | transform | No prior OG logic |
| `src/lib/feed/search-params.ts` | utility (nuqs cache) | transform | No prior URL state module; `nuqs` is a new dependency |
| `public/fonts/*.woff2` | font assets | — | No prior self-hosted fonts |
| `public/icons/*.svg` | icon assets | — | No prior icon library (except scaffold `file.svg` / `window.svg`) |
| `public/og-default.png` | image asset | — | No prior OG images |

**Planner budget guidance:** the greenfield work is concentrated in **component ports** (~20 files) and **OG image + font buffer loading**. Both have strong external references (design bundle `.jsx` files for components; RESEARCH.md `next/og` section for OG) but no in-repo precedent. Budget paired implementation + visual-diff review for component ports. Budget one focused task for OG + Chinese font buffer with careful testing on a deployed preview (local `next dev` can't fully exercise Edge runtime + WeChat crawler).

---

## Metadata

**Analog search scope:**
- `src/app/**` (pages, layouts, API routes)
- `src/components/**` (none existed)
- `src/lib/**` (ingest, cluster, llm, redis, db, rsshub)
- `src/trigger/**` (for the refresh-clusters extension pattern)
- `.design/feed-ui/project/src/**` (visual authority — NOT engineering analog)

**Files scanned:** ~45 across src/, plus 4 vendored design `.jsx` prototypes.
**Pattern extraction date:** 2026-04-22

---

## PATTERN MAPPING COMPLETE
