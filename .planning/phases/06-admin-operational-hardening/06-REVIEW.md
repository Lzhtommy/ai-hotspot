---
phase: 06-admin-operational-hardening
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 58
files_reviewed_list:
  - docs/admin.md
  - docs/observability.md
  - drizzle/0005_admin_ops.sql
  - instrumentation-client.ts
  - instrumentation.ts
  - next.config.ts
  - scripts/apply-0005-admin-ops.ts
  - scripts/verify-admin-ops.ts
  - sentry.edge.config.ts
  - sentry.server.config.ts
  - src/app/admin/access-denied/page.tsx
  - src/app/admin/costs/page.tsx
  - src/app/admin/dead-letter/page.tsx
  - src/app/admin/layout.tsx
  - src/app/admin/page.tsx
  - src/app/admin/sources/[id]/edit/page.tsx
  - src/app/admin/sources/new/page.tsx
  - src/app/admin/sources/page.tsx
  - src/app/admin/users/page.tsx
  - src/app/api/admin/sentry-test/route.ts
  - src/app/robots.ts
  - src/app/sitemap.ts
  - src/components/admin/admin-nav.tsx
  - src/components/admin/admin-shell.tsx
  - src/components/admin/cost-summary.tsx
  - src/components/admin/cost-table.tsx
  - src/components/admin/dead-letter-table.tsx
  - src/components/admin/retry-button.tsx
  - src/components/admin/source-form.tsx
  - src/components/admin/source-health-badge.tsx
  - src/components/admin/source-row-actions.tsx
  - src/components/admin/sources-table.tsx
  - src/components/admin/user-ban-button.tsx
  - src/components/admin/users-table.tsx
  - src/lib/admin/costs-repo.ts
  - src/lib/admin/dead-letter-repo.ts
  - src/lib/admin/sources-repo.ts
  - src/lib/admin/users-repo.ts
  - src/lib/auth/admin.ts
  - src/lib/db/schema.ts
  - src/lib/feed/sitemap-repo.ts
  - src/middleware.ts
  - src/server/actions/admin-dead-letter.ts
  - src/server/actions/admin-sources.ts
  - src/server/actions/admin-users.ts
  - src/trigger/ingest-hourly.ts
  - src/trigger/process-item.ts
  - src/trigger/sentry-wrapper.ts
  - tests/e2e/sitemap-and-analytics.spec.ts
  - tests/integration/ban-revokes-sessions.test.ts
  - tests/unit/admin-costs.test.ts
  - tests/unit/admin-dead-letter.test.ts
  - tests/unit/admin-gate.test.ts
  - tests/unit/admin-sources.test.ts
  - tests/unit/admin-users.test.ts
  - tests/unit/schema-admin-ops.test.ts
  - tests/unit/sitemap-repo.test.ts
  - tests/unit/source-health.test.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 6: Code Review Report (Iteration 2)

**Reviewed:** 2026-04-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 58
**Status:** issues_found (warnings only — no criticals, no security blockers)

## Summary

This is the second review pass on Phase 6 after the `06-REVIEW-FIX.md` iteration landed commits `56e82cf` (CR-01), `9fe8bc6` (WR-01), `50f7b9d` (WR-02), `a7c2e1c` (WR-03), `8f847aa` (WR-04), `6d8e317` (WR-05), and `40e1c1d` (WR-06).

**All seven prior in-scope findings are cleanly resolved.** Spot-verification:

- **CR-01** — `retryAllCore` now uses `and(inArray(items.id, ids), eq(items.status, 'dead_letter'))` (dead-letter-repo.ts:123). The `void inArray` escape hatch is gone. The new integration test at `tests/integration/dead-letter-retry-all.test.ts` is referenced in the unit test comment (admin-dead-letter.test.ts:163) as the end-to-end proof.
- **WR-01** — Both `sentry.server.config.ts` and `sentry.edge.config.ts` carry independent copies of `scrubNested(v, seen: WeakSet)` with recursive walk over `request.data`, `extra`, `contexts`, and `breadcrumbs[].data`. Cycle guard present. Regex expanded to include `bearer`.
- **WR-02** — SourceForm now pairs a hidden `<input type="hidden" name="isActive" value="false">` sentinel with the checkbox (source-form.tsx:197-206). `readBool` reads `fd.getAll(key)` and treats the LAST value as authoritative (admin-sources.ts:133-139) — correct because `FormData.get()` returns the FIRST occurrence.
- **WR-03** — `isUniqueViolation` catches `.code === '23505'` with a `.message` regex fallback; `createSourceAction` maps to `'URL_EXISTS'`; Chinese copy is in `ERROR_COPY` (source-form.tsx:65).
- **WR-04** — Route is `POST`, Origin/host equality check present with fail-closed on missing Origin/Host, runbook updated.
- **WR-05** — `banUserCore` UPDATE carries `and(eq(users.id), eq(users.isBanned, false))`; zero-row UPDATE triggers a disambiguation SELECT that distinguishes `UserNotFoundError` from `AlreadyBannedError`. Both errors abort the transaction so the DELETE never runs.
- **WR-06** — `requireAdmin()` reads `x-pathname` from `next/headers` and emits `redirect('/?next=…')` when present, falling through to the literal `redirect('/')` otherwise. The static grep in `scripts/verify-admin-ops.ts:185` still matches.

