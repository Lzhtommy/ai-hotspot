# Roadmap: AI Hotspot

## Overview

Six phases deliver a complete Chinese-language AI news aggregator: provisioned infrastructure leads into an ingestion pipeline, which feeds a full LLM processing and clustering layer, which provides enriched items to the feed UI, which gains user auth and interactions, and finally an admin backend and operational tooling closes the loop for sustainable production operation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure Foundation** - All services provisioned and wired; project deploys to Vercel
- [ ] **Phase 2: Ingestion Pipeline** - Hourly RSSHub polling deduplicates and enqueues items reliably
- [ ] **Phase 3: LLM Pipeline + Clustering** - Every item receives translation, summary, score, tags, 推荐理由, and cluster assignment
- [ ] **Phase 4: Feed UI** - Public timeline (精选 + 全部 AI 动态) renders enriched items with dark-theme design
- [ ] **Phase 5: Auth + User Interactions** - Users can log in and save or vote on items
- [ ] **Phase 6: Admin + Operational Hardening** - Admin manages sources and users; errors, costs, and dead-letters are visible

## Phase Details

### Phase 1: Infrastructure Foundation
**Goal**: All services are provisioned, connected, and the Next.js app deploys to Vercel with a verified CI pipeline
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08
**Success Criteria** (what must be TRUE):
  1. Running `git push` to main triggers a Vercel build that passes typecheck and runs Drizzle migrations on the preview environment
  2. Neon Postgres is reachable from the app with pgvector enabled and all schema tables created (sources, items, clusters, item_clusters, tags, item_tags, users, favorites, votes, settings, pipeline_runs)
  3. A Trigger.dev task can be triggered manually and succeeds without timeout errors
  4. RSSHub is reachable at its VPS URL with ACCESS_KEY auth and returns a valid RSS feed for at least one configured route
  5. Upstash Redis ping returns OK from a Vercel edge function
**Plans:** 6 plans
- [x] 01-01-PLAN.md — Repo bootstrap: Next.js 15 + pnpm scaffold, husky + pre-commit UUID hook, .env.example canonical registry
- [x] 01-02-PLAN.md — Drizzle + Neon + pgvector: 11-table schema, 0000 extension migration, [BLOCKING] drizzle-kit migrate to live Neon dev branch
- [x] 01-03-PLAN.md — Trigger.dev v4 + Upstash Redis: trigger.config.ts, health-probe task (dashboard manual-trigger checkpoint), Redis client singleton
- [x] 01-04-PLAN.md — RSSHub wrapper + /api/health: fetchRSSHub with warmup + 60s timeout, /api/health Node-runtime route aggregating 4 service checks
- [x] 01-05-PLAN.md — CI pipeline: GitHub Actions (typecheck/lint/build/migrate with Neon branch-per-PR), Trigger.dev deploy job, PR preview verification checkpoint
- [x] 01-06-PLAN.md — Docs & runbooks: README + docs/rsshub.md (key rotation runbook), docs/health.md, docs/ci.md, docs/vercel.md, docs/database.md

### Phase 2: Ingestion Pipeline
**Goal**: Hourly polling fetches all active sources via RSSHub, deduplicates by normalized URL fingerprint, and enqueues new items for LLM processing without data loss or cross-source interference
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06, INGEST-07, INGEST-08
**Success Criteria** (what must be TRUE):
  1. After two consecutive hourly cron runs, zero duplicate items exist in the database (idempotency verified)
  2. Intentionally breaking one source's RSSHub route does not prevent the remaining sources from being polled and enqueued
  3. Each source row in the database reflects accurate last_fetched_at, consecutive_empty_count, and consecutive_error_count after the poll
  4. All item timestamps in the database are stored as UTC regardless of source-local timezone
**Plans:** 5 plans
- [x] 02-01-PLAN.md — Schema migration: add items.published_at_source_tz TEXT NULL, generate 0002 migration, push to live Neon dev branch
- [x] 02-02-PLAN.md — Ingest utilities: normalizeUrl (D-04), fingerprint (SHA-256), parseRSS (rss-parser wrapper); Vitest unit tests
- [x] 02-03-PLAN.md — Trigger.dev v4 tasks: ingest-hourly (schedules.task cron) + fetch-source (task maxDuration=90) + runFetchSource core orchestrator with D-08 counter semantics
- [x] 02-04-PLAN.md — Canary source seed: drizzle/seed-sources.ts with 3 RSSHub routes, idempotent ON CONFLICT, pnpm db:seed alias
- [x] 02-05-PLAN.md — Verification harness: scripts/verify-ingest.ts asserts all 4 Phase 2 success criteria programmatically; UAT checkpoint

### Phase 3: LLM Pipeline + Clustering
**Goal**: Every published item has a Chinese summary, 0-100 hotness score, 推荐理由, auto-tags, and a cluster assignment; prompt caching is active; all failures land in dead-letter state rather than being dropped
**Depends on**: Phase 2
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, LLM-07, LLM-08, LLM-09, LLM-10, LLM-11, LLM-12, LLM-13, CLUST-01, CLUST-02, CLUST-03, CLUST-04, CLUST-05, CLUST-06, CLUST-07
**Success Criteria** (what must be TRUE):
  1. A newly ingested English-source item appears in the database with a Chinese title, Chinese summary, hotness score between 0 and 100, a non-empty 推荐理由, and at least one tag — all produced by Claude Haiku
  2. The pipeline_runs table shows cache_read_input_tokens > 0 for at least one processed item, confirming prompt caching is active
  3. An item whose LLM response is malformed (missing score or required fields) transitions to dead-letter state and is never written to the published feed
  4. Two items from different sources covering the same event are assigned to the same cluster, and the cluster's member_count increments correctly
  5. Langfuse shows a trace per item with cost breakdown visible in the dashboard
