---
phase: quick-260424-ogp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/search/route.ts
  - src/lib/search/search-items-core.ts
  - src/components/layout/sidebar-search.tsx
  - src/components/layout/sidebar.tsx
  - tests/unit/search-items-core.test.ts
  - tests/unit/search-route.test.ts
autonomous: true
requirements:
  - QUICK-260424-OGP-01  # 可真实使用的搜索 (replace sidebar stub)
  - QUICK-260424-OGP-02  # ⌘K / Ctrl+K 快捷键聚焦
  - QUICK-260424-OGP-03  # 后端搜索 API (Postgres ILIKE title/summary_zh)
  - QUICK-260424-OGP-04  # 结果 UI (title + score + source + time, 跳转 /item/[id])
  - QUICK-260424-OGP-05  # 所有文案中文

must_haves:
  truths:
    - "Sidebar 搜索框可接收键盘输入 (不再是 disabled stub)"
    - "在任意页面按 ⌘K (macOS) / Ctrl+K (其它) 会聚焦/打开搜索"
    - "输入关键词后 ~200ms 内调用 /api/search 并渲染命中结果列表"
    - "结果项显示 title (优先 titleZh) / score / source name / 相对时间"
    - "点击结果项跳转 /items/[id] 并关闭搜索弹层"
    - "后端只返回 status='published' 的条目,按 publishedAt DESC,上限 20 条"
    - "空查询或不足 2 字符时不调用后端,显示提示"
    - "同 IP 每分钟最多 30 次请求 (429 RATE_LIMITED)"
    - "所有用户可见文案为中文"
  artifacts:
    - path: "src/lib/search/search-items-core.ts"
      provides: "searchItemsCore({ q, limit, db }) — pure function, ILIKE OR on title/title_zh/summary_zh"
      exports: ["searchItemsCore", "SearchHit"]
    - path: "src/app/api/search/route.ts"
      provides: "GET /api/search?q=... — zod-validated, rate-limited, returns SearchHit[]"
      exports: ["GET"]
    - path: "src/components/layout/sidebar-search.tsx"
      provides: "<SidebarSearch /> — Client Component: input + ⌘K listener + debounced fetch + results popover"
      exports: ["SidebarSearch"]
    - path: "tests/unit/search-items-core.test.ts"
      provides: "Vitest unit tests for pure core (happy path, empty, %/_ escape, limit)"
    - path: "tests/unit/search-route.test.ts"
      provides: "Vitest unit tests for route handler (validation, rate-limit, empty q, shape)"
  key_links:
    - from: "src/components/layout/sidebar.tsx"
      to: "src/components/layout/sidebar-search.tsx"
      via: "import + replace lines 160-196 (stub) with <SidebarSearch />"
      pattern: "SidebarSearch"
    - from: "src/components/layout/sidebar-search.tsx"
      to: "/api/search"
      via: "fetch in debounced effect"
      pattern: "fetch\\([`'\"]/api/search"
    - from: "src/app/api/search/route.ts"
      to: "src/lib/search/search-items-core.ts"
      via: "searchItemsCore({ q, limit, db })"
      pattern: "searchItemsCore"
---

<objective>
将 src/components/layout/sidebar.tsx 左上角的 visual-only 搜索 stub 替换为真实可用的搜索:
1. 可输入的搜索框 + 全局 ⌘K/Ctrl+K 快捷键打开+聚焦
2. 后端 /api/search 基于 Postgres ILIKE 对 items.title / items.title_zh / items.summary_zh 做关键词匹配
3. 结果以弹层形式渲染,点击跳转 /items/[id]
4. 所有文案中文
5. 单元测试覆盖 core + route handler

**超出范围**: 导出按钮 (保持 disabled); 手动同步按钮; 中文全文检索 (tsvector/pg_bigm — 见 STATE.md SEARCH-01 v2 候选); 搜索历史;管理员/死信 item 搜索 (仅 published)。

