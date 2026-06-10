# AI Hotspot

A public-facing Chinese-language AI news aggregator. Pulls from official lab blogs, social, forums, and Chinese sources via a self-hosted RSSHub; Claude (Anthropic) scores and summarizes; items are clustered by semantic similarity (Voyage AI embeddings + pgvector); surfaced as a timeline-style feed.

**Core value:** A single Chinese-language timeline where AI practitioners never miss a significant AI event, because the system hears it from every source, clusters duplicates, and ranks by LLM-judged importance — not chronology.

## Tech Stack

- Next.js 15 App Router (TypeScript, pnpm)
- Supabase Postgres + pgvector (via Drizzle ORM, `node-postgres`)
- Trigger.dev v4 (hourly ingestion + LLM pipeline workers)
- RSSHub (self-hosted on Hugging Face Space — see `docs/rsshub.md`)
- Anthropic Claude Haiku 4.5 (summarization, scoring, tagging, 推荐理由)
- Voyage AI `voyage-3.5` (1024-dim embeddings for clustering)

## Local Development

### Prerequisites

- Node.js 20.9 or newer (use `nvm use` — respects `.nvmrc`)
- pnpm 9+ (`npm i -g pnpm`)
- A Supabase project (free tier is fine) — see `docs/database.md`
- A Trigger.dev Cloud project — see `docs/ci.md`

### Setup

```bash
nvm use                                 # picks up .nvmrc → Node 20
pnpm install
cp .env.example .env.local              # then fill in values — see docs/vercel.md for sources
pnpm db:migrate                         # applies pgvector + schema to your Supabase database
pnpm dev
```

Then open http://localhost:3000/api/health — should return `{ ok: true, services: { db: "ok", rsshub: "ok", trigger: "ok" } }`.

### Useful scripts

| Command               | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `pnpm dev`            | Start Next.js dev server                                     |
| `pnpm build`          | Production build                                             |
| `pnpm typecheck`      | `tsc --noEmit`                                               |
| `pnpm lint`           | ESLint                                                       |
| `pnpm format`         | Prettier write                                               |
| `pnpm db:generate`    | Generate SQL migration from schema diff                      |
| `pnpm db:migrate`     | Apply migrations to `DATABASE_URL` (dev-branch or CI-branch) |
| `pnpm db:push`        | Apply schema directly without SQL files (dev-only)           |
| `pnpm db:check`       | Verify schema.ts matches generated SQL                       |
| `pnpm trigger:dev`    | Run local Trigger.dev worker tunnel                          |
| `pnpm trigger:deploy` | Deploy tasks to Trigger.dev Cloud                            |

## Project Layout

```
src/
  app/                 # Next.js App Router pages + API routes
    api/health/        # Phase 1 acceptance gate
  lib/
    db/                # Drizzle client + schema (all 11 tables)
    rsshub.ts          # RSSHub fetch wrapper
  trigger/             # Trigger.dev tasks
drizzle/               # Migration SQL (generated + 0000 pgvector manual)
docs/                  # Runbooks — rsshub, health, ci, vercel, database
.planning/             # GSD planning artifacts (phase docs)
```

## Further Reading

- `docs/rsshub.md` — RSSHub HF Space pointer + key rotation runbook
- `docs/health.md` — `/api/health` contract
- `docs/database.md` — Drizzle + Supabase + pgvector migration workflow
- `docs/ci.md` — GitHub Actions + secrets
- `docs/vercel.md` — Vercel env vars + project settings
- `docs/auth-providers.md` — Auth.js v5 provider setup, Vercel env scope matrix, admin promotion SQL, preview OAuth smoke test
- `docs/admin.md` — Admin operations runbook: `/admin` routes, source CRUD + health, user ban/unban, dead-letter retry, cost dashboard
- `docs/observability.md` — Sentry (OPS-01), Langfuse (OPS-02), Vercel Analytics (OPS-05), `/api/health`, and `pipeline_runs` SQL fallbacks

## License

TBD.

<!-- CI verification trigger 1776671036 -->
