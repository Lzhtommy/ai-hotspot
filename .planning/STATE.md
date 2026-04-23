---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-07-PLAN.md (FeedCardActions useOptimistic + VOTE-03 copy + RSC prop-threading)
last_updated: "2026-04-23T06:56:01.949Z"
last_activity: 2026-04-23
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 33
  completed_plans: 30
  percent: 91
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** A single Chinese-language timeline where AI practitioners never miss a significant AI event, because the system hears it from every source, clusters duplicates, and ranks by LLM-judged importance — not chronology.
**Current focus:** Phase 5 — auth-user-interactions

## Current Position

Phase: 5 (auth-user-interactions) — EXECUTING
Plan: 9 of 11 (05-00, 05-01, 05-02, 05-03, 05-04, 05-05, 05-06 complete; 05-07 next)
Status: Ready to execute
Last activity: 2026-04-23

Progress: [█████████░] 88%

## Performance Metrics

**Velocity:**

- Total plans completed: 18
- Average duration: 6min
- Total execution time: 0.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 01 | 1 | 6min | 6min |
| 01 | 6 | - | - |
| 03 | 5 | - | - |
| 04 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: Phase 01 P01 (6min, 3 tasks, 18 files)
- Trend: -

*Updated after each plan completion*

| Phase Plan | Duration | Tasks | Files |
|------------|----------|-------|-------|
| Phase 01 P01 | 6min | 3 tasks | 18 files |
| Phase 01 P02 | 15min | 3 tasks | 12 files |
| Phase 01-infrastructure-foundation P03 | 5min | 3 tasks | 7 files |
| Phase 01-infrastructure-foundation P04 | 10min | 3 tasks | 3 files |
| Phase 01-infrastructure-foundation P06 | 4min | 2 tasks | 6 files |
| Phase 01-infrastructure-foundation P05 | 3min | 3 tasks | 3 files |
| Phase 02-ingestion-pipeline P03 | 5min | 4 tasks | 7 files |
| Phase 02-ingestion-pipeline P04 | 8min | 2 tasks | 2 files |
| Phase 02-ingestion-pipeline P05 | 9min | 3 tasks | 4 files |
| Phase 03-llm-pipeline-clustering P03-01 | 526295min | 3 tasks | 6 files |
| Phase 03-llm-pipeline-clustering P03-01 | 10min | 3 tasks | 6 files |
| Phase 03-llm-pipeline-clustering P04 | 7 | 3 tasks | 9 files |
| Phase 03-llm-pipeline-clustering P03-05 | 4min | 2 tasks | 3 files |
| Phase 03-llm-pipeline-clustering P03-05 | 717min | 3 tasks | 4 files |
| Phase 04-feed-ui P04 | 27 | 3 tasks | 16 files |
| Phase 04-feed-ui P05 | 10 | 2 tasks | 10 files |
| Phase 04-feed-ui P06 | 21 | 3 tasks | 21 files |
| Phase 05-auth-user-interactions P00 | 5 min | 3 tasks | 28 files |
| Phase 05-auth-user-interactions P01 | 22 min | 3 tasks | 6 files |
| Phase 05-auth-user-interactions P02 | 5 | 3 tasks | 11 files |
| Phase 05-auth-user-interactions P04 | 8 min | 3 tasks | 7 files |
| Phase --phase P05-auth-user-interactions | --plan | 05 tasks | --duration files |
| Phase 05-auth-user-interactions P07 | 11 min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Trigger.dev v4 chosen over Inngest (Vercel timeout avoidance)
- Roadmap: Voyage AI voyage-3.5 for embeddings (multilingual Chinese+English)
- Roadmap: GitHub OAuth + Resend email magic link as primary auth (GFW accessibility)
- Roadmap: Admin + OPS consolidated into Phase 6 (operational hardening after core loop validated)
- [Phase 01]: Plan 01-01: Next.js pinned to 15.x (React 18) via manual post-scaffold pin; create-next-app default (16.x + React 19) overridden per CLAUDE.md
- [Phase 01]: Plan 01-01: ESLint 9 flat config bridges Next 15's legacy preset via @eslint/eslintrc FlatCompat
- [Phase 01]: Plan 01-02: Auth.js tables deferred to later auth-integration plan — v1 schema has 11 domain tables only per D-09
- [Phase 01]: Plan 01-02: Embedding dimension pinned to vector(1024) for Voyage voyage-3.5 per D-10 (overrides CLAUDE.md OpenAI recommendation)
- [Phase 01]: Plan 01-02: Pre-commit UUID hook narrowed (not disabled) to exclude drizzle/meta/*.json — D-08 intent preserved
- [Phase 01-infrastructure-foundation]: Plan 01-03: Trigger.dev SDK import path is `@trigger.dev/sdk` root (NOT `/build` — subpath absent in 4.4.4)
- [Phase 01-infrastructure-foundation]: Plan 01-03: trigger.config.ts must include `maxDuration` (required in @trigger.dev/core@4.4.4); pinned to 3600s (1h) for Phase 2 hourly ingestion budget
- [Phase 01-infrastructure-foundation]: Plan 01-03: Upstash Redis module-scope singleton pattern adopted (mirrors Drizzle client — safe for HTTP-only clients, not TCP)
- [Phase 01-infrastructure-foundation]: Plan 01-04: RSSHub fetch wrapper uses warmup HEAD (5s) + 60s measured budget for D-05 cold-start tolerance; ACCESS_KEY scrubbed from all error paths
- [Phase 01-infrastructure-foundation]: Plan 01-04: /api/health uses Promise.allSettled over four service probes; Trigger.dev check uses whoami primary + tr_-prefix fallback (RESEARCH.md A1)
- [Phase 01-infrastructure-foundation]: Plan 01-06: docs/ci.md + docs/vercel.md carry dated Status banners — they are the authoritative acceptance spec for Plan 05 CI YAML + vercel.json (forward reference, not fiction)
- [Phase 01-infrastructure-foundation]: Plan 01-06: Runbook layout is one file per operational surface (rsshub, health, ci, vercel, database); README.md 'Further Reading' links to all five
- [Phase 01-infrastructure-foundation]: Plan 01-05: CI pins pnpm to 10.32.1 (matches packageManager), supports both main+master push triggers; vercel.json installCommand+buildCommand but no db:migrate (D-18)
- [Phase 01-infrastructure-foundation]: Plan 01-05: Task 4 live PR/preview verification deferred to phase-level HUMAN-UAT per execute-phase user_setup_status (user not yet linked GitHub remote/Vercel app/secrets); artifacts ready for /gsd-verify-work
- [Phase 02-ingestion-pipeline]: Plan 02-03: batch.triggerAndWait v4 signature is Array<{id, payload}>-only; v3-style (taskId, items) removed — verified @trigger.dev/sdk@4.4.4 shared.d.ts:232
- [Phase 02-ingestion-pipeline]: Plan 02-03: Core-logic / task-wrapper split pattern — Trigger.dev task files are thin adapters; business logic in pure src/lib/* modules with injected deps for unit testing
- [Phase 02-ingestion-pipeline]: Plan 02-03: vitest.setup.ts bootstraps placeholder DATABASE_URL for unit tests that transitively import @/lib/db/client (eager neon() call); tests inject mocked db via deps
- [Phase 02-ingestion-pipeline]: Plan 02-04: Seed scripts that import the shared db singleton must use tsx --env-file=.env.local — in-file dotenv.config() runs too late because ES-module imports are hoisted and the db client eagerly calls neon() at evaluation time
- [Phase 02-ingestion-pipeline]: Plan 02-04: RSSHub routes stored as paths only (e.g. /anthropic/news) not full URLs — keeps ACCESS_KEY out of DB (D-20) and makes RSSHUB_BASE_URL rotatable from env without DB updates
- [Phase 02-ingestion-pipeline]: Plan 02-05: db.execute result shape is { rows: Array<T>, rowCount, fields, ... } in drizzle-orm/neon-http — NOT a bare array. Cast to { rows: Array<T> } and index .rows[0].
- [Phase 02-ingestion-pipeline]: Plan 02-05: CLI harness cleanup pattern — main() returns Promise<boolean>; top-level .then() calls process.exit AFTER finally runs. process.exit inside try bypasses finally in Node async runtime.
- [Phase 02-ingestion-pipeline]: Plan 02-05: SC#2 (source isolation) DEFERRED to post-RSSHub-deployment run. Live RSSHub (HF Space) returns 503 to all routes — SC#2 requires at least one non-broken source to succeed in the same run, unobservable while all routes 503. Documented in 02-UAT.md with re-verification checklist.
- [Phase 03-llm-pipeline-clustering]: Plan 03-01: 0003_snapshot.json is byte-identical copy-forward of 0002 — HNSW index not representable in Drizzle's current index builder; DSL unchanged
- [Phase 03-llm-pipeline-clustering]: Plan 03-01: .env.example already contained all 5 Phase 3 vars from prior work; no append needed
- [Phase 03-llm-pipeline-clustering]: Plan 03-01: vitest.setup.ts dummies: sk-ant-test-dummy / pa-test-dummy / pk-lf-test-dummy / sk-lf-test-dummy (clearly non-resolvable per T-03-09)
- [Phase 03-llm-pipeline-clustering]: Plan 03-01: psql fallback used for Task 3 migration push (non-TTY drizzle-kit push would require interactive TTY confirmation); pnpm check:hnsw verified exit 0 on live Neon dev branch
- [Phase 03-llm-pipeline-clustering]: A8 debounce verified: TriggerOptions.debounce exists in @trigger.dev/core@4.4.4 — Path A taken; refreshClusters.trigger(undefined, { debounce: buildDebounceOpts() })
- [Phase 03-llm-pipeline-clustering]: W4 queue inline on task(): queue: { name: 'llm-pipeline', concurrencyLimit: 4 } confirmed in CommonTaskOptions types; trigger.config.ts unchanged
- [Phase 03-llm-pipeline-clustering]: OTel stack: @langfuse/otel@5.1.0 + @arizeai/openinference-instrumentation-anthropic@0.1.9 + @opentelemetry/sdk-node@0.215.0; AnthropicInstrumentation.manuallyInstrument at module load precedes client.ts instantiation
- [Phase 03-llm-pipeline-clustering]: ZodError DI injection for SC#3: import from 'zod/v4' matches process-item-core.ts catch clause
- [Phase 03-llm-pipeline-clustering]: Sentinel URL randomization (Date.now() + Math.random()) avoids url_fingerprint UNIQUE collision on verify:llm re-runs
- [Phase 03-llm-pipeline-clustering]: Plan 03-05: neon-serverless Pool driver adopted (fix 5be492b) — neon-http does not support transactions; Pool/WebSocket required for any future db.transaction() usage
- [Phase 04-feed-ui]: ClusterSection extracted as minimal 'use client' wrapper — FeedCard outer stays RSC; only expand state is client-side
- [Phase 04-feed-ui]: Native <dialog> for LoginPromptModal — showModal() provides focus trap + backdrop + Escape for free (no Radix)
- [Phase 04-feed-ui]: nuqs shallow:false on FilterPopover — forces RSC re-render when URL params change (FEED-12)
- [Phase 04-feed-ui]: vitest JSX via esbuild jsx:automatic — avoids ESM-only @vitejs/plugin-react in CJS vitest.config.ts
- [Phase 04-feed-ui]: deleted src/app/page.tsx — Next.js resolves / through (reader)/page.tsx route group
- [Phase 04-feed-ui]: generateMetadata does NOT set og:image manually — Next.js auto-wires opengraph-image.tsx
- [Phase 04-feed-ui]: ISR pages show as ƒ in Next.js 15 build when DB unavailable at build time — revalidate still operative at runtime
- [Phase 04-feed-ui]: E2E fixture uses HTTP GET to /api/e2e-fixture/sample-item rather than direct DB import — Playwright workers run outside Next.js process
- [Phase 04-feed-ui]: SidebarMobileDrawer split into context provider + SidebarDrawerPanel — context must wrap entire shell so HamburgerButton in main can reach useSidebarDrawer
- [Phase 04-feed-ui]: NuqsAdapter added to root layout.tsx — required for App Router nuqs useQueryState to work (FilterPopover was crashing /all without it)
- [Phase 05-auth-user-interactions]: Plan 05-00: Vitest env switched node->jsdom; include paths extended to tests/unit + tests/integration for Phase 5 scaffolding
- [Phase 05-auth-user-interactions]: Plan 05-00: seed-session helper uses raw SQL (drizzle-orm sql template) — avoids importing sessions schema symbol that Plan 05-01 will add
- [Phase 05-auth-user-interactions]: Plan 05-00: @vitest/ui pinned to 2.1.9 to match vitest 2.x; pnpm default resolves to 4.x which peer-mismatches
- [Phase 05-auth-user-interactions]: Plan 05-01: psql-equivalent runner (scripts/apply-0004-auth.ts) used over drizzle-kit push — push was non-TTY-blocked AND proposed DROP of Plan 03-01 HNSW index (Drizzle DSL cannot represent HNSW). All future Phase 5+ migrations should follow scripts/apply-NNNN-*.ts pattern until the DSL gap closes.
- [Phase 05-auth-user-interactions]: Plan 05-01: camelCase quoted SQL identifiers ("userId", "providerAccountId", "sessionToken") are scoped to the three Auth.js adapter tables only (accounts/sessions/verification_tokens) — @auth/drizzle-adapter contract requirement. Rest of schema keeps snake_case.
- [Phase 05-auth-user-interactions]: Plan 05-02: vitest.config.ts inlines next-auth + @auth/core to resolve bare-subpath imports (next/server without .js extension) that Node's ESM resolver rejects; same class of fix as voyageai
- [Phase 05-auth-user-interactions]: Plan 05-02: authConfig split (src/lib/auth/config.ts) from NextAuth() singleton (src/lib/auth/index.ts) — mirrors db/{schema,client}.ts split so tests can import raw authConfig for shape assertions without invoking NextAuth()
- [Phase 05-auth-user-interactions]: Plan 05-02: Providers ship empty[] — Plan 02 isolates adapter+callback+route concerns; GitHub/Resend/Google wiring moved to Plan 03 per original plan split
- [Phase 05-auth-user-interactions]: Use form onSubmit + FormData + server-action call instead of action={serverAction} prop — React 18.3 does not fire function-valued action outside Next.js compiler transform, and Vitest environment cannot test it.
- [Phase 05-auth-user-interactions]: jsdom HTMLDialogElement.showModal polyfill in tests/setup.ts (Option B from Plan 05-00) — preserves production <dialog> semantics while unblocking tests.
- [Phase 05-auth-user-interactions]: Plan 05-05: Session prop-drilled from RSC layout (`await auth()` in `src/app/(reader)/layout.tsx`) through ReaderShell → Sidebar → UserChip — UserChip never calls useSession() (CLAUDE.md §11 + RESEARCH §Anti-Patterns).
- [Phase 05-auth-user-interactions]: Plan 05-05: AuthenticatedChip extracted as child component so useState/useEffect do not run under UserChip's always-branching anonymous early-return (rules-of-hooks compliance).
- [Phase 05-auth-user-interactions]: Plan 05-05: Sidebar downgraded from `async function` to sync — `async` in a Client-Component parent (ReaderShell) was a latent bug; session now arrives via prop from the RSC layout boundary.
- [Phase 05-auth-user-interactions]: Plan 05-07: useOptimisticCompat wrapper — always-called useState/useEffect stable hook order across React 18.3 (vitest) + React 19 canary (Next 15 production); same source compile-and-pass both runtimes
- [Phase 05-auth-user-interactions]: Plan 05-07: RSC prop-threading for auth — every feed page calls auth() + getUserInteractions, passes isAuthenticated + interactionMap through Timeline to FeedCard to FeedCardActions; zero useSession() on client (RESEARCH §Anti-Patterns + CLAUDE.md §11)
- [Phase 05-auth-user-interactions]: Plan 05-07: IconButton tone extended with 'success' (like active) + ACTIVE_BG map (10% tone fills: accent-50/success-50/danger-50) per UI-SPEC §FeedCardActions active-state contract

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 research flag: Verify Trigger.dev v4 batch.triggerByTaskAndWait API patterns before planning
- Phase 2 research flag: Evaluate full-text extraction library (@mozilla/readability vs. unfluff vs. Jina.ai) before LLM pipeline planning
- Phase 2 note: X/Twitter RSSHub routes are highest-volatility — treat as best-effort in v1
- Phase 2 SC#2 blocked on RSSHub deployment — lurnings-rsshub.hf.space returns 503 on all canary routes. Re-verify via pnpm verify:ingest once healthy. Phase 3 prerequisite.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260422-ogt | Fix Trigger.dev deploy ENOENT for src/lib/llm/prompts/*.md by adding additionalFiles build extension to trigger.config.ts | 2026-04-22 | 523dc77 | [260422-ogt-fix-trigger-dev-deploy-enoent-for-src-li](./quick/260422-ogt-fix-trigger-dev-deploy-enoent-for-src-li/) |
| 260422-rax | fix: Trigger.dev ingest-hourly fails due to Neon WebSocket incompat on Node 22 | 2026-04-22 | fdd0719 | [260422-rax-fix-trigger-dev-ingest-hourly-fails-due-](./quick/260422-rax-fix-trigger-dev-ingest-hourly-fails-due-/) |
| 260423-e6n | enrich.ts: expose real Anthropic error detail (name+message 300 chars, APIError status/type) in EnrichError without leaking keys | 2026-04-23 | a2afa86 | [260423-e6n-enrich-ts-expose-real-anthropic-error-de](./quick/260423-e6n-enrich-ts-expose-real-anthropic-error-de/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-04-23T06:56:01.944Z
Stopped at: Completed 05-07-PLAN.md (FeedCardActions useOptimistic + VOTE-03 copy + RSC prop-threading)
Resume file: None

**Planned Phase:** 05 (auth-user-interactions) — 11 plans — 2026-04-23T03:52:10.184Z
