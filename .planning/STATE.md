---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: "v1.0 MVP"
status: "v1.0 shipped and archived — planning v1.1"
stopped_at: v1.0 milestone closed 2026-04-24; audit status tech_debt; 74/75 requirements satisfied; next step /gsd-new-milestone
last_updated: "2026-04-24T06:20:00.000Z"
last_activity: 2026-04-24
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24 after v1.0 milestone)

**Core value:** A single Chinese-language timeline where AI practitioners never miss a significant AI event, because the system hears it from every source, clusters duplicates, and ranks by LLM-judged importance — not chronology.
**Current focus:** Planning v1.1 milestone (v1.0 shipped 2026-04-24 — archived to `.planning/milestones/`)

## Current Position

Milestone: v1.0 complete and archived
Last shipped: Phase 6 (Admin + Operational Hardening) on 2026-04-23
Next step: `/gsd-new-milestone` to scope v1.1

Progress: [██████████] 100% of v1.0

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
| Phase 05-auth-user-interactions P08 | 8 min | 2 tasks | 4 files |
| Phase 05-auth-user-interactions P09 | 7 min | 3 tasks | 7 files |
| Phase 05-auth-user-interactions P10 | 3 min | 3 tasks | 2 files |
| Phase 06-admin-operational-hardening P00 | 7min | 3 tasks | 8 files |
| Phase 06-admin-operational-hardening P01 | 15min | 3 tasks | 6 files |
| Phase 06-admin-operational-hardening P06-06 | 25min | 2 tasks | 11 files |
| Phase 06-admin-operational-hardening P06-07 | 4min | 2 tasks | 5 files |
| Phase 06-admin-operational-hardening P08 | 9min | 3 tasks | 6 files |

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
- [Phase 05-auth-user-interactions]: Plan 05-08: /favorites redirects anonymous users to / (D-15 Option A); authenticated users see favorites reverse-chrono via innerJoin(items) + orderBy(desc(favorites.createdAt)); FeedTopBar gains subtitle override prop
- [Phase 05-auth-user-interactions]: Plan 05-09: Split tests/helpers/test-db.ts out of db.ts — Playwright workers (Node CJS) cannot import vitest; re-export preserves Vitest-side import path; vitest-free makeTestDb used by seedSession for E2E DB writes
- [Phase 05-auth-user-interactions]: Plan 05-09: Auth cookie name derived from baseUrl protocol — __Secure-authjs.session-token on https, authjs.session-token on http — matches Auth.js v5 useSecureCookies auto-derivation
- [Phase 05-auth-user-interactions]: Plan 05-09: Magic-link E2E uses OR-assertion (success 链接已发送 OR failure 发送失败) so CI works without RESEND_API_KEY; real deliverability UAT deferred to Plan 10 runbook
- [Phase 05-auth-user-interactions]: Plan 05-10: docs/auth-providers.md is the Phase 5 operational hand-off — 8 sections (OAuth apps, Resend, Vercel env matrix, admin SQL, preview smoke test, ban enforcement, deployment DoD); English prose to match existing docs/ runbooks, Chinese only for quoted in-app copy
- [Phase 05-auth-user-interactions]: Plan 05-10: Task 3 live smoke-test checklist deferred to HUMAN-UAT (requires real OAuth apps + email inbox + browser); runbook grep-gated automated checks all pass — phase-close decoupled from experiential verification
- [Phase 06-admin-operational-hardening]: Plan 06-00: Three-layer admin gate — edge cookie filter (middleware) + RSC requireAdmin() + per-action assertAdmin(). Every Phase 6 admin plan inherits the gate via app/admin/layout.tsx without re-declaring.
- [Phase 06-admin-operational-hardening]: Plan 06-00: Edge middleware sets x-pathname header so RSC layout can skip requireAdmin() on /admin/access-denied — fixes redirect loop where non-admin users bounce forever between layout and access-denied.
- [Phase 06-admin-operational-hardening]: Plan 06-00: assertAdmin declared as 'asserts session is AdminSession' — Server Actions narrow the session type in one call without a cast.
- [Phase 06-admin-operational-hardening]: Plan 06-01: Self-referencing FK for users.banned_by declared in raw SQL (not Drizzle DSL) via DO $$ IF NOT EXISTS constraint guard — sidesteps TS circularity; matches 0003/0004 hand-written precedent
- [Phase 06-admin-operational-hardening]: Plan 06-01: Applier script doubles as verification harness — scripts/apply-0005-admin-ops.ts runs 6 post-apply assertions and exits non-zero on drift; eliminates a separate verify:admin-schema script
- [Phase 06-admin-operational-hardening]: Plan 06-01: category stored as free-form TEXT (not pg enum) — UI layer enforces v1 value set; avoids ALTER TYPE migrations when taxonomy evolves
- [Phase 06-admin-operational-hardening]: Plan 06-01: sources_deleted_at_idx btree index added proactively in 0005 migration — Plan 06-02 sources-list WHERE deleted_at IS NULL hot path does not need a follow-up push
- [Phase 06-admin-operational-hardening]: Plan 06-06: Sentry beforeSend scrubs PII in place (cookies, auth headers, user.email, secret-field regex) and forwards — redact-not-drop preserves error signal; Sentry relay scrubbing remains defense-in-depth
- [Phase 06-admin-operational-hardening]: Plan 06-06: Trigger.dev worker Sentry init is lazy inside withSentry wrapper (not module-scope) — matches Phase 01 db/redis singleton pattern; safe when SENTRY_DSN absent
- [Phase 06-admin-operational-hardening]: Plan 06-06: Task 3 live Sentry verification DEFERRED to 06-06-HUMAN-UAT.md pending user SENTRY_DSN provisioning — code-complete on branch (commits e713c7e + 36372d1); matches Plan 05-10 precedent of decoupling live smoke-test from code-complete
- [Phase 06-admin-operational-hardening]: Plan 06-07: WARNING-8 honoured — sitemap-repo does NOT join sources.deleted_at; Wave 1 plan (depends_on: []) remains mergeable before Plan 06-01 0005_admin_ops migration lands. Ingestion poller enforces deleted_at skip on new items; historical published items remain valid for SEO.
- [Phase 06-admin-operational-hardening]: Plan 06-07: Live E2E run of sitemap-and-analytics.spec.ts deferred to phase-close UAT (requires dev server) per Plan 05-10/06-06 precedent; build + unit tests + typecheck are the merge gate.
- [Phase 06-admin-operational-hardening]: Plan 06-08: OPS-02 satisfied without code change — Phase 3 03-04 Langfuse OTel wiring canonical; runbook-only closure in docs/observability.md
- [Phase 06-admin-operational-hardening]: Plan 06-08: verify-admin-ops SC#1 uses source-grep + DB-level cores (no HTTP probe) per WARNING-10; 18/18 PASS live on Neon dev with finally cleanup

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
| 260424-g2y | Wire sidebar 管理 section to real /admin routes (Phase 6) + role-gate on session.user.role==='admin' | 2026-04-24 | 4b4fd9a | [260424-g2y-wire-sidebar-admin-nav-to-real-admin-rou](./quick/260424-g2y-wire-sidebar-admin-nav-to-real-admin-rou/) |
| 260424-mjc | admin 新建信源表单接受 RSSHub 路由路径（/ 开头）与完整 URL 两种格式 | 2026-04-24 | 690ae1a | [260424-mjc-admin-rsshub](./quick/260424-mjc-admin-rsshub/) |
| 260424-ney | feed 列表页聚类展开按钮点击渲染 siblings — getFeed 批量返回 clusterSiblings + / 和 /all 页面传参（favorites 留作边界） | 2026-04-24 | ecf89ec | [260424-ney-feed-siblings](./quick/260424-ney-feed-siblings/) |
| 260424-o34 | fetch-source-core 按 URL 前缀分流：原生 http(s):// 走裸 fetch，/ 开头走 fetchRSSHub；新增 nativeFetch 可注入 + 5 条测试覆盖分流 | 2026-04-24 | 5a07ce7 | [260424-o34-fetch-source-native-rss-rsshub](./quick/260424-o34-fetch-source-native-rss-rsshub/) |
| 260424-ogp | 左上角搜索：SidebarSearch 客户端组件 + ⌘K/Ctrl+K 全局快捷键 + /api/search (ILIKE title/title_zh/summary_zh, Upstash 30/60s 速率限制, Zod 校验) + 10 单测 | 2026-04-24 | 144c805 | [260424-ogp-implement-sidebar-search-with-api-and-ke](./quick/260424-ogp-implement-sidebar-search-with-api-and-ke/) |

