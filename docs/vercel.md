# Vercel Deployment

Next.js deploys are triggered by the Vercel GitHub App, independent of GitHub Actions. Preview on every PR; production on every merge to `main`.

> **Status (2026-04-17):** `vercel.json` lands with Plan 01-05. The Install/Build command overrides documented below are the acceptance spec for that file; until then, Vercel uses the project-setting defaults.

## Project Settings

| Setting          | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| Framework Preset | Next.js                                               |
| Root Directory   | `./` (repo root)                                      |
| Build Command    | `pnpm build` (from `vercel.json`)                     |
| Install Command  | `pnpm install --frozen-lockfile` (from `vercel.json`) |
| Output Directory | `.next` (auto)                                        |
| Node.js Version  | 20 (inherits from `.nvmrc`)                           |

## Runtime Environment Variables

All must be set in BOTH Preview and Production environments unless noted. Values differ per environment (dev API keys vs prod API keys).

| Variable                   | Preview                                                                         | Production                                       | Source                                                       |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`             | Neon `dev` branch pooled URL (or leave empty to inherit CI-injected per-PR URL) | Neon `main` branch pooled URL                    | Neon Console → branch → Connection Details                   |
| `UPSTASH_REDIS_REST_URL`   | Same as dev                                                                     | Production Upstash DB URL                        | Upstash Console → Redis DB → REST API                        |
| `UPSTASH_REDIS_REST_TOKEN` | Same as dev                                                                     | Production Upstash token                         | Upstash Console                                              |
| `TRIGGER_SECRET_KEY`       | `tr_dev_...`                                                                    | `tr_prod_...`                                    | Trigger.dev Dashboard → Project → API Keys                   |
| `TRIGGER_PROJECT_REF`      | `proj_XXXXXX`                                                                   | same                                             | Trigger.dev Dashboard → Project Settings                     |
| `RSSHUB_BASE_URL`          | `https://lurnings-rsshub.hf.space`                                              | same                                             | D-01                                                         |
| `RSSHUB_ACCESS_KEY`        | same as HF Space                                                                | same                                             | HF Space → Variables and secrets → ACCESS_KEY (D-02 rotated) |
| `ANTHROPIC_API_KEY`        | Placeholder OK in Phase 1                                                       | same                                             | Anthropic Console                                            |
| `VOYAGE_API_KEY`           | Placeholder OK in Phase 1                                                       | same                                             | Voyage AI Console                                            |
| `AUTH_SECRET`              | Phase 5                                                                         | Phase 5                                          | `openssl rand -base64 32`                                    |
| `AUTH_URL`                 | Vercel Preview URL (set in Phase 5)                                             | `https://ai-hotspot.vercel.app` or custom domain | Phase 5                                                      |

**Never prefix any of these with `NEXT_PUBLIC_`** — they are all server-only secrets.

## GitHub App Link

Install via https://vercel.com/new → Import Git Repository. The app posts a comment on every PR with the preview URL.

## Phase 1 Acceptance

Merge → Production deploys → curl `https://<your-domain>/api/health` must return 200 with all four services "ok".
