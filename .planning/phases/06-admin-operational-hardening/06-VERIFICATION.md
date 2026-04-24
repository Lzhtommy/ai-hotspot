---
phase: 06-admin-operational-hardening
verified: 2026-04-23T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Dead-letter items are visible in the admin UI with a retry button that re-enqueues them through the LLM pipeline (SC#5 retry surface)"
    status: partial
    reason: >-
      Single-item retry works end-to-end (verified live by
      scripts/verify-admin-ops.ts SC#5 assertion). However, bulk 批量重试
      (retryAllCore, wired to `dead-letter-table.tsx` via `retryAllAction`) will
      fail at runtime because the raw SQL fragment `WHERE id IN ${ids}` embeds a
      JS array as a single bound parameter, which Postgres rejects. This is
      CR-01 from 06-REVIEW.md (CRITICAL). The existing unit test only walks
      `queryChunks` and never executes against a real driver; the verify-admin-ops
      harness exercises `retryItemCore` but not `retryAllCore`, so the bug is
      undetected by current tests.
    artifacts:
      - path: "src/lib/admin/dead-letter-repo.ts"
        issue: >-
          Lines 114-121: `await d.execute(dsql\`UPDATE items ... WHERE id IN ${ids}
          AND status = 'dead_letter'\`)` binds the JS array `ids` as a single
          parameter; renders as `WHERE id IN $1` which Postgres rejects.
      - path: "src/components/admin/dead-letter-table.tsx"
        issue: >-
          Line 26 + 68: UI wires `retryAllAction()` to the bulk-retry button. The
          first admin click in production will surface a 500 / INTERNAL error,
          not the expected bulk retry.
    missing:
      - "Replace raw `WHERE id IN ${ids}` with either Drizzle `inArray(items.id, ids)` query-builder composition, or raw SQL via `sql.join(ids, dsql\`, \`)` (precedent: `src/lib/feed/get-feed.ts:98`)."
      - "Remove the defensive `void inArray;` line at `src/lib/admin/dead-letter-repo.ts:126` once `inArray` is actually used."
      - "Add an integration test (pattern: `tests/integration/ban-revokes-sessions.test.ts`) that seeds two `status='dead_letter'` rows and asserts both flip to `pending` after `retryAllCore({ limit: 2 })` — this is the coverage gap that let CR-01 land."
deferred:
  - truth: "A deliberate runtime error in a Trigger.dev task appears in the Sentry dashboard within minutes (SC#4 live end-to-end)"
    addressed_in: "06-06-HUMAN-UAT.md (pending user SENTRY_DSN provisioning)"
    evidence: >-
      Code wiring is complete and typed-clean: `sentry.server.config.ts`
      (beforeSend + cookie/authorization/email scrub), `instrumentation.ts` +
      `instrumentation-client.ts`, `src/trigger/sentry-wrapper.ts::withSentry`
      (captureException with `tags: { task }` + Sentry.flush(2000)), and
      `src/trigger/process-item.ts:49` invokes `withSentry('process-item', ...)`.
      The only blocker is live DSN provisioning in Vercel + Trigger.dev + local
      .env.local, tracked in 06-06-HUMAN-UAT.md with result `pending`.
  - truth: "/sitemap.xml builds cleanly in CI without a live DATABASE_URL"
    addressed_in: "deferred-items.md (pre-existing Phase 6 build regression, follow-up quick task)"
    evidence: >-
      Pre-existing on branch at commit f816ef7 (introduced by Plan 06-07, not by
      any Wave 2 plan). Route works correctly at runtime when DATABASE_URL is
      live (verify-admin-ops SC#5 PASS: `getPublishedItemUrls returns 10
      published rows`). Fix options documented in deferred-items.md §3
      (force-dynamic, gated query, or Vercel build-env DATABASE_URL).
human_verification:
  - test: "SC#4 Next.js path — admin deliberate error reaches Sentry"
    expected: >-
      Admin signs in, GETs /api/admin/sentry-test. Within 5 minutes, Sentry
      Issues shows the event titled "Sentry integration test — <ISO ts>".
      Inspect payload: request.cookies = {}, authorization header absent,
      user.email = '[redacted]', user.id preserved.
    why_human: >-
      Requires live Sentry DSN provisioned in Vercel + .env.local; PII-scrub
      verification can only be done against a real Sentry event payload. Tracked
      in 06-06-HUMAN-UAT.md Test 1 (result: pending).
  - test: "SC#4 Trigger.dev path — worker error reaches Sentry with task tag"
    expected: >-
      Inject `throw new Error('Sentry Trigger.dev test')` inside
      `withSentry('process-item', ...)` of `src/trigger/process-item.ts`. Run
      `pnpm trigger:dev` + manually trigger `process-item`. Within 5 minutes
      Sentry shows the error with tag `task=process-item`. Remove the throw;
      `pnpm typecheck && pnpm test --run` exits 0.
    why_human: >-
      Requires live SENTRY_DSN in Trigger.dev project env (worker runtime does
      not inherit Vercel env). Tracked in 06-06-HUMAN-UAT.md Test 2 (result:
      pending).
  - test: "SC#3 session revocation across tabs"
    expected: >-
      Profile A (admin) bans Profile B (non-admin) via /admin/users. Profile B,
      on next page navigation or refresh, sees UserChip in anonymous state (登录
      button) without an explicit logout.
    why_human: >-
      Cross-profile browser behaviour can only be validated by a human driving
      two signed-in sessions. Automated tests only verify the DB-level
      transaction (sessions.count(userId=target)=0 post-ban — PASS).
  - test: "SC#2 source health badge flips red on consecutive errors"
    expected: >-
      SQL: UPDATE sources SET consecutive_error_count = 3 WHERE
      name='<existing>'. Reload /admin/sources — that row renders a red badge.
    why_human: >-
      Visual rendering of the `source-health-badge.tsx` component against the
      live DB state. `computeSourceHealth` returns 'red' at errorCount=3 per
      unit test — the visual link must be confirmed in a browser.
  - test: "SC#5 dead-letter retry rate limit after 20+ clicks/60s"
    expected: >-
      As admin, click 重试 ≥21 times within 60s. 21st click returns RATE_LIMITED
      and UI displays 操作频率过快 / rate-limit error. Wait 60s; next click
      succeeds.
    why_human: >-
      Upstash rate-limit timing behaviour requires live Redis + real-time
      interaction; covered in 06-UAT.md SC#5.
---

# Phase 6: Admin + Operational Hardening Verification Report

**Phase Goal:** An admin can manage all sources and users from a protected backend, view daily LLM costs, retry failed pipeline items, and the system emits errors to Sentry and page views to Vercel Analytics.

**Verified:** 2026-04-23T00:00:00Z
**Status:** gaps_found (1 critical runtime gap; 5 human-verification items deferred; 0 overrides)
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth                                                                                                                                                            | Status                         | Evidence                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Non-admin redirected from /admin; admin sees 信源 list with name/URL/weight/active/last-fetched/consecutive errors                                               | ✓ VERIFIED                     | `requireAdmin()` 3-branch gate (admin.ts:56-61) + middleware edge filter (middleware.ts:67) + layout invokes `await requireAdmin()` (layout.tsx:59). Live harness PASS on 3 SC#1 assertions.        |
| 2   | Admin can create/edit/soft-delete a source; a source with consecutive_empty_count ≥ 3 shows a red health indicator                                               | ✓ VERIFIED (visual deferred)   | `sources-repo.ts`: softDelete sets `deleted_at = now()` (line 181), listSourcesForAdmin filters `isNull(sources.deletedAt)` (line 83), ingest poller filters same (ingest-hourly.ts:50). `computeSourceHealth` returns 'red' at errorCount=3 (unit test PASS; harness PASS). Red-badge render deferred to human UAT. |
| 3   | Admin can view the user list, ban a user (revokes their session), and see daily Claude token cost breakdown from pipeline_runs                                   | ✓ VERIFIED                     | `banUserCore` runs `UPDATE users SET is_banned=true, banned_at, banned_by` + `DELETE FROM sessions WHERE userId=target` inside a single `db.transaction` (users-repo.ts:139-160). Harness asserts sessions.count=0 post-ban: PASS. `getDailyCosts` aggregates pipeline_runs via `date_trunc('day', created_at) GROUP BY model` (costs-repo.ts:74-82); returns 4 rows live: PASS.                   |
| 4   | A deliberate runtime error in a Trigger.dev task appears in the Sentry dashboard within minutes                                                                  | ⚠️ HUMAN NEEDED (code-complete) | Sentry wired (`sentry.server.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`, `src/trigger/sentry-wrapper.ts::withSentry`, `process-item.ts:49` wraps via `withSentry('process-item', ...)`). Live dashboard verification deferred to 06-06-HUMAN-UAT.md (2 tests, result: pending — awaiting SENTRY_DSN).                                            |
| 5   | Dead-letter items visible in admin UI with a retry button that re-enqueues through the LLM pipeline; sitemap.xml publicly accessible with published item URLs    | ✗ FAILED (partial)             | Single retry: VERIFIED (harness PASS — retryItemCore flips dead_letter→pending + retry_count+1). **Bulk retry: FAILED** — CR-01 runtime bug in `retryAllCore` (`WHERE id IN ${ids}` binds array as `$1`; Postgres rejects). Bulk button wired in `dead-letter-table.tsx:68`. Sitemap: `/sitemap.xml` runtime PASS (10 published rows); build-time failure separately deferred. |

**Score:** 4/5 truths VERIFIED at code-level; 1 partial (SC#5 bulk retry).

### Deferred Items

Items not blocking Phase 6 closure, explicitly tracked in downstream documents.

| # | Item                                                                                                       | Addressed In          | Evidence                                                                                                                          |
| - | ---------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1 | SC#4 live Sentry verification (Next.js + Trigger.dev end-to-end PII-scrub check)                           | 06-06-HUMAN-UAT.md    | 2 pending tests awaiting user DSN provisioning; code wiring complete on commits e713c7e + 36372d1.                               |
| 2 | `/sitemap.xml` build-time prerender requires live DATABASE_URL                                             | deferred-items.md §3 | Pre-existing on branch at f816ef7 (Plan 06-07). Route functionally correct at runtime; fix options documented (force-dynamic).   |
| 3 | Voyage LLM client test failures in jsdom                                                                   | deferred-items.md §1 | Pre-existing Phase 3 test-env issue; out of scope for Phase 6.                                                                   |

### Required Artifacts

| Artifact                                              | Expected                                          | Status     | Details                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/auth/admin.ts`                               | requireAdmin + assertAdmin + AdminAuthError       | ✓ VERIFIED | 3 exports, 3 gate branches (anonymous→/, non-admin→/admin/access-denied, admin→session). Unit tests PASS.           |
| `src/middleware.ts`                                   | matcher /admin/:path* + cookie presence check     | ✓ VERIFIED | Both cookie-name strings present (dev + `__Secure-` prod); x-pathname header propagated for layout loop-guard.       |
| `src/app/admin/layout.tsx`                            | force-dynamic + await requireAdmin()              | ✓ VERIFIED | `dynamic = 'force-dynamic'` + loop-guard for /admin/access-denied + requireAdmin on all other admin paths.           |
| `src/app/admin/{page,access-denied/page}.tsx`         | admin shell + 4-nav + access-denied page          | ✓ VERIFIED | All 4 admin sub-routes (sources, users, costs, dead-letter) wired in admin-nav.tsx.                                  |
| `drizzle/0005_admin_ops.sql` + schema extensions      | sources.deleted_at, category; users.banned_at/by  | ✓ VERIFIED | Migration applied to live Neon dev branch (per 06-01-SUMMARY). Harness PASS on soft-delete + ingest filter.          |
| `src/lib/admin/sources-repo.ts`                       | softDelete, listSourcesForAdmin, computeSourceHealth | ✓ VERIFIED | softDelete sets deleted_at + isActive=false; list filters deletedAt IS NULL; health returns red at errorCount ≥3.    |
| `src/server/actions/admin-sources.ts`                 | create/update/softDelete/toggleActive Server Actions | ✓ VERIFIED | All 4 actions call `assertAdmin(await auth())` before DB work; zod validates input.                                 |
| `src/lib/admin/users-repo.ts`                         | banUserCore transactional (UPDATE + DELETE sessions) | ✓ VERIFIED | Live-verified: sessions.count=0 post-ban. Self-ban guard present before transaction opens.                          |
| `src/lib/admin/costs-repo.ts`                         | getDailyCosts (date_trunc + GROUP BY day, model)  | ✓ VERIFIED | Single aggregation query; live-returned 4 rows in harness; model breakdown + summary computed.                      |
| `src/lib/admin/dead-letter-repo.ts`                   | retryItemCore (race-guarded); retryAllCore         | ⚠️ STUB-IN-BUG | retryItemCore verified live; **retryAllCore contains CR-01 runtime SQL bug (WHERE id IN ${ids})**.                 |
| `src/server/actions/admin-dead-letter.ts`             | retryItemAction + retryAllAction with rate limit  | ✓ VERIFIED (adapter) | Adapter correctly wires assertAdmin + Upstash slidingWindow(20, '60 s') + revalidatePath — the bug is in the core.   |
| `sentry.server.config.ts` / `instrumentation.ts` / `src/trigger/sentry-wrapper.ts` | Sentry init + beforeSend + withSentry wrapper      | ✓ VERIFIED (static) | beforeSend scrubs cookies/authorization/email; withSentry captures + flushes + rethrows. Live dashboard deferred.    |
| `src/app/sitemap.ts` / `src/app/robots.ts` / `src/lib/feed/sitemap-repo.ts` | sitemap.xml + robots.txt + Analytics in root     | ✓ VERIFIED | Sitemap maps published rows to `/items/{id}`; robots disallows /admin+/api+/favorites + references sitemap; `<Analytics />` imported from `@vercel/analytics/next` in root layout. |
| `scripts/verify-admin-ops.ts`                         | SC harness                                        | ✓ VERIFIED | 18/18 assertions PASS against live Neon dev (sentinels cleaned up in finally{}).                                    |
| `docs/admin.md` / `docs/observability.md`             | admin + observability runbooks                    | ✓ VERIFIED | Both present; referenced from 06-UAT.md.                                                                             |

### Key Link Verification

| From                                               | To                                                 | Via                                    | Status  | Details                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------- | -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `src/app/admin/layout.tsx`                         | `src/lib/auth/admin.ts::requireAdmin`              | `await requireAdmin()`                 | WIRED   | Line 59.                                                                                                      |
| `src/middleware.ts`                                | session cookie check                               | `matcher: ['/admin/:path*']`           | WIRED   | Line 86. Also sets x-pathname for layout loop-guard.                                                          |
| `src/server/actions/admin-sources.ts`              | `src/lib/auth/admin.ts::assertAdmin`               | `assertAdmin(session)`                 | WIRED   | All 4 Server Actions defer to core repo after assertAdmin.                                                    |
| `src/trigger/ingest-hourly.ts`                     | `sources.deletedAt IS NULL`                        | WHERE filter in poller query           | WIRED   | Line 50: `and(eq(sources.isActive, true), isNull(sources.deletedAt))`.                                        |
| `src/lib/admin/users-repo.ts::banUserCore`         | `DELETE FROM sessions WHERE userId=target`         | `db.transaction(tx => ...)`            | WIRED   | Line 159 inside transaction opened at line 139. Harness verifies sessions.count=0 post-ban.                    |
| `src/app/admin/costs/page.tsx`                     | `src/lib/admin/costs-repo.ts::getDailyCosts`       | `getDailyCosts({ days: 30 })`          | WIRED   | Page RSC aggregates via single GROUP BY day,model.                                                             |
| `src/components/admin/dead-letter-table.tsx`       | `src/server/actions/admin-dead-letter::retryAllAction` | bulk button onClick                    | WIRED-BUT-BROKEN | Import + usage at lines 26, 68. Action itself is correct; the `retryAllCore` it calls will error at runtime (CR-01). |
| `src/app/layout.tsx`                               | `@vercel/analytics/next::<Analytics />`            | JSX child of `<body>`                  | WIRED   | Line 32.                                                                                                      |
| `src/trigger/process-item.ts`                      | `src/trigger/sentry-wrapper.ts::withSentry`        | `withSentry('process-item', ...)`      | WIRED   | Line 49; wrapper invokes captureException + Sentry.flush(2000) on error.                                       |

### Data-Flow Trace (Level 4)

| Artifact                                    | Data Variable               | Source                                       | Produces Real Data | Status   |
| ------------------------------------------- | --------------------------- | -------------------------------------------- | ------------------ | -------- |
| `/admin/sources` RSC                        | `sourcesForAdmin`           | `listSourcesForAdmin()` → Neon sources table | Yes (live harness) | FLOWING  |
| `/admin/users` RSC                          | `users`                     | `listUsersForAdmin()` (left-join accounts)   | Yes                | FLOWING  |
| `/admin/costs` RSC                          | `dailyCosts` + `summary`    | `getDailyCosts` → pipeline_runs aggregation  | Yes (4 rows live)  | FLOWING  |
| `/admin/dead-letter` RSC (list)             | `deadLetterItems`           | `listDeadLetterItems` → items WHERE status='dead_letter' | Yes (verified live) | FLOWING  |
| `/sitemap.xml`                              | `rows`                      | `getPublishedItemUrls({limit: 5000})`        | Yes (10 rows live) | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                             | Command                                                              | Result                                    | Status  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | ------- |
| Live 18-assertion SC harness                                         | `pnpm verify:admin-ops`                                              | "All 18 automated criteria PASSED"        | ✓ PASS  |
| retryItemCore single-item retry (live DB)                            | (via harness) seed dead_letter → retryItemCore → confirm pending     | status=pending, retry_count=1, reason=null | ✓ PASS  |
| banUserCore session revocation (live DB)                             | (via harness) ban target → SELECT COUNT(*) FROM sessions WHERE userId=target | count=0                                   | ✓ PASS  |
| retryAllCore bulk retry against real Neon driver                     | Not executed                                                         | Harness does NOT exercise retryAllCore    | ✗ FAIL  |
| /sitemap.xml dev-server probe                                        | fetch(http://localhost:3000/sitemap.xml)                             | dev server unreachable → DEFERRED         | ? SKIP  |

**Note:** The bulk-retry spot-check is the gap CR-01 identifies. The raw-SQL render would need to be bound and executed by Postgres — the existing unit test only walks `queryChunks`, never touches a driver.

### Requirements Coverage

Every Phase 6 requirement ID is claimed by exactly one plan in this phase (no orphans).

| Requirement | Source Plan | Description                                                                            | Status               | Evidence                                                                                |
| ----------- | ----------- | -------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| ADMIN-01    | 06-00       | Admin-only /admin route with role check                                                | ✓ SATISFIED          | Defense-in-depth gate; harness PASS on SC#1.                                            |
| ADMIN-02    | 06-02       | 信源 list with name/URL/weight/active/last-fetched/consecutive errors                  | ✓ SATISFIED          | `listSourcesForAdmin` returns all 8 columns; sources-table renders them.                |
| ADMIN-03    | 06-02       | Admin can create new source with weight + category                                     | ✓ SATISFIED          | `/admin/sources/new` + `createSourceAction` with zod validation; category on schema.     |
| ADMIN-04    | 06-02       | Admin can edit weight/name/active state                                                | ⚠️ PARTIAL (WR-02)   | Edit works for name/weight/category; unchecked "active" checkbox is silently ignored by current FormData reader — row-level toggle is the admin workaround. Tracked as WARNING in 06-REVIEW.md WR-02, not a blocker for phase closure. |
| ADMIN-05    | 06-02       | Soft-delete preserves items                                                            | ✓ SATISFIED          | `softDeleteSourceCore` sets deleted_at + isActive=false; items untouched.                |
| ADMIN-06    | 06-02       | Health badge red when consecutive counts ≥ 3                                           | ✓ SATISFIED (static) | `computeSourceHealth` returns 'red'; visual render deferred to human UAT.                |
| ADMIN-07    | 06-03       | 用户 list with email/provider/created-at/role/ban toggle                               | ✓ SATISFIED          | `listUsersForAdmin` leftJoin accounts; users-table wires ban/unban.                      |
| ADMIN-08    | 06-03       | Ban revokes sessions + blocks interactions                                             | ✓ SATISFIED          | Transactional UPDATE+DELETE verified live.                                               |
| ADMIN-09    | 06-04       | Daily Claude token cost dashboard                                                      | ✓ SATISFIED          | `getDailyCosts` aggregates input/output/cache-read/cache-write/cost per day per model.   |
| OPS-01      | 06-06       | Sentry integrated for Next.js + Trigger.dev                                            | ⚠️ NEEDS HUMAN       | Code-complete; live verification in 06-06-HUMAN-UAT.md (pending DSN).                    |
| OPS-02      | 06-08       | Langfuse dashboard shows per-item cost + cache hit rate                                | ✓ SATISFIED (wired)  | otel.ts + @langfuse/otel + LANGFUSE keys in .env.example (harness PASS on all 3).        |
| OPS-03      | 06-05       | Dead-letter retry action                                                               | ✗ PARTIAL            | Single-item retry works; **bulk retry fails at runtime (CR-01)**.                       |
| OPS-04      | 06-07       | Sitemap.xml from published items                                                       | ✓ SATISFIED (runtime) | Runtime PASS; build-time regression separately tracked in deferred-items.md §3.          |
| OPS-05      | 06-07       | Vercel Analytics enabled                                                               | ✓ SATISFIED          | `<Analytics />` in root layout; no Google Analytics endpoints.                          |

### Anti-Patterns Found

From 06-REVIEW.md (standard-depth review):

| File                                             | Line      | Pattern                                                                         | Severity       | Impact                                                       |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| `src/lib/admin/dead-letter-repo.ts`              | 114-121   | CR-01 — raw SQL `WHERE id IN ${ids}` binds array as single param                | 🛑 Blocker     | Bulk retry UI crashes at first admin click (SC#5 partial).  |
| `src/lib/admin/dead-letter-repo.ts`              | 30, 126   | IN-01 — `void inArray;` escape hatch for unused import                          | ℹ️ Info        | Code smell; cleanup landing with CR-01 fix.                  |
| `sentry.server.config.ts` / `sentry.edge.config.ts` | 41-48   | WR-01 — beforeSend only walks top-level keys; nested secrets pass through        | ⚠️ Warning     | Nested `{ auth: { bearer_token: '...' } }` may leak.         |
| `src/server/actions/admin-sources.ts`            | 167       | WR-02 — unchecked checkbox omitted from FormData → can't deactivate via edit form | ⚠️ Warning     | Admin workaround: row-level toggle button (still functional). |
| `src/lib/admin/sources-repo.ts`                  | 177-183   | WR-03 — soft-delete holds rss_url UNIQUE; recreating fails                      | ⚠️ Warning     | Admin sees "服务器出错" with no URL-in-soft-delete hint.     |
| `src/app/api/admin/sentry-test/route.ts`         | 25-32     | WR-04 — GET handler reachable via CSRF `<img>` (admin log-spam only)             | ⚠️ Warning     | Authenticated admin burns Sentry events from cross-site imgs. |
| `src/lib/admin/users-repo.ts`                    | 141-160   | WR-05 — re-ban overwrites prior banned_at/banned_by (audit loss)                 | ⚠️ Warning     | Post-incident "who banned first?" unanswerable.              |
| `src/lib/auth/admin.ts`                          | 58        | WR-06 — `redirect('/')` on anonymous drops `?next=` (middleware preserves it)   | ⚠️ Warning     | Two redirect branches inconsistent.                          |
| `src/lib/admin/costs-repo.ts`                    | 120-121   | IN-02 — JS float accumulation drift at scale                                    | ℹ️ Info        | No impact at v1 scale (<300 rows).                           |
| `instrumentation.ts`                             | 17-22     | IN-03 — dynamic import + top-level Sentry.init (HMR double-init fragility)      | ℹ️ Info        | Sentry.init is idempotent; no immediate action.              |
| `src/components/admin/dead-letter-table.tsx`     | 166-173   | IN-04 — `href={row.url}` without scheme check                                   | ℹ️ Info        | Defense-in-depth harden opportunity.                         |
| `src/app/sitemap.ts`                             | 27        | IN-05 — 5000-URL cap with no paginated sitemap index                             | ℹ️ Info        | Older URLs drop silently once corpus > 5000.                 |

Warnings and info items are tracked for follow-up; only CR-01 blocks SC#5 closure.

### Human Verification Required

See `human_verification:` section in frontmatter. 5 items total:

1. **SC#4 Next.js Sentry event** — live DSN required (tracked in 06-06-HUMAN-UAT.md).
2. **SC#4 Trigger.dev Sentry event** — live DSN required (tracked in 06-06-HUMAN-UAT.md).
3. **SC#3 cross-tab session revocation** — two browser profiles, bans propagate on next nav.
4. **SC#2 red health badge visual render** — SQL-driven consecutive_error_count=3 then reload /admin/sources.
5. **SC#5 rate-limit UX** — ≥21 clicks in 60s → RATE_LIMITED banner.

These are tracked in 06-UAT.md (5 SC checklist) + 06-06-HUMAN-UAT.md (2 pending Sentry tests). Items 1-2 are deferred pending user DSN provisioning and do NOT block Phase 6 metadata closure (consistent with deferred-items.md §2 scope boundary).

### Gaps Summary

**The Phase 6 goal is substantially achieved with one critical runtime gap:**

- **CR-01 (blocker for SC#5 bulk retry):** `retryAllCore` will fail at runtime on the first admin click of **批量重试** because of the `WHERE id IN ${ids}` array-bind bug. The UI button is wired (`dead-letter-table.tsx:68`), and the live harness does not exercise this path, so the bug escaped both the unit test (which only inspects `queryChunks`) and the automated verify-admin-ops harness.

Every other ROADMAP success criterion is code-complete and verified (4/5 truths VERIFIED; SC#4 is code-complete with live verification deferred to human UAT pending SENTRY_DSN provisioning).

**Recommended closure path:**

1. Fix CR-01 per 06-REVIEW.md recommendation (switch to `inArray(items.id, ids)` query-builder composition OR raw SQL with `sql.join(ids, dsql\`, \`)`).
2. Add an integration test that executes `retryAllCore({ limit: 2 })` against a real driver with seeded dead-letter rows.
3. Remove the defensive `void inArray;` escape-hatch now that `inArray` is actually used.
4. Re-run `pnpm verify:admin-ops` and add a new assertion for retryAllCore round-trip.
5. Provision SENTRY_DSN and complete the two pending tests in 06-06-HUMAN-UAT.md.
6. Merge the two Sentry event IDs + the SC#5 re-verification into 06-UAT.md sign-off.

---

_Verified: 2026-04-23T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