Purpose: 用户当前无法搜索已收录的 AI 动态,只能按时间线浏览。有了真实搜索,v1.1 的"第一个可验证增量"即刻可用。
Output: 一个 Client 组件 + 一个 API 路由 + 一个 pure core + 两个 Vitest 文件 + sidebar.tsx 的 stub 替换,单次提交闭环。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
@./CLAUDE.md
@src/components/layout/sidebar.tsx
@src/components/layout/icon.tsx
@src/components/layout/reader-shell.tsx
@src/lib/db/schema.ts
@src/lib/db/client.ts
@src/lib/redis/client.ts
@src/server/actions/admin-dead-letter.ts
@src/app/api/health/route.ts

<interfaces>
<!-- Key types/exports executor will use. Pulled directly from codebase so no exploration is needed. -->

From src/lib/db/schema.ts (items table, fields relevant to search):
```ts
export const items = pgTable('items', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  sourceId: integer('source_id').notNull().references(() => sources.id),
  title: text('title').notNull(),           // English or original
  titleZh: text('title_zh'),                 // Chinese translation (nullable)
  summaryZh: text('summary_zh'),             // Chinese summary (nullable)
  score: integer('score'),                   // 0-100 (nullable until LLM scored)
  status: text('status').notNull().default('pending'), // 'published' is the only searchable state
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  // ... other fields not needed for search
});
export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),              // Display name for result row
  // ...
});
```

From src/lib/db/client.ts:
```ts
export const db = drizzle({ client: pool, schema }); // drizzle-orm/neon-serverless, schema bound
```

From src/lib/redis/client.ts:
```ts
export const redis = new Redis({ url: ..., token: ... }); // @upstash/redis
```

From src/components/layout/icon.tsx:
```ts
export type IconName = 'search' | 'x' | 'loader' | ... ; // 'search', 'x', 'loader' all already allowed
export function Icon({ name, size, className, decorative }: IconProps): JSX.Element;
```

Rate-limit pattern to mirror (src/server/actions/admin-dead-letter.ts:40-49):
```ts
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  analytics: false,
  prefix: 'search:q',
});
```

Route convention (src/app/api/health/route.ts): `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`
</interfaces>

<design_decisions>
D-01 (popover vs. results page): Use a **popover dropdown** anchored under the sidebar input, not a dedicated /search page. Justification: the stub lives in the sidebar; ⌘K semantics (GitHub/Linear/shadcn cmdk) expect inline popup; keeps users on the current feed; no SEO trade-off (search is a transient filter, not a landable view). Local `useState` for open/query/results/loading is sufficient — modal state is ephemeral, not shareable. CLAUDE.md §11 `nuqs` requirement applies to shareable URL state, which this is not.

D-02 (search mechanism): Postgres `ILIKE '%q%'` with `OR` across `title`, `title_zh`, `summary_zh` on `status='published'`, ordered by `publishedAt DESC`, limit 20. **Deliberately NOT** tsvector / pg_bigm in this quick task — STATE.md lists "SEARCH-01 Chinese full-text" as a v2 candidate; quick-ogp is the MVP bridge. Chinese ILIKE works for short-to-medium substrings because Postgres treats the column as bytes; no collation issues for simple substring match.

