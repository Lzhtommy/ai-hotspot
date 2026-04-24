# Observability Runbook

> **Status: current as of Phase 6 completion (2026-04-24).** Covers the three observability layers of the production stack: Sentry (errors), Langfuse (LLM cost + traces — OPS-02), Vercel Analytics (web metrics — OPS-05), plus `/api/health` and direct `pipeline_runs` SQL as a canonical fallback.

This runbook assumes you already know your way around `docs/admin.md` (which covers the `/admin/costs` in-app view). Admin-ops and observability overlap but are not the same: the admin UI is a curated slice; this runbook is the full toolkit.

## 1. Sentry (OPS-01)

### What it catches

- **Next.js** — any thrown error from a Server Action, Route Handler, or server-rendered page. Client-side errors from the `app/` bundle (including interaction handlers on Client Components) are captured via `instrumentation-client.ts`.
- **Trigger.dev** — errors thrown inside tasks wrapped by `withSentry(...)` (see `src/trigger/sentry-wrapper.ts`). The wrapper is currently applied to `process-item` — extend to new tasks by wrapping their `run` handler.

The Sentry SDK is initialized separately for server (`sentry.server.config.ts`), edge (`sentry.edge.config.ts`), and browser (`instrumentation-client.ts`). Next.js `register()` runs the appropriate init at cold start for each runtime.

### Environment variables

All set in Vercel (Production + Preview + Development scopes) and Trigger.dev project env:

| Variable                 | Scope                                           | Purpose                                                                                          |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `SENTRY_DSN`             | Runtime (Vercel + Trigger.dev)                  | Server + worker DSN                                                                              |
| `NEXT_PUBLIC_SENTRY_DSN` | Runtime (Vercel)                                | Browser DSN — same value as `SENTRY_DSN`, exposed via `NEXT_PUBLIC_` prefix                      |
| `SENTRY_AUTH_TOKEN`      | Build-time only (Vercel Build + GitHub Actions) | Sourcemap upload — scope `project:releases + project:read`. Absent = sourcemaps silently skipped |
| `SENTRY_ORG`             | Build-time                                      | Sentry organisation slug                                                                         |
| `SENTRY_PROJECT`         | Build-time                                      | Sentry project slug                                                                              |

Get DSN + auth token from Sentry Dashboard → **Settings → Projects → ai-hotspot → Client Keys (DSN)** and **Settings → Account → Auth Tokens**.

`Sentry.init()` is gated by `enabled: process.env.NODE_ENV === 'production' || !!process.env.SENTRY_DSN`, so local dev without a DSN does not spam "Sentry DSN is not defined" warnings on every boot.

### PII scrub via `beforeSend` (T-6-60)

Every event passes through `beforeSend` in `sentry.server.config.ts`. We **mutate in place and return the event** — we do NOT return `null` (which would drop the event). The operator still gets the error signal, just without PII.

Scrubbed fields:

```ts
// sentry.server.config.ts (excerpt)
beforeSend(event) {
  if (event.request?.cookies) event.request.cookies = {};
  if (event.request?.headers) {
    delete event.request.headers['cookie'];
    delete event.request.headers['authorization'];
    delete event.request.headers['Authorization'];
    delete event.request.headers['Cookie'];
  }
  if (event.user?.email) event.user.email = '[redacted]';
  if (event.request?.data && typeof event.request.data === 'object') {
    const data = event.request.data as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      if (/token|secret|key|password|authorization/i.test(key)) {
        data[key] = '[redacted]';
      }
    }
  }
  return event;
}
```

- `request.cookies` → wiped (entire object → `{}`)
- `request.headers.cookie` / `authorization` (both casings) → deleted
- `user.email` → `[redacted]` (but `user.id` is kept for correlation — operators need a stable identifier without the plaintext email)
- `request.data.*` — any key matching `/token|secret|key|password|authorization/i` is redacted to `[redacted]`

Sentry's built-in relay-side scrubbing is **defense in depth** — the `beforeSend` hook is our primary layer. Do not rely on relay scrubbing alone.

### How to verify new errors land within 5 minutes

1. Sign in as an admin.
2. Hit `GET /api/admin/sentry-test` (exists in dev; this route is admin-gated). This throws a labelled `Sentry integration test — <ISO timestamp>` error on purpose.
3. Within 5 minutes, the error should appear in **Sentry → Issues** with the matching title. Inspect the event payload:
   - `request.cookies` is `{}`
   - `request.headers.cookie` and `authorization` are absent
   - `user.email` (if attached) is `[redacted]`; `user.id` is preserved