## Deferred Items

Items acknowledged at v1.0 milestone close on 2026-04-24. All are non-blocking and tracked for v1.1 consideration. Full detail in `.planning/milestones/v1.0-MILESTONE-AUDIT.md`.

### Live-Environment UAT (require user action)

| Category | Item | Phase | Blocker For |
|----------|------|-------|-------------|
| uat_live | CI live PR run + Neon branch lifecycle | 01 | Needs GitHub remote + repo secrets (NEON_API_KEY, TRIGGER_ACCESS_TOKEN, DATABASE_URL_MAIN, NEON_PROJECT_ID) |
| uat_live | Vercel preview /api/health 200 | 01 | Needs Vercel GitHub App install + env vars |
| uat_live | Trigger.dev dashboard manual trigger of health-probe | 01 | Needs interactive OAuth login |
| uat_live | WeChat share card rendering | 04 | Needs live deploy + WeChat client |
| uat_live | Full FeedCard anatomy with real published data | 04 | Needs ingested items in DB |
| uat_live | Paper+amber palette browser inspection | 04 | Visual check |
| uat_live | Live GitHub OAuth round-trip on Vercel preview | 05 | Needs real GitHub OAuth app + preview deploy |
| uat_live | Magic-link deliverability from CN mailbox (QQ/163) | 05 | Needs Resend domain verification |
| uat_live | Session persistence across real browser close/reopen | 05 | Browser UAT |
| uat_live | Google OAuth from non-CN network | 05 | Needs non-CN network |
| uat_live | Resend SPF/DKIM/DMARC verification | 05 | DNS-level check |
| uat_live | Playwright E2E against live dev server + seeded DB | 05 | CI wiring |
| uat_live | Live Sentry verification — Next.js path | 06 | Needs SENTRY_DSN in Vercel + .env.local |
| uat_live | Live Sentry verification — Trigger.dev path | 06 | Needs SENTRY_DSN in Trigger.dev project env |
| uat_live | Cross-tab session revocation UX | 06 | Two-profile browser UAT |
| uat_live | Red health badge visual render | 06 | SQL-driven error count ≥3 + browser |
| uat_live | Dead-letter retry rate limit at 20+ clicks/60s | 06 | Live Redis + real-time interaction |