D-03 (escape): Escape `%`, `_`, `\` in the user query before building the pattern. Per D-13 from PROJECT constraints: zod for input validation; input constrained to 2..64 chars; trim whitespace.

D-04 (debounce): 200ms in the client. Abort the in-flight fetch with `AbortController` on new input.

D-05 (rate limit): 30 req / 60s / IP via `Ratelimit.slidingWindow`, prefix `search:q`. Key = `x-forwarded-for` (first hop) or `x-real-ip` fallback. Mirrors admin-dead-letter pattern.

D-06 (⌘K global): `useEffect` in SidebarSearch attaches a `keydown` listener to `window` that triggers on `(e.metaKey || e.ctrlKey) && e.key === 'k'` — NOT mounted higher (layout is RSC, cannot own window events). Preventing default so browser's "location bar focus" (Firefox) does not fire.

D-07 (display): title (titleZh ?? title), score (if non-null), source name, relative time (e.g., `2 小时前` via `date-fns/formatDistanceToNow` with `zhCN` locale — already in `date-fns` per CLAUDE.md). Clicking the row navigates via `next/link` to `/items/[id]`.

D-08 (escape hatches): Escape key closes popover. Clicking outside closes popover. Focus returns to the input on open; trap is intentionally NOT added (popover, not modal).
</design_decisions>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure search core + API route + unit tests</name>
  <files>
    src/lib/search/search-items-core.ts,
    src/app/api/search/route.ts,
    tests/unit/search-items-core.test.ts,
    tests/unit/search-route.test.ts
  </files>
  <behavior>
    **search-items-core.ts — pure function, deps-injected db (mirrors admin/dead-letter-repo pattern):**
    - `searchItemsCore({ q, limit, db }: { q: string; limit?: number; db: DB })` → `Promise<SearchHit[]>`
    - `SearchHit` shape:
      ```ts
      export interface SearchHit {
        id: string;              // bigint serialized as string (wire-safe JSON)
        title: string;           // titleZh ?? title
        titleOriginal: string;   // raw title (for tie-breaking / a11y)
        summaryZh: string | null;
        score: number | null;    // 0-100
        sourceName: string;
        publishedAt: string;     // ISO
      }
      ```
    - Trim `q`; if `q.length < 2` return `[]` synchronously.
    - Escape `%`, `_`, `\` via `q.replace(/[\\%_]/g, '\\$&')` — so `50%` matches the literal "50%" not "anything starting with 50".
    - Drizzle query: `db.select({...}).from(items).innerJoin(sources, eq(items.sourceId, sources.id)).where(and(eq(items.status, 'published'), or(ilike(items.title, pattern), ilike(items.titleZh, pattern), ilike(items.summaryZh, pattern)))).orderBy(desc(items.publishedAt)).limit(limit ?? 20)`.
    - Project `id: items.id`, `title: items.title`, `titleZh: items.titleZh`, `summaryZh: items.summaryZh`, `score: items.score`, `publishedAt: items.publishedAt`, `sourceName: sources.name`. Map `titleZh ?? title` into `SearchHit.title`; stringify bigint id; toISOString on publishedAt.
    - Default `limit = 20`; clamp via `Math.min(Math.max(1, limit), 20)`.

    **Tests — tests/unit/search-items-core.test.ts (Vitest, mirror admin-dead-letter.test.ts chainable mock):**
    - Test 1: `q.trim().length < 2` → returns `[]`, db NOT called.
    - Test 2: `q = 'Claude'` → db called; result maps `titleZh ?? title` correctly; `id` is string; `publishedAt` is ISO.
    - Test 3: `q = '50%'` → pattern passed to ILIKE is `%50\%%` (literal `%` in input escaped); assert by inspecting the Drizzle SQL chunks.
    - Test 4: `limit = 999` → clamped to 20 in `.limit()` call.
    - Test 5: only `status='published'` — assert SQL chunks contain the literal `'published'`.

    **/api/search GET route (src/app/api/search/route.ts):**
    - `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`
    - Parse `?q=...` + optional `?limit=...` with zod:
      ```ts
      const SearchParams = z.object({
        q: z.string().min(1).max(64),
        limit: z.coerce.number().int().min(1).max(20).optional(),
      });
      ```
    - On zod failure → `400 { error: 'VALIDATION' }`.
    - Rate limit: `Ratelimit.slidingWindow(30, '60 s')`, prefix `'search:q'`, key = `req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'`. On `!success` → `429 { error: 'RATE_LIMITED' }`.
    - Import `db` from `@/lib/db/client` and call `searchItemsCore({ q, limit, db })`. Catch errors → `500 { error: 'INTERNAL' }` (do NOT leak err.message).
    - Response: `{ hits: SearchHit[] }`, 200.

    **Tests — tests/unit/search-route.test.ts:**
    - Test 1: missing `?q` → 400 VALIDATION.
    - Test 2: `q` length > 64 → 400 VALIDATION.
    - Test 3: valid `q` → 200 with `{ hits: [...] }` shape (mock `searchItemsCore` via vi.mock).
    - Test 4: `Ratelimit.limit()` returns `{ success: false }` → 429 RATE_LIMITED.
    - Test 5: core throws → 500 INTERNAL, no err.message leak.
    - Use `vi.mock('@/lib/redis/client', ...)` + `vi.mock('@upstash/ratelimit', ...)` + `vi.mock('@/lib/search/search-items-core', ...)` to isolate. Construct `Request` via `new Request('http://localhost/api/search?q=...', { headers: { 'x-forwarded-for': '1.2.3.4' }})` and call the exported GET directly.
  </behavior>
  <action>
    **Step 1 (RED):** Create the two test files with failing tests first. Run `pnpm vitest run tests/unit/search-items-core.test.ts tests/unit/search-route.test.ts` — all must fail with "module not found" (imports don't exist yet).

    **Step 2 (GREEN):** Create `src/lib/search/search-items-core.ts` and `src/app/api/search/route.ts` with the minimal implementation above. Re-run the two tests — all green.

    **Wiring notes:**
    - Drizzle imports: `import { and, or, ilike, eq, desc } from 'drizzle-orm';` and `import { items, sources } from '@/lib/db/schema';`. The `schema.ts` file is singular (src/lib/db/schema.ts), not a directory — import from `@/lib/db/schema`.
    - bigint → string: `String(row.id)` (Drizzle returns bigint).
    - Do NOT call `.toJSON()` on the timestamp — use `.toISOString()`.
    - Do NOT add an index migration in this task — the `items_status_published_at_idx` already covers the `status='published' ORDER BY published_at DESC` part; ILIKE on title/summary_zh does a seq scan on the status-filtered subset, which is fine at current volume. Document this in a comment for v1.1 if traffic grows.
    - Escape regex for the `q.replace(/[\\%_]/g, '\\$&')`: the character class is `[\\%_]` — backslash, percent, underscore — and the replacement is `\\$&`. Watch for the JS string literal doubling (actual regex in source reads `/[\\%_]/g` and replacement `'\\$&'`).

    **Commit:** `feat(search): add /api/search route + searchItemsCore pure function with unit tests (quick-260424-ogp)`
  </action>
  <verify>
    <automated>pnpm vitest run tests/unit/search-items-core.test.ts tests/unit/search-route.test.ts --reporter=verbose</automated>
  </verify>
  <done>
    - `src/lib/search/search-items-core.ts` exports `searchItemsCore` + `SearchHit`
    - `src/app/api/search/route.ts` exports `GET`, validates with zod, rate-limits via Upstash, returns JSON
    - Both test files pass — all 5 + 5 cases green
    - `pnpm typecheck` passes
    - No new dependencies added to package.json (uses existing drizzle-orm, zod, @upstash/ratelimit, @upstash/redis)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: SidebarSearch Client Component + ⌘K listener + sidebar.tsx wiring</name>
  <files>
    src/components/layout/sidebar-search.tsx,
    src/components/layout/sidebar.tsx
  </files>
  <action>
    **Create `src/components/layout/sidebar-search.tsx`** — `'use client'` Client Component. Public API:
    ```ts
    export function SidebarSearch(): JSX.Element;
    ```

    **Component state (useState):**
    - `open: boolean` — popover visible
    - `q: string` — controlled input value
    - `hits: SearchHit[]` — results; type imported `type { SearchHit } from '@/lib/search/search-items-core'`
    - `loading: boolean`
    - `error: string | null` — Chinese error message (`'搜索失败,请稍后再试'` / `'请求过于频繁'`)
    - `activeIdx: number` — keyboard-nav highlighted row (-1 = none)

    **Refs:**
    - `inputRef` — for focus() on ⌘K
    - `containerRef` — for outside-click detection
    - `abortRef` — `AbortController | null`

    **Effects:**
    1. Global ⌘K listener (attached once on mount to `window`):
       ```ts
       useEffect(() => {
         const handler = (e: KeyboardEvent) => {
           if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
             e.preventDefault();
             setOpen(true);
             // RAF: input is only rendered when open===true; defer focus to next paint
             requestAnimationFrame(() => inputRef.current?.focus());
           } else if (e.key === 'Escape') {
             setOpen(false);
           }
         };
         window.addEventListener('keydown', handler);
         return () => window.removeEventListener('keydown', handler);
       }, []);
       ```
    2. Outside-click close: attach `mousedown` on document when `open`, check `containerRef.current?.contains(e.target)`.
    3. Debounced fetch: `useEffect` keyed on `q` — 200ms setTimeout; if `q.trim().length < 2`, set `hits: []` + `loading: false` and skip fetch. Otherwise `abortRef.current?.abort()` old request, create new `AbortController`, `fetch('/api/search?q=' + encodeURIComponent(q), { signal })`. On 429 → set error `'请求过于频繁'`; on non-OK → `'搜索失败,请稍后再试'`; on OK → `setHits(json.hits); setError(null); setActiveIdx(-1)`. Clear timeout on cleanup.

    **Keyboard nav inside input:**
    - `ArrowDown` → `setActiveIdx((i) => Math.min(i + 1, hits.length - 1))`
    - `ArrowUp` → `setActiveIdx((i) => Math.max(i - 1, -1))`
    - `Enter` → if `activeIdx >= 0 && hits[activeIdx]` use `router.push(\`/items/\${hits[activeIdx].id}\`)` from `next/navigation`'s `useRouter`, then `setOpen(false); setQ('')`.

    **Render — match the existing stub's visual frame** (sidebar.tsx lines 162-196 style) but replace the outer `<div role="search">` with:
    - A positioning container `<div ref={containerRef} style={{ position: 'relative', marginBottom: 4 }}>`.
    - The 30px-tall search bar (same inline styles: `background: var(--surface-1)`, `borderRadius: 6`, `gap: 8`, `padding: '0 10px'`) with:
      - `<Icon name="search" size={13} />`
      - `<input ref={inputRef} value={q} onChange={...} onKeyDown={...} placeholder="搜索动态…" aria-label="搜索动态" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink-900)', fontSize: 12.5, fontFamily: 'var(--font-sans)' }} />`
      - `<kbd>⌘K</kbd>` — keep the existing styling, but hide it when `q.length > 0` to save space (simple conditional).
    - The popover (conditionally rendered when `open` AND `(loading || hits.length > 0 || error || q.trim().length >= 2)`):
      ```
      position: absolute
      top: 34 (height + 4 gap)
      left: 0
      right: 0
      zIndex: 20
      background: var(--paper)
      border: 1px solid var(--line-weak)
      borderRadius: 6
      boxShadow: 0 8px 24px rgba(0,0,0,0.08)
      maxHeight: 360, overflowY: auto
      padding: 4
      ```
      Contents:
      - Loading: `<div>搜索中…</div>` (small Icon loader + text)
      - Error: `<div style={{ color: 'var(--danger-600, #b04040)' }}>{error}</div>` (fall back to --danger-500 if 600 not defined — both are in the design tokens for Phase 5 feedback states; if uncertain inline a safe CSS color `#c2410c`)
      - Empty (`q.trim().length >= 2` && !loading && hits.length === 0 && !error): `<div>未找到相关动态</div>`
      - Prompt (`q.trim().length < 2` but open): `<div>输入至少 2 个字符以搜索</div>` — show only when user has explicitly opened popover via ⌘K, skip otherwise
      - Hits: `<Link href={\`/items/\${hit.id}\`} ...>` per row, rendering:
        - Row 1: `<span>{hit.title}</span>` (truncate CSS: `overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap`)
        - Row 2 (12px): `{hit.sourceName} · {hit.score ?? '—'}/100 · {formatDistanceToNow(new Date(hit.publishedAt), { locale: zhCN, addSuffix: true })}`
        - `onClick` = `() => { setOpen(false); setQ(''); }` (let Link do the nav; just close the popover)
        - Highlight row when `idx === activeIdx` — `background: var(--surface-1)`

    **date-fns imports:** `import { formatDistanceToNow } from 'date-fns';` + `import { zhCN } from 'date-fns/locale';` — already in package.json per CLAUDE.md.

    **Edit `src/components/layout/sidebar.tsx`:**
    - Add `import { SidebarSearch } from './sidebar-search';` near the existing imports.
    - Replace lines **160-196** (the entire stub `<div role="search">...⌘K</kbd></div>`, including its comment lines 160-161) with a single `<SidebarSearch />`.
    - Keep everything else unchanged. Sidebar itself stays a Server Component — only the new child is `'use client'`.

    **a11y:**
    - `aria-label="搜索动态"` on input
    - `role="listbox"` on popover container when hits.length > 0; `role="option"` + `aria-selected={idx===activeIdx}` on each hit row
    - `aria-activedescendant` can be deferred — the visual highlight + arrow-key state suffices for v1
    - Icon has `decorative` default (already aria-hidden)

    **No new tests in this task** — the component is a thin UI shell over the API route (which is tested) + a ⌘K listener (DOM-event, straightforward). E2E is out of scope per plan constraints.

    **Commit:** `feat(search): sidebar SidebarSearch client component with ⌘K, debounced fetch, popover results (quick-260424-ogp)`
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm build</automated>
  </verify>
  <done>
    - `pnpm typecheck` passes
    - `pnpm build` passes (Next.js 15 App Router compile succeeds; ISR routes unaffected)
    - `src/components/layout/sidebar.tsx` has `<SidebarSearch />` in place of the old stub (grep: `SidebarSearch` appears twice — one import, one JSX usage)
    - `src/components/layout/sidebar-search.tsx` exists, is `'use client'`, exports `SidebarSearch`
    - Existing `tests/unit/sidebar-admin-nav.test.tsx` still passes (`pnpm vitest run tests/unit/sidebar-admin-nav.test.tsx`)
  </done>
</task>

</tasks>

<verification>
**Plan-level automated checks (run at the end):**
```bash
# All search-related tests green
pnpm vitest run tests/unit/search-items-core.test.ts tests/unit/search-route.test.ts

# Existing sidebar test still green (no regression in Sidebar RSC shape)
pnpm vitest run tests/unit/sidebar-admin-nav.test.tsx

# Full typecheck + build
pnpm typecheck
pnpm build

# Grep assertions on key links
grep -l "SidebarSearch" src/components/layout/sidebar.tsx   # must match
grep -l "searchItemsCore" src/app/api/search/route.ts       # must match
grep -l "ilike" src/lib/search/search-items-core.ts         # must match
grep -l "'search:q'" src/app/api/search/route.ts            # rate-limit prefix
```

**Manual smoke (user, post-merge — OPTIONAL, not a merge gate):**
1. `pnpm dev` → visit `/` → press ⌘K → input auto-focuses + popover suggests "输入至少 2 个字符"
2. Type `AI` → see debounced result list with 源名 + score + 相对时间
3. Click a row → navigates to `/items/<id>`
4. Press ⌘K again on `/all` → popover opens (global listener works cross-route)
5. Spam 40 queries in <60s → 429 RATE_LIMITED shown as "请求过于频繁"
</verification>

<success_criteria>
1. All must-haves truths observable (search input works, ⌘K opens+focuses, debounced API call, results render, click navigates, 文案中文, rate limit enforced)
2. 10 unit tests green (5 core + 5 route)
3. `pnpm build` + `pnpm typecheck` green
4. No new npm dependencies (all libraries — drizzle-orm, zod, @upstash/ratelimit, @upstash/redis, date-fns, next — already in package.json)
5. sidebar.tsx lines 160-196 (stub) fully replaced by `<SidebarSearch />`
6. 导出按钮 untouched (remains disabled); 手动同步按钮 untouched
7. Scope boundary: no tsvector / pg_bigm / search index migration introduced (defers to v1.1 SEARCH-01)
</success_criteria>

<output>
After completion, create `.planning/quick/260424-ogp-implement-sidebar-search-with-api-and-ke/260424-ogp-SUMMARY.md` with:
- Artifacts: files created/modified
- Commits: SHAs of the two commits
- Test results: 10/10 green
- Deferred follow-ups (for v1.1 backlog): full-text index (SEARCH-01), search history, highlight matched substring in results, typeahead analytics
</output>