**Plans:** 5 plans
- [ ] 03-01-PLAN.md — HNSW index migration + settings threshold seed + env registry + check:hnsw assertion script (hard gate; [BLOCKING] schema push)
- [ ] 03-02-PLAN.md — LLM core library: client, schema, prompt (cached ≥4096 tokens + untrusted_content), extract (SSRF-guarded Readability), enrich (Haiku 4.5 structured output), embed (Voyage 1024-dim), pricing, process-item-core orchestrator
- [ ] 03-03-PLAN.md — Cluster library: threshold (settings-backed + 0.82 default), join-or-create (pgvector <=> + ±24h + transactional), refresh (member_count + primary + earliest/latest + centroid + buildDebounceOpts)
- [ ] 03-04-PLAN.md — Trigger.dev v4 tasks: process-pending (cron */5 + FOR UPDATE SKIP LOCKED + fan-out), process-item (OTel flush), refresh-clusters (debounce-invoked); Langfuse OTel bootstrap
- [ ] 03-05-PLAN.md — Live verification harness scripts/verify-llm.ts + 03-UAT.md human checklist (asserts all 5 ROADMAP SCs)
**UI hint**: no

### Phase 4: Feed UI
**Goal**: Anonymous users can read the full timeline on both the 精选 and 全部 AI 动态 views, see per-item detail pages, and share items to WeChat with correct OG cards
**Depends on**: Phase 3
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06, FEED-07, FEED-08, FEED-09, FEED-10, FEED-11, FEED-12
**Success Criteria** (what must be TRUE):
  1. The / (精选) page loads for an anonymous user showing top-scored items grouped by time with source badge, Chinese summary, hotness score, 推荐理由, tags, and cluster count badge when applicable
  2. The /all page shows a full chronological feed with source and tag filter controls and pagination or infinite scroll
  3. An item detail page at /items/[id] shows the full summary, all cluster member sources with links, and the original article link; pasting the URL into WeChat renders a share card with og:title and og:description
  4. The layout renders correctly on a 375px-wide mobile viewport and on desktop, using the dark theme with green accent
  5. CJK text is displayed using self-hosted Noto Sans SC fonts without any request to fonts.googleapis.com
**Plans**: TBD
**UI hint**: yes

### Phase 5: Auth + User Interactions
**Goal**: Users can create accounts via GitHub OAuth or email magic link, stay logged in across sessions, and favorite or vote on items; anonymous users are prompted to sign in when they attempt an interaction
**Depends on**: Phase 4
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, FAV-01, FAV-02, FAV-03, VOTE-01, VOTE-02, VOTE-03, VOTE-04
**Success Criteria** (what must be TRUE):
  1. A user can log in with GitHub OAuth on both the production URL and a Vercel preview URL without callback errors
  2. A user can log in via email magic link (Resend) from a mainland-China-accessible email address and stay logged in after closing and reopening the browser
  3. An anonymous user clicking the favorite or like button sees a sign-in modal rather than an error
  4. An authenticated user can favorite an item and see it appear immediately in the /favorites page in reverse-chronological order; unfavoriting removes it
  5. An authenticated user can like or dislike an item; the UI reflects the action immediately and includes copy indicating personalization is forthcoming
**Plans**: TBD
**UI hint**: yes

### Phase 6: Admin + Operational Hardening
**Goal**: An admin can manage all sources and users from a protected backend, view daily LLM costs, retry failed pipeline items, and the system emits errors to Sentry and page views to Vercel Analytics
**Depends on**: Phase 5
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08, ADMIN-09, OPS-01, OPS-02, OPS-03, OPS-04, OPS-05
**Success Criteria** (what must be TRUE):
  1. A non-admin user navigating to /admin is redirected; an admin user can view the 信源 list with name, URL, weight, active toggle, last-fetched, and consecutive-error count
  2. An admin can create, edit weight/name/active-state, and soft-delete a source; a source with consecutive_empty_count >= 3 shows a red health indicator
  3. An admin can view the user list, ban a user (which revokes their session), and see the daily Claude token cost breakdown from the pipeline_runs table
  4. A deliberate runtime error in a Trigger.dev task appears in the Sentry dashboard within minutes
  5. Dead-letter items are visible in the admin UI with a retry button that re-enqueues them through the LLM pipeline; sitemap.xml is publicly accessible and contains published item URLs
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Foundation | 0/6 | Planned | - |
| 2. Ingestion Pipeline | 0/TBD | Not started | - |
| 3. LLM Pipeline + Clustering | 0/5 | Planned | - |
| 4. Feed UI | 0/TBD | Not started | - |
| 5. Auth + User Interactions | 0/TBD | Not started | - |
| 6. Admin + Operational Hardening | 0/TBD | Not started | - |