**Security posture remains strong.** Three-layer gate is intact (edge middleware → RSC `requireAdmin()` → per-action `assertAdmin()`), Server Actions uniformly map caught exceptions to opaque `{ ok: false, error: CODE }` shapes, zod runs before DB, the bulk-retry rate limit stayed at 20/60s sliding-window, `banUserCore` is transactional, Sentry scrub now traverses nested shapes with cycle detection.

**New findings this pass (fresh look):**

- **One new warning (WR-07)** — `updateSourceAction` cannot clear a `category` once it's set. Root cause is the same `readString`-empty-string-collapse pattern that caused the original WR-02 checkbox bug, applied to a `<select>` whose "未分类" option has `value=""`.
- **One warning revisited (WR-08)** — UserBanButton does not handle the newly-introduced `'ALREADY_BANNED'` error code; the `else` fallback shows the generic "操作失败,请重试" alert which is wrong copy for this case.
- **Five Info items** — four carried forward from iteration 1 (IN-02..IN-05 were deliberately out of scope per `fix_scope=critical_warning`), plus one new minor issue around the AdminShell rendering the admin nav on `/admin/access-denied`.

The codebase is in a shippable state — no critical or security-grade issues remain.

## Warnings

### WR-07: updateSourceAction cannot clear a category once set — same root-cause class as the fixed WR-02

**File:** `src/server/actions/admin-sources.ts:113-118,192-199` + `src/components/admin/source-form.tsx:173-186`
**Issue:** `readString(fd, key)` deliberately collapses an empty string to `undefined` (line 117: `return trimmed === '' ? undefined : trimmed`). The category `<select>` always submits a value — including `category=""` when the admin selects "未分类". But `readString` then returns `undefined`, and the ternary on line 198 (`categoryRaw === undefined ? undefined : …`) maps `undefined` to `undefined` in the parsed payload, which `updateSourceCore` treats as "no change" (sources-repo.ts:161 uses `'category' in patch`, and a `category: undefined` key IS present in the object but `patch.category ?? null` would evaluate to `null` — except the key `'category'` is not actually added to the parsed object by zod when the schema field is `optional()` and the input is `undefined`).

Consequence: an admin who had previously set a source's category to `lab` and wants to clear it back to NULL cannot do so from the edit form. They would need a direct SQL UPDATE. This is the exact UX regression that was fixed for `isActive` in WR-02 — the same `readString`-strips-empty-string pattern just needs to be applied consistently to `category`.

**Fix:** Two options; option A is tighter.

Option A — teach `readString` to preserve empty strings when the caller asks for them:

```ts
function readString(fd: FormData, key: string, opts: { preserveEmpty?: boolean } = {}): string | undefined {
  const v = fd.get(key);
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (trimmed === '' && !opts.preserveEmpty) return undefined;
  return trimmed;
}

// in updateSourceAction:
const categoryRaw = readString(formData, 'category', { preserveEmpty: true });
const parsed = SourceUpdateSchema.safeParse({
  // …
  // Empty string → null (explicit clear); missing field → undefined (no change).
  category:
    categoryRaw === undefined
      ? undefined
      : categoryRaw === ''
        ? null
        : categoryRaw,
});
```

Option B — a hidden sentinel pair like the `isActive` fix, but for a `<select>` you cannot send two values, so the sentinel approach doesn't carry over cleanly. Option A is the right precedent.

Note that CREATE is unaffected — line 160 is `readString(formData, 'category') ?? null`, which coerces undefined to null for a brand-new row. The asymmetry is the bug: CREATE treats empty-string as null, UPDATE treats it as no-change.

Add a unit test covering: edit an existing source with `category='lab'` → submit form with "未分类" selected → assert the UPDATE's SET clause contains `{ category: null }`.

### WR-08: UserBanButton surfaces generic "操作失败,请重试" for the new ALREADY_BANNED code

**File:** `src/components/admin/user-ban-button.tsx:41-49`
**Issue:** WR-05's fix introduced a new error code `'ALREADY_BANNED'` (admin-users.ts:48,71). `UserBanButton.handleClick` only branches on `SELF_BAN` and `UNAUTHENTICATED`; every other code — including `ALREADY_BANNED`, `NOT_FOUND`, `FORBIDDEN`, `VALIDATION`, `INTERNAL` — falls through to `window.alert('操作失败,请重试')`.

