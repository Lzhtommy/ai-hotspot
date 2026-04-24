# Admin Operations Runbook

> **Status: current as of Phase 6 completion (2026-04-24).** This runbook is the hand-off document for anyone operating the `/admin` backend. All admin data lives in Neon Postgres; there is no separate admin database. UI copy is Chinese (v1); this runbook is English prose with Chinese for the exact in-app strings that operators must recognize.

## 1. Overview

The `/admin` subtree is a protected operator surface with five routes:

| Route                | Purpose                                                           | Plan  |
| -------------------- | ----------------------------------------------------------------- | ----- |
| `/admin`             | Landing page — links to every other admin surface                 | 06-00 |
| `/admin/sources`     | CRUD + health for RSS sources (ADMIN-02..06)                      | 06-02 |
| `/admin/users`       | List + ban/unban (ADMIN-07, 08)                                   | 06-03 |
| `/admin/costs`       | Daily Claude + Voyage cost rollup from `pipeline_runs` (ADMIN-09) | 06-04 |
| `/admin/dead-letter` | List + retry items stuck in `status='dead_letter'` (OPS-03)       | 06-05 |

### Who should have the admin role

Admins can change every source the feed pulls from, revoke any user's session, and trigger LLM work that consumes Anthropic budget. Grant the role only to individuals who should be able to do all three. v1 supports exactly one role level (`admin` vs `user`); there is no fine-grained permission split.

### Defense-in-depth gate

Every `/admin` request passes three checks:

1. **Edge middleware** (`src/middleware.ts`) — cheap cookie-presence filter. Anonymous traffic to `/admin/*` is redirected at the CDN edge.
2. **RSC layout** (`src/app/admin/layout.tsx` → `requireAdmin()`) — authoritative DB-backed role lookup. Non-admins get redirected to `/admin/access-denied`.
3. **Per-action `assertAdmin()`** — every Server Action under `src/server/actions/admin-*.ts` re-checks the session before touching the database. This catches CSRF and any future route that forgets the layout gate.

Plan 06-00 wired all three layers. Sub-plans (06-02..06-05) MUST NOT redeclare the check — they rely on Layers 2 and 3 being in place.

## 2. Promoting a user to admin

**v1 has no in-app admin-promotion UI.** Promotion is an out-of-band SQL operation on the `users` table. This mirrors `docs/auth-providers.md` §5 (admin bootstrap playbook) and is intentional — the admin-creation API surface would itself need an authenticated admin to call it, which is a chicken-and-egg problem we solve with the one-off SQL grant.

### Prerequisites

- The target user has already signed in at least once via the normal OAuth or magic-link flow. Their `users` row exists (sign-up is passive on first session).
- You have direct `psql` access to the Neon production branch. Connection string: Neon Console → **Connection Details** → copy the `psql` command.

### Promote

```sql
-- Connect: psql 'postgresql://...'
UPDATE users SET role='admin' WHERE email='admin@example.com';
```

### Verify

```sql
SELECT id, email, role, is_banned
  FROM users
 WHERE role = 'admin';
```

### Demote

```sql
UPDATE users SET role='user' WHERE email='formerly-admin@example.com';
```

Demotion does NOT invalidate an existing session on its own — the role is re-read on every session callback (Auth.js DB strategy), so the admin becomes a plain user on their next request. To force immediate logout alongside demotion, also run:

```sql
DELETE FROM sessions WHERE "userId" = (SELECT id FROM users WHERE email='formerly-admin@example.com');
```

### Cautions

- Running these statements requires `DATABASE_URL` access. Treat that access as admin-level already — it is the actual trust boundary (T-6-82, runbook threat model).
- Do not grant the role to service accounts or users that sign in via a shared inbox.

## 3. Source management (`/admin/sources`)

### What this page does

Lists every row in `sources` where `deleted_at IS NULL`. Each row shows: name, rssUrl, language, weight, category, active toggle, last-fetched timestamp, and a three-state health badge (green / yellow / red).

Source code: `src/lib/admin/sources-repo.ts` (data layer), `src/server/actions/admin-sources.ts` (Server Actions), `src/app/admin/sources/page.tsx` (RSC).

### Add a new source

Click **新建信源** (or go to `/admin/sources/new`) and fill in:

