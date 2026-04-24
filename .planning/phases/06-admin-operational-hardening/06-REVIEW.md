---
phase: 06-admin-operational-hardening
reviewed: 2026-04-23T00:00:00Z
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
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-04-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 58 (of 62 in scope; 4 config/generated artifacts excluded per workflow: `.env.example`, `package.json`, `pnpm-lock.yaml`, `drizzle/meta/_journal.json`)
**Status:** issues_found

## Summary

Phase 6 lands a substantial admin and operational-hardening surface: a three-layer admin gate (edge middleware → RSC `requireAdmin()` → per-action `assertAdmin()`), four admin routes (sources, users, costs, dead-letter), Sentry + Langfuse wiring, a soft-delete schema migration, and public SEO surfaces.

**Security posture is strong overall.** The defense-in-depth admin gate is correctly layered, Server Actions uniformly re-verify the session via `assertAdmin()` before any DB work, `zod` validation rejects malformed input before it touches Neon, errors are mapped to opaque `{ ok: false, error: CODE }` shapes so DB schema hints do not leak across the client boundary, `banUserCore` runs the `is_banned` flip and session-revocation DELETE in a single transaction, the dead-letter retry action is sliding-window rate-limited per admin, and Sentry `beforeSend` scrubs cookies/authorization/email plus top-level token-like keys.

**One critical correctness bug** exists in `retryAllCore` — the `sql\`... WHERE id IN ${ids}\`` raw-SQL fragment embeds a JS array as a single bound parameter, producing `WHERE id IN $1` which Postgres rejects. The unit test only inspects the rendered fragment and never executes against a real driver, so the bug is undetected by the harness. This will fail at runtime the first time an admin clicks **批量重试**.

Several warnings concern edge cases rather than exploitable flaws: the Sentry `beforeSend` regex only traverses top-level keys (nested secrets pass through), the edit-source form cannot deactivate a source because HTML unchecked checkboxes are omitted from FormData (the `updateSourceAction` treats missing `isActive` as "no change"), soft-deleted sources still hold the `rss_url` UNIQUE constraint so recreating under the same URL fails, and the `/api/admin/sentry-test` GET route is reachable from a CSRF-authenticated `<img>` tag (admin-only log-spam, not privilege escalation).

## Critical Issues

### CR-01: retryAllCore raw-SQL `IN ${ids}` binds array as single parameter → runtime failure

**File:** `src/lib/admin/dead-letter-repo.ts:114-121`
**Issue:** The bulk UPDATE uses Drizzle's `sql` template tag with `WHERE id IN ${ids}` where `ids` is a JS array of `bigint` values. Drizzle's `sql` tag wraps non-SQL interpolated values as `Param` objects — a plain JS array becomes a single bound parameter, not an expanded `IN (1, 2, 3)` list. The rendered SQL is effectively `WHERE id IN $1` with `$1` bound to an array, which Postgres rejects (`IN` requires a parenthesized scalar list or a subquery; `= ANY($1::bigint[])` is the array-bind idiom).

The existing unit test (`tests/unit/admin-dead-letter.test.ts:158-172`) only walks the rendered `queryChunks` and asserts the literals `status = 'pending'`, `status = 'dead_letter'`, `retry_count = retry_count + 1` are present — it never executes the SQL against a real driver. `scripts/verify-admin-ops.ts` exercises `retryItemCore` (single-item), not `retryAllCore`. The bug will therefore first surface in production the first time an admin clicks **批量重试** on `/admin/dead-letter`.

**Fix:** Use Drizzle's `sql.join` helper (already the project precedent — see `src/lib/feed/get-feed.ts:98`) or the query builder's `inArray()` helper. The comment at lines 107-112 rejects `inArray()` because it claims the race-guard cannot be composed atomically, but `inArray` composes fine with `.where(and(...))`:

```ts
// Option A — query builder (cleanest, type-safe):
await d
  .update(items)
  .set({
    status: 'pending',
    failureReason: null,
    processedAt: null,
    retryCount: dsql`${items.retryCount} + 1`,
  })
  .where(and(inArray(items.id, ids), eq(items.status, 'dead_letter')));

// Option B — raw SQL with sql.join (keep this shape if the race-guard comment is load-bearing):
await d.execute(dsql`
  UPDATE items
  SET status = 'pending',
      failure_reason = NULL,
      processed_at = NULL,
      retry_count = retry_count + 1
  WHERE id IN (${dsql.join(ids, dsql`, `)}) AND status = 'dead_letter'
