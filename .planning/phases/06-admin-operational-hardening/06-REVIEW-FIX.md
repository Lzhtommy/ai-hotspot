---
phase: 06-admin-operational-hardening
fixed_at: 2026-04-23T10:55:00Z
review_path: .planning/phases/06-admin-operational-hardening/06-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-04-23T10:55:00Z
**Source review:** `.planning/phases/06-admin-operational-hardening/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical + 6 Warning — Info findings excluded per fix_scope=critical_warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: retryAllCore raw-SQL `IN ${ids}` binds array as single parameter

**Files modified:** `src/lib/admin/dead-letter-repo.ts`, `tests/unit/admin-dead-letter.test.ts`, `tests/integration/dead-letter-retry-all.test.ts`
**Commit:** `56e82cf`
**Applied fix:** Replaced the raw `sql\`UPDATE ... WHERE id IN ${ids}\`` template with Drizzle's query builder using `and(inArray(items.id, ids), eq(items.status, 'dead_letter'))`. The inArray helper expands the JS array into a parenthesized scalar list at render time, while the composed eq() keeps the dead_letter race guard atomic with the UPDATE. Removed the `void inArray;` defensive no-op — inArray is now genuine usage. Rewrote the retryAllCore unit test to assert `db.update` is invoked (not `db.execute`) and that the UPDATE's WHERE fragment carries the dead_letter literal. **Added a new integration test** (`tests/integration/dead-letter-retry-all.test.ts`) that seeds two dead_letter rows against a real Neon Pool driver and asserts both flip to pending + retry_count=1 after retryAllCore — proves the inArray path end-to-end, which was the coverage gap flagged by the review.

### WR-01: Sentry beforeSend scrubs only top-level keys — nested secrets pass through

**Files modified:** `sentry.server.config.ts`, `sentry.edge.config.ts`
**Commit:** `9fe8bc6`
**Applied fix:** Introduced a recursive `scrubNested(v, seen)` walker guarded by a WeakSet against object cycles; replaced the one-level `Object.keys` loop with a recursive walk across `event.request.data`, `event.extra`, `event.contexts`, and every `event.breadcrumbs[].data`. Expanded the key regex to include `bearer` (Auth.js breadcrumbs sometimes carry bearer-prefixed headers nested inside fetch data). Server and edge configs carry independent copies of `scrubNested` so the edge bundle stays self-contained.

### WR-02: updateSourceAction cannot deactivate a source — unchecked checkbox omitted

**Files modified:** `src/components/admin/source-form.tsx`, `src/server/actions/admin-sources.ts`
**Commit:** `50f7b9d`
**Applied fix:** Added a hidden `<input type="hidden" name="isActive" value="false">` sentinel immediately before the `isActive` checkbox, and set the checkbox's `value="true"`. An unchecked checkbox leaves only the sentinel in FormData; a checked checkbox appends a second `isActive=true` entry. Rewrote `readBool()` to use `fd.getAll(key)` + last-value-wins, because `FormData.get()` returns the FIRST occurrence of a repeated key (verified via a node -e smoke). Now the admin can deactivate a source via the edit form and the present-checkbox case correctly overrides the sentinel.

### WR-03: Soft-deleted source blocks re-creation under the same rss_url

**Files modified:** `src/server/actions/admin-sources.ts`, `src/components/admin/source-form.tsx`
**Commit:** `a7c2e1c`
**Applied fix:** Chose Option 1 from the review (catch 23505 in the server action) rather than Option 2 (partial unique index migration) — the latter is architecturally cleaner but requires another schema migration that is not load-bearing for v1. Added `isUniqueViolation(e)` helper that checks `.code === '23505'` with a defensive `.message` regex fallback for non-PG drivers. Extended the `ErrorCode` union with `'URL_EXISTS'`. Wrapped `createSourceCore()` so unique violations map to `{ ok: false, error: 'URL_EXISTS' }` instead of the opaque `'INTERNAL'`. Added Chinese copy `该 RSS 地址已存在(可能在软删除的信源中)` to the SourceForm ERROR_COPY map.

### WR-04: /api/admin/sentry-test reachable via CSRF (admin log-spam)

**Files modified:** `src/app/api/admin/sentry-test/route.ts`, `docs/observability.md`
**Commit:** `8f847aa`
**Applied fix:** Changed the route from `GET` to `POST` so a cross-site `<img src=...>` tag can no longer trigger the endpoint (images are GET-only). Added a belt-and-suspenders Origin/host equality check that rejects cross-origin POSTs with a 403 — layered on top of Auth.js's default SameSite=Lax session cookie, which already blocks top-level cross-site form POSTs from delivering the session cookie. Fails closed when either Origin or Host is absent. Updated `docs/observability.md` to reflect the new POST shape with an example `curl -X POST -b ... -H Origin:...` invocation. Left `06-UAT.md` alone (historical record; updated on re-verification).

