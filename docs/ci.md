# CI / CD

Two GitHub Actions workflows govern builds and migrations.

> **Status (2026-04-17):** The workflow files described here are authored in Plan 01-05 (next in Phase 1). This document is the acceptance spec those workflows must meet; paths and step names below are authoritative for the planner/executor landing them.

## Workflows

### `.github/workflows/ci.yml`

Runs on every pull request (open, synchronize, reopen) and every push to `main`.

| Step                     | PR  | main | Purpose                                                      |
| ------------------------ | --- | ---- | ------------------------------------------------------------ |
| install                  | ✓   | ✓    | `pnpm install --frozen-lockfile`                             |
| typecheck                | ✓   | ✓    | `pnpm typecheck`                                             |
| lint                     | ✓   | ✓    | `pnpm lint`                                                  |
| build                    | ✓   | ✓    | `pnpm build`                                                 |
| db:check                 | ✓   | ✓    | `drizzle-kit check` — fails on schema drift                  |
| create Neon branch       | ✓   | —    | `neondatabase/create-branch-action@v6` → `pr-<N>`            |
| db:migrate (PR branch)   | ✓   | —    | `pnpm db:migrate` against `steps.neon-branch.outputs.db_url` |
| db:migrate (main branch) | —   | ✓    | `pnpm db:migrate` against `secrets.DATABASE_URL_MAIN`        |
| trigger:deploy (prod)    | —   | ✓    | Separate `trigger-deploy` job on main only                   |

### `.github/workflows/cleanup-neon-branch.yml`

Runs on PR close — deletes the per-PR Neon branch via `neondatabase/delete-branch-action@v3`.

## Required Repository Secrets

| Name                   | Purpose                                                             | Source                                                               |
| ---------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `NEON_API_KEY`         | Create/delete branches via Neon API                                 | Neon Console → Account → API keys                                    |
| `DATABASE_URL_MAIN`    | Connection string to the Neon `main` branch for on-merge migrations | Neon Console → Project → Connection Details (main branch pooled URL) |
| `TRIGGER_ACCESS_TOKEN` | Deploy Trigger.dev tasks to prod env                                | Trigger.dev Dashboard → Profile → Personal Access Tokens             |

**NOT required as Actions secrets** (these live only in Vercel + Trigger.dev Cloud + HF Space):

- `TRIGGER_SECRET_KEY` (runtime only)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (runtime)
- `RSSHUB_ACCESS_KEY` (runtime)
- `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` (runtime)

## Required Repository Variables (not secrets)

| Name                          | Purpose                                   | Source                                    |
| ----------------------------- | ----------------------------------------- | ----------------------------------------- |
| `NEON_PROJECT_ID`             | Identifier of the Neon project            | Neon Console → Project Settings → General |
| `NEON_DB_USERNAME` (optional) | DB user to impersonate in per-PR branches | Defaults to `neondb_owner`                |

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
| Neon branch create fails with 401             | `NEON_API_KEY` missing / wrong                | Re-add in repo Secrets                                                                           |
| `type "vector" does not exist` during migrate | 0000 extension migration skipped or reordered | Confirm `drizzle/0000_enable_pgvector.sql` is committed and `_journal.json` lists it before 0001 |
| `drizzle-kit check` fails with drift          | schema.ts changed without regenerating SQL    | Run `pnpm db:generate` locally, commit new migration                                             |
| `trigger:deploy` 401                          | `TRIGGER_ACCESS_TOKEN` wrong                  | Rotate + re-add in repo Secrets                                                                  |

## Why GitHub Actions, Not Vercel Neon Integration

Vercel's Neon integration triggers branch creation as part of Vercel's own preview build — which can race with the preview booting against an unmigrated schema. GitHub Actions gives explicit ordering (per D-18): Actions creates the branch AND finishes migrations, THEN Vercel preview boots against a migrated schema. Actions and Vercel run in parallel but by the time Vercel's `/api/health` is curlable, Actions has typically completed migrations.
