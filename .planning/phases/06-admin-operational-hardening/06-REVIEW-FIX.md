---
phase: 06-admin-operational-hardening
fixed_at: 2026-04-24T00:00:00Z
review_path: .planning/phases/06-admin-operational-hardening/06-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report (Iteration 2)

**Fixed at:** 2026-04-24T00:00:00Z
**Source review:** `.planning/phases/06-admin-operational-hardening/06-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 2 (WR-07, WR-08 — Critical/Warning only)
- Fixed: 2
- Skipped: 0
- Info findings (IN-01..IN-05): out of scope per `fix_scope=critical_warning`

All iteration-2 in-scope findings applied cleanly. No rollbacks were required. All admin-related tests (40) pass; full `tsc --noEmit` is clean. The 5 pre-existing test failures in `src/lib/llm/*` and `src/trigger/process-pending.test.ts` are unrelated env-missing failures (verified against the pre-fix state) and untouched by this iteration.

## Fixed Issues

### WR-07: updateSourceAction maps empty category `<select>` to `null`

**Files modified:**
- `src/server/actions/admin-sources.ts`
- `tests/unit/admin-sources-actions.test.ts` (new file)

**Commit:** `31e0475` (+ tsc test-only follow-up `4af4b8c`)

**Applied fix:** Chose **Option A** from the review (teach `readString` a `preserveEmpty` opt-in). Key changes:

1. `readString(fd, key, { preserveEmpty: true })` now returns `''` verbatim instead of collapsing to `undefined` for that caller. Default behavior (no opts) is unchanged, so `createSourceAction` and every other call site keep their empty-string → undefined semantics.
2. `updateSourceAction` reads category via `formData.has('category')` + `{ preserveEmpty: true }` and then maps the three states explicitly:
   - key absent → `undefined` (no change — repo `'category' in patch` is false)
   - key present + empty string → `null` (explicit clear — repo writes `category = null`)
   - key present + non-empty → the string
3. `createSourceAction` intentionally untouched: `readString(formData, 'category') ?? null` already coerces empty-string-or-absent to `null` for a brand-new row. The asymmetry was the bug; now both CREATE and UPDATE treat the value consistently.

**Test coverage added** (3 new cases in `tests/unit/admin-sources-actions.test.ts`):
- `category=""` → patch has `{ category: null }` with key present
- `category="lab"` → patch has `{ category: 'lab' }`
- no `category` field → patch has no `category` key (undefined)

Verification: `tsc --noEmit` clean; `vitest run tests/unit/admin-sources-actions.test.ts tests/unit/admin-sources.test.ts` passes 14 tests. The repo-layer contract (`'category' in patch` → writes null) was already proven by the pre-existing `updateSourceCore(7, { category: null })` test at `admin-sources.test.ts:200-204`, so the new action-layer tests close the end-to-end loop.

A follow-up commit `4af4b8c` relaxed the `mock.calls[0]!` destructure to an explicit `as unknown as [number, Record<string, unknown>]` cast — the lint-staged hook does not gate on `tsc` so the typo-level TS2493 error was not caught in the first commit. No runtime behavior change; test semantics are identical.

### WR-08: UserBanButton handles ALREADY_BANNED with correct copy + router.refresh()

**Files modified:** `src/components/admin/user-ban-button.tsx`

**Commit:** `f6bba87`

**Applied fix:** Added a new `else if (result.error === 'ALREADY_BANNED')` branch between `SELF_BAN` and `UNAUTHENTICATED` that:

1. Alerts `'该用户已被封禁,请刷新列表。'` instead of the generic `'操作失败,请重试'`.
2. Calls `router.refresh()` so the stale row re-fetches from the server and the 解封 button replaces the 封禁 button on the next paint. (Pattern matches `source-row-actions.tsx` and `source-form.tsx` — same `next/navigation#useRouter` + `.refresh()` idiom.)

Updated the JSDoc block at the top of the file to document the new branch + the stale-tab reachability argument (admin-A/admin-B race) with an explicit 06-REVIEW WR-08 reference.

Verification: `tsc --noEmit` clean. No tests exist for the client component itself (no `user-ban-button.test.tsx` in the repo), but the Server-Action contract — `banUserAction` returns `{ ok: false, error: 'ALREADY_BANNED' }` on the zero-row UPDATE + AlreadyBannedError path — is already covered by `tests/unit/admin-users.test.ts` (6/6 passing) and `tests/integration/ban-revokes-sessions.test.ts`.

---

_Fixed: 2026-04-24T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2 (follow-up to 06-REVIEW-FIX.md iteration 1)_