`);
```

Also remove the `void inArray;` defensive no-op on line 126 once `inArray` is actually used — it becomes genuine dead-code-silencing after the fix.

**Add an integration test** (pattern: `tests/integration/ban-revokes-sessions.test.ts`) that seeds two `status='dead_letter'` items and asserts both flip to `pending` after `retryAllCore({ limit: 2 })`. The unit-test-only coverage is what let this slip through RED→GREEN.

## Warnings

### WR-01: Sentry beforeSend scrubs only top-level keys — nested secrets pass through

**File:** `sentry.server.config.ts:41-48` (and mirrored at `sentry.edge.config.ts:30-37`)
**Issue:** The secret-scrub regex `/token|secret|key|password|authorization/i` only walks `Object.keys(event.request.data)` — one level deep. A request body like `{ auth: { bearer_token: 'sk-...' } }` or `{ user: { apiKey: '...' } }` leaves the inner key untouched. Similarly, `event.extra`, `event.contexts`, and `event.breadcrumbs[].data` are never traversed — breadcrumbs often carry the outbound fetch URL + headers that originally contained the secret.

**Fix:** Either recurse, or rely on Sentry's built-in denyUrls/scrubbing. Recommended: add Sentry's built-in `RequestData` integration with `include.ip: false` plus a recursive walk:

```ts
function scrubNested(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(scrubNested);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    out[k] = /token|secret|key|password|authorization|bearer/i.test(k)
      ? '[redacted]'
      : scrubNested(val);
  }
  return out;
}
if (event.request?.data && typeof event.request.data === 'object') {
  event.request.data = scrubNested(event.request.data);
}
if (event.extra) event.extra = scrubNested(event.extra) as typeof event.extra;
if (event.breadcrumbs) {
  for (const b of event.breadcrumbs) if (b.data) b.data = scrubNested(b.data) as typeof b.data;
}
```

### WR-02: updateSourceAction cannot deactivate a source — unchecked checkbox is omitted from FormData

**File:** `src/server/actions/admin-sources.ts:167` + `src/components/admin/source-form.tsx:194-201`
**Issue:** HTML does not submit unchecked checkboxes, so `formData.has('isActive')` is `false` when the admin unchecks the **启用** box and submits the edit form. The server action then sets `isActive: undefined` (the ternary on line 167), which `updateSourceCore` treats as "no change" and skips the update. Consequence: the **edit form** cannot deactivate a source. The admin workaround (the row-level **停用** toggle in `source-row-actions.tsx`) works because it sends an explicit `toggleActiveAction(id, false)` call, but this is a surprise for anyone reaching for the form.

**Fix:** Add a hidden `isActive=false` sentinel ahead of the checkbox so the checkbox-present case overrides it. Standard HTML form trick:

```tsx
{/* Always post something for isActive so unchecked state is distinguishable from "field absent" */}
<input type="hidden" name="isActive" value="false" />
<label style={checkboxLabelStyle}>
  <input type="checkbox" name="isActive" value="true"
         defaultChecked={prefill ? prefill.isActive : true} />
  <span>启用(取消勾选则加入后不轮询)</span>
</label>
```

Then in `readBool`, treat the last value wins (`FormData.get` already returns the last occurrence for duplicate keys; `FormData.getAll` if you want to be explicit).

### WR-03: Soft-deleted source blocks re-creation under the same rss_url

**File:** `src/lib/admin/sources-repo.ts:177-183` + `src/lib/db/schema.ts:25`
**Issue:** `sources.rssUrl` is declared `.notNull().unique()`. `softDeleteSourceCore` sets `deleted_at = now()` but leaves `rss_url` untouched. If an admin soft-deletes a source and then tries to recreate it under the same URL (e.g., after a misconfiguration), `createSourceCore` fails with a Postgres `unique_violation (23505)`, which `toErrorCode()` maps to `'INTERNAL'` — the admin sees "服务器出错,请稍后再试" with no hint that the URL is in soft-delete limbo. This is the direct consequence of the "soft-delete preserves history" D-unwind rationale colliding with URL uniqueness.