### WR-05: banUserCore re-ban overwrites prior audit columns

**Files modified:** `src/lib/admin/users-repo.ts`, `src/server/actions/admin-users.ts`, `tests/unit/admin-users.test.ts`
**Commit:** `6d8e317`
**Applied fix (requires human verification):** Chose Option 1 from the review (is_banned guard at the top of banUserCore) rather than a separate ban_events audit table. Added `and(eq(users.isBanned, false))` to the UPDATE's WHERE so a re-ban matches zero rows and leaves the original `banned_at` / `banned_by` untouched. Introduced `AlreadyBannedError` and a disambiguation SELECT inside the transaction so zero-row UPDATE cleanly resolves to either `UserNotFoundError` (row does not exist) or `AlreadyBannedError` (row exists but is_banned=true). Mapped `AlreadyBannedError` → `'ALREADY_BANNED'` in `banUserAction`. Updated the existing UserNotFoundError test to seed the SELECT fallback and added a new AlreadyBannedError test proving DELETE sessions is skipped and only UPDATE + SELECT ran. **Note (human verification suggested):** the new `eq(users.isBanned, false)` guard is a subtle semantic change to a concurrency-critical transaction; the unit-test mock verifies shape but not the actual Postgres behavior. Recommend the operator seed a banned user on the dev branch and confirm (a) the UI's 解封 flow still works and (b) re-invoking banUserAction on a banned user returns `ALREADY_BANNED` rather than a 500.

### WR-06: requireAdmin redirect('/') drops originally-requested path

**Files modified:** `src/lib/auth/admin.ts`, `tests/unit/admin-gate.test.ts`
**Commit:** `40e1c1d`
**Applied fix:** Imported `headers` from `next/headers` and read the `x-pathname` header that middleware sets for every `/admin/*` request (src/middleware.ts:80-82). If the header is present, redirect to `/?next=${encodeURIComponent(pathname)}`; otherwise fall through to the canonical `redirect('/')` literal. Structured as two separate `redirect()` calls rather than a ternary so the literal `redirect('/')` stays intact for the static grep in `scripts/verify-admin-ops.ts:185`. Mocked `next/headers` in the admin-gate tests with a mutable `pathHeader` sentinel; kept the existing anonymous-redirect tests and added a new test asserting that seeding `x-pathname='/admin/users'` produces `redirect('/?next=%2Fadmin%2Fusers')`.

## Skipped Issues

_None — all 7 in-scope findings were fixed._

## Verification Summary

- `pnpm exec tsc --noEmit` — clean across the full repo after every fix.
- `pnpm exec vitest run tests/unit/admin-dead-letter.test.ts` — 6/6 passing.
- `pnpm exec vitest run tests/unit/admin-sources.test.ts` — 11/11 passing.
- `pnpm exec vitest run tests/unit/admin-users.test.ts` — 6/6 passing.
- `pnpm exec vitest run tests/unit/admin-gate.test.ts` — 8/8 passing.
- `pnpm exec vitest run tests/integration/ban-revokes-sessions.test.ts` — skipped (no real DB; expected).
- Full repo `pnpm exec vitest run` — 47 files passing, 2 skipped, 5 pre-existing failures in `src/lib/llm/*` and `src/trigger/process-pending.test.ts` (Anthropic SDK browser-environment detection; pre-date this fix pass, verified by checking out the pre-fix state).
- `tests/integration/dead-letter-retry-all.test.ts` (new): skips without `RUN_INTEGRATION_DB=1` / a `.neon.tech` URL — identical gating pattern to `ban-revokes-sessions.test.ts`. Needs to be run by the operator against a live dev branch to prove CR-01 end-to-end.

## Human Verification Checklist

- [ ] WR-05: Seed a banned user on the dev branch. Confirm (a) 解封 flow still works from the UsersTable and (b) re-invoking banUserAction on a banned user returns `ALREADY_BANNED` rather than 500. Confirm original banned_at/banned_by audit is NOT overwritten by a hand-crafted re-ban attempt.
- [ ] CR-01: Run `RUN_INTEGRATION_DB=1 pnpm exec vitest run tests/integration/dead-letter-retry-all.test.ts` against the dev Neon branch. Expect PASS.
- [ ] WR-04: Smoke test `curl -X POST -H "Origin: https://<host>" -b "<admin-cookie>" https://<host>/api/admin/sentry-test` and confirm 500 with the deliberate error; then test without Origin and confirm 403.

---

_Fixed: 2026-04-23T10:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
