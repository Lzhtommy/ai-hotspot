# Phase 2: Ingestion Pipeline - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Hourly Trigger.dev v4 scheduled task enumerates active `sources`, fans out one child task per source, each of which fetches its RSS feed through the existing `fetchRSSHub()` wrapper, normalizes entry URLs into a SHA-256 `url_fingerprint`, writes net-new entries into `items` with `status='pending'`, and updates the source's health counters. All timestamps stored UTC (plus source-local string preserved separately). Per-source failures are isolated by structure — one source's timeout or parse error cannot block its siblings.

**In scope:** hourly scheduled task + per-source child task topology; RSS parser integration; URL normalization + fingerprint computation; dedup via existing `items.url_fingerprint` UNIQUE index; `body_raw` population from RSS entry HTML; source health accounting (`consecutive_empty_count`, `consecutive_error_count`, `last_fetched_at`); source-local timestamp column migration; canary source seed (3 sources) so the cron has real data on first run; end-to-end verification that two consecutive hourly runs produce zero duplicates.

**Out of scope (later phases):** LLM translation / summary / scoring / 推荐理由 / tags (all Phase 3 — LLM-01..LLM-13); full-text extraction / Readability fetch on the article URL (Phase 3 — LLM-02); embedding + clustering (Phase 3 — CLUST-*); feed UI (Phase 4); admin source CRUD UI (Phase 6 — ADMIN-02..06); admin source-health red indicator rendering (Phase 6 — ADMIN-06); Sentry/Langfuse error reporting beyond basic Trigger.dev run logs (Phase 6 — OPS-01, OPS-02).

</domain>

<decisions>
## Implementation Decisions

