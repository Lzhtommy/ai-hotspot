---
phase: 06-admin-operational-hardening
plan: "06"
subsystem: infra
tags: [sentry, observability, error-monitoring, nextjs, trigger-dev, pii-scrub, ops-01]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: Next.js 15 App Router scaffold + Trigger.dev v4 config (instrumentation.ts + trigger.config.ts host surfaces that Sentry init files hook into)
  - phase: 05-auth-user-interactions
    provides: requireAdmin() from src/lib/auth/admin.ts (admin gate on /api/admin/sentry-test route)
  - phase: 06-admin-operational-hardening (self, plan 00)
    provides: Admin gate baseline — /api/admin/* routes inherit the same three-layer gate pattern
provides:
  - Sentry SDK wired into Next.js (server + edge + client) via @sentry/nextjs
  - Trigger.dev worker-runtime Sentry init via src/trigger/sentry-wrapper.ts (withSentry(label, fn) wrapper)
  - src/trigger/process-item.ts wrapped in withSentry('process-item', ...) so every worker exception reaches Sentry with task tag
  - /api/admin/sentry-test admin-gated deliberate-error endpoint for live verification (T-6-61 mitigation)
  - PII scrub (T-6-60) in beforeSend across all four Sentry inits: cookies, cookie/authorization headers, user.email, and any /token|secret|key|password/i field
  - .env.example documents 4 new env vars: NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT (SENTRY_DSN was already placeholdered)
  - next.config.ts wrapped with withSentryConfig (silent build, widened client upload, disabled auto Vercel monitors, no auto logger patching)
affects: [06-07-uptime-monitoring, 06-08-runbook-deployment, production-release-runbook]

# Tech tracking
tech-stack:
  added:
    - "@sentry/nextjs (pinned by pnpm add; resolves latest — sourcemap upload + App Router instrumentation primitives)"
  patterns:
    - "Runtime-specific Sentry init files at project root (sentry.server.config.ts + sentry.edge.config.ts + instrumentation-client.ts) + dynamic register() in instrumentation.ts per NEXT_RUNTIME — Next.js 15 canonical pattern"
    - "Dynamic import of @sentry/nextjs inside onRequestError (not top-level) to sidestep top-level-await mode differences across tsc + esbuild + swc"
    - "Lazy init + module-scope singleton guard (`let initialized = false; function ensureInit()`) inside Trigger.dev wrapper — matches db client + redis client precedent from Phase 01; safe when SENTRY_DSN is absent (no-op)"
    - "withSentry(label, fn) wrapper exposes a task-agnostic try/captureException/flush(2000)/rethrow contract — Trigger.dev tasks opt in by wrapping their run body; wrapper composes alongside existing startOtel/flushOtel orthogonally"
    - "Admin-only deliberate-error route via requireAdmin() redirect pattern (non-admins bounce to /admin/access-denied, not 403 body) — consistent with Phase 06-00 gate precedent; error body is the test payload only after the admin gate has passed"
    - "enabled flag gates runtime init on presence of DSN (`enabled: !!process.env.*_DSN`) so dev runs without Sentry provisioning are no-ops and never noise-error"

key-files:
  created:
    - sentry.server.config.ts
    - sentry.edge.config.ts
    - instrumentation.ts
    - instrumentation-client.ts
    - src/trigger/sentry-wrapper.ts
    - src/app/api/admin/sentry-test/route.ts
    - .planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md
  modified:
    - next.config.ts
    - src/trigger/process-item.ts
    - .env.example
    - package.json
    - pnpm-lock.yaml
    - .planning/phases/06-admin-operational-hardening/deferred-items.md

key-decisions:
  - "beforeSend redacts in place and forwards (returns event) rather than dropping (returns null) — Sentry still sees stack + message + scrubbed context; null-return was considered for T-6-60 but would eliminate the signal we're paying to capture. Defense-in-depth is Sentry's built-in relay scrubbing layered on top."
  - "Trigger.dev worker Sentry init is lazy inside withSentry wrapper, not at module scope — the worker runtime loads src/trigger/*.ts eagerly, and a module-scope Sentry.init() would fire unconditionally even in local trigger:dev runs without DSN. Lazy init keeps the dev loop quiet."
  - "instrumentation.ts uses dynamic import inside onRequestError (documented as WARNING-7 fix in the plan) rather than top-level-await captureRequestError binding — avoids cross-bundler mode differences (tsc emits TLA; esbuild/swc sometimes reject it in certain config matrices) and is the pattern Sentry's own docs recommend for Next 15."
  - "/api/admin/sentry-test uses requireAdmin() redirect semantics (not a 403 JSON) — consistent with the Phase 06-00 admin gate baseline. Non-admins never see the thrown error body. The deliberate throw is the test payload only after auth has cleared."
  - "Live Sentry verification (Task 3) deferred to HUMAN-UAT rather than blocking plan close — code is complete and typed-clean on branch; live verification requires real Sentry project provisioning which is a separate operator workflow. Matches precedent from Plan 05-10 (auth-providers runbook) where live smoke-tests were decoupled from code-complete."

patterns-established:
  - "Runtime-specific init file naming: sentry.<runtime>.config.ts at project root — Sentry Next.js wizard convention; do not relocate under src/"
  - "instrumentation-client.ts (not sentry.client.config.ts) is the Next.js 15 App Router filename — wizard output for Next 13+; older pre-Next-13 examples use sentry.client.config.ts and must be ignored"
  - "Deliberate-error test routes live under /api/admin/* — admin-gated by default via the Phase 06-00 gate; never under public routes"
  - "Every Sentry init file has its own beforeSend with at minimum `user.email = '[redacted]'` — future runtimes (new edge routes, new worker files) must re-apply the scrub; it is not a framework default"
  - "Env var naming: SENTRY_DSN (runtime), NEXT_PUBLIC_SENTRY_DSN (browser-exposed), SENTRY_AUTH_TOKEN (build-time only — never in runtime envs), SENTRY_ORG / SENTRY_PROJECT (build-time) — audit Vercel env matrix after any rewire"

requirements-completed: [OPS-01]

# Metrics
duration: ~25min
completed: 2026-04-24
---

# Phase 6 Plan 06-06: Sentry Integration Summary

**Sentry SDK wired into Next.js (server + edge + client) + Trigger.dev workers via a withSentry wrapper, with beforeSend PII scrubs on all four runtimes and an admin-gated deliberate-error endpoint for live verification — code-complete; live dashboard verification deferred to HUMAN-UAT pending SENTRY_DSN provisioning.**

Live Sentry receipt: DEFERRED — tracked in 06-06-HUMAN-UAT.md (status `partial`, 2 pending tests). All code + types + admin gate are in place on branch `gsd/phase-06-admin-operational-hardening` (commits `e713c7e` + `36372d1`).

## Performance

- **Duration:** ~25 min (Tasks 1 + 2 completed by prior agent; Task 3 live verification deferred; this continuation agent: metadata only)
- **Started:** 2026-04-23 (Phase 6 Wave 1)
- **Completed:** 2026-04-24 (metadata + deferred tracking)
- **Tasks:** 3 defined — 2 completed as code, 1 deferred to HUMAN-UAT
- **Files created:** 7 (5 source/config + 1 API route + 1 HUMAN-UAT tracking doc)
- **Files modified:** 6 (next.config.ts, process-item.ts, .env.example, package.json, pnpm-lock.yaml, deferred-items.md)

## Accomplishments

- Installed `@sentry/nextjs` and wrote the Next.js 15 canonical Sentry init file set: `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `instrumentation-client.ts` — each with its own beforeSend scrub.
- Wrapped `next.config.ts` with `withSentryConfig` (sourcemap upload gated on SENTRY_AUTH_TOKEN presence at build time; silent in non-CI, widened client upload, automaticVercelMonitors=false, disableLogger=true).
- Built `src/trigger/sentry-wrapper.ts` — exports `withSentry<T>(label, fn)` — lazy Sentry.init guard + captureException with `tags: { task: label }` + `Sentry.flush(2000)` before rethrow. Trigger.dev worker runtime now surfaces escape-path exceptions to Sentry (the worker does NOT inherit Next's instrumentation hook, so this wrapper is load-bearing for OPS-01 on the worker side).
- Wired `src/trigger/process-item.ts` run body inside `withSentry('process-item', ...)` — future worker errors carry the `task=process-item` tag.
- Built `src/app/api/admin/sentry-test/route.ts` as the live-verification harness: `requireAdmin()` gate, then `throw new Error("Sentry integration test — <ISO>")`. Non-admins redirect (never see the body); admins trigger a deliberate fault that should reach Sentry within 5 minutes.
- Extended `.env.example` with `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` placeholders (SENTRY_DSN was already placeholdered in the runtime envs block).
- Created `06-06-HUMAN-UAT.md` with 2 pending tests (Next.js admin route error receipt + Trigger.dev worker error receipt); appended cross-reference to `deferred-items.md` so phase closure tooling can surface the pending verification.

## Task Commits

1. **Task 1: Install @sentry/nextjs + init configs + PII scrub + next.config wrap + env vars** → `e713c7e` (feat)
2. **Task 2: Trigger.dev Sentry wrapper + process-item wiring + admin-gated sentry-test route** → `36372d1` (feat)
3. **Task 3: Live Sentry dashboard verification** → DEFERRED (tracked in `06-06-HUMAN-UAT.md`; no code commit; requires user to provision Sentry project + DSN + auth token)

**Plan metadata commit:** pending (end of this summary — docs commit bundles SUMMARY + STATE + ROADMAP + deferred-items)

## Files Created/Modified

**Created:**
- `sentry.server.config.ts` — Server-side Sentry.init with full beforeSend (cookies + auth headers + user.email + secret-field regex scrub); tracesSampleRate 0.1; enabled gated on SENTRY_DSN or NODE_ENV=production
- `sentry.edge.config.ts` — Edge-runtime Sentry.init mirror with the same beforeSend contract
- `instrumentation.ts` — register() dispatches to sentry.server.config or sentry.edge.config per NEXT_RUNTIME; onRequestError dynamically imports @sentry/nextjs (WARNING-7 fix — no top-level await)
- `instrumentation-client.ts` — Browser-side Sentry.init with minimal beforeSend (user.email redact only — no request context in browser); exports onRouterTransitionStart for Next 15 App Router navigation tracing
- `src/trigger/sentry-wrapper.ts` — withSentry<T>(label, fn) wrapper with lazy init guard + captureException + flush + rethrow
- `src/app/api/admin/sentry-test/route.ts` — admin-gated deliberate-error endpoint (dynamic = 'force-dynamic')
- `.planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md` — 2 pending UAT tests documenting what live verification will exercise once DSN is provisioned

**Modified:**
- `next.config.ts` — wrapped export with withSentryConfig(nextConfig, { org, project, silent, widenClientFileUpload, disableLogger, automaticVercelMonitors: false })
- `src/trigger/process-item.ts` — run body wrapped in withSentry('process-item', async () => { ... }); existing startOtel/flushOtel flow preserved orthogonally
- `.env.example` — added NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT placeholders with inline comments
- `package.json` + `pnpm-lock.yaml` — @sentry/nextjs dependency added
- `.planning/phases/06-admin-operational-hardening/deferred-items.md` — appended Plan 06-06 Task 3 deferred-verification section pointing to 06-06-HUMAN-UAT.md

## Decisions Made

See frontmatter `key-decisions` for the full list with rationale. Highlights:

- **beforeSend redacts and forwards, never drops.** Null-return was considered for the paranoid-T-6-60 path but defeats the purpose of capture. Scrub-and-forward preserves the error signal while eliminating PII egress. Sentry's own relay scrubbing remains a defense-in-depth layer on top.
- **Trigger.dev wrapper is lazy-init, not module-scope init.** Eager `Sentry.init()` at module load would fire unconditionally in every `pnpm trigger:dev` run without DSN — silent log noise on every worker boot. The lazy guard is the same shape as Phase 01's db/redis singleton patterns.
- **instrumentation.ts uses dynamic import inside onRequestError.** Avoids top-level-await mode mismatches across tsc/esbuild/swc bundler matrix — matches Sentry's own Next 15 canonical docs; the plan called this out as WARNING-7 and it remains the correct shape.
- **Live verification deferred, not blocking.** Sentry provisioning is operator work; the code surface is complete and typed-clean. HUMAN-UAT cross-referenced from deferred-items for phase-close traceability — matches Plan 05-10 precedent where auth-providers live smoke-test was decoupled from code-complete.

## User Setup Required

**External services require manual configuration before live verification.** See [06-06-HUMAN-UAT.md](./06-06-HUMAN-UAT.md) for the 2 pending verification tests.

Required env vars (all from Sentry Dashboard — see plan `user_setup` frontmatter for exact dashboard paths):

| Var | Where | Purpose |
|-----|-------|---------|
| `SENTRY_DSN` | Vercel runtime env + Trigger.dev project env + `.env.local` (optional for dev) | Server/edge/worker event ingest |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel runtime env + `.env.local` (optional) | Browser event ingest (same DSN value) |
| `SENTRY_AUTH_TOKEN` | Vercel Build env + GitHub Actions secrets (**not runtime**) | Sourcemap upload at build time; scope = sourcemap upload |
| `SENTRY_ORG` | Vercel Build env + GitHub Actions secrets | Build-time sourcemap destination |
| `SENTRY_PROJECT` | Vercel Build env + GitHub Actions secrets | Build-time sourcemap destination |

Additional Sentry Dashboard tasks:
- Create Next.js project `ai-hotspot` in Sentry (if not present)
- Grant `SENTRY_AUTH_TOKEN` sourcemap upload scope only

## Deviations from Plan

**None.** Plan executed exactly as written (Tasks 1 + 2 in full); Task 3 is an explicit `checkpoint:human-verify` that the plan specified can be gated on real provisioning. Deferring Task 3 to HUMAN-UAT is within the plan's checkpoint semantics per the execute-phase `handle_human_needed` pattern — it is not a deviation.

## Issues Encountered

None during code execution. Live verification (Task 3) is blocked on user-controlled Sentry provisioning, which is expected and tracked via HUMAN-UAT.

## TDD Gate Compliance

N/A — this plan is `type: execute` (not `type: tdd`). Tasks 1 + 2 are `type="auto"` without `tdd="true"`. Commit sequence shows `feat(06-06)` + `feat(06-06)` atomic commits per task, matching the plan's execution contract.

## Next Phase Readiness

- **Plan 06-07 (uptime monitoring) unblocked.** Sentry is in place for error-class observability; 06-07 layers uptime pings on top of the same dashboard (different signal, same SaaS relationship).
- **Plan 06-08 (runbook/deployment docs) inherits.** Docs plan will reference the 5-var env matrix + the HUMAN-UAT live-verification procedure as part of the production release runbook.
- **Phase 6 closure.** OPS-01 is code-complete; the phase-level `VERIFICATION.md` (when generated at Phase 6 close) must reference 06-06-HUMAN-UAT.md alongside the existing deferred-items entry to surface the single remaining manual verification before sign-off.

## Self-Check: PASSED

Verified:

- `sentry.server.config.ts` — FOUND (`git show e713c7e --stat` lists it)
- `sentry.edge.config.ts` — FOUND
- `instrumentation.ts` — FOUND
- `instrumentation-client.ts` — FOUND
- `src/trigger/sentry-wrapper.ts` — FOUND (`git show 36372d1 --stat` lists it)
- `src/app/api/admin/sentry-test/route.ts` — FOUND
- `.planning/phases/06-admin-operational-hardening/06-06-HUMAN-UAT.md` — FOUND (created this agent)
- `next.config.ts` / `src/trigger/process-item.ts` / `.env.example` / `package.json` / `pnpm-lock.yaml` — MODIFIED (in commits `e713c7e` + `36372d1`)
- `.planning/phases/06-admin-operational-hardening/deferred-items.md` — MODIFIED (appended Plan 06-06 UAT cross-reference)
- Commit `e713c7e` — FOUND via `git log --oneline -5`
- Commit `36372d1` — FOUND via `git log --oneline -5`

---

*Phase: 06-admin-operational-hardening*
*Completed: 2026-04-24*