4. For the Trigger.dev side: temporarily inject `throw new Error('Sentry Trigger.dev test')` inside the `withSentry('process-item', async () => { ... })` block, run `pnpm trigger:dev`, manually trigger the task from the Trigger.dev dashboard. Error appears in Sentry within 5 min with tag `task=process-item`. Remove the throw after verifying.

### Live verification status (2026-04-24)

Live Sentry smoke-test is tracked in `.planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md` and is DEFERRED pending DSN provisioning. The code path is complete and committed (commits `e713c7e` + `36372d1`); the two tests above exercise it end-to-end.

## 2. Langfuse (OPS-02)

### Why no code change was needed

Phase 3 Plan 03-04 already shipped the full Langfuse OTel bootstrap:

- `src/lib/llm/otel.ts` wires `@arizeai/openinference-instrumentation-anthropic` to patch the Anthropic SDK's `Messages` prototype so every `client.messages.create(...)` call emits an OTel span.
- `LangfuseSpanProcessor` from `@langfuse/otel` exports those spans to Langfuse Cloud.
- The OTel SDK is started at module load in every Trigger.dev task file that invokes Anthropic (idempotent via the `started` flag) and flushed in the task's `finally{}` block via `flushOtel()` — the latter is critical because Trigger.dev recycles worker processes aggressively (RESEARCH §Pitfall 6).

OPS-02 is therefore satisfied without code change — this runbook is the missing piece (how to read the dashboards).

### Environment variables

Set in Vercel (Production + Preview + Development) **and** Trigger.dev project env (the worker runtime does not inherit Vercel env):

| Variable              | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `LANGFUSE_PUBLIC_KEY` | Publishable key (`pk-lf-...`)                             |
| `LANGFUSE_SECRET_KEY` | Secret key (`sk-lf-...`)                                  |
| `LANGFUSE_BASE_URL`   | `https://cloud.langfuse.com` (default) or self-hosted URL |

Get both keys from Langfuse Cloud → **Settings → API Keys**.

### Dashboard URL template

```
https://cloud.langfuse.com/project/<LANGFUSE_PROJECT_ID>/traces
```

Replace `<LANGFUSE_PROJECT_ID>` with your project's ID (Langfuse Settings → General → Project ID, or copy from the URL after logging in).

### Per-item trace view

Each pipeline invocation emits one trace with typically three spans:

| Span                                                          | Covers                                                        | Notable metadata                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `anthropic.messages.create` (enrich)                          | Claude Haiku call for score + summary + recommendation + tags | `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`, `estimated_cost_usd`, `model` |
| `anthropic.messages.create` (translate, if English source)    | Haiku translation prior to scoring                            | Same shape                                                                                                               |
| Voyage embedding span (if OpenInference instruments voyageai) | Voyage `voyage-3.5` embedding                                 | `input_tokens`                                                                                                           |

Filter by the last 10 minutes to find a recent run; each trace opens into a waterfall view showing input prompt, output content, cost, and latency per span.

### Cost column

Langfuse auto-computes `estimated_cost_usd` per span from the model ID and token counts using Langfuse's internal pricing table. The default table covers Haiku 4.5, Sonnet 4.6, voyage-3.5. If you see `$0` on a span, verify the model string in the span name matches the Langfuse pricing table exactly.

Per-model breakdown: Langfuse → **Usage** → group by Model. This is the canonical Chinese-LLM cost rollup for the ops team; `/admin/costs` is the in-app convenience view, but Langfuse is the authoritative source.

### Cache-hit-rate column

Look for `cache_read_input_tokens` in the span metadata. A healthy warmed-up pipeline shows this > 0 on the second-and-subsequent items within any 5-minute window (Haiku 4.5 prompt-cache TTL). SC#2 of Phase 3 was specifically the assertion `MAX(cache_read_tokens) > 0 across sentinel A+B enrich runs`.

Cache-hit-ratio shortcut: `cache_read_input_tokens / (cache_read_input_tokens + input_tokens)`. Same metric surfaced on `/admin/costs`.

### Quick sanity check after a pipeline run

1. Trigger a pipeline run (either cron tick waits up to 5 min, or `pnpm trigger:dev` then manual trigger from the Trigger.dev dashboard).
2. Open `https://cloud.langfuse.com/project/<LANGFUSE_PROJECT_ID>/traces` and filter by last 10 minutes.
3. Expect ≥ 1 trace per processed item. Open one — verify:
   - `input_tokens > 0`
   - `output_tokens > 0`
   - `estimated_cost_usd > 0`
   - second-and-subsequent items within 5 min show `cache_read_input_tokens > 0`

