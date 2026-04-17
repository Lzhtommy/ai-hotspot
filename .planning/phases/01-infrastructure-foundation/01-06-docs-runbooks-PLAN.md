---
phase: 01-infrastructure-foundation
plan: 06
type: execute
wave: 3
depends_on: ["01-01", "01-02", "01-03", "01-04", "01-05"]
files_modified:
  - README.md
  - docs/rsshub.md
  - docs/health.md
  - docs/ci.md
  - docs/vercel.md
  - docs/database.md
autonomous: true
requirements: [INFRA-06, INFRA-07, INFRA-08]
tags: [docs, runbooks, onboarding]
user_setup: []

must_haves:
  truths:
    - "A new contributor can set up the project locally using only README.md and reach `pnpm dev` + green /api/health"
    - "docs/rsshub.md captures the HF Space URL, required env vars, and the key-rotation runbook (D-02)"
    - "docs/health.md documents the /api/health contract (shape, status codes, each service check)"
    - "docs/ci.md documents the required GitHub secrets + variables + branch protection recommendations"
    - "docs/vercel.md lists all runtime env vars per environment (Preview, Production) and project-settings expectations"
    - "docs/database.md explains the migration workflow: push (dev) vs generate + migrate (CI)"
  artifacts:
    - path: "README.md"
      provides: "Project overview + getting-started + directory tour"
      contains: "pnpm install"
    - path: "docs/rsshub.md"
      provides: "HF Space pointer + env vars + key-rotation runbook (D-01, D-02, D-04)"
      contains: "lurnings-rsshub.hf.space"
    - path: "docs/health.md"
      provides: "/api/health contract documentation"
      contains: "services"
    - path: "docs/ci.md"
      provides: "CI pipeline runbook (secrets, variables, failure playbook)"
      contains: "NEON_API_KEY"
    - path: "docs/vercel.md"
      provides: "Vercel env var + project settings runbook"
      contains: "TRIGGER_SECRET_KEY"
    - path: "docs/database.md"
      provides: "Migration workflow runbook"
      contains: "drizzle-kit migrate"
  key_links:
    - from: "README.md"
      to: "docs/*.md"
      via: "Linked from README 'Further reading' section"
      pattern: "docs/"
---

<objective>
Land all project documentation and operational runbooks so Phases 2-6 (and any new contributor) have written references for every infrastructure surface Phase 1 stood up. Every file is a standalone, self-contained reference — no undocumented tribal knowledge survives this phase.

Purpose: INFRA-06 / INFRA-07 / INFRA-08 all require human-facing documentation of the infra they describe. Per CONTEXT.md D-13, RSSHub's "deployment pointer" lives in `docs/rsshub.md`. Per D-02, the key-rotation runbook must be committed.
Output: Six documentation files forming the project's permanent operational knowledge base.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-infrastructure-foundation/01-CONTEXT.md
@.planning/phases/01-infrastructure-foundation/01-RESEARCH.md
@.planning/phases/01-infrastructure-foundation/01-01-SUMMARY.md
@.planning/phases/01-infrastructure-foundation/01-02-SUMMARY.md
@.planning/phases/01-infrastructure-foundation/01-03-SUMMARY.md
@.planning/phases/01-infrastructure-foundation/01-04-SUMMARY.md
@.planning/phases/01-infrastructure-foundation/01-05-SUMMARY.md
@.env.example
@CLAUDE.md

