# CI / CD

Two GitHub Actions workflows govern builds and migrations.

> **Status (2026-04-17):** The workflow files described here are authored in Plan 01-05 (next in Phase 1). This document is the acceptance spec those workflows must meet; paths and step names below are authoritative for the planner/executor landing them.

## Workflows

### `.github/workflows/ci.yml`

Runs on every pull request (open, synchronize, reopen) and every push to `main`.

| Step                     | PR  | main | Purpose                                                                  |
| ------------------------ | --- | ---- | ------------------------------------------------------------------------ |
| install                  | ✓   | ✓    | `pnpm install --frozen-lockfile`                                         |
| typecheck                | ✓   | ✓    | `pnpm typecheck`                                                         |
| lint                     | ✓   | ✓    | `pnpm lint`                                                              |
| build                    | ✓   | ✓    | `pnpm build`                                                             |
| db:check                 | ✓   | ✓    | `drizzle-kit check` — fails on schema drift                              |
| db:migrate (PR)          | ✓   | —    | `pnpm db:migrate` against the `pgvector/pgvector:pg16` service container |
| db:migrate (main branch) | —   | ✓    | `pnpm db:migrate` against `secrets.DATABASE_URL_MAIN` (Supabase)         |
| trigger:deploy (prod)    | —   | ✓    | Separate `trigger-deploy` job on main only                               |

PR migrations run against an ephemeral Postgres service container (pgvector preinstalled) that boots
alongside the job and is discarded with the runner — no external DB and no per-PR branch lifecycle to
clean up.

## Required Repository Secrets

| Name                   | Purpose                                                | Source                                                                |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `DATABASE_URL_MAIN`    | Production Supabase pooler URL for on-merge migrations | Supabase Dashboard → Project → Connect → connection pooling (Session) |
| `TRIGGER_ACCESS_TOKEN` | Deploy Trigger.dev tasks to prod env                   | Trigger.dev Dashboard → Profile → Personal Access Tokens              |

**NOT required as Actions secrets** (these live only in Vercel + Trigger.dev Cloud + HF Space):

- `TRIGGER_SECRET_KEY` (runtime only)
- `RSSHUB_ACCESS_KEY` (runtime)
- `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` (runtime)

## Branch Protection Recommendations (Phase 6 — not Phase 1)

- Require `ci` check to pass before merge
- Require 1 approval on PRs from external contributors
- Disallow force-push to `main`
- Require branches up-to-date with `main` before merge

Phase 1 is greenfield and a single developer — branch protection is optional. Enable at milestone gates.

## Failure Playbook

| Failure                                       | Diagnosis                                     | Fix                                                                                              |
| --------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ERR_PNPM_FROZEN_LOCKFILE_VIOLATION`          | `pnpm-lock.yaml` not committed or out of sync | Run `pnpm install` locally and commit lockfile                                                   |
| Migrate step cannot connect on a PR           | pgvector service container not healthy yet    | Check the `services.postgres` health-check block in `ci.yml`; the job waits for `pg_isready`     |
| `type "vector" does not exist` during migrate | 0000 extension migration skipped or reordered | Confirm `drizzle/0000_enable_pgvector.sql` is committed and `_journal.json` lists it before 0001 |
| `drizzle-kit check` fails with drift          | schema.ts changed without regenerating SQL    | Run `pnpm db:generate` locally, commit new migration                                             |
| `trigger:deploy` 401                          | `TRIGGER_ACCESS_TOKEN` wrong                  | Rotate + re-add in repo Secrets                                                                  |

## PR isolation without per-PR databases

Supabase has no drop-in per-PR branch action equivalent to Neon's, so PR CI validates migrations against a throwaway `pgvector/pgvector:pg16` service container instead of a real cloud branch. This keeps PR runs hermetic and credential-free; the production Supabase schema is only ever touched by the on-merge `db:migrate` step using `secrets.DATABASE_URL_MAIN`. If you later want preview deployments to run against an isolated cloud schema, Supabase's paid Branching feature (or a dedicated staging project) can be wired into a preview-only step.