If no traces appear after 10 minutes: (a) check Langfuse env vars are present in Trigger.dev, (b) verify `flushOtel()` is called in the task finally — without it, spans sit in the batch queue and never ship before worker recycle.

## 3. Vercel Analytics (OPS-05)

### What it surfaces

- Page views — per route and per day
- Top pages
- Web Vitals — LCP, CLS, INP, TTFB, FCP
- Geography — country / region rollup (important for gauging mainland-China-accessibility of the deployment)
- Referrer breakdown

### Where it's wired

`@vercel/analytics/next` `<Analytics />` component, mounted once in the root layout (`src/app/layout.tsx`) per Plan 06-07. Page-view beacons POST to `/_vercel/insights/view` — same-origin, cookieless, so no cookie banner is required.

### Access

Vercel Dashboard → **Analytics** tab on the project. Free tier is included with every Vercel project; upgrade to Pro for sub-hour granularity.

### Privacy note

Vercel Analytics is cookieless by design — it uses a daily-rotating, hashed visitor ID derived from the request IP + user agent. No PII leaves the user's browser. This is why no cookie consent banner is needed for OPS-05.

## 4. `/api/health`

### Contract

`GET /api/health` runs four parallel `Promise.allSettled` probes:

| Service         | Check                                                              | Timeout                 |
| --------------- | ------------------------------------------------------------------ | ----------------------- |
| Neon (Postgres) | `SELECT 1` via Drizzle                                             | Neon HTTP default (~5s) |
| Upstash Redis   | `redis.ping()`                                                     | HTTP default            |
| Trigger.dev     | `whoami` API call (fallback: tr\_-prefix token presence)           | HTTP default            |
| RSSHub          | `fetchRSSHub(warmup HEAD)` — 5s warmup + up to 60s measured budget | 60s                     |

Response:

```json
{
  "ok": true,
  "services": {
    "neon": "ok",
    "redis": "ok",
    "rsshub": "ok",
    "trigger": "ok"
  }
}
```

Any failing probe flips `ok: false` and the individual service key to a descriptive string (e.g. `"redis": "error: WRONGPASS"`). Full contract: `docs/health.md`.

### Use as a cheap first-response for paging

If a page doesn't load, hit `/api/health` first. If it returns `{ok: false}`, the issue is an upstream service, not the Next.js app.

## 5. `pipeline_runs` as canonical cost source

`pipeline_runs` is the same data source that `/admin/costs` aggregates over. When the admin page is down, or when you want a cost breakdown the UI doesn't expose, query directly:

### 30-day daily cost per model

```sql
SELECT date_trunc('day', created_at) AS day,
       model,
       SUM(estimated_cost_usd) AS usd,
       COUNT(*) AS runs,
       SUM(input_tokens) AS input,
       SUM(cache_read_tokens) AS cache_read,
       SUM(output_tokens) AS output
  FROM pipeline_runs
 WHERE status = 'ok'
   AND created_at > now() - interval '30 days'
 GROUP BY 1, 2
 ORDER BY 1 DESC, 2 ASC
 LIMIT 30;
```

### Cache-hit ratio for the last hour

```sql
SELECT model,
       SUM(cache_read_tokens)::float / NULLIF(SUM(cache_read_tokens + input_tokens), 0) AS hit_ratio,
       SUM(input_tokens) AS input,
       SUM(cache_read_tokens) AS cache_read
  FROM pipeline_runs
 WHERE status = 'ok'
   AND task = 'enrich'
   AND created_at > now() - interval '1 hour'
 GROUP BY model;
```

### Most recent failures (what's pushing items to dead-letter)

```sql
SELECT created_at, task, model, status, error_class, error_message
  FROM pipeline_runs
 WHERE status != 'ok'
 ORDER BY created_at DESC
 LIMIT 20;
```

Cross-reference the returned `item_id` with `SELECT id, status, failure_reason FROM items WHERE id = ...` to see what ended up in the dead-letter queue.

## 6. See Also

- `docs/admin.md` — in-app admin ops + `/admin/costs` interpretation.
- `docs/health.md` — `/api/health` endpoint contract and per-service probe details.
- `docs/auth-providers.md` — Auth.js v5 env matrix (overlaps Sentry env in Vercel scoping).
- `.planning/phases/03-llm-pipeline-clustering/03-UAT.md` — the Phase 3 Langfuse UAT steps (still the canonical SC#5 checklist).
- `.planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md` — deferred live Sentry smoke-test.
- `.planning/phases/06-admin-operational-hardening/06-UAT.md` — the Phase 6 SC-by-SC UAT checklist.