| Field    | Meaning                                                                                     | Notes                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name     | Display name shown on feed cards                                                            | 1..200 chars, any language                                                                                                                                                               |
| rssUrl   | Either a full RSS URL (`http://…` / `https://…`) or an RSSHub route path beginning with `/` | Dispatch is prefix-based: `http(s)://` → direct fetch (30s timeout, no ACCESS_KEY); `/…` → RSSHub (60s budget + key). RSSHub routes are preferred when available — see `docs/rsshub.md`. |
| language | `zh` or `en`                                                                                | Controls whether the enrichment pipeline translates before scoring                                                                                                                       |
| weight   | numeric(3,1), `0.0..99.9`                                                                   | Source-level score multiplier. Default `1.0`. Raise to boost a high-signal source; lower to demote a noisy one                                                                           |
| category | Free-form TEXT, ≤40 chars (nullable)                                                        | Used for admin filtering only; not rendered on the public feed in v1                                                                                                                     |
| isActive | boolean                                                                                     | Unchecked = the ingestion poller skips this source                                                                                                                                       |

The form is a standard HTML `<form action={createSourceAction}>`. Validation is done server-side via zod; a malformed input returns `{ ok: false, error: 'VALIDATION' }` and the form shows the generic `输入无效` error. We intentionally do NOT echo the raw zod error back to the client — that would leak schema details (threat T-6-24).

### Edit an existing source

