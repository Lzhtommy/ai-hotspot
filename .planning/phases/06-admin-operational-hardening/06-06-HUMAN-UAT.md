---
status: partial
phase: 06-admin-operational-hardening
plan: "06"
source: [06-06-PLAN.md Task 3]
started: 2026-04-24T00:00:00Z
updated: 2026-04-24T00:00:00Z
---

## Current Test

Pending live Sentry provisioning (SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT). Code is complete on branch `gsd/phase-06-admin-operational-hardening` (commits `e713c7e` + `36372d1`); the two tests below exercise the live integration end-to-end and must be completed before OPS-01 can be signed off against production traffic.

## Prerequisites

Before running either test, provision in the runtime environment (Vercel + Trigger.dev dashboards; for local dev `.env.local`):

- `SENTRY_DSN` — Sentry Dashboard → Settings → Projects → ai-hotspot → Client Keys (DSN)
- `NEXT_PUBLIC_SENTRY_DSN` — same value as `SENTRY_DSN` (browser-exposed)
- `SENTRY_AUTH_TOKEN` — Sentry Dashboard → Settings → Account → Auth Tokens, scope: sourcemap upload (Vercel Build env + GitHub Actions only; not in runtime)
- `SENTRY_ORG` — Sentry org slug
- `SENTRY_PROJECT` — Sentry project slug

For Trigger.dev specifically, `SENTRY_DSN` must also be set in the Trigger.dev project env (the worker runtime does not inherit Vercel env).

## Tests

### 1. Next.js admin-gated deliberate error reaches Sentry
expected: Admin signs in and GETs `/api/admin/sentry-test` (deployed URL or `http://localhost:3000` with `SENTRY_DSN` set in `.env.local`). Within 5 minutes an issue titled `Sentry integration test — <ISO timestamp>` appears in the Sentry Issues list. Inspect the event payload: `request.cookies` is `{}`, `user.email` (if attached) is `[redacted]`, no `authorization` / `cookie` headers visible.
result: pending
evidence: |
  Not yet executed — awaiting user provisioning of `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in
  Vercel + `.env.local`. Handler + admin gate + PII scrub code is committed
  (`src/app/api/admin/sentry-test/route.ts`, `sentry.server.config.ts`, `instrumentation-client.ts`,
  commits e713c7e + 36372d1). Re-run this test after Sentry DSN is wired in either
  deploy env or local `.env.local`.

### 2. Trigger.dev process-item error reaches Sentry with task tag
expected: Temporarily inject `throw new Error('Sentry Trigger.dev test')` inside the `withSentry('process-item', async () => { ... })` block of `src/trigger/process-item.ts`, run `pnpm trigger:dev`, manually trigger the task from the Trigger.dev dashboard. Within 5 minutes the error appears in Sentry with tag `task=process-item`. Remove the temporary throw; keep the `withSentry` wrapper. `pnpm typecheck && pnpm test --run` exits 0 after cleanup.
result: pending
evidence: |
  Not yet executed — awaiting user provisioning of `SENTRY_DSN` in Trigger.dev project env.
  Wrapper code is committed (`src/trigger/sentry-wrapper.ts`) and `process-item.ts` is wrapped
  via `withSentry('process-item', ...)` (commit 36372d1). Wrapper calls `Sentry.captureException`
  with `tags: { task: label }` then `Sentry.flush(2000)` before rethrow — semantics are present
  in code and will be exercised end-to-end by this test.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0
resolved-equivalently: 0

## Gaps

- Live Sentry verification is environment-bound: both tests require real Sentry project provisioning (DSN + auth token + org/project slugs) and real deploy targets (Vercel for Next.js route; Trigger.dev project for worker run).
- PII scrub correctness can only be verified against a real event payload in the Sentry UI; local unit tests cannot assert what Sentry relay stores. This UAT is the sole source of truth for T-6-60.
- OPS-01 acceptance is code-complete on this branch; phase closure of 06-admin-operational-hardening is not blocked on this UAT (tracked as deferred), but the phase-level `VERIFICATION.md` harness should cross-reference this file.