### Cron topology & source isolation (INGEST-01, INGEST-07)
- **D-01:** **Fan-out to per-source child tasks.** One Trigger.dev v4 scheduled task runs at the top of every hour (`0 * * * *`), queries `sources` where `is_active = true`, and fans out via Trigger.dev `batch.triggerAndWait` (or `batch.trigger` if wait-less is acceptable — planner picks based on current v4 API; see Research Flags) to a child task `fetch-source` with one run per source. Each source gets its own Trigger.dev run record, its own retry budget, its own timeout. INGEST-07 source isolation is achieved **structurally** — a failing child task is inherently isolated from sibling runs.
- **D-02:** Parent scheduler task name: `ingest-hourly` (or equivalent — planner's discretion). Child task name: `fetch-source`. Both live under `src/trigger/`. The parent must not do fetch work itself; its sole responsibility is enumerate + fan out + (optionally) aggregate run-level summary for logs.
- **D-03:** **Per-source child `maxDuration` is 90 seconds.** Budget: up to 60s for `fetchRSSHub()` cold-start (D-05 from Phase 1) + ~30s for parse, dedup, insert, source-row update. If a child exceeds 90s it is considered failed and its source increments `consecutive_error_count`.

### Dedup & URL normalization (INGEST-02, INGEST-03)
- **D-04:** **URL normalization rules (medium profile).** Before computing `url_fingerprint = SHA-256(normalized_url)`:
  1. Force scheme to `https` (from `http`).
  2. Lowercase the host.
  3. Strip known tracking query params: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`, `ref`, `source`, `spm`. Case-insensitive match on key. Preserve all other query params.
  4. Drop URL `#fragment`.
  5. Strip a trailing `/` on the path when path length > 1 (keep root `/`).
  6. No HTTP I/O — pure string transform. Do **not** resolve shortlinks (t.co, bit.ly) in Phase 2; shortlink collapse can happen later at cluster time if needed.
- **D-05:** **Fingerprint algorithm:** `url_fingerprint = hex(sha256(normalized_url))`. UTF-8 bytes. Stored as `TEXT` in the existing `items.url_fingerprint` UNIQUE column.
- **D-06:** **Dedup mechanism:** `INSERT INTO items ... ON CONFLICT (url_fingerprint) DO NOTHING`, then check `RETURNING id` (or rows-affected) to decide whether the item is truly new. This also handles the cross-source race in a single hourly fan-out: if two sources return the same article in the same run, the second insert gets `DO NOTHING` and is counted as "already seen," not a new item.
- **D-07:** **`content_hash`** (existing column) is set to `hex(sha256(normalized_url + '\n' + title))` in Phase 2 — used as a secondary dedup signal and as a cheap pre-LLM-processing identity check for Phase 3. Not involved in the UNIQUE constraint.

### Source health accounting (INGEST-06, INGEST-07, INGEST-08)
- **D-08:** **Strict semantics.** At the end of each child `fetch-source` run, the `sources` row is updated as follows:
  - On fetch/parse **exception** (any thrown error — network failure, non-2xx from RSSHub, malformed XML, timeout): `consecutive_error_count := consecutive_error_count + 1`. `consecutive_empty_count` is untouched. `last_fetched_at` is **not** updated.
  - On fetch **success with zero new items after dedup** (feed returned entries, but every one was already in DB, or feed returned zero entries): `consecutive_empty_count := consecutive_empty_count + 1`; `consecutive_error_count := 0` (success resets error counter); `last_fetched_at := now() UTC`.
  - On fetch **success with ≥ 1 new item**: both counters reset to `0`; `last_fetched_at := now() UTC`.
- **D-09:** This is the authoritative definition for ADMIN-06's red-health indicator (`consecutive_empty_count >= 3` OR `consecutive_error_count >= 3` → red). Phase 6 renders the UI; Phase 2 supplies the data.
- **D-10:** **Idempotency (INGEST-08):** the `url_fingerprint` UNIQUE index is the sole guarantee. Re-running the same hour's fetch produces zero new rows because every fingerprint already exists. The cron does **not** consult `last_fetched_at` to skip "recently polled" sources — every run polls every active source. Manual re-trigger of `ingest-hourly` from the Trigger.dev dashboard is therefore safe.

### Timestamp storage (INGEST-05)
- **D-11:** **Additive migration — new column `items.published_at_source_tz TEXT NULL`.** Stores the RFC3339 string from the RSS entry with its original offset (e.g., `"2026-04-20T09:00:00+08:00"` or `"2026-04-20T01:00:00Z"`). Nullable because some RSS entries have no pubDate or only a UTC timestamp with no offset info to preserve.
- **D-12:** `items.published_at` (existing TIMESTAMPTZ) continues to store the UTC instant. Parser converts source-local → UTC before insert. All DB reads and comparisons use `published_at`.
- **D-13:** If the RSS entry has no `pubDate` / `dc:date` at all, `published_at = ingested_at = now()` and `published_at_source_tz = NULL`. The item is still published into the pipeline.

### Fields persisted per item
- **D-14:** **Required fields written on insert:** `source_id`, `url` (normalized), `url_fingerprint`, `content_hash`, `title`, `published_at` (UTC), `published_at_source_tz` (nullable), `body_raw`, `status = 'pending'`, `retry_count = 0`, `ingested_at = now()`. Everything else (`title_zh`, `body_zh`, `summary_zh`, `recommendation`, `score`, `tags`, `embedding`, `cluster_id`, `is_cluster_primary`, `processed_at`, `failure_reason`) is untouched by Phase 2 — Phase 3 populates.
- **D-15:** **`body_raw` is stored as the raw HTML blob** from the RSS entry (prefer `content:encoded` over `description` when both present). No stripping, no sanitization. Length cap at **50,000 characters** (truncate if longer) to keep row sizes sane; truncation is recorded by appending a trailing sentinel `<!-- truncated -->`. Phase 3's LLM-02 full-text extraction step is responsible for cleaning/extracting.
- **D-16:** The `url` column stores the **normalized** URL (the same string that was hashed into `url_fingerprint`). The original pre-normalization URL is **not** preserved in Phase 2 — if needed later, the RSS feed still has it at source.

### LLM pipeline handoff (INGEST-04)
- **D-17:** **Status-only handoff.** Phase 2 writes `status = 'pending'` and stops. Phase 3 decides its own pickup mechanism (scheduled poller, fan-out on insert, batch-pull — Phase 3's design). Phase 2 does **not** call `batch.trigger` on a hypothetical Phase 3 task; the queue is the `items` table filtered on `status = 'pending'`. Matches INGEST-04's "enqueued for LLM processing" literally — `pending` is the queued state.

### Source seeding (canary)
- **D-18:** **Seed 3 canary sources** via a Drizzle seed script (`drizzle/seed-sources.ts` or equivalent), runnable via `pnpm db:seed`. Populates on a clean dev/preview Neon branch. The three seed sources:
  1. **Anthropic Blog** — a stable English AI lab source (likely RSSHub route `/anthropic` or the lab's native RSS if it exists; planner confirms at research time).
  2. **Hacker News AI front-page filter** — RSSHub route for HN with an AI-keyword filter (planner confirms exact route; `hackernews` with a filter param is a known RSSHub route).
  3. **buzzing.cc** — a known Chinese-language AI news aggregator accessible via RSSHub (planner confirms the route; `buzzing.cc` is referenced in PROJECT.md).
- **D-19:** The seed script is **idempotent** — uses `ON CONFLICT (rss_url) DO NOTHING` so re-running it on a branch with existing seeds is a no-op. Script does **not** run automatically in CI or on `main`; it is a developer tool. Admin UI for full source CRUD is Phase 6 (ADMIN-02..06).
- **D-20:** The canary list is intentionally small. Adding more sources is trivial (INSERT rows) but would slow Phase 2's verification runs. The admin workflow for "real" source management belongs to Phase 6.

### Parser library
- **D-21:** **Claude's Discretion** — planner picks the RSS parser (`rss-parser`, `fast-xml-parser` + manual shaping, or `feedparser-node`). Constraints: must handle RSS 2.0 + Atom, must expose `content:encoded`, must run in the Trigger.dev v4 Node runtime (no Edge restriction since Trigger.dev is Node-only). Planner documents the choice in the plan's `<research_findings>` block.

### Claude's Discretion (explicit)
- Exact file/folder layout under `src/trigger/` and `src/lib/ingest/` (normalizer, parser, dedup helpers).
- RSS parser library (per D-21).
- Exact Trigger.dev v4 batch-trigger API call shape (`batch.trigger` vs `batch.triggerAndWait`) — planner resolves at research time against live Trigger.dev v4 docs (Research Flag 1 in STATE.md).
- Whether to write one `pipeline_runs` row per ingest run for observability, or to leave `pipeline_runs` as an LLM-only audit log (its docstring says "LLM token usage audit trail per item per run" — leaning toward NOT writing ingest rows unless planner finds a compelling reason). Default: do not write `pipeline_runs` from Phase 2.
- Error log format (structured JSON vs plain text) in Trigger.dev task logs — just ensure the RSSHub access key is scrubbed (reuse `fetchRSSHub`'s existing scrubbing).
- Drizzle migration numbering (follows Phase 1's `0000_*`, `0001_*` pattern → Phase 2 adds `0002_add_published_at_source_tz.sql` or similar).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project truth
- `.planning/REQUIREMENTS.md` §Ingestion — INGEST-01..INGEST-08 are the Phase 2 acceptance bar
- `.planning/ROADMAP.md` §"Phase 2: Ingestion Pipeline" — Goal + 4 Success Criteria
- `.planning/PROJECT.md` — Constraints, Key Decisions table (RSSHub, hourly cadence)
- `.planning/STATE.md` §Decisions + §Blockers/Concerns — Trigger.dev v4 locked (Inngest overridden); Phase 2 research flags (batch.triggerByTaskAndWait API; full-text extraction library is a Phase 3 concern)
- `CLAUDE.md` — project conventions. **Caveat:** the Tech Stack section still mentions Inngest as the cron/queue. REQUIREMENTS.md + STATE.md override it with Trigger.dev v4. Planner must not regress.

### Prior phase artifacts (Phase 1 — locked decisions that Phase 2 depends on)
- `.planning/phases/01-infrastructure-foundation/01-CONTEXT.md` §RSSHub hosting (D-01..D-05) — HF Space URL, ACCESS_KEY in env only, cold-start is tolerated (60s)
- `.planning/phases/01-infrastructure-foundation/01-CONTEXT.md` §Schema bootstrap scope (D-09, D-10) — 11-table schema already live; pgvector enabled
- `.planning/phases/01-infrastructure-foundation/01-RESEARCH.md` — Trigger.dev v4 SDK import path `@trigger.dev/sdk` root; `trigger.config.ts` must include `maxDuration`
- `.planning/phases/01-infrastructure-foundation/01-VERIFICATION.md` + `01-SUMMARY.md` — what Phase 1 actually shipped

### Phase 1 code (Phase 2 extends these — do not rewrite)
- `src/lib/rsshub.ts` — `fetchRSSHub(path, opts)` wrapper with warmup + 60s timeout + key-scrubbed errors. Phase 2 calls this; it does not call `fetch` directly against RSSHub.
- `src/lib/db/schema.ts` — `sources`, `items` table definitions. Phase 2 adds `published_at_source_tz` via new migration; does not restructure existing columns.
- `src/lib/db/client.ts` — Drizzle+Neon HTTP client singleton. Phase 2 reuses it.
- `src/trigger/health-probe.ts` — reference for the Trigger.dev v4 task-definition shape (`task({ id, run })`). Phase 2 adds `ingest-hourly` (scheduled) and `fetch-source` (triggered) alongside, does not replace.
- `src/trigger/index.ts` — task registry barrel. Phase 2 adds new exports.
- `trigger.config.ts` — has `maxDuration = 3600s` at project level. Phase 2 sets per-task `maxDuration` (90s on `fetch-source`, parent task duration TBD by planner).
- `drizzle/0000_enable_pgvector.sql`, `drizzle/0001_initial_schema.sql` — migration precedent. Phase 2 adds `0002_*`.

### External docs (researcher/planner should fetch)
- Trigger.dev v4 scheduled tasks — https://trigger.dev/docs/v4/scheduled-tasks (confirm URL at research time)
- Trigger.dev v4 batch trigger — https://trigger.dev/docs/v4/triggering (batch.trigger / batch.triggerAndWait semantics and v4 API surface)
- Trigger.dev v4 retries — https://trigger.dev/docs/v4/errors-retrying
- RSSHub route docs — https://docs.rsshub.app/routes/new-media (and /programming) for confirming Anthropic / HN / buzzing.cc routes
- Drizzle ORM migrations — https://orm.drizzle.team/docs/kit-overview
- Drizzle `onConflictDoNothing` — https://orm.drizzle.team/docs/insert#on-conflict-do-nothing
- Node crypto for SHA-256 — https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options
- RFC 3986 §6 (URL normalization) — https://www.rfc-editor.org/rfc/rfc3986#section-6

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`fetchRSSHub(path, opts)`** at `src/lib/rsshub.ts` — authenticated RSSHub fetch with warmup + 60s timeout + error scrubbing. Phase 2 calls this for every source's RSS URL; do not bypass it.
- **`db` (Drizzle+Neon HTTP client)** at `src/lib/db/client.ts` — module-scope singleton. Phase 2 reuses as-is for reads + writes.
- **`sources`, `items` table exports** from `src/lib/db/schema.ts` — Phase 2 imports these typed table objects; the schema already has every column Phase 2 needs except `items.published_at_source_tz`.
- **Trigger.dev v4 task shape** from `src/trigger/health-probe.ts` — `import { task } from '@trigger.dev/sdk'; export const foo = task({ id, run })`. Phase 2's two new tasks follow this shape; new task file lives under `src/trigger/` and is re-exported from `src/trigger/index.ts`.
- **`trigger.config.ts`** at repo root — Phase 2 may set per-task `maxDuration` on `fetch-source` (90s per D-03); leaves the project-level default of 3600s untouched for the parent scheduler run.

### Established Patterns
- **Drizzle migration naming:** `drizzle/0000_enable_pgvector.sql`, `drizzle/0001_initial_schema.sql`. Phase 2 adds `drizzle/0002_add_published_at_source_tz.sql` (or the Drizzle-Kit-generated equivalent).
- **Env var naming:** `SCREAMING_SNAKE_CASE`, documented once in `.env.example` (Phase 1 D-06..D-08). Phase 2 does not need new env vars — the hourly cron runs inside Trigger.dev Cloud which already has `RSSHUB_BASE_URL`, `RSSHUB_ACCESS_KEY`, `DATABASE_URL`.
- **Error/secret scrubbing:** The pre-commit UUID-pattern hook (Phase 1 D-08) + `RSSHubError` message scrubbing (`src/lib/rsshub.ts:70`). Phase 2 must not log the access key or full authenticated URL; rely on `fetchRSSHub` already doing this.
- **UTC timestamps:** all existing `timestamp` columns are `withTimezone: true` and default to `now()` in UTC semantics. New `published_at_source_tz TEXT` column is the deliberate exception per D-11.

### Integration Points
- **Hugging Face RSSHub Space** — `https://lurnings-rsshub.hf.space/`. Phase 2 hits this through `fetchRSSHub()`. Cold-start (30–60s) is absorbed by `fetchRSSHub`'s 60s timeout + the 90s per-source child budget (D-03).
- **Neon production branch** — Phase 2's cron writes to the production branch. Preview branches (Phase 1 D-11) are used for CI + local dev; seed sources (D-18) run against the dev branch.
- **Trigger.dev Cloud project** — linked in Phase 1 D-13. Phase 2 adds two new tasks; they deploy via the Phase 1 CI job (`trigger.dev deploy`).

</code_context>

<specifics>
## Specific Ideas

- RSSHub cold-start tolerance (Phase 1 D-05) is the reason the per-source child budget is 90s and not tighter (D-03). The design assumes at least one source per hour will hit a cold-start.
- X/Twitter RSSHub routes are noted in STATE.md as "highest-volatility" in v1 — treat as best-effort. If an X route errors out, `consecutive_error_count` tracks it; admin decides (Phase 6) whether to deactivate the source.
- The seed script (D-18) is the only way the verification plan can actually run a hot-path end-to-end test in dev — without it, the cron has zero sources and success-criterion #1 (two consecutive runs, zero dupes) can't be observed.

</specifics>

<deferred>
## Deferred Ideas

- **Shortlink resolution (t.co, bit.ly → canonical URL)** — rejected for Phase 2 normalization (D-04). Can be revisited at cluster time (Phase 3) if Twitter-sourced items create cross-source clustering misses.
- **Per-ingest-run row in `pipeline_runs`** — default is NOT to write them from Phase 2. Can be added later if token-cost dashboards (Phase 6 — ADMIN-09, OPS-02) need ingestion-side latency/error data.
- **"Skip recently polled" optimization** — using `last_fetched_at` to skip sources polled in the last 55 minutes. Rejected because INGEST-08 idempotency is already guaranteed by `url_fingerprint` UNIQUE; skip logic adds complexity without benefit at hourly cadence.
- **Dead-source auto-deactivation** — auto-flip `is_active = false` when `consecutive_error_count >= N`. Belongs to Phase 6 admin operations; Phase 2 just records the counts.
- **`body_text` (HTML-stripped) alongside `body_raw`** — deferred. Phase 3's full-text extraction (LLM-02) derives the text it needs from `body_raw` + original URL.
- **Multi-poll-per-hour burst handling** — out of scope for v1's hourly cadence; would require a more sophisticated queue / deduplication-of-polls layer.
- **Keep-alive ping for HF Space** — still deferred (Phase 1 decision); revisit only if cold-starts degrade the hourly poll success rate.

</deferred>

---

*Phase: 02-ingestion-pipeline*
*Context gathered: 2026-04-20*