**Fix:** Either
1. Catch the `23505` pg error code explicitly in `createSourceAction` and return a dedicated `'URL_EXISTS'` error code with Chinese copy "该 RSS 地址已存在(可能在软删除的信源中)", or
2. Make the unique constraint partial: `CREATE UNIQUE INDEX sources_rss_url_live ON sources (rss_url) WHERE deleted_at IS NULL;` (migration change). Option 2 is cleaner but requires another schema migration; option 1 is sufficient for v1.

### WR-04: /api/admin/sentry-test is reachable via CSRF (admin log-spam only)

**File:** `src/app/api/admin/sentry-test/route.ts:25-32`
**Issue:** The route is a GET handler, `dynamic = 'force-dynamic'`, gated by `requireAdmin()`. A malicious site the admin visits while logged in can trigger a Sentry event via `<img src="https://aihotspot.example/api/admin/sentry-test">` — the redirect for non-admins returns 3xx so no body is embeddable, but an authenticated admin's browser will dutifully burn a Sentry event on every such `<img>` load. The plan explicitly accepts T-6-63 (log-noise DoS) for first-party admins, but CSRF amplifies: a cross-site `<img>` burns events without the admin's awareness.

**Fix:** Change to `POST` and require a matching SameSite cookie (Auth.js session cookie is `SameSite=Lax` by default, which blocks `<img>` triggers) or add a custom header check the `fetch()` caller must supply:

```ts
// Change to POST; browsers do not send cross-origin POST preflight-free with custom
// headers, and Auth.js's SameSite=Lax cookie already blocks top-level POST from
// cross-site forms.
export async function POST(req: Request) {
  await requireAdmin();
  // optional belt-and-suspenders: require Origin header matches host
  const origin = req.headers.get('origin') ?? '';
  const host = req.headers.get('host') ?? '';
  if (!origin.endsWith(host)) return new Response('forbidden', { status: 403 });
  throw new Error(`Sentry integration test — ${new Date().toISOString()}`);
}
```

And update the UAT script that probes it to send POST.

### WR-05: banUserCore does not preserve prior ban audit on re-ban — overwrites bannedAt/bannedBy

**File:** `src/lib/admin/users-repo.ts:141-160`
**Issue:** If admin A bans user X at T1, admin B unbans X at T2, admin C re-bans X at T3, the `banned_at = now()` + `banned_by = C.id` writes on T3 overwrite any prior audit. The `users` row carries only a single audit slot. The UsersTable UI hides the ban button on already-banned rows (showing **解封** instead), so the direct re-ban case is blocked by UI, but the `banUserAction` Server Action itself has no "is already banned" guard and could be invoked by a hand-crafted POST. The lost audit only matters if the operator later asks "who banned X the first time?" — material for post-incident review only.

**Fix:** Either
1. Add an `is_banned` guard at the top of `banUserCore`: `SELECT is_banned FROM users WHERE id = $target` — if already true, throw `AlreadyBannedError` and short-circuit the UPDATE, or
2. Introduce a dedicated `ban_events` audit table (id, target_user_id, admin_user_id, action enum('ban' | 'unban'), at timestamptz) and append on every ban/unban — future-proof.

Option 1 is the one-line v1 fix.

### WR-06: requireAdmin() redirect('/') drops the originally-requested path

**File:** `src/lib/auth/admin.ts:58`
**Issue:** The edge middleware at `src/middleware.ts:67-74` deliberately preserves the attempted admin path via `?next=${pathname}` on its redirect for anonymous traffic. But `requireAdmin()` in the RSC layer at `src/lib/auth/admin.ts:58` just calls `redirect('/')` with no `next` hint — so any admin path that slips past middleware (e.g., if middleware were ever scoped narrower) loses the user's intended destination. The two layers should stay in lockstep.

**Fix:** Read the current pathname via `headers().get('x-pathname')` (middleware already sets this for every `/admin/*` request, see `src/middleware.ts:80-82`) and preserve it:

