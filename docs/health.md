# /api/health

Aggregates three parallel reachability checks into a single HTTP response. This is the Phase 1 acceptance gate — Plan 05 CI curls this endpoint post-deploy to confirm the pipeline is wired.

## Request

`GET /api/health` — no parameters, no auth (Phase 1). Auth gate added in Phase 5.

## Response

**200 OK — all services reachable:**

```json
{
  "ok": true,
  "services": {
    "db": "ok",
    "rsshub": "ok",
    "trigger": "ok"
  }
}
```

**503 Service Unavailable — at least one service failed:**

```json
{
  "ok": false,
  "services": {
    "db": { "error": "Error: Connection timeout" },
    "rsshub": "ok",
    "trigger": "ok"
  }
}
```

## Service Checks

| Service   | Check                                                                                       | Timeout      | Notes                                                                                           |
| --------- | ------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `db`      | `SELECT 1` + `SELECT extname FROM pg_extension WHERE extname = 'vector'`                    | ~3s implicit | Confirms Supabase Postgres AND pgvector extension                                               |
| `rsshub`  | `GET /?key=<ACCESS_KEY>` against HF Space                                                   | 60s          | Preceded by fire-and-forget warmup for cold-start                                               |
| `trigger` | `GET https://api.trigger.dev/api/v1/whoami` with `Authorization: Bearer TRIGGER_SECRET_KEY` | 10s          | Fallback to `tr_*` prefix format check if whoami endpoint is unreachable (see [RESEARCH.md A1]) |

## Runtime

Route runs in Node.js runtime (`export const runtime = 'nodejs'`). Edge runtime cannot use the node-postgres TCP driver.

## Error Sanitization

Error messages are sanitized via `sanitize()` in `src/app/api/health/route.ts`:

- `Error.name + ": " + Error.message`, with `postgres://...` URLs scrubbed to `[redacted-db-url]`
- Never logs the access key, DB URL, or auth token
- Never leaks a raw stack trace to the client

## Operational Playbook

| Service reports                                     | Most likely cause                                                         | Fix                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `db: { error: ... }`                                | `DATABASE_URL` wrong or Supabase project paused                           | Verify env var; resume the project in the Supabase dashboard                                                    |
| `db: { error: "pgvector extension not installed" }` | 0000 migration skipped                                                    | Run `pnpm db:migrate`                                                                                           |
| `rsshub: { error: ... }`                            | HF Space sleeping (wait 60s) or ACCESS_KEY rotated without updating vault | Retry; or follow `docs/rsshub.md` rotation runbook                                                              |
| `trigger: { error: ... }`                           | `TRIGGER_SECRET_KEY` wrong or the whoami endpoint changed                 | Verify key starts with `tr_dev_`/`tr_prod_`; manual dashboard trigger still proves Phase 1 Success Criterion #3 |

## Phase Evolution

- **Phase 1:** public, no auth — acceptance test
- **Phase 5:** gated behind admin role (per RESEARCH.md §Security Domain V4)
- **Phase 6:** alerts on 503 via Sentry integration
