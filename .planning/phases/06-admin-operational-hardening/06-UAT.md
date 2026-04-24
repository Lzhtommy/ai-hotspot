---
phase: 06-admin-operational-hardening
created: 2026-04-24
status: pending
---

# Phase 6 — User Acceptance Test

Gated by the orchestrator after Plan 06-08 ships. Confirms all 5 ROADMAP Success Criteria live against a deployed environment (Vercel preview OR local dev + Trigger.dev tunnel) with a real admin user, Neon dev branch, Sentry project (if provisioned), and Langfuse project.

Complements the code-level harness (`pnpm verify:admin-ops`) — the harness asserts DB-level and static-file preconditions; this UAT exercises what only a human on a browser can validate: cross-tab session revocation, live dashboard event delivery, and visual admin flows.

Cross-references:

- `docs/admin.md` — the operational runbook you are verifying against.
- `docs/observability.md` — Sentry + Langfuse + Vercel Analytics dashboards.
- `.planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md` — deferred live Sentry smoke-test (partial status; merge its PASS into SC#4 here once DSN is provisioned).

## Preflight

Complete every row before starting. If any are unchecked, log the gap and either provision or record as DEFERRED.

- [ ] `.env.local` (or Vercel preview env) has: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`
- [ ] At least one user has signed in via the normal OAuth / magic-link flow and has been promoted to admin per `docs/admin.md` §2 (`UPDATE users SET role='admin' WHERE email='...'`)
- [ ] At least one regular (non-admin) user exists
- [ ] Dev server or Vercel preview deployment URL is known. If local: `pnpm dev` running on http://localhost:3000 AND `pnpm trigger:dev` running for worker tasks
- [ ] Sentry provisioned (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` in Vercel; `SENTRY_DSN` also in Trigger.dev env) — if not, record SC#4 as DEFERRED and cross-link 06-06-HUMAN-UAT.md
- [ ] Langfuse provisioned (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` in Vercel + Trigger.dev) — if not, record the OPS-02 live dashboard check as DEFERRED and rely on `pipeline_runs` SQL fallback per `docs/observability.md` §5
- [ ] `pnpm test --run` exits 0 (unit tests green)
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm verify:admin-ops` exits 0 (automated preconditions all PASS)

## Automated Run

**Command:** `pnpm verify:admin-ops`

Expected duration: ~10 seconds.

Expected stdout PASS lines (non-exhaustive — consult the harness for the full list):

```
[PASS] SC#1 requireAdmin source declares 3 gate branches
[PASS] SC#1 middleware edge filter present
[PASS] SC#1 admin layout invokes requireAdmin
[PASS] SC#2 computeSourceHealth returns red at errorCount=3
[PASS] SC#2 softDeleteSourceCore hides source from admin list
[PASS] SC#2 ingest poller filters deleted_at IS NULL
[PASS] SC#3 banUserCore flips is_banned + records banned_by
[PASS] SC#3 banUserCore deletes target sessions atomically
[PASS] SC#3 getDailyCosts executes against pipeline_runs schema
[PASS] SC#3 OPS-02 src/lib/llm/otel.ts contains Langfuse wiring
[PASS] SC#3 OPS-02 .env.example declares LANGFUSE keys
[PASS] SC#3 OPS-02 package.json depends on @langfuse/otel
[PASS] SC#4 sentry.server.config.ts contains beforeSend + cookie scrub
[PASS] SC#4 instrumentation-client.ts exists
[PASS] SC#4 Trigger.dev sentry-wrapper present
[PASS] SC#5 retryItemCore flips dead_letter→pending + increments retryCount
[PASS] SC#5 getPublishedItemUrls returns published rows incl. sentinel
[PASS] SC#5 /sitemap.xml HTTP probe (best-effort)
```

If any line shows `[FAIL]`, consult the Troubleshooting section below before continuing to the manual checks.

## Per-SC Checklist

### SC#1 — Admin route gating

Covers ADMIN-01.

- [ ] Sign out. As an **anonymous** user, visit the deployed URL `/admin` — you are redirected to `/` (home feed).
- [ ] Sign in as a **non-admin** user. Visit `/admin` — you are redirected to `/admin/access-denied`. The page renders the Chinese copy indicating access is denied.
- [ ] Sign out, then sign in as an **admin**. Visit `/admin` — the admin shell renders with the admin nav (`信源`, `用户`, `成本`, `失败项`) visible.
- [ ] Admin can navigate into each of `/admin/sources`, `/admin/users`, `/admin/costs`, `/admin/dead-letter`.
- Reference: ROADMAP.md Phase 6 SC#1; `docs/admin.md` §1.

### SC#2 — Source CRUD + health

Covers ADMIN-02..06.

- [ ] As admin, open `/admin/sources`. See the list of sources with columns (name, URL, weight, active, last-fetched, error count, health badge).
- [ ] Click **新建信源**. Fill in: name = "SC#2 UAT source", rssUrl = "/__uat__/sc2", language = "en", weight = "1.0", category = "lab", active = on. Submit. Return to the list and confirm the new row appears.
- [ ] Click edit on the new row. Change weight → "2.0". Save. Return to list and confirm weight shows 2.0.
- [ ] Toggle active off. Row stays in list with active=off.
- [ ] Click **删除** (soft-delete). Row disappears from the list.
- [ ] Via SQL verify: `SELECT id, name, deleted_at, is_active FROM sources WHERE name='SC#2 UAT source';` — `deleted_at` is non-null, `is_active` is false. Clean up with `DELETE FROM sources WHERE name='SC#2 UAT source';` afterwards.
- [ ] **Health badge (red):** via SQL, `UPDATE sources SET consecutive_error_count = 3 WHERE name='<any existing source>';` then reload `/admin/sources` — that row shows a red badge. Reset with `UPDATE sources SET consecutive_error_count = 0 WHERE name='<same>';`.
- [ ] `/api/health` returns `{ ok: true, services: { neon: 'ok', ... } }`.
- Reference: ROADMAP.md Phase 6 SC#2; `docs/admin.md` §3.

### SC#3 — User ban + session revocation + cost dashboard + OPS-02 (Langfuse)

Covers ADMIN-07, ADMIN-08, ADMIN-09, OPS-02.

**Live session revocation (the SC test):**

- [ ] Open **two browser profiles**: Profile A signs in as admin, Profile B signs in as the target (non-admin) user.
- [ ] In Profile B, confirm `UserChip` shows the target's avatar/email on the home page — session is live.
- [ ] In Profile A, go to `/admin/users`, find the target row, click **封禁**. Confirm the admin list now shows the target as banned.
- [ ] In Profile B, navigate to any page (click the home link or refresh). `UserChip` now shows the anonymous state (登录 button). No explicit logout was required.
- [ ] In Profile A, unban the target via **解除封禁**.
- [ ] In Profile B, click sign-in again and confirm authentication works — no residual ban state.

**Self-ban guard:**

- [ ] In Profile A, attempt to ban the admin account itself (if a self-row is visible in the list). The action surfaces the `SELF_BAN` error; the admin's session is untouched.

**Cost dashboard:**

- [ ] Go to `/admin/costs`. Confirm the summary card renders without errors, and the daily table lists at least one row (if the pipeline has run). If empty, run `pnpm trigger:dev` + manually trigger `process-item` to populate.
- [ ] Verify at least one row shows `cache_hit_ratio > 0` (confirms prompt caching is active — corroborates Phase 3 SC#2).

**OPS-02 live Langfuse check (skip to DEFERRED if Langfuse not provisioned):**

- [ ] Within 5 minutes of the most recent pipeline run, open `https://cloud.langfuse.com/project/<LANGFUSE_PROJECT_ID>/traces` (replace `<LANGFUSE_PROJECT_ID>` with your project's ID).
- [ ] Filter traces to the last 10 minutes. Confirm ≥ 1 trace exists from today.
- [ ] Open the trace. Verify:
  - `input_tokens > 0`
  - `output_tokens > 0`
  - `estimated_cost_usd > 0`
  - Subsequent traces in the same 5-min window show `cache_read_input_tokens > 0` (prompt cache hit)
  - No `sk-ant-...` key prefix visible anywhere in prompt/completion text (T-03-04 privacy check)
- [ ] If Langfuse is NOT provisioned, record SC#3 OPS-02 as DEFERRED, and instead verify the same data via `pipeline_runs` SQL per `docs/observability.md` §5:
  ```sql
  SELECT item_id, model, task, input_tokens, cache_read_tokens, estimated_cost_usd
    FROM pipeline_runs
   WHERE status = 'ok'
   ORDER BY created_at DESC
   LIMIT 6;
  ```
  Confirm: ≥2 enrich rows, at least one with `cache_read_tokens > 0`, `estimated_cost_usd > 0`.
- Reference: ROADMAP.md Phase 6 SC#3; `docs/admin.md` §4, §6; `docs/observability.md` §2.

### SC#4 — Sentry error visibility (OPS-01)

**DEFERRED if `SENTRY_DSN` not provisioned.** This SC inherits the status from `06-06-HUMAN-UAT.md`; complete its pending tests to close this SC.

- [ ] **Next.js path:** As admin, `GET /api/admin/sentry-test` (via browser address bar or curl with the session cookie). Response 500 with the deliberate "Sentry integration test — <ISO timestamp>" error.
- [ ] Within 5 minutes, open **Sentry → Issues**. Find the matching title. Inspect the event payload:
  - `request.cookies` → `{}`
  - `request.headers.cookie` and `authorization` → absent
  - `user.email` → `[redacted]` (if attached)
  - `user.id` → preserved
- [ ] **Trigger.dev path:** Temporarily add `throw new Error('Sentry Trigger.dev test')` inside the `withSentry('process-item', async () => { ... })` block of `src/trigger/process-item.ts`. Run `pnpm trigger:dev` and manually trigger `process-item` from the Trigger.dev dashboard.
- [ ] Within 5 minutes, the error appears in Sentry with `tag: task=process-item`. Remove the temporary throw. Run `pnpm typecheck && pnpm test --run` — exits 0 after cleanup.
- [ ] Record the Sentry event IDs (Next.js + Trigger.dev) in the Sign-off block below.
- Reference: ROADMAP.md Phase 6 SC#4; `docs/observability.md` §1; `06-06-HUMAN-UAT.md`.

### SC#5 — Dead-letter retry + public sitemap

Covers OPS-03, OPS-04.

**Dead-letter retry:**

- [ ] Via SQL, pick a recently-processed item and move it to dead-letter: `UPDATE items SET status='dead_letter', failure_reason='UAT: SC#5 sentinel', processed_at=now() WHERE id = (SELECT id FROM items WHERE status='published' ORDER BY published_at DESC LIMIT 1);` — keep the `id` for cleanup.
- [ ] As admin, visit `/admin/dead-letter`. The manually-set item appears with its failure reason and retry count.
- [ ] Click **重试** on the row. The page revalidates; the item disappears from the dead-letter list.
- [ ] Via SQL confirm the transition: `SELECT status, retry_count, failure_reason FROM items WHERE id = {id};` — status is `pending` (or already `processing`/`published` if a cron tick has picked it up), `retry_count` is 1 higher than before, `failure_reason` is NULL.
- [ ] Wait up to 5 minutes (the `process-pending` cron cadence) and reconfirm: the item is now `published` again. If a `publishing` pipeline run produces an identifiable trace, verify a new `pipeline_runs` row exists for the retried item.
- [ ] **Rate limit:** as admin, click retry ≥ 21 times within 60 seconds (use a prepared set of 21 sentinel rows, or the bulk action). The 21st click returns `RATE_LIMITED` and the UI shows the 操作频率过快 / rate-limit error. Wait 60s; the next click succeeds.

**Public sitemap:**

- [ ] `curl https://{deploy-url}/sitemap.xml` — HTTP 200, `Content-Type: application/xml`, body starts with `<?xml version="1.0"` and contains `<urlset`.
- [ ] Body contains `<url>` entries for at least the home URL and `/all`; if published items exist, one entry per item up to 5000.
- [ ] `curl https://{deploy-url}/robots.txt` — contains `Disallow: /admin`.
- [ ] Page loads do NOT make a request to `fonts.googleapis.com` or any Google Analytics endpoint (inspect the Network panel). Vercel Analytics beacon to `/_vercel/insights/view` is expected.
- Reference: ROADMAP.md Phase 6 SC#5; `docs/admin.md` §5; `docs/observability.md` §3.

## Troubleshooting

| Symptom                                                             | Likely cause                                                 | Fix                                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| SC#1 FAIL: admin redirected back to `/`                             | `users.role` is `user`, not `admin`                          | Run `docs/admin.md` §2 SQL and verify with `SELECT role FROM users WHERE email=...`. Sign out + back in to refresh the session.         |
| SC#1 FAIL: non-admin lands on `/admin`, not `/admin/access-denied`  | Middleware not wired, or admin layout gate bypassed          | Check `src/middleware.ts` matcher includes `/admin/:path*` and `src/app/admin/layout.tsx` calls `requireAdmin()`.                       |
| SC#2 FAIL: soft-deleted source still in list                        | Admin list query missing `deleted_at IS NULL` filter         | Confirm `listSourcesForAdmin` in `src/lib/admin/sources-repo.ts` filters `isNull(sources.deletedAt)`.                                   |
| SC#2 FAIL: health badge never red                                   | Counters not incrementing on failed poll                     | Inspect `src/trigger/ingest-hourly.ts` — must UPDATE `consecutive_error_count` on fetchSource errors. Or manually set via SQL for test. |
| SC#3 FAIL: banned user still signed in on refresh                   | `sessions` row not deleted in the transaction                | Verify `banUserCore` deletes sessions in the same `db.transaction` block. Check `SELECT * FROM sessions WHERE "userId" = '{id}';`.      |
| SC#3 DEFERRED: Langfuse traces missing                              | `LANGFUSE_*` env missing in Trigger.dev, OR `flushOtel` skipped | Confirm env is set in BOTH Vercel and Trigger.dev. Confirm `flushOtel()` is awaited in the task's finally{} (Pitfall 6).                |
| SC#4 DEFERRED: SENTRY_DSN not provisioned                           | DSN not set in Vercel + Trigger.dev                          | Provision via `docs/observability.md` §1. Re-run tests in `06-06-HUMAN-UAT.md`.                                                         |
| SC#4 FAIL: event arrives in Sentry but cookies visible              | `beforeSend` not firing or mutating wrong field              | Inspect `sentry.server.config.ts` beforeSend. Add a debug `console.log` to confirm the hook fires. Confirm `event.request.cookies = {}`. |
| SC#5 FAIL: retry click does nothing                                 | Item race — another admin retried first                      | Reload `/admin/dead-letter`; the row may be gone. Seed a fresh sentinel via SQL.                                                        |
| SC#5 FAIL: `RATE_LIMITED` doesn't appear after 20+ clicks           | Upstash Redis not reachable, or rate-limit short-circuited   | Check `UPSTASH_REDIS_REST_URL` reachability via `/api/health`. Inspect Upstash dashboard for keys matching `admin:retry:*`.             |
| SC#5 FAIL: sitemap build error at Vercel deploy                     | Pre-existing regression — see `deferred-items.md`            | `/sitemap.xml` prerender fails when build-time DATABASE_URL is not live. Fix options: force-dynamic route, gate query at build, or provide branch DATABASE_URL to Vercel build env. Tracked in `deferred-items.md`. |
| `verify:admin-ops` harness FAIL on cleanup                          | Sentinel rows remain from prior crash                        | Re-run the harness — cleanup is idempotent (`DELETE ... WHERE source_id IN (...)`).                                                     |

## Deferred Items Cross-Reference

Before sign-off, confirm the status of each deferred item in `.planning/phases/06-admin-operational-hardening/deferred-items.md`:

1. **Live Sentry verification (06-06)** — merge result here into SC#4 when the DSN is provisioned and both tests in `06-06-HUMAN-UAT.md` show `result: pass`.
2. **`/sitemap.xml` prerender failure at build time without live DATABASE_URL** — track separately; not blocking for Phase 6 sign-off because the route works at runtime on deployments with a real DATABASE_URL. Recommended fix (not in this plan): change `src/app/sitemap.ts` to `export const dynamic = 'force-dynamic'` OR gate the DB query behind a placeholder-DATABASE_URL check. Candidate for a follow-up quick task.
3. **Voyage rate-limit test failures on `pnpm test --run`** — pre-existing Phase 3 LLM client issue; unrelated to Phase 6 surfaces. Track in `deferred-items.md`.

## Sign-off

- [ ] SC#1 PASS
- [ ] SC#2 PASS
- [ ] SC#3 PASS (OPS-02 Langfuse: PASS / DEFERRED)
- [ ] SC#4 PASS (or DEFERRED pending Sentry DSN — cross-ref `06-06-HUMAN-UAT.md`)
- [ ] SC#5 PASS (sitemap runtime PASS; build-time failure separately tracked in `deferred-items.md`)

**Verifier:** {name}
**Date:** {YYYY-MM-DD}
**Branch:** gsd/phase-06-admin-operational-hardening
**Deploy target:** {Vercel preview URL OR http://localhost:3000}
**Sentry event IDs (SC#4):** {next.js event ID} / {trigger.dev event ID}
**Langfuse trace URL (SC#3 OPS-02):** {trace URL or DEFERRED}

**Verdict:** PASS · FAIL · DEFERRED (specify which SCs)

---

_Phase: 06-admin-operational-hardening_
_Plan: 06-08 (runbooks + verification harness + UAT)_
_Related: `.planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md` (deferred live Sentry)_
