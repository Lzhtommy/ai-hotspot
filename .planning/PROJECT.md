# AI Hotspot

## What This Is

A public-facing Chinese-language timeline that aggregates AI news from across the internet — official lab blogs (Anthropic/OpenAI/DeepMind), Hacker News, Chinese sources (公众号/微博/buzzing.cc), all ingested via self-hosted RSSHub. Claude Haiku 4.5 scores each item's hotness, summarizes in Chinese, writes a one-line 推荐理由, and clusters duplicate events across sources ("另有 N 个源也报道了此事件"). Voyage `voyage-3.5` embeddings drive pgvector-based cluster assignment. Feed renders timeline-first (not chronological) with a paper+amber light theme per the v1.0 design iteration (D-02 supersedes the original dark/green anchor).

## Core Value

**A single Chinese-language timeline where AI practitioners never miss a significant AI event, because the system hears it from every source, clusters duplicates, and ranks by LLM-judged importance — not chronology.**

Validated at v1.0 ship — core loop (ingest → enrich → cluster → rank → render) works end-to-end against real Anthropic + Voyage + Neon live infrastructure.

## Current State (v1.0 — shipped 2026-04-24)

- **Deployed**: Pending user wiring (Vercel app install + OAuth app creation + Sentry DSN + Trigger.dev vault env). Code-complete on `master`; see `.planning/MILESTONES.md` and `docs/auth-providers.md` §6 for the activation checklist.
- **Stack**: Next.js 15 (App Router) + TypeScript strict + Tailwind v4; Neon Postgres + Drizzle ORM + pgvector 0.8; Trigger.dev v4; Upstash Redis; Auth.js v5 (GitHub + Resend + Google); Anthropic Haiku 4.5; Voyage `voyage-3.5`; Langfuse + Sentry; RSSHub on HF Space.
- **Code**: ~21.8K LOC across 148 source files, 6 Drizzle migrations, 42 plans delivered across 6 phases in 7 days (294 commits).
- **Testing**: 178+ unit tests (Vitest), 4 Playwright E2E specs (chromium + webkit), live verification harnesses per phase (`pnpm verify:ingest`, `verify:llm`, `verify:admin-ops`).
- **Known gaps**: ADMIN-04 edit-form checkbox UX quirk (row-level toggle is workaround); 10+ live-environment UAT items deferred pending user provisioning; Phase 06 has 6 warning-level code-review items open for v1.1 hardening.

## Requirements

### Validated (v1.0 — shipped)

<!-- Shipped and confirmed valuable at v1.0. Full list in .planning/milestones/v1.0-REQUIREMENTS.md -->

- ✓ **INFRA-01..08** (8) — Infrastructure foundation — v1.0
- ✓ **INGEST-01..08** (8) — Hourly ingestion pipeline with dedup + isolation — v1.0
- ✓ **LLM-01..13** (13) — Claude Haiku pipeline with prompt caching + dead-letter — v1.0
- ✓ **CLUST-01..07** (7) — pgvector HNSW + threshold clustering — v1.0
- ✓ **FEED-01..12** (12) — Feed UI including 精选 + /all + /items/[id] + OG + filters — v1.0
- ✓ **AUTH-01..08** (8) — Auth.js v5 with GitHub + Resend + Google + preview-proxy — v1.0
- ✓ **FAV-01..03** (3) — Favorite + unfavorite + /favorites page — v1.0
- ✓ **VOTE-01..04** (4) — Like/dislike with honest-copy + login-gate — v1.0
- ✓ **ADMIN-01..03, 05..09** (8) — Admin backend for sources + users + costs + dead-letter — v1.0
- ✓ **OPS-01..05** (5) — Sentry + Langfuse + sitemap + Vercel Analytics + Langfuse dashboard — v1.0
- ⚠ **ADMIN-04** — Edit source weight/name/active — v1.0 (partial: WR-02 form-checkbox quirk, row-level toggle workaround)

### Active (v1.1 — next milestone)

<!-- Current scope for the next shipped increment. Populate via /gsd-new-milestone. -->

(None defined yet — run `/gsd-new-milestone` to scope v1.1.)

### Out of Scope

<!-- Explicit v1 boundaries with reasoning. Revisit at v1.1 scoping. -->

- **低粉爆文 section** — v2; needs social-platform engagement APIs beyond RSSHub and separate ranking logic
- **User-custom curation strategies** — v1 is admin-managed global strategies only; per-user prompts add complexity without proven demand
- **信源提报 (user-submitted source reporting)** — v2; requires moderation workflow and abuse protection
- **策略迭代 tooling** — offline/manual in v1; formal A/B and iteration UI is a v2 concern
- **Multi-language UI (English toggle)** — Chinese-only ships v1; English UI is v2
- **Mobile native apps** — responsive web only
- **Monetization (ads, subscriptions)** — validate the product first
- **Real-time (<5 min) ingestion** — hourly polling sufficient; lower cost
- **Mainland-China-hosted infrastructure** — triggers ICP 备案; HK/SG avoids this
- **Google Fonts / Google Analytics** — blocked by GFW for mainland CN users
- **WeChat OAuth in v1** — requires Chinese business entity + ICP; deferred
- **Comments / threaded discussion** — moderation burden; not core to "never miss AI news"
- **Video posts/items** — not aligned with text-news aggregation
- **Prisma ORM / Inngest / self-hosted Next.js** — stack rejected in favor of Drizzle + Trigger.dev + Vercel

