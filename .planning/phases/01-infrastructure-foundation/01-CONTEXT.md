# Phase 1: Infrastructure Foundation - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Provision every managed service and wire them together so a `git push` to `main` produces a Vercel deployment that typechecks, runs Drizzle migrations, and exposes a health endpoint proving Neon (+pgvector), Upstash Redis, Trigger.dev v4, RSSHub, and the Anthropic + Voyage API keys are all reachable from the application.

**In scope:** project scaffold, DB + extension + full schema migration, Redis client, Trigger.dev v4 project linkage, RSSHub reachability wiring (host already deployed), env var topology, CI typecheck + migrate on preview, `/api/health` smoke test.

**Out of scope (later phases):** actual ingestion logic (Phase 2), LLM pipeline (Phase 3), feed UI (Phase 4), Auth.js wiring beyond env placeholders (Phase 5), admin UI and Sentry/Langfuse instrumentation depth (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### RSSHub hosting
- **D-01:** RSSHub is **already deployed by the user on Hugging Face Spaces**. Base URL: `https://lurnings-rsshub.hf.space/`. Phase 1 does **not** provision RSSHub; it wires the existing Space into the app's env and health check.
- **D-02:** The RSSHub ACCESS_KEY lives **only** in env vars — `RSSHUB_ACCESS_KEY` in Vercel (all environments) and Trigger.dev Cloud. It must never be committed to the repo, logged, or written into docs. **Action for user:** rotate the current key (it was exposed in the discuss-phase chat transcript) and re-set the env var before Phase 1 completes.
- **D-03:** RSSHub uses its in-process **memory cache** (no Redis backing). Cache is ephemeral across Space restarts — acceptable for hourly polling.
- **D-04:** RSSHub runtime config follows **hardened defaults**: `ALLOW_USER_HOTLINK=false`, `DISALLOW_ROBOT=true`, `REQUEST_RETRY=2`, `CACHE_EXPIRE=900`, `CACHE_CONTENT_EXPIRE=3600`. Phase 1 planner verifies these are set on the existing Space (or opens a follow-up to set them) but does not redeploy the Space.
- **D-05:** HF Space cold-start is tolerated, not prevented. Ingestion (Phase 2) will rely on Trigger.dev's automatic per-step retry to absorb the first-call 30–60s warmup. Phase 1's `/api/health` performs a warmup `HEAD`/GET against the Space before asserting 200 OK, so intermittent cold-starts don't flap the health check.

### Env & secrets topology (Claude's discretion, locked)
- **D-06:** Single `.env.example` at repo root is the source of truth for variable names. Actual values live in three vaults:
  - **Vercel project env** — Next.js runtime secrets (DB URL, Redis URL, Anthropic, Voyage, Auth.js, RSSHub base URL + key, Trigger.dev public/secret keys).
  - **Trigger.dev Cloud env** — worker-side secrets (DB URL, Anthropic, Voyage, RSSHub base URL + key). Set via Trigger.dev dashboard or `npx trigger.dev@latest deploy` syncing.
  - **Hugging Face Space** — RSSHub-side secrets (ACCESS_KEY, DISALLOW_ROBOT, ALLOW_USER_HOTLINK).
- **D-07:** Env var names used across services are identical (e.g., `RSSHUB_ACCESS_KEY`, `ANTHROPIC_API_KEY`) so the `.env.example` documents them once. Values may differ per environment but names must not drift.
- **D-08:** No secret is ever written to `.planning/`, CLAUDE.md, or committed code. Sentinel check: a pre-commit hook greps for the UUID pattern of the HF ACCESS_KEY — if the key surfaces in staged content, the commit fails.

### Schema bootstrap scope (Claude's discretion, locked by REQUIREMENTS)
- **D-09:** INFRA-03 is explicit: **all 11 tables** (`sources, items, clusters, item_clusters, tags, item_tags, users, favorites, votes, settings, pipeline_runs`) are defined in a single Drizzle migration in Phase 1. Column-level detail for later-phase concerns (indexes on embedding, FK constraints, default rows in `settings`) is allowed to iterate per phase, but the tables themselves exist from day one.
- **D-10:** `pgvector` extension is enabled in the same migration (`CREATE EXTENSION IF NOT EXISTS vector;`). `items.embedding` column is `vector(1024)` to match Voyage AI voyage-3.5 output dimensionality. HNSW index creation may be deferred to Phase 3.

### Preview DB strategy (Claude's discretion, locked)
- **D-11:** **Neon branching per PR.** GitHub Actions (or Vercel's Neon integration) creates a Neon database branch for each preview deployment, runs `drizzle-kit migrate`, and the preview env points at that branch. Branch auto-deletes when the PR closes. Matches Neon's native feature; zero cost at free tier.
- **D-12:** `main` branch writes to the production Neon branch. Dev runs against either a long-lived `dev` Neon branch or local Postgres — planner picks one, both are acceptable.

### Repository layout (Claude's discretion, locked)
- **D-13:** **Single Next.js repo** (not a monorepo). Trigger.dev code lives under `./src/trigger/` in the same repo (Trigger.dev v4 supports this layout natively). RSSHub is external (HF Space) and has no source in this repo — only a documented deployment pointer in `/docs/rsshub.md` (or a brief README section) capturing the Space URL, env vars required, and the "rotate key" runbook note.
- **D-14:** Package manager: **pnpm**. Node: whatever version Next.js 15 + Trigger.dev v4 jointly require (planner pins via `.nvmrc` and `engines`).

### Health-check surface (Claude's discretion, locked)
- **D-15:** `/api/health` (Node runtime, not Edge — needs DB driver) performs four checks in parallel and returns JSON:
  1. **Neon** — `SELECT 1` via Drizzle; separately `SELECT extname FROM pg_extension WHERE extname='vector'` to confirm pgvector.
  2. **Upstash Redis** — `redis.ping()`.
  3. **RSSHub** — `GET {base}/?key={RSSHUB_ACCESS_KEY}` with a 60s timeout (cold-start budget); preceded by a fire-and-forget warmup call.
  4. **Trigger.dev** — Confirms the SDK can reach the Trigger.dev API (e.g., `client.getRun` for a known task ID, or the Trigger.dev health endpoint if available). If truly unreachable, a manual task trigger from the dashboard still counts as Phase 1 success per Success Criterion #3.
- **D-16:** Response shape: `{ ok: boolean, services: { neon: "ok" | { error }, redis: ..., rsshub: ..., trigger: ... } }`. HTTP 200 if all green, 503 otherwise. This route is the acceptance test for INFRA-01/02/04/05/06.

### CI pipeline (Claude's discretion, locked)
- **D-17:** GitHub Actions workflow on every PR and `main`: install → typecheck (`tsc --noEmit`) → lint (`eslint`) → build (`next build`) → run `drizzle-kit migrate` against the PR's Neon branch. No test step in Phase 1 (tests land as phases need them).
- **D-18:** Vercel deployment is triggered by Vercel's GitHub app, not by the Actions workflow. Actions runs migrations *before* Vercel's preview finishes so the preview boots against a migrated schema.

### Claude's Discretion (explicit)
- Exact file/folder names inside `src/`
- Drizzle column types and nullability for tables whose usage is phase-later (e.g., `favorites.created_at` defaulting strategy)
- Whether to use Neon's Vercel integration or roll GitHub Action migrations manually — pick the lower-friction path at planning time
- Logging format for `/api/health` failures
- ESLint/Prettier vs Biome — default to `eslint-config-next` + Prettier unless planner finds a strong reason to switch

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project truth
- `.planning/REQUIREMENTS.md` §Infrastructure — INFRA-01..INFRA-08 are the Phase 1 acceptance bar
- `.planning/ROADMAP.md` §"Phase 1: Infrastructure Foundation" — Goal + 5 Success Criteria
- `.planning/PROJECT.md` — Constraints, Key Decisions table
- `.planning/STATE.md` §Decisions — locked choices (Trigger.dev v4 over Inngest, Voyage voyage-3.5, GitHub OAuth + Resend)
- `CLAUDE.md` — project-wide conventions. **Caveat:** the Tech Stack section of CLAUDE.md still lists Inngest as the cron/queue. REQUIREMENTS.md + STATE.md **override** it with Trigger.dev v4. Planner must not regress to Inngest.

### Internal research
- `.planning/research/STACK.md` — detailed rationale; **same caveat as CLAUDE.md** (recommends Inngest). Use it for everything except queue/cron.
- `.planning/research/ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md`, `SUMMARY.md` — read for domain framing

### External docs (researcher/planner should fetch)
- Next.js 15 App Router — https://nextjs.org/docs/app
- Drizzle ORM + Neon HTTP driver — https://orm.drizzle.team/docs/get-started-postgresql#neon
- Neon pgvector — https://neon.com/docs/extensions/pgvector
- Neon branching for CI — https://neon.com/docs/guides/branching-neon-api
- Trigger.dev v4 (Next.js integration) — https://trigger.dev/docs/v4 (confirm URL at research time)
- RSSHub deployment + env — https://docs.rsshub.app/deploy/
- Hugging Face Spaces runtime limits — https://huggingface.co/docs/hub/spaces
- Upstash Redis (Node + REST) — https://upstash.com/docs/redis
- Vercel + Neon integration — https://vercel.com/marketplace/neon

</canonical_refs>

<code_context>
## Existing Code Insights

**Greenfield project.** Repo currently contains only `.planning/`, `.git/`, and `CLAUDE.md`. No `src/`, no `package.json`, no existing components/hooks/utilities.

### Reusable Assets
- None yet.

### Established Patterns
- None yet. Phase 1 *is* where the baseline patterns land (repo layout, env handling, schema conventions, CI shape).

### Integration Points
- **Hugging Face RSSHub Space** — `https://lurnings-rsshub.hf.space/`. Existing external dependency. App integrates via `RSSHUB_BASE_URL` + `RSSHUB_ACCESS_KEY` env vars; treat as read-only from this repo.

</code_context>

<specifics>
## Specific Ideas

- User has already deployed RSSHub on HF Space with an ACCESS_KEY. That choice pre-empts the Railway/Hetzner debate and is kept as-is.
- Chinese-user latency note (PITFALLS.md territory): HF Spaces use global CDN; if Chinese users see slow feed reads, that's a Phase 4 problem, not a Phase 1 one.

</specifics>

<deferred>
## Deferred Ideas

- **Keep-alive ping for HF Space** — if cold-starts turn into a frequent operational issue in Phase 2, add a 10-minute warmup cron. Not now.
- **Cloudflare / IP allowlist in front of RSSHub** — overkill while the endpoint stays behind ACCESS_KEY. Revisit only if the key leaks publicly.
- **Migration to persistent HF Space or alt host** — if HF free tier sleep disrupts polling, evaluate Railway/Hetzner in a later operational phase.
- **Secrets scanning beyond pre-commit** — GitHub push protection / gitleaks are nice-to-have; Phase 6 operational hardening.

</deferred>

---

*Phase: 01-infrastructure-foundation*
*Context gathered: 2026-04-17*