```ts
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  if (!session?.user?.id) {
    const h = await headers();
    const next = h.get('x-pathname') ?? '';
    redirect(next ? `/?next=${encodeURIComponent(next)}` : '/');
  }
  if (roleOf(session.user) !== 'admin') redirect('/admin/access-denied');
  return session as AdminSession;
}
```

## Info

### IN-01: Unused `inArray` import with `void inArray` escape hatch

**File:** `src/lib/admin/dead-letter-repo.ts:30,126`
**Issue:** Line 30 imports `inArray` from drizzle-orm; line 126 contains `void inArray;` with the comment "Silence unused-import warnings when tree-shaking picks only part of the file." This is a code smell pointing at the root-cause of CR-01 — the author reached for `inArray` but gave up and used raw SQL. Once CR-01 is fixed by switching to `inArray`, both the import and the `void` line become genuine usage.

**Fix:** Use `inArray` in `retryAllCore` per CR-01 recommendation, remove the `void` line.

### IN-02: CostSummary totalUsd uses JS float summation (precision drift at scale)

**File:** `src/lib/admin/costs-repo.ts:120-121`
**Issue:** `totalUsd += r.estimatedCostUsd` accumulates JS doubles. At v1 scale (<~30 days × ~10 models = 300 rows, dollar amounts at 6 decimal precision) the relative drift is <1e-9 — well under the 4-decimal display rounding — but if the admin page is ever extended to multi-month windows, consider switching to integer cents aggregation or `SUM(estimated_cost_usd)` pushed server-side into a single query.

**Fix:** Replace the JS loop with a second `SELECT SUM(...) GROUP BY model` aggregated server-side if/when windows grow. No immediate action required.

### IN-03: instrumentation.ts inline `import('./sentry.server.config')` pattern

**File:** `instrumentation.ts:17-22`
**Issue:** The dynamic `await import('./sentry.server.config')` is correct for Next.js's `instrumentation.ts` special-casing, but the imported module does its side-effect (`Sentry.init(...)`) at top level. If Next.js ever invokes `register()` twice in dev (historically the case during HMR), `Sentry.init()` is called twice — it's idempotent in current Sentry SDKs, but the pattern is fragile. The `src/trigger/sentry-wrapper.ts:31-46` `initialized` flag guard is the robust version.

**Fix:** No action required today (Sentry.init is idempotent). If HMR double-init becomes a problem, move the `Sentry.init` call into an `ensureInit()`-style lazy function mirroring `sentry-wrapper.ts`.

### IN-04: DeadLetterTable uses row.url in <a href> without scheme check

**File:** `src/components/admin/dead-letter-table.tsx:166-173`
**Issue:** `href={row.url}` embeds the ingested item URL directly. Items are ingested through `src/lib/ingest/normalize-url.ts`, which forces https, so `javascript:` URLs cannot reach the admin table — but the defense is at a distance. A defense-in-depth scheme whitelist in the render path would harden against future ingestion regressions.

**Fix:** Add a trivial guard:

```ts
function safeHref(u: string): string {
  try { const url = new URL(u); return url.protocol === 'https:' || url.protocol === 'http:' ? u : '#'; }
  catch { return '#'; }
}
// <a href={safeHref(row.url)} ...>
```

### IN-05: Sitemap has no total-URL cap guard beyond limit=5000

**File:** `src/app/sitemap.ts:27` + `src/lib/feed/sitemap-repo.ts:31`
**Issue:** `getPublishedItemUrls({ limit: 5000 })` caps hard at 5000, which stays well under the sitemap protocol's 50,000-URL / 50MB limit. When the corpus exceeds 5000 items, the sitemap silently drops older items with no paginated `<sitemapindex>` mechanism. At current traffic (projected 200 items/hr × 24 × 30 = 144k/month), the 5000-cap will be hit within ~1 day of ingestion and historical URLs will drop out of the sitemap thereafter.

**Fix:** Move to a paginated sitemap index (`/sitemap.xml` → references `/sitemap/page/[n].xml`) once the corpus passes ~5000 published items. Track as a follow-up; do not block Phase 6.

---

_Reviewed: 2026-04-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