Go to `/admin/sources/{id}/edit`. You can change `name`, `weight`, `category`, and `isActive`. **`rssUrl` is immutable** once a source exists — changing it would orphan every ingested item from its origin URL and silently break dedup idempotency (the url-fingerprint hash is on the source's URL, not the source row). If you need to swap the source of an existing feed, create a new source row and soft-delete the old one.

### Soft-delete vs toggle-active

Two different operations, two different semantics:

| Action                  | Effect                                                                                                                                                     | When to use                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Toggle `isActive=false` | Pauses ingestion but the row stays in the admin list and items remain in the feed. Reversible with one click.                                              | Temporary pause — source is broken or you want to experiment.                                                                    |
| Soft-delete             | Sets `deleted_at = now()` AND `isActive = false`. Row disappears from the admin list (filter `deleted_at IS NULL`). Items already in the DB are preserved. | Permanent removal. Not reversible from the UI in v1; to undelete, run `UPDATE sources SET deleted_at=NULL WHERE id=...` via SQL. |

The ingestion poller (`src/trigger/ingest-hourly.ts`) filters BOTH `deleted_at IS NULL` AND `is_active = true`, so either action stops polling. The soft-delete step additionally removes the source from the admin UI.

### Health badge interpretation

The three-state badge is computed by `computeSourceHealth()` from two counters on the `sources` row:

| State  | Rule                                                           | Meaning                                                                               |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Green  | `consecutive_empty_count = 0 AND consecutive_error_count = 0`  | Normal — last poll returned items, no fetch error                                     |
| Yellow | `consecutive_empty_count >= 1 OR consecutive_error_count >= 1` | Early warning — one or more consecutive bad polls                                     |
| Red    | `consecutive_empty_count >= 3 OR consecutive_error_count >= 3` | Alarm — at least 3 consecutive empty or error polls. The source is effectively broken |

Red dominates yellow dominates green, so a source that errored 5 times then finally returned one empty response is still red until the counter resets. Counters reset to 0 on any successful poll that returns at least one item.

**When a source goes red:**

1. Click through to the edit page and open the `rssUrl` in a browser. If it 404s or the RSSHub route has moved, update the URL (note: rssUrl is immutable — you must create a new row and soft-delete the old one).
2. Check `/api/health` — if RSSHub itself is down, EVERY source will trend red together.
3. If the source is intentionally discontinued, soft-delete it.

## 4. User management (`/admin/users`)

### What this page does

Lists every row in `users` ordered by creation time (newest first). Each row shows: email, name, role, ban state, linked OAuth providers (GitHub/Google derived from the `accounts` table; empty array means Resend-only / magic-link only).

Source code: `src/lib/admin/users-repo.ts` (data layer), `src/server/actions/admin-users.ts` (Server Actions).

### Ban a user

Click **封禁** next to a row. This runs `banUserCore` which does three things **inside a single database transaction** (threat T-6-32, T-6-33):

1. `UPDATE users SET is_banned = true, banned_at = now(), banned_by = {admin_user_id} WHERE id = {target}`
2. `DELETE FROM sessions WHERE "userId" = {target}` — clears every active session row for this user
3. Commit or rollback atomically

Because Auth.js v5 uses the DB session strategy, deleting the `sessions` row makes the user's cookie resolve to `null` on their very next request. No logout round-trip is required from the user's side — they simply become anonymous on the next page load.

**What ban does NOT do:**

- Does NOT delete any of the user's data (favorites, votes). Those rows remain so that an unban restores the user's history.
- Does NOT anonymise their `email` / `name`. If you need full erasure, run `DELETE FROM users WHERE id = ...` via SQL; the FK cascade then removes favorites/votes/sessions/accounts.
- Does NOT log them out of connected OAuth providers (GitHub/Google) — only of this app.

### Unban a user

Click **解除封禁** next to a banned row. This clears `is_banned`, `banned_at`, and `banned_by`. It does NOT restore the previously-deleted session rows — the user must sign in again. This is deliberate: re-creating the session row server-side without the user's cookie would be meaningless, and the explicit sign-in also gives them a chance to see any post-ban UI they missed.

### Self-ban limitation

An admin cannot ban themselves (`SelfBanError` → `SELF_BAN`). The `banned_by FK` is set to the acting admin's `id`; if target === admin, the core rejects before the transaction begins. This prevents the "admin accidentally revokes their own session and locks themselves out of the admin UI" failure mode.

### Admin-to-admin ban

Not explicitly blocked in v1. An admin CAN ban another admin. If you need to prevent this, either (a) coordinate out-of-band, or (b) add a second guard in `banUserCore` checking the target's role — not shipped in v1 because there is typically only one admin per deployment.

## 5. Dead-letter queue (`/admin/dead-letter`)

### What lands here

Any item whose `status = 'dead_letter'`. The LLM pipeline core (`src/lib/llm/process-item-core.ts`) classifies failures as terminal vs transient:

| Terminal (→ dead_letter)                       | Transient (→ retry)                             |
| ---------------------------------------------- | ----------------------------------------------- |
| ZodError on LLM output                         | Anthropic 5xx / network timeout                 |
| EnrichError with cause `'parse'` or `'schema'` | Voyage 429 rate limit                           |
| EmbedError on malformed response               | Voyage transient error                          |
| `retry_count >= 3` after Trigger.dev retries   | Other unclassified throws (Trigger.dev retries) |

Dead-letter items carry a `failure_reason` (error class name + first 300 chars of message) — redacted of any API key fragments.

### Retry a single item

Click **重试** on a row. This calls `retryItemAction` which (a) enforces the rate limit, then (b) `UPDATE items SET status='pending', failure_reason=NULL, retry_count=retry_count+1 WHERE id={id} AND status='dead_letter'`. The `status='dead_letter'` guard is a race-guard (T-6-52) — two admins clicking retry on the same row concurrently will have one UPDATE match zero rows instead of double-incrementing `retry_count`.

The item re-enters the pending queue; the next `process-pending` cron tick (every 5 minutes) picks it up.

### Bulk retry

Click **全部重试** — retries up to `BULK_LIMIT=20` items in one call. Counts as a **single** rate-limit credit (rationale: preserves the 20-items/60-s ceiling whether an admin retries one at a time or all at once).

### Rate limit

**20 retries / 60 s / admin**, sliding-window (Upstash Ratelimit). Returns `error: 'RATE_LIMITED'` when exhausted.

Why sliding-window: a naive tumbling-bucket would allow up to 2×N retries in the 1-second neighbourhood of the minute boundary, which maps directly to 2× the LLM cost ceiling under an adversarial retry loop. Sliding-window closes that window.

Redis prefix: `admin:retry`. If you need to flush the limiter (emergency unthrottle), connect to Upstash and delete keys matching `admin:retry:*`.

## 6. LLM cost dashboard (`/admin/costs`)

### What this page shows

Two views over `pipeline_runs` (filter: `status = 'ok'`):

1. **Summary card** — total USD, total runs, total tokens, overall cache-hit ratio, and a model-breakdown chip strip (top contributors).
2. **Daily table** — one row per `(day × model)` for the last 30 days. Columns: date, model, input/cache-read/cache-write/output tokens, estimated_cost_usd, runs, cache-hit ratio.

Source code: `src/lib/admin/costs-repo.ts` (`getDailyCosts`, `getCostsSummary`), `src/app/admin/costs/page.tsx`.

### How to read it

| Metric               | Definition                                                        | Reasonable range (v1)          |
| -------------------- | ----------------------------------------------------------------- | ------------------------------ |
| `input_tokens`       | New tokens Claude had to process (no cache hit)                   | Most expensive — drives cost   |
| `cache_read_tokens`  | Tokens served from prompt cache (90% cheaper than input)          | We want this HIGH              |
| `cache_write_tokens` | First-time cache writes (25% premium over input for 5-min TTL)    | Small — one-off per cache-line |
| `output_tokens`      | Haiku-generated reply tokens                                      | Depends on summary length      |
| `estimated_cost_usd` | Sum over (tokens × per-model rate) — see `src/lib/llm/pricing.ts` | —                              |
| `cache_hit_ratio`    | `cache_read / (cache_read + input)`                               | Target ≥ 0.6 after warmup      |

### Red-flag thresholds

- **Daily cost > $2/day** — investigate. At the CLAUDE.md cost model (`~$15-20/month` at 200 items/hour, prompt-cache-enabled), sustained $2/day suggests either a retry storm, a prompt-cache miss regression, or a source that suddenly 10x'd its output rate.
- **Cache hit ratio < 0.3** — the prompt cache has gone cold. Verify `buildSystemPrompt >= 4096 tokens` (the Haiku 4.5 caching floor). If the system prompt is below floor, cache writes are ignored. Run: `pnpm test --run src/lib/llm/prompt`.
- **Output tokens spiking above ~400/item** — the JSON schema (`src/lib/llm/schema.ts`) may be drifting; Haiku is returning verbose blocks instead of concise summaries. Check a few recent items.

### Direct SQL fallback

If the page is down but you still need cost data, query `pipeline_runs` directly. See `docs/observability.md` §5 for the canonical snippet.

## 7. Troubleshooting

| Symptom                                                      | Likely cause                                                                                                                                              | Fix                                                                                                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin visits `/admin` and lands on `/admin/access-denied`    | `users.role != 'admin'` — role promotion hasn't taken effect yet                                                                                          | Verify with `SELECT role FROM users WHERE email=...`. If `admin`, the session cookie is stale — the admin should sign out and back in, OR wait for the next session-callback refresh.       |
| Admin navigates to `/admin/sources` and gets bounced to `/`  | No session at all (cookie missing/expired). Middleware caught it at Layer 1                                                                               | Sign in and try again.                                                                                                                                                                      |
| Server Action returns `{ ok: false, error: 'RATE_LIMITED' }` | 20-retries-per-60-s ceiling hit                                                                                                                           | Wait 60s, or flush `admin:retry:*` keys in Upstash for emergency unthrottle.                                                                                                                |
| `banUserAction` returns `SELF_BAN`                           | Admin tried to ban their own account                                                                                                                      | By design (T-6-30). Use SQL if you really need to self-lock.                                                                                                                                |
| Banned user still sees admin nav in a second browser tab     | Browser has a cached RSC payload                                                                                                                          | The ban clears their sessions row; the user becomes anonymous on the next _network_ request. A client-cached RSC render can persist until they navigate. Have them refresh.                 |
| `/admin/dead-letter` retry button does nothing               | Item `status` changed between list load and button click (race)                                                                                           | Reload the page. The race-guard (`WHERE status='dead_letter'`) silently matched zero rows — the item was already retried by another admin.                                                  |
| `/admin/costs` shows zero rows today but pipeline is running | `pipeline_runs` inserts only on `task='enrich'` / `'embed'` / `'score'` success paths with `status='ok'`. If every run is failing, the table stays empty. | Check `SELECT status, COUNT(*) FROM pipeline_runs WHERE created_at > now() - interval '1 hour' GROUP BY status;`. If all `failed`, go to `/admin/dead-letter` and inspect `failure_reason`. |

## 8. See Also

- `docs/observability.md` — Langfuse dashboards, Sentry errors, Vercel Analytics, `pipeline_runs` SQL.
- `docs/auth-providers.md` — OAuth provider setup, Vercel env matrix, admin-role SQL bootstrap (originates here, cross-linked for convenience).
- `docs/database.md` — Drizzle + Neon + pgvector migration workflow.
- `docs/rsshub.md` — RSSHub HF Space pointer + access-key rotation runbook.
- `docs/health.md` — `/api/health` contract for Neon / Redis / Trigger.dev / RSSHub.
- `.planning/phases/06-admin-operational-hardening/06-UAT.md` — the SC-by-SC UAT checklist for the phase.
