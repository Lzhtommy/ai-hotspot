---
status: partial
phase: 01-infrastructure-foundation
source: [01-VERIFICATION.md]
started: 2026-04-17T00:00:00Z
updated: 2026-04-17T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. GitHub Actions CI runs green on a live PR
expected: User links GitHub remote, adds repo secrets (NEON_API_KEY, TRIGGER_ACCESS_TOKEN, DATABASE_URL_MAIN) and variable (NEON_PROJECT_ID), opens a PR. CI workflow runs and all jobs (typecheck, lint, build, db:check, create-neon-branch, db:migrate) exit 0. Closing the PR triggers cleanup-neon-branch and the per-PR Neon branch is deleted.
result: [pending]

### 2. Vercel preview deployment serves /api/health with all services ok
expected: User installs Vercel GitHub App, imports the repo, configures Production + Preview env vars (DATABASE_URL, UPSTASH_REDIS_REST_URL/TOKEN, TRIGGER_SECRET_KEY, RSSHUB_BASE_URL, RSSHUB_ACCESS_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY). Pushing a commit produces a preview URL. `curl <preview-url>/api/health` returns HTTP 200 with `{"ok":true,"services":{"neon":"ok","redis":"ok","rsshub":"ok","trigger":"ok"}}`.
result: [pending]

### 3. Trigger.dev health-probe registers and runs on Cloud dashboard
expected: User runs `pnpm exec trigger login` then `pnpm exec trigger deploy --env dev`. Opens Trigger.dev dashboard → health-probe task → manual trigger. Run completes with status COMPLETED and output `{ ok: true, timestamp: "...", runtime: "..." }`. Satisfies ROADMAP Phase 1 Success Criterion #3.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
