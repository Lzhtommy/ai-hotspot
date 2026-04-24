---
phase: 260424-mjc-admin-rsshub
plan: 01
subsystem: admin
tags: [admin, sources, validation, rsshub, zod]
requires: []
provides:
  - "SourceCreateSchema.rssUrl refine rule (accepts full URL or /-prefixed RSSHub path)"
  - "Admin source form accepts both rssUrl formats at UI layer (type=text + hint copy)"
affects:
  - "src/server/actions/admin-sources.ts"
  - "src/components/admin/source-form.tsx"
  - "tests/unit/admin-sources-actions.test.ts"
tech_stack_added: []
patterns:
  - "zod refine() replaces z.string().url() when input shape has multiple valid forms"
  - "Client input type=text + server-side refine = single validation source of truth (CLAUDE.md §zod)"
key_files_created: []
key_files_modified:
  - src/server/actions/admin-sources.ts
  - src/components/admin/source-form.tsx
  - tests/unit/admin-sources-actions.test.ts
decisions:
  - "rssUrl accepts two formats: full http(s):// URL (native RSS) or /-prefixed path (RSSHub route); aligns UI with drizzle/seed-sources.ts canonical format per D-20"
  - "Protocol-relative URLs (// prefix) explicitly rejected in refine predicate to prevent scheme-injection at fetch layer"
  - "Bare '/' rejected via length>=2 guard; shortest legal RSSHub route is '/x'"
  - "Client-side native URL validation removed (type=text); server-side zod refine is the sole validator"
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_touched: 3
  tests_added: 8
  completed_at: "2026-04-24T08:20:24Z"
requirements_completed:
  - "QUICK-260424-MJC"
---

# Quick Task 260424-mjc: Admin Source Form Accepts RSSHub Route Paths

Unblock `/admin/sources/new` so the RSS 地址 field accepts both full URLs and RSSHub route paths (e.g. `/hackernews/newest/ai`) — previously the form silently rejected the `/path` format even though `drizzle/seed-sources.ts` and the `fetchRSSHub()` contract treat it as canonical.

## What Changed

### Task 1 — Schema: rssUrl refine predicate (commit `85d3693`)

Replaced `z.string().trim().url().max(2000)` in `SourceCreateSchema.rssUrl` with a `refine()` that accepts either:

- A full URL starting with `http://` or `https://`, OR
- A path starting with `/`, NOT starting with `//` (rejects protocol-relative), with length ≥ 2 (rejects the bare `/`).

`.max(2000)` is preserved via the chained `.max()` before `refine()`. The refine message is a user-facing Chinese string — shown only in dev/debug; admins see the `ERROR_COPY.VALIDATION` copy.

Added 8 regression tests in `tests/unit/admin-sources-actions.test.ts` under `describe('createSourceAction — rssUrl format acceptance', ...)`:

| Test | Input | Expected |
|------|-------|----------|
| A | `/hackernews/newest/ai` | accept, pass through verbatim |
| B | `https://huggingface.co/blog/feed.xml` | accept, pass through verbatim |
| C | `http://example.com/feed.xml` | accept |
| D | `hackernews/newest/ai` (no leading /) | VALIDATION |
| E | `/` (bare slash) | VALIDATION |
| F | `''` (empty) | VALIDATION |
| G | `//evil.com/rss` (protocol-relative) | VALIDATION |
| H | `/` + 'a'*2001 (overlong) | VALIDATION |

All 8 pass; pre-existing 3 WR-07 tests for `updateSourceAction` continue to pass (no regression).

### Task 2 — Frontend: input type + placeholder + hint + ERROR_COPY (commit `690ae1a`)

In `src/components/admin/source-form.tsx`:

- `<input name="rssUrl" type="url">` → `type="text"`. Browser's native URL validator rejects `/path` strings before they reach the server, which would silently block the new valid format. Dropping `type=url` makes the server-side zod refine the single validation source of truth (CLAUDE.md §zod pattern).
- Placeholder: `https://rsshub.example.com/anthropic/news` → `/anthropic/news 或 https://example.com/feed.xml` (shows both formats).
- Added create-mode hint: `可填写完整 URL(http:// 或 https:// 开头),或以 / 开头的 RSSHub 路由路径。` Edit-mode hint ("RSS 地址创建后不可修改…") is preserved; the two hints are mutually exclusive via `isEdit ? … : …`.
- `ERROR_COPY.VALIDATION`: updated to name the two accepted formats rather than the generic "表单填写有误".

## Verification

- `pnpm test tests/unit/admin-sources.test.ts tests/unit/admin-sources-actions.test.ts --run` → 22/22 PASS (11 + 11).
- `pnpm typecheck` → clean.
- `pnpm lint src/server/actions/admin-sources.ts src/components/admin/source-form.tsx tests/unit/admin-sources-actions.test.ts` → clean.
- TDD gate compliance: Task 1 followed RED → GREEN — initial run showed Test A failing on the current `.url()` validator (verified before schema change), then passed after the `refine` predicate was introduced. Both artifacts shipped in a single commit per TDD-in-one-task convention documented in the plan.

## Deviations from Plan

None — plan executed exactly as specified.

Note: `lint-staged` + `prettier --write` cosmetically reformatted the `refine()` predicate (single-line arrow body) after `git add` in the Task 1 commit. Semantics are unchanged. This is automated formatting, not a logic deviation.

## Deferred Issues (out-of-scope pre-existing failures)

Running the full `pnpm test` suite surfaced 3 pre-existing failures unrelated to this plan:

- `src/lib/llm/client.test.ts` — 3 voyage.embed rate-limit tests fail due to Anthropic client module-scope instantiation requiring `ANTHROPIC_API_KEY` in the test env. Present on master before this plan (commit `04f21c2`). Not caused by admin-sources changes; out of scope per executor SCOPE BOUNDARY rule.

Recommend logging these into `.planning/quick/deferred-items.md` or folding into an LLM-observability hardening follow-up.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `85d3693` | feat(260424-mjc-01): accept RSSHub route paths in createSourceAction |
| 2 | `690ae1a` | feat(260424-mjc-02): align admin source form UI with RSSHub path support |

## Self-Check: PASSED

- `src/server/actions/admin-sources.ts` — FOUND (refine predicate at line 61-69)
- `src/components/admin/source-form.tsx` — FOUND (type="text" at line 130)
- `tests/unit/admin-sources-actions.test.ts` — FOUND (new describe block with 8 tests)
- Commit `85d3693` — FOUND in git log
- Commit `690ae1a` — FOUND in git log