The UsersTable hides the ban button for rows where `isBanned === true`, so this path is reachable only via stale UI (admin A bans user X, admin B's open /admin/users tab hasn't re-rendered, admin B clicks ban). Admin B sees "操作失败,请重试" with no indication the user is actually already banned and the list is stale. Low impact but confusing in a two-admin team.

**Fix:**

```ts
if (result.error === 'SELF_BAN') {
  window.alert('不能封禁自己');
} else if (result.error === 'ALREADY_BANNED') {
  window.alert('该用户已被封禁,请刷新列表。');
} else if (result.error === 'UNAUTHENTICATED') {
  window.alert('请重新登录');
} else {
  window.alert('操作失败,请重试');
}
```

Also consider emitting `router.refresh()` on `ALREADY_BANNED` so the stale row re-renders with the 解封 button.

## Info

### IN-01: AdminShell renders AdminNav on /admin/access-denied for non-admin authenticated users

**File:** `src/app/admin/layout.tsx:47-57` + `src/components/admin/admin-shell.tsx:131-144`
**Issue:** When a non-admin authenticated user lands on `/admin/access-denied`, the layout short-circuits `requireAdmin()` (correct — avoids redirect loop) and still renders `<AdminShell>` with the full sidebar nav (信源 / 用户 / 成本 / 死信). A non-admin clicking any of those links immediately gets re-redirected to `/admin/access-denied`, so there is no data leak — but the nav appearing creates a misleading impression that these are reachable surfaces, and it's an awkward welcome-mat for a user who was just told "无权访问".

**Fix:** Render a minimal shell (no `<AdminNav>`) for the access-denied branch, or hide nav items when the session's role is not 'admin':

```tsx
if (isAccessDenied) {
  const session = await auth();
  const userName = session?.user?.name ?? session?.user?.email ?? '访客';
  const isAdmin = roleOf(session?.user) === 'admin';
  return <AdminShell userName={userName} showNav={isAdmin}>{children}</AdminShell>;
}
```

The `showNav` prop is a one-line change in AdminShell. No behavior change for admins.

### IN-02: CostSummary totalUsd uses JS float summation (carried from iteration 1 — still out of scope)

**File:** `src/lib/admin/costs-repo.ts:120-131`
**Issue:** `totalUsd += r.estimatedCostUsd` accumulates JS doubles. Relative drift is <1e-9 at current scale (<~300 rows × 4-decimal display). No action required; track for re-evaluation if cost windows grow past 30 days.

**Fix:** Push `SUM(estimated_cost_usd)` server-side when window growth exceeds ~365 days, or switch to integer cents aggregation.

### IN-03: instrumentation.ts inline dynamic import pattern (carried from iteration 1)

**File:** `instrumentation.ts:17-22`
**Issue:** `await import('./sentry.server.config')` runs the module's top-level `Sentry.init(...)` side-effect. `register()` is called once per cold-start in current Next.js; if HMR or future Next changes call it twice, `Sentry.init()` runs twice (currently idempotent but fragile).

**Fix:** No action today; if/when flakes appear, mirror `src/trigger/sentry-wrapper.ts`'s `ensureInit()` lazy-init guard in the Next.js bootstrap.

### IN-04: DeadLetterTable anchor has no scheme whitelist (carried from iteration 1)

**File:** `src/components/admin/dead-letter-table.tsx:166-173`
**Issue:** `href={row.url}` is unguarded. `src/lib/ingest/normalize-url.ts` forces https, so `javascript:` URLs cannot reach this row in practice — defense-in-depth wants a scheme-whitelist at the render path.

**Fix:** Tiny helper in this file:

```tsx
function safeHref(u: string): string {
  try { const url = new URL(u); return url.protocol === 'https:' || url.protocol === 'http:' ? u : '#'; }
  catch { return '#'; }
}
// …
<a href={safeHref(row.url)} target="_blank" rel="noreferrer" …>
```

### IN-05: Sitemap has a silent 5000-URL ceiling (carried from iteration 1)

**File:** `src/app/sitemap.ts:27` + `src/lib/feed/sitemap-repo.ts:31`
**Issue:** `getPublishedItemUrls({ limit: 5000 })` caps hard; older items silently drop from the sitemap once the corpus exceeds 5000. At projected v1 scale (144k items/month) this threshold is crossed within ~1 day of steady ingestion.

**Fix:** Introduce a paginated `<sitemapindex>` at `/sitemap.xml` referencing `/sitemap/page/[n].xml` when corpus >5000. Not a Phase 6 blocker — track as a follow-up under the OPS-04 surface.

---

_Reviewed: 2026-04-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2 (follow-up to 06-REVIEW-FIX.md iteration 1)_