## Context

- **Reference design** (D-02 override): v1.0 ships paper+amber light theme, not the original dark/green anchor. CJK reading ergonomics + contrast were the driver.
- **Why RSSHub**: normalizes Twitter/微博/公众号/forums into uniform RSS; adding sources is config not code. Self-hosted because RSSHub's model precludes Vercel. Currently HF Space (`lurnings-rsshub.hf.space`) — adequate for v1, candidate for Railway/Hetzner migration.
- **Why LLM-heavy**: AI news volume is high and noisy; rules-based filtering fails at "what matters" — Haiku-judged hotness + embedding clustering is the product's differentiator.
- **Event clustering is the signal**: a story covered by N sources is an important story. Cluster count doubles as implicit popularity layered on Haiku hotness.
- **Prompt caching is load-bearing** (LLM-08): ~60% cost reduction verified via `cache_read_input_tokens > 0`. System prompt floored at 4096 tokens to satisfy Haiku 4.5 cache minimum.
- **Dead-letter path is load-bearing** (LLM-10, LLM-11): malformed LLM responses classified terminal (ZodError) never pollute the published feed; retry-exhausted items land in admin UI for manual action.
- **Auth.js DB sessions over JWT**: ban-revocation requires server-side session invalidation (Phase 5 D-05 Layer 1). JWT cannot be revoked mid-flight.

## Constraints

- **Tech stack**: Next.js (App Router, TypeScript) — specified by user; Drizzle + Neon + pgvector; Auth.js v5; Trigger.dev v4; Anthropic + Voyage.
- **UI language**: Chinese only in v1.
- **LLM provider**: Claude Haiku 4.5 for scoring/summary/translation/推荐理由/tags; Sonnet reserved for grey-zone cluster decisions (0.80–0.88 similarity) but not yet wired.
- **Hosting**: Vercel for Next.js + managed services (Neon, Upstash, Trigger.dev, Langfuse, Sentry). Self-hosted RSSHub.
- **Ingestion cadence**: hourly polling (not real-time), balancing freshness and LLM cost.
- **PIPL**: user PII stays out of US-locked vendors — Auth.js over Clerk, Langfuse (self-hostable) over Helicone proxy.

## Key Decisions

Full list in `.planning/MILESTONES.md` v1.0 entry. High-impact v1.0 decisions marked with outcomes:

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Trigger.dev v4 over Inngest/Vercel cron | No timeout; dedicated compute; step/retry/fan-out | ✓ Good — hourly pipeline robust |
| Voyage `voyage-3.5` over OpenAI embedding | Stronger multilingual CN+EN, 1024-dim | ✓ Good — cluster PASS cross-source |
| Neon + Drizzle over Supabase/Prisma | Edge HTTP driver; pgvector native; branching for CI | ✓ Good — 500ms cold starts |
| Paper+amber light theme (D-02) | CJK contrast + reading ergonomics over original dark/green anchor | ✓ Good — supersedes FEED-06 wording |
| Auth.js v5 over Clerk | PII data residency; no per-MAU; Chinese-first UI | ✓ Good — PIPL-compatible |
| Haiku 4.5 over Sonnet for scoring | Classification + CN generation quality sufficient; 3× cheaper | ✓ Good — caching cuts cost further |
| Langfuse over Helicone | No proxy hop; OTel-native; self-hostable | ✓ Good — per-item cost visible |
| GitHub OAuth + Resend magic-link as primary | GFW accessibility; WeChat requires CN business entity | ✓ Good — CN-accessible flows |
| DB sessions over JWT | Needed for ban revocation (D-05 Layer 1) | ✓ Good — `banUserCore` atomic |
| 3-layer admin gate (edge + RSC + action) | Defense-in-depth beats any single-layer bypass | ✓ Good — harness PASS on all layers |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Next Milestone Goals (v1.1)

Scope definition pending `/gsd-new-milestone`. Candidate themes from v1.0 audit deferred items + v2 backlog:

1. **Live-environment UAT closure** — work through STATE.md Deferred Items once user has provisioned GitHub OAuth app, Vercel deploy, Sentry DSN, etc.
2. **Phase 06 code-review hardening** — WR-01..06 (Sentry nested-key PII scrub, edit-form checkbox handling, soft-delete UNIQUE collision hint, sentry-test CSRF, ban audit trail, `?next=` param preservation).
3. **Drizzle tooling cleanup** — regenerate 0004 + 0005 snapshots for correct `drizzle-kit generate` diffs on the next migration.
4. **Nyquist doc gap closure** — VALIDATION.md for phases 02/04/06 (or explicit deferral decision).
5. **v2 candidates eligible for v1.1** — STRAT-01 (admin curation strategies), SEARCH-01 (Chinese full-text), SOCIAL-01 (低粉爆文).

Start with `/gsd-new-milestone` — requirements definition → research → roadmap.

---
*Last updated: 2026-04-24 after v1.0 milestone*