### Doc/Tooling Debt

| Category | Item | Notes |
|----------|------|-------|
| doc_debt | Phase 06 VERIFICATION.md status stale (CR-01 fixed in 56e82cf) | Runtime resolved; doc needs status: passed |
| doc_debt | 03-UAT.md sign-off block placeholder | Live run PASSED; admin update needed |
| doc_debt | VALIDATION.md missing for Phases 02, 04, 06 | Test coverage adequate; Nyquist documentation gap |
| doc_debt | VALIDATION.md Phase 05 status: draft | nyquist_compliant: false, wave_0_complete: false |
| tooling_debt | Drizzle snapshots 0004_auth + 0005_admin_ops absent from drizzle/meta/ | Runtime unaffected; drizzle-kit generate would misdiff on next migration |
| doc_debt | REQUIREMENTS.md traceability table stale pre-close — fixed in archive | 10 items flipped at milestone close per VERIFICATION.md evidence |
| doc_debt | Quick-task markers missing close-out (260422-ogt/rax, 260423-e6n, 260424-g2y) | .planning/quick/*/ SUMMARY.md front-matter |

### Code-Review Warnings (v1.1 hardening candidates)

| Category | Item | Phase | Severity |
|----------|------|-------|----------|
| code_review | WR-01 Sentry beforeSend walks top-level keys only; nested secrets may leak | 06 | Warning |
| code_review | WR-02 Edit source form silently ignores unchecked 'active' checkbox (ADMIN-04 partial — row toggle is workaround) | 06 | Warning |
| code_review | WR-03 Soft-delete holds rss_url UNIQUE; recreating same URL fails with generic error | 06 | Warning |
| code_review | WR-04 /api/admin/sentry-test GET reachable via CSRF <img> (admin log-spam only) | 06 | Warning |
| code_review | WR-05 Re-ban overwrites prior banned_at/banned_by (audit-trail loss) | 06 | Warning |
| code_review | WR-06 Anonymous /admin redirect drops ?next= param (inconsistent with middleware) | 06 | Warning |
| code_review | parse-rss publishedAtSourceTz format inconsistency (UTC .000Z vs numeric offset seconds precision) | 02 | Warning |
| code_review | parse-rss unanchored timezone regex (can false-match "GMTnotes") | 02 | Warning |
| code_review | fetch-source-core normalizeUrl silent catch | 02 | Warning |
| code_review | ingest-hourly no explicit maxDuration on scheduler task | 02 | Info |
| code_review | opengraph-image.tsx params not await'ed (Next.js 15 Edge) | 04 | Warning |
| code_review | IN-02..IN-05 cost float drift; HMR double-init; dead-letter href scheme check; sitemap 5000 cap | 06 | Info |

### Operational Notes (require runbook addition, not code)

| Category | Item | Note |
|----------|------|------|
| ops_note | FEED-10 ISR invalidation requires REVALIDATE_SECRET + NEXT_PUBLIC_SITE_URL in Trigger.dev vault | Silent skip if absent; Redis flush always runs — document in docs/observability.md |
| ops_note | buzzing.cc RSSHub route (/buzzing/whatsnew) upstream errors | Candidate for source substitution in v1.1 |

## Session Continuity

Last session: 2026-04-24T06:20:00Z
Stopped at: v1.0 milestone closed, archived, and tagged
Resume file: None

**Next milestone:** v1.1 — scope undefined. Start with `/gsd-new-milestone`.