<interfaces>
<!-- All referenced env var names, file paths, and commands must match exactly what Plans 01-05 produced. -->
<!-- The plan writer should cross-check against .env.example (truth source for env var names) and package.json (truth source for scripts). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write README.md + docs/rsshub.md + docs/health.md</name>
  <read_first>
    - .env.example (canonical env var names — MUST match exactly)
    - package.json (scripts must match: dev, build, typecheck, lint, db:generate, db:migrate, db:push, db:check, trigger:dev, trigger:deploy)
    - .planning/phases/01-infrastructure-foundation/01-CONTEXT.md (D-01 HF Space, D-02 key rotation, D-04 hardened defaults, D-13 docs pointer)
    - .planning/phases/01-infrastructure-foundation/01-04-SUMMARY.md (actual /api/health observed shape from local smoke)
    - src/app/api/health/route.ts (the real shape of the response — document what exists, not what was planned)
  </read_first>
  <files>README.md, docs/rsshub.md, docs/health.md</files>
  <action>

    **File 1 — `README.md`** (overwrite the scaffold-generated one with this content):
    ```markdown
    # AI Hotspot

    A public-facing Chinese-language AI news aggregator. Pulls from official lab blogs, social, forums, and Chinese sources via a self-hosted RSSHub; Claude (Anthropic) scores and summarizes; items are clustered by semantic similarity (Voyage AI embeddings + pgvector); surfaced as a timeline-style feed.

    **Core value:** A single Chinese-language timeline where AI practitioners never miss a significant AI event, because the system hears it from every source, clusters duplicates, and ranks by LLM-judged importance — not chronology.

    ## Tech Stack

    - Next.js 15 App Router (TypeScript, pnpm)
    - Neon Postgres + pgvector (via Drizzle ORM, `@neondatabase/serverless`)
    - Trigger.dev v4 (hourly ingestion + LLM pipeline workers)
    - Upstash Redis (HTTP — feed cache + rate limiting)
    - RSSHub (self-hosted on Hugging Face Space — see `docs/rsshub.md`)
    - Anthropic Claude Haiku 4.5 (summarization, scoring, tagging, 推荐理由)
    - Voyage AI `voyage-3.5` (1024-dim embeddings for clustering)

    ## Local Development

    ### Prerequisites
    - Node.js 20.9 or newer (use `nvm use` — respects `.nvmrc`)
    - pnpm 9+ (`npm i -g pnpm`)
    - A Neon project (free tier is fine) — see `docs/database.md`
    - An Upstash Redis database — see `docs/vercel.md`
    - A Trigger.dev Cloud project — see `docs/ci.md`

    ### Setup
    ```bash
    nvm use                                 # picks up .nvmrc → Node 20
    pnpm install
    cp .env.example .env.local              # then fill in values — see docs/vercel.md for sources
    pnpm db:migrate                         # applies pgvector + schema to your Neon dev branch
    pnpm dev
    ```
    Then open http://localhost:3000/api/health — should return `{ ok: true, services: { neon: "ok", redis: "ok", rsshub: "ok", trigger: "ok" } }`.

    ### Useful scripts
    | Command | Purpose |
    |---------|---------|
    | `pnpm dev` | Start Next.js dev server |
    | `pnpm build` | Production build |
    | `pnpm typecheck` | `tsc --noEmit` |
    | `pnpm lint` | ESLint |
    | `pnpm format` | Prettier write |
    | `pnpm db:generate` | Generate SQL migration from schema diff |
    | `pnpm db:migrate` | Apply migrations to `DATABASE_URL` (dev-branch or CI-branch) |
    | `pnpm db:push` | Apply schema directly without SQL files (dev-only) |
    | `pnpm db:check` | Verify schema.ts matches generated SQL |
    | `pnpm trigger:dev` | Run local Trigger.dev worker tunnel |
    | `pnpm trigger:deploy` | Deploy tasks to Trigger.dev Cloud |

    ## Project Layout
    ```
    src/
      app/                 # Next.js App Router pages + API routes
        api/health/        # Phase 1 acceptance gate
      lib/
        db/                # Drizzle client + schema (all 11 tables)
        redis/             # Upstash client
        rsshub.ts          # RSSHub fetch wrapper
      trigger/             # Trigger.dev tasks
    drizzle/               # Migration SQL (generated + 0000 pgvector manual)
    docs/                  # Runbooks — rsshub, health, ci, vercel, database
    .planning/             # GSD planning artifacts (phase docs)
    ```

    ## Further Reading
    - `docs/rsshub.md` — RSSHub HF Space pointer + key rotation runbook
    - `docs/health.md` — `/api/health` contract
    - `docs/database.md` — Drizzle + Neon + pgvector migration workflow
    - `docs/ci.md` — GitHub Actions + secrets
    - `docs/vercel.md` — Vercel env vars + project settings

    ## License
    TBD.
    ```

    **File 2 — `docs/rsshub.md`** (D-01, D-02, D-04 runbook):
    ```markdown
    # RSSHub (Hugging Face Space)

    RSSHub is deployed externally on a Hugging Face Space. This project does NOT host RSSHub; it reads from the Space via HTTPS.

    **Space URL:** `https://lurnings-rsshub.hf.space`

    ## Environment Variables

    | Variable | Where it's set | Purpose |
    |----------|----------------|---------|
    | `RSSHUB_BASE_URL` | Vercel (Preview+Production), Trigger.dev Cloud, `.env.local` | Base URL of the Space |
    | `RSSHUB_ACCESS_KEY` | Vercel (Preview+Production), Trigger.dev Cloud, `.env.local`, **HF Space secrets (as ACCESS_KEY)** | Auth query parameter on every RSSHub request |

    All three vaults must hold the **same** value for `RSSHUB_ACCESS_KEY`. Variable name `RSSHUB_ACCESS_KEY` in vaults; inside the HF Space UI it's named `ACCESS_KEY`.

    ## Hardened Defaults (D-04)

    The HF Space must have these env vars set:
    ```
    ALLOW_USER_HOTLINK=false
    DISALLOW_ROBOT=true
    REQUEST_RETRY=2
    CACHE_EXPIRE=900
    CACHE_CONTENT_EXPIRE=3600
    ACCESS_KEY=<secret>
    ```

    RSSHub uses its in-process memory cache (no Redis backing). Cache is ephemeral across Space restarts — acceptable for hourly polling.

    ## Key Rotation Runbook (D-02)

    Prior ACCESS_KEY values have been exposed in planning chat transcripts. Rotate every time any of:
    - A secret appeared in `.planning/`, chat transcripts, or git history
    - A contributor leaves the project
    - The value appears in an error log

    **Steps:**
    1. Generate a new UUID v4: `uuidgen` (or `python -c "import uuid; print(uuid.uuid4())"`).
    2. HF Space → Settings → Variables and secrets → `ACCESS_KEY` → set new value → Save → Restart the Space.
    3. Vercel Dashboard → Project → Settings → Environment Variables → update `RSSHUB_ACCESS_KEY` for Production AND Preview → Save.
    4. Trigger.dev Cloud → Project → Environment Variables → update `RSSHUB_ACCESS_KEY` for dev AND prod → Save.
    5. `.env.local` on every developer laptop: update manually.
    6. Verify: `curl https://<vercel-url>/api/health` should return 200 with `rsshub: "ok"`. If 503 with rsshub error, a vault update was missed.

    ## Cold-Start Behavior (D-05)

    HF Spaces sleep after ~48h of inactivity. First request takes 30-60s. The `/api/health` route and `src/lib/rsshub.ts` wrapper issue a fire-and-forget warmup before the measured call, with a 60s timeout budget.

    If cold-starts become operationally disruptive in Phase 2+, consider adding a 10-minute keep-alive cron (deferred item in CONTEXT.md).

    ## Operational Limits

    - **No redeploy from this repo** — the HF Space is deployed separately; this repo only reads from it.
    - **Do NOT commit the ACCESS_KEY anywhere.** Pre-commit hook (`.husky/pre-commit`) blocks UUID-shaped tokens. If a commit is blocked, the key is staged — remove it.
    - **If the Space disappears** (account deletion, quota), provision Railway or Hetzner per the deferred option in CONTEXT.md.
    ```

    **File 3 — `docs/health.md`** (/api/health contract):
    ```markdown
    # /api/health

    Aggregates four parallel reachability checks into a single HTTP response. This is the Phase 1 acceptance gate — Plan 05 CI curls this endpoint post-deploy to confirm the pipeline is wired.

    ## Request
    `GET /api/health` — no parameters, no auth (Phase 1). Auth gate added in Phase 5.

    ## Response

    **200 OK — all services reachable:**
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

    **503 Service Unavailable — at least one service failed:**
    ```json
    {
      "ok": false,
      "services": {
        "neon": "ok",
        "redis": { "error": "Error: Connection timeout" },
        "rsshub": "ok",
        "trigger": "ok"
      }
    }
    ```

    ## Service Checks

    | Service | Check | Timeout | Notes |
    |---------|-------|---------|-------|
    | `neon` | `SELECT 1` + `SELECT extname FROM pg_extension WHERE extname = 'vector'` | ~3s implicit | Confirms Postgres AND pgvector extension |
    | `redis` | `redis.ping()` (Upstash) | ~3s implicit | Expects `PONG` response |
    | `rsshub` | `GET /?key=<ACCESS_KEY>` against HF Space | 60s | Preceded by fire-and-forget warmup for cold-start |
    | `trigger` | `GET https://api.trigger.dev/api/v1/whoami` with `Authorization: Bearer TRIGGER_SECRET_KEY` | 10s | Fallback to `tr_*` prefix format check if whoami endpoint is unreachable (see [RESEARCH.md A1]) |

    ## Runtime

    Route runs in Node.js runtime (`export const runtime = 'nodejs'`). Edge runtime cannot use the Neon HTTP driver.

    ## Error Sanitization

    Error messages are sanitized via `sanitize()` in `src/app/api/health/route.ts`:
    - `Error.name + ": " + Error.message`, with `postgres://...` URLs scrubbed to `[redacted-db-url]`
    - Never logs the access key, DB URL, or auth token
    - Never leaks a raw stack trace to the client

    ## Operational Playbook

    | Service reports | Most likely cause | Fix |
    |-----------------|-------------------|-----|
    | `neon: { error: ... }` | `DATABASE_URL` wrong or Neon branch paused | Verify env var; wake branch in Neon console |
    | `neon: { error: "pgvector extension not installed" }` | 0000 migration skipped | Run `pnpm db:migrate` |
    | `redis: { error: ... }` | Upstash DB deleted or REST_URL/REST_TOKEN wrong | Verify env vars; check Upstash console |
    | `rsshub: { error: ... }` | HF Space sleeping (wait 60s) or ACCESS_KEY rotated without updating vault | Retry; or follow `docs/rsshub.md` rotation runbook |
    | `trigger: { error: ... }` | `TRIGGER_SECRET_KEY` wrong or the whoami endpoint changed | Verify key starts with `tr_dev_`/`tr_prod_`; manual dashboard trigger still proves Phase 1 Success Criterion #3 |

    ## Phase Evolution

    - **Phase 1:** public, no auth — acceptance test
    - **Phase 5:** gated behind admin role (per RESEARCH.md §Security Domain V4)
    - **Phase 6:** alerts on 503 via Sentry integration
    ```

    Run `pnpm format` and `pnpm lint` to confirm the markdown + no code changed unexpectedly.
  </action>
  <verify>
    <automated>test -f README.md && test -f docs/rsshub.md && test -f docs/health.md && grep -q "pnpm install" README.md && grep -q "docs/rsshub.md" README.md && grep -q "lurnings-rsshub.hf.space" docs/rsshub.md && grep -q "ALLOW_USER_HOTLINK=false" docs/rsshub.md && grep -q "ACCESS_KEY" docs/rsshub.md && grep -q "/api/health" docs/health.md && grep -q "services" docs/health.md && grep -q "runtime = 'nodejs'" docs/health.md</automated>
  </verify>
  <done>
    - `README.md` contains getting-started, layout tour, script table, further-reading links
    - `docs/rsshub.md` contains HF Space URL, all env vars, hardened defaults, key-rotation runbook
    - `docs/health.md` documents request/response shape, all four service checks with timeouts, sanitization rules, playbook
    - All three files pass Prettier (no unformatted markdown)
  </done>
</task>

<task type="auto">
  <name>Task 2: Write docs/ci.md + docs/vercel.md + docs/database.md</name>
  <read_first>
    - .github/workflows/ci.yml (the real job names, step names, and secret references)
    - .github/workflows/cleanup-neon-branch.yml
    - vercel.json
    - drizzle.config.ts + drizzle/0000_enable_pgvector.sql + drizzle/0001_initial_schema.sql
    - .planning/phases/01-infrastructure-foundation/01-05-SUMMARY.md (actual CI run URL + any deltas)
  </read_first>
  <files>docs/ci.md, docs/vercel.md, docs/database.md</files>
  <action>

    **File 1 — `docs/ci.md`** (GitHub Actions + secrets):
    ```markdown
    # CI / CD

    Two GitHub Actions workflows govern builds and migrations.

    ## Workflows

    ### `.github/workflows/ci.yml`
    Runs on every pull request (open, synchronize, reopen) and every push to `main`.

    | Step | PR | main | Purpose |
    |------|----|----|---------|
    | install | ✓ | ✓ | `pnpm install --frozen-lockfile` |
    | typecheck | ✓ | ✓ | `pnpm typecheck` |
    | lint | ✓ | ✓ | `pnpm lint` |
    | build | ✓ | ✓ | `pnpm build` |
    | db:check | ✓ | ✓ | `drizzle-kit check` — fails on schema drift |
    | create Neon branch | ✓ | — | `neondatabase/create-branch-action@v6` → `pr-<N>` |
    | db:migrate (PR branch) | ✓ | — | `pnpm db:migrate` against `steps.neon-branch.outputs.db_url` |
    | db:migrate (main branch) | — | ✓ | `pnpm db:migrate` against `secrets.DATABASE_URL_MAIN` |
    | trigger:deploy (prod) | — | ✓ | Separate `trigger-deploy` job on main only |

    ### `.github/workflows/cleanup-neon-branch.yml`
    Runs on PR close — deletes the per-PR Neon branch via `neondatabase/delete-branch-action@v3`.

    ## Required Repository Secrets

    | Name | Purpose | Source |
    |------|---------|--------|
    | `NEON_API_KEY` | Create/delete branches via Neon API | Neon Console → Account → API keys |
    | `DATABASE_URL_MAIN` | Connection string to the Neon `main` branch for on-merge migrations | Neon Console → Project → Connection Details (main branch pooled URL) |
    | `TRIGGER_ACCESS_TOKEN` | Deploy Trigger.dev tasks to prod env | Trigger.dev Dashboard → Profile → Personal Access Tokens |

    **NOT required as Actions secrets** (these live only in Vercel + Trigger.dev Cloud + HF Space):
    - `TRIGGER_SECRET_KEY` (runtime only)
    - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (runtime)
    - `RSSHUB_ACCESS_KEY` (runtime)
    - `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` (runtime)

    ## Required Repository Variables (not secrets)

    | Name | Purpose | Source |
    |------|---------|--------|
    | `NEON_PROJECT_ID` | Identifier of the Neon project | Neon Console → Project Settings → General |
    | `NEON_DB_USERNAME` (optional) | DB user to impersonate in per-PR branches | Defaults to `neondb_owner` |

    ## Branch Protection Recommendations (Phase 6 — not Phase 1)

    - Require `ci` check to pass before merge
    - Require 1 approval on PRs from external contributors
    - Disallow force-push to `main`
    - Require branches up-to-date with `main` before merge

    Phase 1 is greenfield and a single developer — branch protection is optional. Enable at milestone gates.

    ## Failure Playbook

    | Failure | Diagnosis | Fix |
    |---------|-----------|-----|
    | `ERR_PNPM_FROZEN_LOCKFILE_VIOLATION` | `pnpm-lock.yaml` not committed or out of sync | Run `pnpm install` locally and commit lockfile |
    | Neon branch create fails with 401 | `NEON_API_KEY` missing / wrong | Re-add in repo Secrets |
    | `type "vector" does not exist` during migrate | 0000 extension migration skipped or reordered | Confirm `drizzle/0000_enable_pgvector.sql` is committed and `_journal.json` lists it before 0001 |
    | `drizzle-kit check` fails with drift | schema.ts changed without regenerating SQL | Run `pnpm db:generate` locally, commit new migration |
    | `trigger:deploy` 401 | `TRIGGER_ACCESS_TOKEN` wrong | Rotate + re-add in repo Secrets |

    ## Why GitHub Actions, Not Vercel Neon Integration

    Vercel's Neon integration triggers branch creation as part of Vercel's own preview build — which can race with the preview booting against an unmigrated schema. GitHub Actions gives explicit ordering (per D-18): Actions creates the branch AND finishes migrations, THEN Vercel preview boots against a migrated schema. Actions and Vercel run in parallel but by the time Vercel's `/api/health` is curlable, Actions has typically completed migrations.
    ```

    **File 2 — `docs/vercel.md`** (env var runbook):
    ```markdown
    # Vercel Deployment

    Next.js deploys are triggered by the Vercel GitHub App, independent of GitHub Actions. Preview on every PR; production on every merge to `main`.

    ## Project Settings

    | Setting | Value |
    |---------|-------|
    | Framework Preset | Next.js |
    | Root Directory | `./` (repo root) |
    | Build Command | `pnpm build` (from `vercel.json`) |
    | Install Command | `pnpm install --frozen-lockfile` (from `vercel.json`) |
    | Output Directory | `.next` (auto) |
    | Node.js Version | 20 (inherits from `.nvmrc`) |

    ## Runtime Environment Variables

    All must be set in BOTH Preview and Production environments unless noted. Values differ per environment (dev API keys vs prod API keys).

    | Variable | Preview | Production | Source |
    |----------|---------|------------|--------|
    | `DATABASE_URL` | Neon `dev` branch pooled URL (or leave empty to inherit CI-injected per-PR URL) | Neon `main` branch pooled URL | Neon Console → branch → Connection Details |
    | `UPSTASH_REDIS_REST_URL` | Same as dev | Production Upstash DB URL | Upstash Console → Redis DB → REST API |
    | `UPSTASH_REDIS_REST_TOKEN` | Same as dev | Production Upstash token | Upstash Console |
    | `TRIGGER_SECRET_KEY` | `tr_dev_...` | `tr_prod_...` | Trigger.dev Dashboard → Project → API Keys |
    | `TRIGGER_PROJECT_REF` | `proj_XXXXXX` | same | Trigger.dev Dashboard → Project Settings |
    | `RSSHUB_BASE_URL` | `https://lurnings-rsshub.hf.space` | same | D-01 |
    | `RSSHUB_ACCESS_KEY` | same as HF Space | same | HF Space → Variables and secrets → ACCESS_KEY (D-02 rotated) |
    | `ANTHROPIC_API_KEY` | Placeholder OK in Phase 1 | same | Anthropic Console |
    | `VOYAGE_API_KEY` | Placeholder OK in Phase 1 | same | Voyage AI Console |
    | `AUTH_SECRET` | Phase 5 | Phase 5 | `openssl rand -base64 32` |
    | `AUTH_URL` | Vercel Preview URL (set in Phase 5) | `https://ai-hotspot.vercel.app` or custom domain | Phase 5 |

    **Never prefix any of these with `NEXT_PUBLIC_`** — they are all server-only secrets.

    ## GitHub App Link

    Install via https://vercel.com/new → Import Git Repository. The app posts a comment on every PR with the preview URL.

    ## Phase 1 Acceptance

    Merge → Production deploys → curl `https://<your-domain>/api/health` must return 200 with all four services "ok".
    ```

    **File 3 — `docs/database.md`** (migration workflow):
    ```markdown
    # Database

    Neon Postgres with pgvector extension, schema defined in Drizzle, migrated via `drizzle-kit`.

    ## Schema

    Eleven tables, all defined in `src/lib/db/schema.ts`:
    - `sources` — RSSHub routes / raw RSS feeds
    - `items` — ingested RSS entries (with `embedding vector(1024)`)
    - `clusters` — event groupings (with `centroid vector(1024)`)
    - `item_clusters` — join table
    - `tags`, `item_tags` — tagging normalization
    - `users` — accounts (Auth.js adapter compatible)
    - `favorites`, `votes` — user-item interactions
    - `settings` — admin-tunable config (seed: `cluster_threshold=0.82`)
    - `pipeline_runs` — LLM token/cost audit trail per item per run

    ## Migrations

    Two files, ordered lexicographically:
    - `drizzle/0000_enable_pgvector.sql` — hand-authored: `CREATE EXTENSION IF NOT EXISTS vector;`
    - `drizzle/0001_initial_schema.sql` — generated from `schema.ts` via `drizzle-kit generate`

    ## Workflows

    ### Local development (your Neon dev branch or local Postgres)
    ```bash
    # Option A: push (fast, skips SQL files)
    pnpm db:push

    # Option B: generate + migrate (matches CI flow)
    pnpm db:generate         # produces a new numbered SQL file if schema.ts changed
    pnpm db:migrate          # applies pending migrations
    ```
    Never run `db:push` in CI — no audit trail.

    ### CI (per-PR Neon branch)
    `.github/workflows/ci.yml`:
    1. `neondatabase/create-branch-action@v6` → new branch `pr-<N>`
    2. `pnpm db:migrate` with `DATABASE_URL=${{ steps.neon-branch.outputs.db_url }}`

    Migration failure blocks PR merge.

    ### Production (on merge to main)
    Same `pnpm db:migrate` — uses `secrets.DATABASE_URL_MAIN`.

    ## Adding a Migration

    1. Edit `src/lib/db/schema.ts`
    2. `pnpm db:generate` — produces `drizzle/000N_<name>.sql`
    3. Inspect the SQL for correctness (pgvector columns, FK cascades, etc.)
    4. Commit both the schema change AND the SQL file
    5. `pnpm db:check` — must pass (no drift)
    6. CI applies it on PR, and production-migrates on merge

    ## pgvector Notes

    - Extension enabled in `0000_enable_pgvector.sql` (hand-authored) — must come before any schema referencing `vector()`
    - Column type: `vector('embedding', { dimensions: 1024 })` from `drizzle-orm/pg-core`
    - HNSW index on `items.embedding` is intentionally deferred to Phase 3 (D-10) — not needed until clustering ships

    ## Anti-Patterns

    - ❌ `drizzle-kit push` in CI (no audit trail)
    - ❌ Putting `CREATE EXTENSION` inside `drizzle-kit generate` output (it may reorder statements)
    - ❌ Editing generated SQL files by hand (re-run `db:generate` instead)
    - ❌ Using `sql.raw(userInput)` (SQL injection — always use tagged-template `sql\`SELECT ... ${param}\``)
    ```

    Run `pnpm format` to apply Prettier on all docs.
  </action>
  <verify>
    <automated>test -f docs/ci.md && test -f docs/vercel.md && test -f docs/database.md && grep -q "NEON_API_KEY" docs/ci.md && grep -q "neondatabase/create-branch-action" docs/ci.md && grep -q "DATABASE_URL_MAIN" docs/ci.md && grep -q "TRIGGER_SECRET_KEY" docs/vercel.md && grep -q "Framework Preset" docs/vercel.md && grep -q "drizzle-kit migrate" docs/database.md && grep -q "0000_enable_pgvector" docs/database.md && grep -q "vector(1024)" docs/database.md</automated>
  </verify>
  <done>
    - `docs/ci.md` documents both workflows with required secrets + variables + failure playbook
    - `docs/vercel.md` enumerates every runtime env var with source pointer + marks `NEXT_PUBLIC_` forbidden
    - `docs/database.md` covers schema overview + migration workflow + pgvector notes + anti-patterns
    - All three pass Prettier
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Docs → Repo → Public (if open source) | Docs are public; must not include any real secrets |
| Contributor reads docs → correctly configures local env | Docs are the authoritative onboarding path |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1-01 | Information Disclosure | Documentation accidentally commits a real secret | mitigate | No real values in any doc file; every example uses placeholder like `<secret>` or `tr_dev_...`; pre-commit UUID hook (Plan 01) grep blocks accidental paste |
| T-1-08 | Information Disclosure | docs/rsshub.md leaks internal topology to public repo | accept | Space URL is intentionally documented (low value target behind ACCESS_KEY); hardened defaults listed openly; rotation runbook makes leak recovery explicit |
</threat_model>

<verification>
```bash
pnpm format
pnpm lint
# Ensure no real-looking secret slipped in:
! grep -E "tr_(dev|prod)_[A-Za-z0-9]{20,}" docs/ README.md
! grep -E "postgres(ql)?://[^ ]*@[^ ]+\.neon\.tech" docs/ README.md
# Pre-commit hook should NOT block on these docs (only allow-listed files skip UUID check)
```
</verification>

<success_criteria>
- `README.md` is a complete getting-started reference; `pnpm install && pnpm db:migrate && pnpm dev` works from only reading it
- `docs/rsshub.md`, `docs/health.md`, `docs/ci.md`, `docs/vercel.md`, `docs/database.md` all exist, formatted, committed
- Every env var referenced in docs matches `.env.example` exactly
- No real secrets appear in any doc
- D-02 key-rotation runbook is committed and cross-referenced from README
</success_criteria>

<output>
After completion, create `.planning/phases/01-infrastructure-foundation/01-06-SUMMARY.md` listing all doc files, total word count, and confirming Prettier + no-secret-leak checks passed.
</output>
</content>
</invoke>