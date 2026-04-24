# Milestones

## v1.0 MVP — Shipped 2026-04-24

**Phases:** 6 (Infrastructure → Ingestion → LLM+Clustering → Feed UI → Auth+Interactions → Admin+Ops)
**Plans:** 42
**Tasks:** ~95
**Requirements:** 74/75 satisfied (98.7%); 1 partial (ADMIN-04 — form-checkbox UX quirk, row-level toggle workaround)
**Timeline:** 2026-04-17 → 2026-04-24 (7 calendar days)
**Commits:** 294 on master
**Code:** ~21.8K LOC TypeScript/TSX/SQL across 148 source files + 6 Drizzle migrations

### Delivered

A single Chinese-language timeline where AI practitioners never miss a significant AI event — the system hears it from every source (Anthropic/OpenAI/DeepMind blogs, Hacker News, RSSHub-normalized feeds), clusters duplicates across sources, and ranks by Claude Haiku 4.5 LLM-judged importance rather than chronology.

### Key Accomplishments

1. **Infrastructure foundation** — Next.js 15 App Router on pnpm with TypeScript strict, Tailwind v4, ESLint 9 flat config; 11-table Neon Postgres schema with pgvector 0.8.0; Upstash Redis + Trigger.dev v4 + self-hosted RSSHub; CI with Neon branch-per-PR + `drizzle migrate` + trigger deploy.

2. **Hourly ingestion pipeline** — Trigger.dev scheduled task fans out to per-source `fetchSource` children (isolation via per-child run), SHA-256 fingerprint dedup, D-08 consecutive-empty/error counters, UTC + source-tz dual timestamp. Live verification harness (`pnpm verify:ingest`) asserts all 4 success criteria against real Neon + RSSHub.

3. **LLM enrichment + clustering** — Claude Haiku 4.5 produces Chinese translation + summary + 0-100 hotness score + 推荐理由 + tags; prompt caching active (verified `cache_read_tokens > 0`); Voyage `voyage-3.5` 1024-dim embeddings stored in pgvector with HNSW index; cluster assignment via `<=>` cosine within ±24h window; debounced bulk refresh. Langfuse OTel traces per item with cost breakdown. Dead-letter path for malformed responses.

4. **Paper+amber feed UI** — `/` (精选, ISR 300), `/all` (with nuqs filters, ISR 300), `/items/[id]` (ISR 3600 + Edge runtime `opengraph-image` with self-hosted Noto Sans SC). FEED-08 achieved: no `fonts.googleapis.com` requests anywhere. 178 unit tests + Playwright E2E (chromium + webkit). 8-step FeedCard anatomy with optimistic interactions.

5. **Auth + favorites + votes** — Auth.js v5 + Drizzle adapter + DB sessions. GitHub OAuth (primary) + Resend magic-link (Chinese copy) + Google OAuth (secondary). Two-layer ban enforcement (session callback + Server Action re-check). UserChip 3-state render. `/favorites` auth-gated RSC with reverse-chrono query. 4 Playwright E2E specs.

6. **Admin backend + operational hardening** — 3-layer admin gate (edge cookie filter + RSC `requireAdmin` + Server Action `assertAdmin`). Source CRUD + soft-delete + red health badge at error≥3. User list + atomic ban (transactional `UPDATE users + DELETE sessions`). Daily LLM cost dashboard from `pipeline_runs`. Dead-letter retry (single + bulk, CR-01 fixed via `inArray()`). Sentry wired Next.js + Trigger.dev with beforeSend PII scrub. Sitemap.xml + robots.ts + Vercel Analytics.

### Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Trigger.dev v4 over Inngest/Vercel cron | No 5-min timeout; dedicated compute; step/retry/fan-out primitives | ✓ Good — hourly pipeline robust, dead-letter path exercised |
| Voyage AI `voyage-3.5` over OpenAI embedding | Stronger multilingual (CN+EN), 1024-dim | ✓ Good — SC#4 cluster PASS across cross-source same-event |
| Neon + Drizzle ORM over Supabase/Prisma | Edge-compatible HTTP driver, no cold-start penalty, pgvector native | ✓ Good — 500ms cold starts, branching for CI |
| Paper+amber light theme (D-02 override of dark/green anchor) | Chinese-news-aggregation benchmarks favor high-contrast reading surfaces | ✓ Good — D-02 explicitly supersedes FEED-06 wording |
| Auth.js v5 over Clerk | User PII data residency (no US lock-in); $0 per-MAU | ✓ Good — PIPL-compatible, customizable Chinese UI |
| Haiku 4.5 over Sonnet for scoring/summary | Sufficient quality for classification + CN generation; 3x cheaper | ✓ Good — prompt caching cuts cost further |
| Langfuse self-hostable observability over Helicone | No proxy hop; richer trace hierarchy; OTel-native | ✓ Good — visible per-item cost in dashboard |
| GitHub OAuth + Resend magic-link as primary auth | GFW accessibility; WeChat OAuth deferred (requires Chinese business entity) | ✓ Good — China-accessible flows work |

### Known Deferred Items

Detailed list in `.planning/STATE.md` under `## Deferred Items`. Headline summary:

**Live-environment UAT** (require user action): CI live PR run, Vercel preview `/api/health`, Trigger.dev dashboard trigger, WeChat share card, live GitHub/Google OAuth round-trip, Resend deliverability from CN mailbox, live Sentry verification × 2 paths, cross-tab session revocation, red health badge visual check.

**Doc/tooling debt:** Drizzle snapshots 0004+0005 missing from `drizzle/meta/` (runtime unaffected); VALIDATION.md missing on phases 02/04/06 (Nyquist doc gap); Phase 06 VERIFICATION.md stale on CR-01 (fix landed post-verification in 56e82cf).

**Code warnings** (non-blockers): Phase 06 WR-01..06, Phase 02 parser quality notes, Phase 04 `opengraph-image.tsx` params.

### Quick Tasks Completed

| # | Description | Commit |
|---|-------------|--------|
| 260422-ogt | Trigger.dev deploy ENOENT for markdown prompts — `additionalFiles` build extension | 523dc77 |
| 260422-rax | Trigger.dev ingest-hourly Neon WebSocket incompat on Node 22 | fdd0719 |
| 260423-e6n | enrich.ts expose real Anthropic error detail in EnrichError without leaking keys | a2afa86 |
| 260424-g2y | Wire sidebar 管理 section to real /admin routes + role-gate | 4b4fd9a, 5b03c13 |

### Archive

- **Roadmap:** [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- **Requirements:** [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- **Audit:** [.planning/milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

Git tag: `v1.0`

---
