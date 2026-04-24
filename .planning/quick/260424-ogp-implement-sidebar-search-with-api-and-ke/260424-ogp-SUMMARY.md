---
phase: quick
plan: 260424-ogp
subsystem: ui/sidebar + api/search
tags: [ui, sidebar, search, api, ilike, keyboard-shortcut]
requires:
  - items.status = 'published' rows present in DB
  - sources.name populated
provides:
  - GET /api/search?q=<term> → { items: SearchResultItem[] }
  - <SidebarSearch /> client component with ⌘K shortcut
affects:
  - src/components/layout/sidebar.tsx (replaces disabled stub)
tech-stack:
  added: []
  patterns:
    - "Pure DB function + route wrapper (matches Phase 2 core-logic / task-wrapper split)"
    - "Client-side AbortController + 250ms debounce for search-as-you-type"
    - "LIKE escape chars parameterised via Drizzle sql`... ESCAPE '\\\\'`"
key-files:
  created:
    - src/lib/search/search-items.ts
    - src/lib/search/search-items.test.ts
    - src/app/api/search/route.ts
    - src/components/layout/sidebar-search.tsx
  modified:
    - src/components/layout/sidebar.tsx
decisions:
  - "ILIKE over title/title_zh/summary_zh (OR) is sufficient for v1 sidebar search; no pg_trgm / GIN index until volume demands it (clean revisit at v1.1)"
  - "LIKE escape char is '\\' declared per-predicate; user '%' and '_' escaped to literals — prevents wildcard injection"
  - "MIN_LENGTH = 2 short-circuits guards both client-side and server-side — avoids full-table scans on single-char input"
  - "Dropdown uses <Link href=/items/{id}> so Next.js client routing + mobile-drawer outside-click behaviour both work unchanged"
metrics:
  duration: ~10min
  completed: 2026-04-24
---

# Quick 260424-ogp: Sidebar search with API + ⌘K Summary

## One-liner

Replaced the sidebar's disabled search stub with a live `<SidebarSearch />` Client Component wired to a new `GET /api/search` ILIKE endpoint over `items` (title / title_zh / summary_zh), plus ⌘K / Ctrl+K global focus shortcut and a debounced dropdown with up to 10 results.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 (RED) | `23ea6b2` | test(quick-260424-ogp): add failing tests for searchItems ILIKE lib |
| 1 (GREEN) | `ca1edbf` | feat(quick-260424-ogp): add /api/search route + ILIKE search lib with tests |
| 2 | `c668219` | feat(quick-260424-ogp): sidebar search client component + ⌘K focus shortcut |

## Implementation Notes

### `src/lib/search/search-items.ts`

- Pure function `searchItems(q, { db }): Promise<SearchResultItem[]>` with injectable `db`.
- Trims input; returns `[]` when `q.length < 2` without calling `db.execute`.
- Escapes LIKE wildcards (`%`, `_`, `\\`) via `escapeLikePattern()` so the `%term%` pattern matches literal substrings only.
- Raw Drizzle `sql` template — `ILIKE <pattern> ESCAPE '\\'` over three columns (OR), `status = 'published'`, `ORDER BY items.published_at DESC`, `LIMIT 10`.
- `LEFT JOIN sources` for `source_name`.
- Row mapping converts bigint `id` to string and `Date` to ISO string; mirrors `get-feed.ts` conventions.

### `src/app/api/search/route.ts`

- `runtime = 'nodejs'` + `dynamic = 'force-dynamic'` + `revalidate = 0` — per-keystroke requests, no cache benefit.
- Reads `q` from URL params, delegates to `searchItems`, returns `{ items }`.
- Catches driver exceptions and returns a redacted 500 (`err.name` only) — never leaks DB detail.

### `src/components/layout/sidebar-search.tsx`

- `'use client'`, uses `useState` / `useEffect` / `useRef`.
- Global `keydown` listener translates `(metaKey || ctrlKey) && key === 'k'` → focus + select input.
- 250ms debounce + `AbortController`; previous in-flight requests are aborted on every keystroke.
- Dropdown is absolutely positioned below the input (`z-index: 50`). States: 搜索中…, 未找到相关动态, or up to 10 Link rows to `/items/{id}`.
- `Escape` clears the input + closes the dropdown + blurs the field.
- Blur hides the dropdown with a 120ms delay so click-on-a-link still navigates.

### `src/components/layout/sidebar.tsx`

- Replaced the disabled stub `div` (visual only) with `<SidebarSearch />`. Kept outer spacing, `Icon import` dropped (now encapsulated in SidebarSearch).
- Comment header updated: "SidebarSearch (client; ⌘K focus shortcut, debounced /api/search)".

## Verification

```bash
pnpm test src/lib/search tests/unit/sidebar-admin-nav.test.tsx
# → Test Files  2 passed (2); Tests  15 passed (15)

pnpm tsc --noEmit
# → exit 0, no output

pnpm build
# → ✓ Compiled successfully; /api/search route visible in Route (app) table

# Greps:
grep -R "searchItems"   src   # lib + route + tests
grep -R "SidebarSearch" src/components/layout   # sidebar.tsx import + wire + file
grep -R "搜索动态"      src/components/layout   # aria-label / placeholder preserved
grep -R "⌘K"            src/components/layout   # visual kbd preserved (now live)
```

All verification steps above passed on 2026-04-24.

## Deviations from Plan

None of the Rule 1–3 deviations triggered:

- No bugs discovered in edited code paths.
- No missing critical functionality (LIKE wildcard escaping was in the plan).
- No blocking issues (vitest + Neon envs worked out of the box).

### Pre-existing test failures NOT touched

Per Rule 4 SCOPE BOUNDARY — pre-existing failures unrelated to this task are logged as deferred items, not fixed:

- `src/lib/llm/client.test.ts` (3 tests) — Anthropic key init / Voyage rate-limit tests
- `src/lib/llm/enrich.test.ts`
- `src/lib/llm/embed.test.ts`
- `src/lib/llm/process-item-core.test.ts`
- `src/trigger/process-pending.test.ts`

Verified these fail on `HEAD~2` (before any 260424-ogp commit). Already covered by the v1.0 milestone audit's “doc/tooling debt” entries.

## Known Stubs

None. The feed-top-bar 手动同步 / 导出 buttons remain disabled per the task's explicit out-of-scope constraint; they are **tracked in .planning/STATE.md → Deferred Items** (ops_note entries already exist for 手动同步 wiring via Phase 6 `POST /api/admin/revalidate`-style actions).

## Self-Check

- File `src/lib/search/search-items.ts` → FOUND
- File `src/lib/search/search-items.test.ts` → FOUND
- File `src/app/api/search/route.ts` → FOUND
- File `src/components/layout/sidebar-search.tsx` → FOUND
- Commit `23ea6b2` → FOUND
- Commit `ca1edbf` → FOUND
- Commit `c668219` → FOUND

## Self-Check: PASSED
